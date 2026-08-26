//=============================================================================
// CheatEngine_Core.js
//=============================================================================
/*:
 * @plugindesc [Cheat Engine] Core v1.5.0 - Pure-logic cheat engine core for RPG Maker MV/MZ (no UI).
 * @author rpghack
 * @url
 *
 * @param persistCheatStateOnLoad
 * @text Persist Cheat State On Load
 * @type boolean
 * @on Persist
 * @off Reset
 * @default false
 * @desc If ON, cheat flags (speed, God Mode, etc.) are saved into the save file and restored on load.
 * If OFF, they are always safely reset to default right after loading.
 *
 * @help
 * CheatEngine_Core.js
 * -----------------------------------------------------------------------------
 * A pure-logic cheat engine core for RPG Maker MV / MZ. Draws no Window/Scene
 * of its own; exposes the global objects window.RpgBridge / window.CheatManager
 * for a UI plugin (e.g. CheatEngine_UI.js) or your own scripts to call.
 *
 * Installation:
 *   - Separate-file install: place this file ABOVE CheatEngine_UI.js (or any
 *     other consumer) in the Plugin Manager list, and enable both.
 *   - Single-file (combined) install: this file's body may be concatenated
 *     with CheatEngine_UI.js's body into one .js file. Both halves resolve
 *     their own plugin name from the currently executing <script> tag
 *     (document.currentScript), so parameter lookup keeps working either way;
 *     if the combined file's header doesn't carry BOTH plugins' @param blocks,
 *     each half simply falls back to its documented defaults.
 *
 * Data validation:
 *   - All public setters (gold, game speed, move speed, stat multiplier, item
 *     quantity lock, number variable, ...) reject non-finite input and clamp
 *     to a safe range (e.g. gold is clamped to $gameParty.maxGold()) so a bad
 *     value from a UI or script call can never corrupt game state.
 *
 * Save/Load behavior:
 *   - Controlled by the "Persist Cheat State On Load" parameter above.
 *   - Starting a brand new game always resets cheat state, regardless of the
 *     parameter (there is nothing to restore).
 *
 * Party-wide toggles:
 *   - Party God Mode (setPartyGodMode/isPartyGodMode): locks every actor's
 *     HP/MP/TP to maximum at all times, independent of per-member God Mode.
 *   - Infinite Items (setInfiniteItems/isInfiniteItems): no consumable item's
 *     held quantity is ever reduced, independent of the per-item lock.
 *   - Instant Kill (setInstantKillMode/isInstantKillMode): any action an
 *     actor applies to an enemy kills it outright, regardless of damage
 *     formula, guard, or elemental rate.
 *
 * Fast Message Skip also speeds up more than just text:
 *   - Map: while an event is auto-running, characters walk faster, route
 *     moves finish sooner, and screen tints/fades play back faster.
 *   - Battle: while battle isn't waiting on the player (no actor/target/
 *     skill/item selection, no open message), action execution, enemy AI
 *     turns, damage resolution, battle log lines, screen flash/shake/tint,
 *     and animation playback all advance faster too.
 *   Both bail back to normal 1x speed the instant the player needs to make
 *   an actual choice, so this only ever accelerates auto-progressing
 *   content, never a real decision point.
 *
 * Plugin Command: none (pure script API).
 * -----------------------------------------------------------------------------
 */

var RpgBridge = RpgBridge || {};
var CheatManager = CheatManager || null;

(() => {
    "use strict";

    //-------------------------------------------------------------------
    // Dynamic plugin name resolution (supports both separate-file and
    // combined-file installs).
    // PluginManager.parameters(name) uses the file name registered in
    // plugins.js (without extension) as its key. document.currentScript
    // points to "the <script> tag currently executing", so whether this
    // file is loaded on its own or concatenated with another file, it can
    // always determine the exact file name it was actually loaded as.
    //-------------------------------------------------------------------
    function resolvePluginName(fallback) {
        const src = document.currentScript && document.currentScript.src;
        const match = src && src.match(/([^/\\]+)\.js(?:\?.*)?$/);
        return match ? match[1] : fallback;
    }
    function paramBool(params, key, defaultValue) {
        const raw = params[key];
        if (raw === undefined || raw === "") return defaultValue;
        return raw === true || raw === "true";
    }

    const PLUGIN_NAME = resolvePluginName("CheatEngine_Core");
    const PARAMS = (typeof PluginManager !== "undefined" ? PluginManager.parameters(PLUGIN_NAME) : {}) || {};
    const PERSIST_CHEAT_STATE_ON_LOAD = paramBool(PARAMS, "persistCheatStateOnLoad", false);

    // While Fast Message Skip is on and an event is auto-running on the map
    // (not while the player is choosing something -- see isWaitingForPlayerInput()
    // below), this is how many total "world simulation" updates
    // ($gameMap/$gamePlayer/$gameTimer/$gameScreen) run per real render
    // frame. The test-play Ctrl key is typically a 3x-4x speed-up, so 6x is
    // comfortably faster while still being stable (it only re-runs the map's
    // own update methods, never the full Scene_Map#update(), so it can never
    // cause input from a message/choice window to be double-processed).
    const MAP_FAST_FORWARD_MULTIPLIER = 6;

    // Same idea, but for battle: how many extra BattleManager "advance one
    // tick" calls run per real render frame while Fast Message Skip is on
    // and battle isn't waiting on the player (see _hookBattleFastForward()).
    const BATTLE_FAST_FORWARD_MULTIPLIER = 6;

    // True while the player needs to make an active choice: a choice list,
    // a number-input window, or an item-choice window is open.
    // $gameMessage.isBusy() alone stays true throughout all of these too, so
    // relying on isBusy() alone to decide "should we fast-forward?" used to
    // let the skip cheat's frame acceleration run while these windows were
    // open. Extra forced updates on top of a single real input poll made the
    // same button press get processed multiple times in one frame and caused
    // the choice UI to flicker/redraw incorrectly. Every fast-forward hook
    // below checks this first and falls back to plain, unaccelerated 1x
    // behavior whenever it's true, so the player always sees and selects
    // options normally and stably.
    function isWaitingForPlayerInput() {
        if (typeof $gameMessage === "undefined" || !$gameMessage) return false;
        return (
            (typeof $gameMessage.isChoice === "function" && $gameMessage.isChoice()) ||
            (typeof $gameMessage.isNumberInput === "function" && $gameMessage.isNumberInput()) ||
            (typeof $gameMessage.isItemChoice === "function" && $gameMessage.isItemChoice())
        );
    }

    //-------------------------------------------------------------------
    // RpgBridge: a shared abstraction layer for MV / MZ
    //-------------------------------------------------------------------
    const ENGINE_NAME = (typeof Utils !== "undefined" && Utils.RPGMAKER_NAME) || "MV";
    const IS_MZ = ENGINE_NAME === "MZ";
    const IS_MV = !IS_MZ;

    RpgBridge.engineName = ENGINE_NAME;
    RpgBridge.isMZ = IS_MZ;
    RpgBridge.isMV = IS_MV;

    /**
     * Absorbs the difference in Window_* constructor signatures.
     * - MZ: initialize(new Rectangle(x, y, width, height))
     * - MV: initialize(x, y, width, height)
     */
    RpgBridge.initWindow = function (windowInstance, x, y, width, height) {
        if (IS_MZ) {
            windowInstance.initialize(new Rectangle(x, y, width, height));
        } else {
            windowInstance.initialize(x, y, width, height);
        }
        return windowInstance;
    };

    RpgBridge.makeRect = function (x, y, width, height) {
        return new Rectangle(x, y, width, height);
    };

    // The Scene_MenuBase inheritance chain is the same in MV/MZ, so we only
    // need to check whether it exists to pick a safe base class (in case it's
    // not yet defined, e.g. very early during boot).
    RpgBridge.baseMenuSceneClass = function () {
        return typeof Scene_MenuBase !== "undefined" ? Scene_MenuBase : Scene_Base;
    };

    // ---- Database access wrappers ----
    RpgBridge.data = {
        item(id) {
            return (typeof $dataItems !== "undefined" && $dataItems && $dataItems[id]) || null;
        },
        armor(id) {
            return (typeof $dataArmors !== "undefined" && $dataArmors && $dataArmors[id]) || null;
        },
        weapon(id) {
            return (typeof $dataWeapons !== "undefined" && $dataWeapons && $dataWeapons[id]) || null;
        },
        skill(id) {
            return (typeof $dataSkills !== "undefined" && $dataSkills && $dataSkills[id]) || null;
        }
    };

    RpgBridge.isGameReady = function () {
        return !!(
            typeof $gameParty !== "undefined" && $gameParty &&
            typeof $gameVariables !== "undefined" && $gameVariables &&
            typeof $gameSwitches !== "undefined" && $gameSwitches &&
            typeof $gameTroop !== "undefined" && $gameTroop
        );
    };

    // ---- Game object access wrappers ----
    RpgBridge.game = {
        variables() { return $gameVariables; },
        switches() { return $gameSwitches; },
        party() { return $gameParty; },
        troop() { return $gameTroop; }
    };

    /**
     * Returns the internal storage container for an item's kind
     * (consumable/weapon/armor).
     * ($gameParty._items / _weapons / _armors have the same structure in MV/MZ)
     */
    RpgBridge.itemContainer = function (item) {
        if (!item || typeof $gameParty === "undefined" || !$gameParty) return null;
        if (DataManager.isItem(item)) return $gameParty._items;
        if (DataManager.isWeapon(item)) return $gameParty._weapons;
        if (DataManager.isArmor(item)) return $gameParty._armors;
        return null;
    };

    //-------------------------------------------------------------------
    // CheatManager: singleton
    //-------------------------------------------------------------------
    class CheatManagerClass {
        constructor() {
            this._state = {
                messageSkip: false,
                godModeActorIds: new Set(), // actorIds of party members with God Mode turned on, tracked individually
                partyGodMode: false, // party-wide toggle: locks HP/MP/TP to max for every actor at once
                instantKillMode: false,
                moveSpeedMultiplier: 1,
                gameSpeedMultiplier: 1,
                statMultipliers: Object.create(null), // paramId -> multiplier
                infiniteItemsGlobal: false, // party-wide toggle: no consumable item ever depletes
                infiniteItemKeys: new Set(), // "I1"/"W1"/"A1" -> per-item infinite (ignore consumption) flag
                lockedItems: new Map() // "I1"/"W1"/"A1" -> { item, amount }
            };
            this._defaultDeltaTime = null; // original SceneManager._deltaTime value (captured lazily)
            this._installHooks();
        }

        // ================= General =================
        setGold(amount) {
            if (typeof $gameParty === "undefined" || !$gameParty) return;
            const maxGold = typeof $gameParty.maxGold === "function" ? $gameParty.maxGold() : 99999999;
            $gameParty._gold = CheatManagerClass._clampFinite(amount, 0, maxGold, $gameParty.gold());
        }
        getGold() {
            return typeof $gameParty !== "undefined" && $gameParty ? $gameParty.gold() : 0;
        }

        /**
         * Sets the game speed. Implements the speed-up by shrinking
         * SceneManager._deltaTime (the fixed timestep) by the multiplier, so
         * more game-logic updates run per real-time second. (This works
         * safely regardless of render frame rate because both MV and MZ use
         * the same accumulator structure.)
         * A value near zero or excessively large can cause runaway or stalled
         * updates, so it is clamped to the [0.05, 32] range.
         */
        setGameSpeed(multiplier) {
            const m = CheatManagerClass._clampFinite(multiplier, 0.05, 32, this._state.gameSpeedMultiplier);
            if (this._defaultDeltaTime === null && typeof SceneManager !== "undefined") {
                this._defaultDeltaTime = SceneManager._deltaTime;
            }
            this._state.gameSpeedMultiplier = m;
            if (typeof SceneManager !== "undefined" && this._defaultDeltaTime !== null) {
                SceneManager._deltaTime = this._defaultDeltaTime / m;
            }
        }
        getGameSpeed() {
            return this._state.gameSpeedMultiplier;
        }

        setMoveSpeedMultiplier(multiplier) {
            this._state.moveSpeedMultiplier = CheatManagerClass._clampFinite(multiplier, 0, 16, this._state.moveSpeedMultiplier);
        }
        getMoveSpeedMultiplier() {
            return this._state.moveSpeedMultiplier;
        }

        setMessageSkip(flag) {
            this._state.messageSkip = !!flag;
        }
        isMessageSkip() {
            return this._state.messageSkip;
        }

        // ================= Party / Battle =================
        /**
         * Turns per-party-member God Mode (lock HP/MP) ON/OFF. It used to be
         * a single global boolean applied to the whole party at once, so
         * turning it on from one character's block would confusingly appear
         * to leak to the other party members too. It's now tracked as a Set
         * keyed by actorId, so only "this one party member" becomes invincible.
         */
        setGodMode(actorId, flag) {
            const id = Number(actorId);
            if (!Number.isFinite(id)) return;
            if (flag) {
                this._state.godModeActorIds.add(id);
            } else {
                this._state.godModeActorIds.delete(id);
            }
        }
        isGodMode(actorId) {
            const id = Number(actorId);
            return Number.isFinite(id) && this._state.godModeActorIds.has(id);
        }

        setInstantKillMode(flag) {
            this._state.instantKillMode = !!flag;
        }
        isInstantKillMode() {
            return this._state.instantKillMode;
        }

        /**
         * Party-wide toggle: while ON, every actor's HP/MP/TP is locked to its
         * maximum at all times (see _hookPartyGodMode()). Independent from the
         * per-member God Mode above -- both can be used at once with no conflict.
         */
        setPartyGodMode(flag) {
            this._state.partyGodMode = !!flag;
        }
        isPartyGodMode() {
            return this._state.partyGodMode;
        }

        /** Instantly kills the given battler (for manual/scripted calls). */
        killBattler(battler) {
            if (!battler) return;
            battler._hp = 0;
            if (typeof battler.refresh === "function") battler.refresh();
            if (typeof battler.isDead === "function" && battler.isDead() && typeof battler.die === "function") {
                battler.die();
            }
        }

        setStatMultiplier(paramId, multiplier) {
            const current = this.getStatMultiplier(paramId);
            this._state.statMultipliers[paramId] = CheatManagerClass._clampFinite(multiplier, 0, 50, current);
        }
        getStatMultiplier(paramId) {
            const v = this._state.statMultipliers[paramId];
            return v === undefined ? 1 : v;
        }
        clearStatMultipliers() {
            this._state.statMultipliers = Object.create(null);
        }

        _isProtectedBattler(battler) {
            if (!battler || typeof $gameParty === "undefined" || !$gameParty) return false;
            return $gameParty.members().indexOf(battler) !== -1;
        }

        // ================= Items / Armors =================
        /**
         * Party-wide toggle: while ON, no consumable item's held quantity is
         * ever reduced by Game_Party.prototype.loseItem (see _hookLoseItem()
         * below). Distinct from the per-item lock below, which fixes one
         * specific item/weapon/armor's quantity regardless of this switch.
         */
        setInfiniteItems(flag) {
            this._state.infiniteItemsGlobal = !!flag;
        }
        isInfiniteItems() {
            return this._state.infiniteItemsGlobal;
        }

        /**
         * Turns "doesn't decrease on consumption" on/off for an individual
         * item, independent of the party-wide switch above. Equipment
         * (weapons/armor) is not normally consumed, so this API is intended
         * mainly for consumables.
         */
        setItemInfinite(item, flag) {
            if (!item) return;
            const key = this._itemKey(item);
            if (flag) {
                this._state.infiniteItemKeys.add(key);
            } else {
                this._state.infiniteItemKeys.delete(key);
            }
        }
        isItemInfinite(item) {
            return item ? this._state.infiniteItemKeys.has(this._itemKey(item)) : false;
        }

        /** Locks the held quantity of a specific item/weapon/armor to a fixed value. */
        lockItemQuantity(item, amount) {
            if (!item) return;
            const safeAmount = CheatManagerClass._clampFinite(amount, 0, 9999, 0);
            this._state.lockedItems.set(this._itemKey(item), { item, amount: safeAmount });
            const container = RpgBridge.itemContainer(item);
            if (container) container[item.id] = safeAmount;
        }
        unlockItemQuantity(item) {
            if (!item) return;
            this._state.lockedItems.delete(this._itemKey(item));
        }
        isItemQuantityLocked(item) {
            return item ? this._state.lockedItems.has(this._itemKey(item)) : false;
        }
        _itemKey(item) {
            const prefix = DataManager.isItem(item) ? "I" : DataManager.isWeapon(item) ? "W" : "A";
            return prefix + item.id;
        }

        // ================= Variables =================
        getNumberVariable(id) {
            if (typeof $gameVariables === "undefined" || !$gameVariables) return 0;
            const v = Number($gameVariables.value(id));
            return Number.isFinite(v) ? v : 0;
        }
        setNumberVariable(id, value) {
            if (typeof $gameVariables === "undefined" || !$gameVariables) return;
            $gameVariables.setValue(id, CheatManagerClass._clampFinite(value, -99999999, 99999999, this.getNumberVariable(id)));
        }
        getBooleanVariable(id) {
            if (typeof $gameVariables === "undefined" || !$gameVariables) return false;
            return !!$gameVariables.value(id);
        }
        setBooleanVariable(id, value) {
            if (typeof $gameVariables === "undefined" || !$gameVariables) return;
            $gameVariables.setValue(id, !!value);
        }
        getSwitch(id) {
            if (typeof $gameSwitches === "undefined" || !$gameSwitches) return false;
            return $gameSwitches.value(id);
        }
        setSwitch(id, value) {
            if (typeof $gameSwitches === "undefined" || !$gameSwitches) return;
            $gameSwitches.setValue(id, !!value);
        }

        // ================= Persistence (Save/Load) =================
        _itemRefToKind(item) {
            return DataManager.isWeapon(item) ? "W" : DataManager.isArmor(item) ? "A" : "I";
        }
        _lookupItemByKind(kind, id) {
            const table = kind === "W" ? $dataWeapons : kind === "A" ? $dataArmors : $dataItems;
            return table && table[id];
        }
        /** Builds a pure JSON snapshot that is safe to put into the save file. */
        serialize() {
            const lockedItems = [];
            this._state.lockedItems.forEach((entry) => {
                lockedItems.push({
                    kind: this._itemRefToKind(entry.item),
                    id: entry.item.id,
                    amount: entry.amount
                });
            });
            const infiniteItems = [];
            this._state.infiniteItemKeys.forEach((key) => {
                infiniteItems.push({ kind: key[0], id: Number(key.slice(1)) });
            });
            return {
                messageSkip: this._state.messageSkip,
                godModeActorIds: Array.from(this._state.godModeActorIds),
                partyGodMode: this._state.partyGodMode,
                instantKillMode: this._state.instantKillMode,
                moveSpeedMultiplier: this._state.moveSpeedMultiplier,
                gameSpeedMultiplier: this._state.gameSpeedMultiplier,
                statMultipliers: Object.assign({}, this._state.statMultipliers),
                infiniteItemsGlobal: this._state.infiniteItemsGlobal,
                infiniteItems,
                lockedItems
            };
        }
        /** Restores state from a snapshot produced by serialize(). */
        deserialize(data) {
            if (!data) {
                this.resetSessionState();
                return;
            }
            this.setMessageSkip(data.messageSkip);
            this._state.godModeActorIds.clear();
            (data.godModeActorIds || []).forEach((actorId) => this.setGodMode(actorId, true));
            this.setPartyGodMode(data.partyGodMode);
            this.setInstantKillMode(data.instantKillMode);
            this.setMoveSpeedMultiplier(data.moveSpeedMultiplier);
            this.setGameSpeed(data.gameSpeedMultiplier);
            this.setInfiniteItems(data.infiniteItemsGlobal);

            this.clearStatMultipliers();
            if (data.statMultipliers) {
                for (const paramId of Object.keys(data.statMultipliers)) {
                    this.setStatMultiplier(paramId, data.statMultipliers[paramId]);
                }
            }

            this._state.lockedItems.clear();
            (data.lockedItems || []).forEach((entry) => {
                const item = this._lookupItemByKind(entry.kind, entry.id);
                if (item) this.lockItemQuantity(item, entry.amount);
            });

            this._state.infiniteItemKeys.clear();
            (data.infiniteItems || []).forEach((entry) => {
                const item = this._lookupItemByKind(entry.kind, entry.id);
                if (item) this.setItemInfinite(item, true);
            });
        }
        /** Safely resets all cheat state back to defaults (new game start, loading without a save, etc.). */
        resetSessionState() {
            this.setMessageSkip(false);
            this._state.godModeActorIds.clear();
            this.setPartyGodMode(false);
            this.setInstantKillMode(false);
            this.setInfiniteItems(false);
            this._state.infiniteItemKeys.clear();
            this.clearStatMultipliers();
            this._state.lockedItems.clear();
            this.setMoveSpeedMultiplier(1);
            this.setGameSpeed(1);
        }

        // ================= internal hooks =================
        _installHooks() {
            this._hookMessageSkip();
            this._hookGodMode();
            this._hookPartyGodMode();
            this._hookInstantKill();
            this._hookStatMultiplier();
            this._hookMoveSpeed();
            this._hookLoseItem();
            this._hookSaveLoad();
        }

        // Fast Message Skip.
        //   1) Force "confirm input detected" to true -> immediately releases
        //      the end-of-sentence pause wait.
        //   2) Bypass wait codes like \.  \| (startWait) and Window_Message's
        //      own wait counter (_waitCount) down to 0.
        //   3) Render message text instantly instead of one character at a
        //      time (Window_Message#updateShowFast).
        //   4) While an event is auto-running on the map, make characters
        //      actually walk faster, route moves finish sooner, and screen
        //      tints/fades play back faster too, by hooking Scene_Map
        //      directly instead of touching the interpreter's wait handling.
        //
        //   Every one of these bails out to completely normal, unaccelerated
        //   behavior whenever isWaitingForPlayerInput() is true (a choice
        //   list, number input, or item-choice window is open), so choice UI
        //   never flickers or double-processes a button press.
        //
        //   Deliberately NOT implemented: forcing
        //   Game_Interpreter.prototype.updateWait to always return false while
        //   messageSkip is on. Doing that would defeat "wait until the message
        //   finishes" (setWaitMode('message')) entirely, letting the event
        //   interpreter run the next command (e.g. a conditional branch that
        //   reads a choice result) before the message/choice window has
        //   actually closed. That can break choice branching or otherwise
        //   corrupt event flow as a real gameplay bug, so instead we rely on
        //   1)-4) above.
        //
        //   Also deliberately NOT implemented (anymore): looping
        //   SceneManager.updateMain()/updateScene() extra times per frame.
        //   That ran the *entire* scene update (including message/choice
        //   window input handling) multiple times against a single real
        //   input poll, which is exactly what caused the choice-window
        //   flicker/double-input bug. The Scene_Map-level hooks in
        //   _hookMapFastForward() below replace it with a version that only
        //   re-runs the map's own world-simulation updates.
        _hookMessageSkip() {
            this._hookMessageSkipTrigger();
            this._hookMessageSkipWait();
            this._hookMessageSkipShowFast();
            this._hookMapFastForward();
            this._hookBattleFastForward();
        }

        // Forces the message window's "confirm input detected" check to true,
        // implementing auto-advance. Skipped while the player is choosing
        // something, so it can never interfere with choice/number/item input.
        _hookMessageSkipTrigger() {
            if (typeof Window_Message === "undefined") return;
            const manager = this;
            const _isTriggered = Window_Message.prototype.isTriggered;
            Window_Message.prototype.isTriggered = function () {
                if (manager.isMessageSkip() && !isWaitingForPlayerInput()) return true;
                return _isTriggered.call(this);
            };
        }

        // Bypasses the wait created by startWait(count) for wait codes like
        // \.(0.25s) and \|(1s) down to 0 while skip is on. This is defined on
        // Window_Message.prototype in MV and on Window_Base.prototype in MZ,
        // but thanks to the prototype chain, Window_Message.prototype.startWait
        // resolves correctly either way, so wrapping this single spot handles
        // both engines safely.
        //
        // In addition, updateWait() itself is also wrapped so that even if
        // some other plugin sets _waitCount directly without going through
        // startWait(), it's still covered defensively (the end-of-line pause
        // wait is always forced to 0 immediately while skip is on). Both
        // bypasses turn off automatically while isWaitingForPlayerInput() is
        // true.
        _hookMessageSkipWait() {
            if (typeof Window_Message === "undefined") return;
            const manager = this;
            const target = Window_Message.prototype;

            function shouldBypassWait() {
                return manager.isMessageSkip() && !isWaitingForPlayerInput();
            }

            if (typeof target.startWait === "function") {
                const _startWait = target.startWait;
                target.startWait = function (count) {
                    _startWait.call(this, shouldBypassWait() ? 0 : count);
                };
            }

            if (typeof target.updateWait === "function") {
                const _updateWait = target.updateWait;
                target.updateWait = function () {
                    if (shouldBypassWait() && this._waitCount > 0) {
                        this._waitCount = 0;
                    }
                    return _updateWait.call(this);
                };
            }
        }

        // Renders message text instantly (skips the one-character-at-a-time
        // typewriter effect) while skip is on, by forcing the same
        // "_showFast" flag the player normally sets by holding the confirm
        // button, and reporting "already at full speed" back to the caller.
        _hookMessageSkipShowFast() {
            if (typeof Window_Message === "undefined" || typeof Window_Message.prototype.updateShowFast !== "function") return;
            const manager = this;
            const _updateShowFast = Window_Message.prototype.updateShowFast;
            Window_Message.prototype.updateShowFast = function () {
                if (manager.isMessageSkip()) {
                    this._showFast = true;
                    return true;
                }
                return _updateShowFast.call(this);
            };
        }

        // Speeds up actual character movement, route moves, and screen
        // tints/fades while an event is auto-running on the map -- the part
        // that merely skipping interpreter waits can never affect, since
        // characters and screen effects animate against real elapsed frames,
        // not against the interpreter's command queue.
        //
        //   - Scene_Map.prototype.isFastForward, where the engine defines it
        //     (added in later MZ core versions to support holding the OK
        //     button during an auto-running event), is reused: making it
        //     return true taps directly into the engine's own native
        //     updateMainMultiply() double-update logic for free.
        //   - On top of that, Scene_Map.prototype.update is wrapped to run
        //     several *additional* $gameMap/$gamePlayer/$gameTimer/$gameScreen
        //     updates -- never the full Scene_Map#update() again, which would
        //     also re-run message/choice window input handling multiple
        //     times against one real input poll and reproduce the old
        //     flicker bug. Because only the map's own world-simulation
        //     methods are re-run, this is safe to stack on top of
        //     isFastForward() above.
        //   - Both only ever activate while $gameMap.isEventRunning() and
        //     isWaitingForPlayerInput() is false, so manual player-controlled
        //     walking and any open choice/number/item window are completely
        //     unaffected.
        _hookMapFastForward() {
            if (typeof Scene_Map === "undefined") return;
            const manager = this;

            function canFastForward() {
                return (
                    manager.isMessageSkip() &&
                    typeof $gameMap !== "undefined" && $gameMap &&
                    typeof $gameMap.isEventRunning === "function" && $gameMap.isEventRunning() &&
                    !isWaitingForPlayerInput()
                );
            }

            if (typeof Scene_Map.prototype.isFastForward === "function") {
                const _isFastForward = Scene_Map.prototype.isFastForward;
                Scene_Map.prototype.isFastForward = function () {
                    return canFastForward() || _isFastForward.call(this);
                };
            }

            const _update = Scene_Map.prototype.update;
            Scene_Map.prototype.update = function () {
                _update.apply(this, arguments);
                if (!canFastForward()) return;

                const active = this.isActive();
                for (let i = 1; i < MAP_FAST_FORWARD_MULTIPLIER; i++) {
                    $gameMap.update(active);
                    $gamePlayer.update(active);
                    $gameTimer.update(active);
                    $gameScreen.update();
                }
            };
        }

        // Speeds up battle the same way _hookMapFastForward() speeds up the
        // map: while Fast Message Skip is on, re-runs every mechanism that
        // independently paces battle several extra times per real render
        // frame -- BattleManager's own turn/action state machine, the
        // battle log window's wait/queue processing, screen flash/shake/
        // tint (Game_Screen), and animation sprite playback. Speeding up
        // BattleManager alone barely shows: it blocks on the log window
        // still being "busy", and the log window (plus Game_Screen and
        // animation sprites) all pace themselves independently via their
        // own per-frame counters, entirely separate from how many times
        // BattleManager.update() ran in that same frame.
        //
        // Every one of these is hooked directly (instead of wrapping
        // Scene_Battle's own update, the way _hookMapFastForward wraps
        // Scene_Map's) so that none of Scene_Battle's window/input handling
        // is ever re-run -- this carries none of the double-input-
        // processing risk that ruled out just looping a whole scene update,
        // since none of BattleManager/Window_BattleLog/Game_Screen/the
        // animation sprites ever poll Input themselves.
        //
        // Deliberately bails (falls back to plain 1x) whenever battle is
        // waiting on an actual player decision -- an actor/target/skill/
        // item selection (isBattleWaitingForCommand()) or an open message/
        // choice/number/item window (isWaitingForPlayerInput()) -- for the
        // same reason every other fast-forward hook does: fast-forwarding
        // must never touch a real decision point, only auto-progressing
        // content.
        _hookBattleFastForward() {
            if (typeof BattleManager === "undefined" || !BattleManager) return;
            const manager = this;

            // BattleManager.isInputting() isn't guaranteed to exist on every
            // engine version -- falling back to the raw _phase field it
            // wraps means this still works even where the helper is
            // missing, instead of canFastForward() silently always being
            // false (which would make Fast Message Skip look like it does
            // nothing at all in battle, regardless of on/off).
            function isBattleWaitingForCommand() {
                if (typeof BattleManager.isInputting === "function") {
                    return BattleManager.isInputting();
                }
                return BattleManager._phase === "input";
            }

            function canFastForward() {
                return (
                    manager.isMessageSkip() &&
                    typeof $gameParty !== "undefined" && $gameParty && $gameParty.inBattle() &&
                    !isBattleWaitingForCommand() &&
                    !isWaitingForPlayerInput()
                );
            }

            // Wraps `target[methodName]` so that, while canFastForward() is
            // true, it runs several extra times per real render frame on
            // top of its normal single call. Used identically below for
            // every battle-pacing mechanism that (unlike an interactive
            // window) never polls Input itself, so none of these carry the
            // double-input-processing risk that rules out re-running a
            // whole Scene's update.
            function multiplyUpdate(target, methodName) {
                if (!target || typeof target[methodName] !== "function") return;
                const original = target[methodName];
                target[methodName] = function (...args) {
                    original.apply(this, args);
                    if (!canFastForward()) return;
                    for (let i = 1; i < BATTLE_FAST_FORWARD_MULTIPLIER; i++) {
                        original.apply(this, args);
                    }
                };
            }

            // BattleManager's own "advance the battle by one tick" update
            // (turn/action state machine, enemy AI, damage resolution).
            multiplyUpdate(BattleManager, "update");

            // The battle log window (attack/skill-use/damage lines).
            if (typeof Window_BattleLog !== "undefined") {
                // MZ's battle log already has a native "hold OK/Shift to
                // speed up" mechanism: isFastForward() makes its wait
                // counter tick down 3x as fast. Reusing it here taps into
                // that built-in speed-up for free, the same way
                // _hookMapFastForward() reuses Scene_Map's isFastForward().
                if (typeof Window_BattleLog.prototype.isFastForward === "function") {
                    const _logIsFastForward = Window_BattleLog.prototype.isFastForward;
                    Window_BattleLog.prototype.isFastForward = function () {
                        return canFastForward() || _logIsFastForward.call(this);
                    };
                }
                multiplyUpdate(Window_BattleLog.prototype, "update");
            }

            // Screen flash/shake/tint (heavily used by hit effects) is
            // driven by Game_Screen, updated once per frame by Scene_Battle
            // -- the same fix _hookMapFastForward() already applies to it
            // on the map.
            if (typeof Game_Screen !== "undefined") {
                multiplyUpdate(Game_Screen.prototype, "update");
            }

            // Actual animation playback (weapon/skill effect sprites) is
            // driven by per-frame duration counters on these sprite
            // classes, entirely separate from both BattleManager and the
            // log window -- neither polls Input, so speeding them up is
            // just as safe. Sprite_AnimationMV is the legacy (pre-Effekseer)
            // animation renderer some MZ projects and all MV projects use;
            // Sprite_Animation is MZ's newer one. Both are checked since
            // only one may exist depending on engine/version.
            if (typeof Sprite_Animation !== "undefined") {
                multiplyUpdate(Sprite_Animation.prototype, "update");
            }
            if (typeof Sprite_AnimationMV !== "undefined") {
                multiplyUpdate(Sprite_AnimationMV.prototype, "update");
            }
        }

        // After refresh(), locks HP/MP to max only for "the party member whose
        // God Mode is turned on", and ignores negative gainHp changes for
        // them. This only applies individually to party members that have an
        // actorId(), so turning on God Mode for one character has no effect
        // on the other party members.
        _hookGodMode() {
            const manager = this;

            function isGodModeActor(battler) {
                return (
                    manager._isProtectedBattler(battler) &&
                    typeof battler.actorId === "function" &&
                    manager.isGodMode(battler.actorId())
                );
            }

            if (typeof Game_BattlerBase !== "undefined") {
                const _refresh = Game_BattlerBase.prototype.refresh;
                Game_BattlerBase.prototype.refresh = function () {
                    _refresh.call(this);
                    if (isGodModeActor(this)) {
                        this._hp = this.mhp;
                        if (this._mp !== undefined) this._mp = this.mmp;
                        if (typeof this.isDead === "function" && this.isDead() && typeof this.removeState === "function") {
                            this.removeState(this.deathStateId());
                        }
                    }
                };
            }

            if (typeof Game_Battler !== "undefined") {
                const _gainHp = Game_Battler.prototype.gainHp;
                Game_Battler.prototype.gainHp = function (value) {
                    if (isGodModeActor(this) && value < 0) {
                        return;
                    }
                    _gainHp.call(this, value);
                };
            }
        }

        // Party God Mode: a single party-wide switch that locks every actor's
        // HP/MP/TP to maximum at all times, independent of the per-member God
        // Mode above. Hooked directly on Game_BattlerBase#setHp/setMp/setTp
        // (the single choke point every HP/MP/TP change funnels through --
        // Game_Battler#gainHp/gainMp/gainTp all call these internally) rather
        // than reacting after the fact in refresh(), so it can never be
        // bypassed by a plugin or action sequence that writes HP/MP/TP some
        // other way but still goes through these setters.
        _hookPartyGodMode() {
            if (typeof Game_BattlerBase === "undefined") return;
            const manager = this;

            function isPartyGodModeActor(battler) {
                return manager.isPartyGodMode() && typeof battler.isActor === "function" && battler.isActor();
            }

            const _setHp = Game_BattlerBase.prototype.setHp;
            Game_BattlerBase.prototype.setHp = function (hp) {
                _setHp.call(this, isPartyGodModeActor(this) ? this.mhp : hp);
            };

            const _setMp = Game_BattlerBase.prototype.setMp;
            Game_BattlerBase.prototype.setMp = function (mp) {
                _setMp.call(this, isPartyGodModeActor(this) ? this.mmp : mp);
            };

            const _setTp = Game_BattlerBase.prototype.setTp;
            Game_BattlerBase.prototype.setTp = function (tp) {
                const maxTp = typeof this.maxTp === "function" ? this.maxTp() : tp;
                _setTp.call(this, isPartyGodModeActor(this) ? maxTp : tp);
            };
        }

        // Instant Kill: rather than hacking the damage formula (unreliable,
        // since guard states/element rates/direct action overrides can all
        // change or skip the damage calculation before it ever reaches HP),
        // this hooks Game_Action.prototype.apply -- the single point every
        // action's effect on a target passes through regardless of how its
        // damage was computed -- and forces the target dead immediately after
        // the action has been fully applied.
        _hookInstantKill() {
            if (typeof Game_Action === "undefined") return;
            const manager = this;
            const _apply = Game_Action.prototype.apply;
            Game_Action.prototype.apply = function (target) {
                _apply.call(this, target);
                if (
                    manager.isInstantKillMode() &&
                    target && typeof target.isEnemy === "function" && target.isEnemy() &&
                    this.subject && this.subject() && typeof this.subject().isActor === "function" && this.subject().isActor()
                ) {
                    manager.killBattler(target);
                }
            };
        }

        // Applies party stat buffs by multiplying paramRate() by a custom multiplier.
        _hookStatMultiplier() {
            if (typeof Game_BattlerBase === "undefined") return;
            const manager = this;
            const _paramRate = Game_BattlerBase.prototype.paramRate;
            Game_BattlerBase.prototype.paramRate = function (paramId) {
                const base = _paramRate.call(this, paramId);
                if (manager._isProtectedBattler(this)) {
                    return base * manager.getStatMultiplier(paramId);
                }
                return base;
            };
        }

        // Applies a multiplier to character movement distance (distancePerFrame).
        _hookMoveSpeed() {
            if (typeof Game_CharacterBase === "undefined") return;
            const manager = this;
            const _distancePerFrame = Game_CharacterBase.prototype.distancePerFrame;
            Game_CharacterBase.prototype.distancePerFrame = function () {
                return _distancePerFrame.call(this) * manager.getMoveSpeedMultiplier();
            };
        }

        // Intercepts loseItem: party-wide infinite consumables, per-item
        // infinite flag, and fixed held quantity locks.
        //
        // RPG Maker MV/MZ always routes item consumption through
        // Game_Party.prototype.loseItem (Game_Action#applyItemUserEffect ->
        // subject().consumeItem() -> $gameParty.consumeItem() -> loseItem()),
        // so hooking this single spot and bypassing the subtraction entirely
        // -- instead of letting the original run and then resetting the
        // container's quantity back afterward -- is both simpler and safe
        // against any action sequencer that reads the quantity mid-effect,
        // since the held amount never actually changes in the first place.
        _hookLoseItem() {
            if (typeof Game_Party === "undefined") return;
            const manager = this;
            const _loseItem = Game_Party.prototype.loseItem;
            Game_Party.prototype.loseItem = function (item, amount, includeEquip) {
                if (!item) return;

                const isGloballyInfiniteConsumable =
                    DataManager.isItem(item) && !!item.consumable && manager.isInfiniteItems();

                if (isGloballyInfiniteConsumable || manager.isItemInfinite(item) || manager.isItemQuantityLocked(item)) {
                    return; // Bypass the subtraction completely -- held quantity never changes.
                }

                _loseItem.call(this, item, amount, includeEquip);
            };
        }

        // Saves/restores cheat state together with the save data (depending on
        // the setting), and always resets it safely when starting a new game.
        _hookSaveLoad() {
            if (typeof DataManager === "undefined") return;
            const manager = this;

            const _makeSaveContents = DataManager.makeSaveContents;
            DataManager.makeSaveContents = function () {
                const contents = _makeSaveContents.call(this);
                if (PERSIST_CHEAT_STATE_ON_LOAD) {
                    contents.cheatEngine = manager.serialize();
                }
                return contents;
            };

            const _extractSaveContents = DataManager.extractSaveContents;
            DataManager.extractSaveContents = function (contents) {
                _extractSaveContents.call(this, contents);
                if (PERSIST_CHEAT_STATE_ON_LOAD && contents && contents.cheatEngine) {
                    manager.deserialize(contents.cheatEngine);
                } else {
                    manager.resetSessionState();
                }
            };

            if (typeof DataManager.setupNewGame === "function") {
                const _setupNewGame = DataManager.setupNewGame;
                DataManager.setupNewGame = function () {
                    _setupNewGame.call(this);
                    manager.resetSessionState();
                };
            }
        }

        // ================= internal helpers =================
        /**
         * Coerces value to a number and clamps it to the [min, max] range. For
         * abnormal input like NaN/Infinity, falls back to fallback (usually
         * "the current value") as-is, so game state can never be corrupted.
         */
        static _clampFinite(value, min, max, fallback) {
            const n = Number(value);
            if (!Number.isFinite(n)) return fallback;
            return Math.min(max, Math.max(min, n));
        }
    }

    CheatManager = new CheatManagerClass();
    window.RpgBridge = RpgBridge;
    window.CheatManager = CheatManager;
})();
