//=============================================================================
// CheatEngine_Core.js
//=============================================================================
/*:
 * @plugindesc [Cheat Engine] Core v1.3.0 - Pure-logic cheat engine core for RPG Maker MV/MZ (no UI).
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

    // When Fast Message Skip is on and a message is currently being shown,
    // this is how many extra times per render frame SceneManager.updateScene()
    // (a pure logic update -- no rendering, input polling, or scene change)
    // gets run. To make sure this is noticeably faster than the test-play
    // Ctrl-key 4x speed-up, the base 1 update (already performed by
    // SceneManager.updateMain) plus this extra amount adds up to a total of 8.
    const MESSAGE_SKIP_EXTRA_UPDATES = 7;

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
                instantKillMode: false,
                moveSpeedMultiplier: 1,
                gameSpeedMultiplier: 1,
                statMultipliers: Object.create(null), // paramId -> multiplier
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
         * Turns "doesn't decrease on consumption" on/off for an individual
         * item. Equipment (weapons/armor) is not normally consumed, so this
         * API is intended mainly for consumables.
         * (The old global setInfiniteItems() was replaced with per-item
         * control, since $dataItems can contain entries that aren't actually
         * meant to be consumed at all.)
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
                instantKillMode: this._state.instantKillMode,
                moveSpeedMultiplier: this._state.moveSpeedMultiplier,
                gameSpeedMultiplier: this._state.gameSpeedMultiplier,
                statMultipliers: Object.assign({}, this._state.statMultipliers),
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
            this.setInstantKillMode(data.instantKillMode);
            this.setMoveSpeedMultiplier(data.moveSpeedMultiplier);
            this.setGameSpeed(data.gameSpeedMultiplier);

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
            this.setInstantKillMode(false);
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
        //   3) While a message is showing, increase how many times per frame
        //      SceneManager.updateMain()'s logic update (updateScene) runs,
        //      up to 8 times, making it clearly faster than the test-play
        //      Ctrl key's 4x speed.
        //
        //   Deliberately NOT implemented: forcing
        //   Game_Interpreter.prototype.updateWait to always return false while
        //   messageSkip is on. Doing that would defeat "wait until the message
        //   finishes" (setWaitMode('message')) entirely, letting the event
        //   interpreter run the next command (e.g. a conditional branch that
        //   reads a choice result) before the message/choice window has
        //   actually closed. That can break choice branching or otherwise
        //   corrupt event flow as a real gameplay bug, so instead we rely on
        //   1)-3) above to maximize how fast the message window itself
        //   progresses.
        _hookMessageSkip() {
            this._hookMessageSkipTrigger();
            this._hookMessageSkipWait();
            this._hookMessageSkipBurstUpdate();
        }

        // Forces the message window's "confirm input detected" check to true,
        // implementing auto-advance.
        _hookMessageSkipTrigger() {
            if (typeof Window_Message === "undefined") return;
            const manager = this;
            const _isTriggered = Window_Message.prototype.isTriggered;
            Window_Message.prototype.isTriggered = function () {
                if (manager.isMessageSkip()) return true;
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
        // wait is always forced to 0 immediately while skip is on).
        _hookMessageSkipWait() {
            if (typeof Window_Message === "undefined") return;
            const manager = this;
            const target = Window_Message.prototype;

            if (typeof target.startWait === "function") {
                const _startWait = target.startWait;
                target.startWait = function (count) {
                    _startWait.call(this, manager.isMessageSkip() ? 0 : count);
                };
            }

            if (typeof target.updateWait === "function") {
                const _updateWait = target.updateWait;
                target.updateWait = function () {
                    if (manager.isMessageSkip() && this._waitCount > 0) {
                        this._waitCount = 0;
                    }
                    return _updateWait.call(this);
                };
            }
        }

        // While a message is being shown (busy) and skip is on, in addition
        // to the one normal update SceneManager.updateMain() already
        // performed (which includes input polling/scene change/rendering),
        // run the pure logic update SceneManager.updateScene() up to
        // MESSAGE_SKIP_EXTRA_UPDATES more times in a row.
        //   - Only updateScene() is called repeatedly, so input isn't polled
        //     again, the scene isn't changed again, and the screen isn't
        //     rendered again multiple times (those three stay exactly as
        //     performed by the original single updateMain() call).
        //   - Each iteration re-checks whether a "scene change is in
        //     progress" or "the message has already finished" and stops
        //     immediately if so, so even with a fixed iteration count this
        //     never disturbs scene transition/scene-end timing.
        //   - This never touches SceneManager._deltaTime/accumulator (which
        //     setGameSpeed() uses), so it stacks safely and independently of
        //     the game speed setting.
        _hookMessageSkipBurstUpdate() {
            if (
                typeof SceneManager === "undefined" ||
                typeof SceneManager.updateMain !== "function" ||
                typeof SceneManager.updateScene !== "function"
            ) {
                return;
            }
            const manager = this;

            function isMessageBusy() {
                return (
                    manager.isMessageSkip() &&
                    typeof $gameMessage !== "undefined" && $gameMessage &&
                    typeof $gameMessage.isBusy === "function" && $gameMessage.isBusy()
                );
            }

            const _updateMain = SceneManager.updateMain;
            SceneManager.updateMain = function () {
                _updateMain.call(this);
                if (!isMessageBusy()) return;
                for (let i = 0; i < MESSAGE_SKIP_EXTRA_UPDATES; i++) {
                    if (typeof this.isSceneChanging === "function" && this.isSceneChanging()) break;
                    if (!isMessageBusy()) break;
                    this.updateScene();
                }
            };
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

        // Forces damage the party (allies) deals to enemies to an instant-kill level.
        _hookInstantKill() {
            if (typeof Game_Action === "undefined") return;
            const manager = this;
            const _makeDamageValue = Game_Action.prototype.makeDamageValue;
            Game_Action.prototype.makeDamageValue = function (target, critical) {
                if (
                    manager.isInstantKillMode() &&
                    target && typeof target.isEnemy === "function" && target.isEnemy() &&
                    this.subject && this.subject() && typeof this.subject().isActor === "function" && this.subject().isActor()
                ) {
                    return (target.mhp || 9999) * 999;
                }
                return _makeDamageValue.call(this, target, critical);
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

        // Intercepts loseItem: infinite items / fixed held quantity.
        _hookLoseItem() {
            if (typeof Game_Party === "undefined") return;
            const manager = this;
            const _loseItem = Game_Party.prototype.loseItem;
            Game_Party.prototype.loseItem = function (item, amount, includeEquip) {
                if (!item) return;

                if (amount < 0 && manager.isItemInfinite(item)) {
                    return; // Only ignore this item's consumption (decrease), effectively making it infinite
                }

                _loseItem.call(this, item, amount, includeEquip);

                const lock = manager._state.lockedItems.get(manager._itemKey(item));
                if (lock) {
                    const container = RpgBridge.itemContainer(item);
                    if (container) container[item.id] = lock.amount;
                }
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
