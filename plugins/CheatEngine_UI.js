//=============================================================================
// CheatEngine_UI.js
//=============================================================================
/*:
 * @plugindesc [Cheat Engine] UI v2.4.0 - In-game cheat menu UI consuming CheatEngine_Core.js.
 * @author rpghack
 * @base CheatEngine_Core
 * @orderAfter CheatEngine_Core
 * @url
 *
 * @param toggleKeyCode
 * @text Toggle Key (keyCode)
 * @type number
 * @min 0
 * @max 255
 * @default 119
 * @desc Browser keyCode that opens/closes the cheat menu. Default 119 = F8.
 *
 * @param enableGamepadToggle
 * @text Enable Gamepad Toggle
 * @type boolean
 * @on Enable
 * @off Disable
 * @default true
 * @desc If ON, a gamepad button also opens/closes the cheat menu (polled manually; not in Input.gamepadMapper by default).
 *
 * @param gamepadStartButtonIndex
 * @text Gamepad Button Index
 * @type number
 * @min 0
 * @max 31
 * @default 9
 * @desc Standard Gamepad API button index that toggles the menu. Default 9 = Start.
 *
 * @param enableGeneralTab
 * @text Enable "General" Tab
 * @type boolean
 * @default true
 * @desc Show the General tab (gold, game speed, move speed, message skip) in the tab bar.
 *
 * @param enablePartyTab
 * @text Enable "Party" Tab
 * @type boolean
 * @default true
 * @desc Show the Party tab (party-wide God Mode/Instant Kill, plus every member's level/EXP/params/full-heal/God Mode) in the tab bar.
 *
 * @param enableItemsTab
 * @text Enable "Items" Tab
 * @type boolean
 * @default true
 * @desc Show the Items tab in the tab bar.
 *
 * @param enableArmorsTab
 * @text Enable "Armors" Tab
 * @type boolean
 * @default true
 * @desc Show the Armors tab in the tab bar.
 *
 * @param enableSkillsTab
 * @text Enable "Skills" Tab
 * @type boolean
 * @default true
 * @desc Show the Skills tab in the tab bar.
 *
 * @param enableVariablesTab
 * @text Enable "Variables" Tab
 * @type boolean
 * @default true
 * @desc Show the Variables tab in the tab bar.
 *
 * @help
 * CheatEngine_UI.js
 * -----------------------------------------------------------------------------
 * An in-game cheat menu UI that consumes CheatEngine_Core.js's
 * window.CheatManager / window.RpgBridge API.
 *
 * Installation:
 *   - Separate-file install: place CheatEngine_Core.js ABOVE this plugin in
 *     the Plugin Manager list and enable both.
 *   - Single-file (combined) install: this file's body may be concatenated
 *     with CheatEngine_Core.js's body into one .js file; both halves resolve
 *     their own plugin name from document.currentScript, so it keeps working
 *     either way (see CheatEngine_Core.js's help for details).
 *
 * Toggle input:
 *   - Keyboard F8 (configurable via "Toggle Key (keyCode)")
 *   - Gamepad Start button, index 9 by default (configurable; can be disabled)
 *
 * Once open, standard controls:
 *   - Arrow keys : move tab bar cursor (2D, wraps to a 2nd row) / move
 *                  content list cursor / adjust the highlighted value
 *   - Z (ok)     : confirm tab -> enter content list, OR (inside the content
 *                  list) toggle/cycle/big-step the highlighted row in place
 *   - Down (bottom row of tabs) : same as Z, enters the content list
 *   - X (cancel) : content list -> back to tab bar; tab bar -> close menu
 *   - Shift      : open the direct-input overlay (number/item qty/variable)
 *
 * The Party tab opens with a "[ Party-Wide Options ]" section -- Party God
 * Mode (locks every member's HP/MP/TP to max at once) and Party Instant Kill
 * Enemies (any actor action kills an enemy outright) -- followed by every
 * current party member's own block, one after another in a single scrollable
 * list (no party-member switching, no PageUp/PageDown, no touch UI for it).
 * Each member's block starts with a non-selectable "[ Character: Name ]"
 * header row followed by that member's own one-shot "Full Heal HP/MP/TP"
 * action row (Z or Left/Right executes it immediately), Level/EXP, an
 * individual God Mode toggle, and per-character param bonuses.
 * The Skills tab still always targets the party leader ($gameParty.leader())
 * since a skill grid only makes sense for one character at a time.
 *
 * Layout:
 *   - Window_CheatTab        : top tab bar, up to 5 columns, wraps to a 2nd
 *                               row when there are more tabs than that
 *   - Window_CheatContent    : single full-width content window; every value
 *                               is viewed, adjusted, and toggled in place
 *                               (no separate detail pane)
 *   - Window_CheatNumberInput: Shift-triggered direct-input overlay
 *
 * Each tab can be hidden from the tab bar via its "Enable ... Tab" parameter
 * above (the underlying CheatManager feature stays fully usable via script
 * calls either way -- the parameter only controls menu visibility).
 *
 * Extending with game-specific tabs:
 *   - A separate plugin file loaded AFTER this one (e.g. CheatEngine_RJ386773.js)
 *     may call window.CheatEngineUI.registerTab({ name, enabled, builder, columns })
 *     to add its own tab to the tab bar. `builder` has the same signature as
 *     every built-in tab's builder (() => descriptor[]). This keeps hardcoded,
 *     single-game logic (specific variable IDs, other plugins' commands, ...)
 *     out of this generic file entirely.
 * -----------------------------------------------------------------------------
 */

(() => {
    "use strict";

    if (
        typeof Window_Selectable === "undefined" ||
        typeof Window_Command === "undefined" ||
        typeof Scene_Base === "undefined"
    ) {
        console.error("CheatEngine_UI.js: RPG Maker core scripts have not been loaded.");
        return;
    }
    if (typeof RpgBridge === "undefined" || typeof CheatManager === "undefined" || !CheatManager) {
        console.error("CheatEngine_UI.js: CheatEngine_Core.js must be loaded first.");
        return;
    }

    //-------------------------------------------------------------------
    // Dynamic plugin name resolution + parameter reading (supports both
    // separate-file and combined-file installs).
    // Same approach as CheatEngine_Core.js: use document.currentScript to
    // find the file name of "the <script> tag currently executing", then
    // look it up via PluginManager.parameters().
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
    function paramNumber(params, key, defaultValue) {
        const raw = params[key];
        if (raw === undefined || raw === "") return defaultValue;
        const n = Number(raw);
        return Number.isFinite(n) ? n : defaultValue;
    }

    const PLUGIN_NAME = resolvePluginName("CheatEngine_UI");
    const PARAMS = (typeof PluginManager !== "undefined" ? PluginManager.parameters(PLUGIN_NAME) : {}) || {};

    const TOGGLE_KEY_CODE = paramNumber(PARAMS, "toggleKeyCode", 119);
    const ENABLE_GAMEPAD_TOGGLE = paramBool(PARAMS, "enableGamepadToggle", true);
    const GAMEPAD_START_BUTTON = paramNumber(PARAMS, "gamepadStartButtonIndex", 9);

    //-------------------------------------------------------------------
    // RpgBridge extensions: absorb MV/MZ method name differences
    //-------------------------------------------------------------------
    // MZ split color-related functionality out of Window_Base and into ColorManager.
    RpgBridge.textColor = function (windowInstance, colorId) {
        if (typeof ColorManager !== "undefined" && ColorManager.textColor) {
            return ColorManager.textColor(colorId);
        }
        return windowInstance.textColor(colorId);
    };

    // The method name Window_Command#drawItem internally uses to compute the
    // "text area" differs between MV (itemRectForText) and MZ (itemLineRect).
    RpgBridge.itemLineRect = function (windowInstance, index) {
        return RpgBridge.isMZ
            ? windowInstance.itemLineRect(index)
            : windowInstance.itemRectForText(index);
    };

    // Layout constants (fixed values based on default font size 26 / line height 36 / padding 12)
    const LINE_HEIGHT = 36;
    const WINDOW_PADDING = 12;
    function panelHeight(lines) {
        return lines * LINE_HEIGHT + WINDOW_PADDING * 2;
    }

    const PARAM_NAMES = ["Max HP", "Max MP", "Attack", "Defense", "Magic Attack", "Magic Defense", "Agility", "Luck"];
    const SKILLS_TAB_COLUMNS = 3;
    const TAB_MAX_COLS = 5;

    // Window_CheatNumberInput layout/theme: a compact, fixed-size dialog
    // rather than one sized off the digit count, so it always reads as a
    // deliberate, self-contained overlay instead of a stretched-out window.
    const NUMBER_INPUT_WIDTH = 340;
    const NUMBER_INPUT_HEIGHT = 140;
    const NUMBER_INPUT_BG_COLOR = "rgba(4, 10, 14, 0.94)"; // ~240/255, matching the other cheat windows' backOpacity
    const NUMBER_INPUT_BORDER_COLOR = "#00f0ff";
    const NUMBER_INPUT_CORNER_RADIUS = 14;
    const NUMBER_INPUT_DIGIT_MARGIN_X = 20;
    const NUMBER_INPUT_DIGIT_TOP = 26;
    const NUMBER_INPUT_DIGIT_HEIGHT = 44;
    const NUMBER_INPUT_LEGEND_TEXT = "[Enter] Confirm  |  [Esc] Cancel  |  [◀/▶] Move Digit";

    //-------------------------------------------------------------------
    // A ledger that remembers each party member's parameter bonus amounts.
    // Game_BattlerBase#addParam(paramId, value) can only add a relative
    // value (delta), so to build an absolute-value editing UI (+/- or direct
    // input), we have to track "the total bonus applied to this character so
    // far" ourselves.
    //-------------------------------------------------------------------
    const actorParamBonusMap = new Map();
    function paramBonusKey(actor, paramId) {
        return `${actor.actorId()}_${paramId}`;
    }
    function getActorParamBonus(actor, paramId) {
        return actorParamBonusMap.get(paramBonusKey(actor, paramId)) || 0;
    }
    function setActorParamBonus(actor, paramId, newValue) {
        const key = paramBonusKey(actor, paramId);
        const oldValue = actorParamBonusMap.get(key) || 0;
        const delta = newValue - oldValue;
        if (delta !== 0) actor.addParam(paramId, delta);
        actorParamBonusMap.set(key, newValue);
    }

    //-------------------------------------------------------------------
    // Runtime type detection for Variables.
    // RPG Maker variables don't have a fixed type -- any JS value can be
    // stored into one while an event is running -- so every time we check
    // the actual stored value's type via typeof, only allow editing for
    // Number/Boolean, and display everything else as [Read-Only].
    //-------------------------------------------------------------------
    function variableRawValue(varId) {
        return typeof $gameVariables !== "undefined" && $gameVariables ? $gameVariables.value(varId) : undefined;
    }
    function variableKind(varId) {
        const t = typeof variableRawValue(varId);
        if (t === "number") return "number";
        if (t === "boolean") return "boolean";
        return "readonly";
    }
    function formatVariableValue(varId) {
        const v = variableRawValue(varId);
        const kind = variableKind(varId);
        if (kind === "number") return `${v}`;
        if (kind === "boolean") return v ? "ON" : "OFF";
        if (typeof v === "string") return `[Read-Only] "${v}"`;
        if (v === null) return "[Read-Only] null";
        if (v === undefined) return "[Read-Only] undefined";
        return "[Read-Only] Object";
    }

    //-------------------------------------------------------------------
    // Data descriptor builders
    // type: "number" | "boolean" | "choice" | "item" | "variable" | "enemy" | "action" | "info"
    //-------------------------------------------------------------------
    function buildGeneralDescriptors() {
        return [
            {
                name: "Gold",
                type: "number", step: 100, min: 0, max: 99999999,
                get: () => CheatManager.getGold(),
                set: (v) => CheatManager.setGold(v)
            },
            {
                name: "Game Speed",
                type: "choice", values: [1, 2, 4, 8],
                format: (v) => `x${v}`,
                get: () => CheatManager.getGameSpeed(),
                set: (v) => CheatManager.setGameSpeed(v)
            },
            {
                name: "Dash/Move Speed Multiplier",
                type: "number", step: 0.5, min: 0, max: 8,
                format: (v) => `x${v}`,
                get: () => CheatManager.getMoveSpeedMultiplier(),
                set: (v) => CheatManager.setMoveSpeedMultiplier(v)
            },
            {
                name: "Fast Message Skip",
                type: "boolean",
                get: () => CheatManager.isMessageSkip(),
                set: (v) => CheatManager.setMessageSkip(v)
            }
        ];
    }

    // Builds one party member's worth of descriptor blocks. The "info" row at
    // the top is a non-clickable divider header that makes it clear, when
    // several characters' blocks are concatenated into one list, where each
    // character's section starts and ends.
    function buildActorDescriptors(actor) {
        if (!actor) return [];
        const list = [];
        list.push({
            name: `▼ [ Character: ${actor.name()} ]  Lv.${actor.level}  ${"─".repeat(16)}`,
            type: "info",
            get: () => ""
        });
        list.push({
            name: "Fully Restore HP/MP/TP",
            type: "action",
            get: () => "",
            action: () => {
                actor.setHp(actor.mhp);
                actor.setMp(actor.mmp);
                actor.setTp(actor.maxTp ? actor.maxTp() : 100);
                if (typeof actor.refresh === "function") actor.refresh();
            }
        });
        list.push({
            name: "Level",
            type: "number", step: 1, min: 1, max: actor.maxLevel(),
            get: () => actor.level,
            set: (v) => actor.changeLevel(Math.round(v), false)
        });
        list.push({
            name: "EXP",
            type: "number", step: 100, min: 0, max: 99999999,
            get: () => actor.currentExp(),
            set: (v) => actor.changeExp(Math.max(0, Math.round(v)), false)
        });
        list.push({
            name: "God Mode (Lock HP/MP)",
            type: "boolean",
            get: () => CheatManager.isGodMode(actor.actorId()),
            set: (v) => CheatManager.setGodMode(actor.actorId(), v)
        });
        for (let paramId = 0; paramId < PARAM_NAMES.length; paramId++) {
            list.push({
                name: `${PARAM_NAMES[paramId]} +/- (This Character)`,
                type: "number", step: 1, min: -999, max: 999,
                get: () => getActorParamBonus(actor, paramId),
                set: (v) => setActorParamBonus(actor, paramId, Math.round(v))
            });
        }
        return list;
    }

    // Party-wide options shown at the very top of the Party tab, above every
    // individual member's block: a single toggle affecting the whole party at
    // once, rather than one member at a time.
    function buildPartyLevelDescriptors() {
        return [
            { name: `▼ [ Party-Wide Options ]  ${"─".repeat(16)}`, type: "info", get: () => "" },
            {
                name: "Party God Mode (All Members)",
                type: "boolean",
                get: () => CheatManager.isPartyGodMode(),
                set: (v) => CheatManager.setPartyGodMode(v)
            },
            {
                name: "Party Instant Kill Enemies",
                type: "boolean",
                get: () => CheatManager.isInstantKillMode(),
                set: (v) => CheatManager.setInstantKillMode(v)
            }
        ];
    }

    function buildPartyGlobalDescriptors() {
        const list = [];
        for (let paramId = 0; paramId < PARAM_NAMES.length; paramId++) {
            list.push({
                name: `Party-wide ${PARAM_NAMES[paramId]} Multiplier`,
                type: "number", step: 0.1, min: 0, max: 10,
                format: (v) => `x${v.toFixed(1)}`,
                get: () => CheatManager.getStatMultiplier(paramId),
                set: (v) => CheatManager.setStatMultiplier(paramId, v)
            });
        }
        return list;
    }

    // A list of Instant Kill targets against enemies, shown only while in
    // battle (Scene_Battle). $gameParty.inBattle() reports whether a battle
    // is in progress regardless of which Scene is on top, so this works
    // correctly even when the cheat scene is pushed on top of the battle.
    function buildEnemyDescriptors() {
        if (typeof $gameParty === "undefined" || !$gameParty || !$gameParty.inBattle()) return [];
        if (typeof $gameTroop === "undefined" || !$gameTroop) return [];
        const enemies = $gameTroop.members().filter((e) => !e.isHidden());
        if (enemies.length === 0) return [];
        const list = [{ name: "── In Battle: Enemy Targets ──", type: "info", get: () => "" }];
        enemies.forEach((enemy, index) => {
            list.push({
                name: `${enemy.name()} #${index + 1}`,
                type: "enemy",
                get: () => `HP ${enemy.hp}/${enemy.mhp}   MP ${enemy.mp}/${enemy.mmp}`,
                action: () => {
                    enemy._hp = 0;
                    enemy._mp = 0;
                    if (enemy._tp !== undefined) enemy._tp = 0;
                    enemy.refresh();
                    if (enemy.isDead()) enemy.die();
                }
            });
        });
        return list;
    }

    // The Skills tab has no party-member switching (PageUp/PageDown) at all
    // and is always locked to the party leader ($gameParty.leader()). (A
    // skill grid only makes sense for one character at a time, so it never
    // shows several characters at once.)
    function leaderActor() {
        return typeof $gameParty !== "undefined" && $gameParty && typeof $gameParty.leader === "function"
            ? $gameParty.leader()
            : null;
    }

    // The Party tab drops the concept of "switching the active character"
    // entirely, and instead concatenates every current member's block
    // (leader included) into a single scrollable list in order. It used to
    // switch the target with PageUp/PageDown, which caused incidents where
    // the character shown on screen and the character actually receiving the
    // edits drifted apart -- with no "switching" state to begin with, that
    // bug class simply can't happen anymore.
    function buildPartyDescriptors() {
        const members = typeof $gameParty !== "undefined" && $gameParty && typeof $gameParty.members === "function"
            ? $gameParty.members()
            : [];
        const list = [];
        list.push(...buildPartyLevelDescriptors());
        for (const member of members) {
            list.push(...buildActorDescriptors(member));
        }
        list.push(...buildEnemyDescriptors());
        list.push(...buildPartyGlobalDescriptors());
        return list;
    }

    // Shared descriptor builder for Items/Armors. To fit all three columns
    // [icon+name] - [quantity] - [infinite lock] on a single line, "infinite
    // lock" reuses CheatManager's quantity-lock feature
    // (lockItemQuantity/unlockItemQuantity) as-is: since that lock resets the
    // held amount back to the locked value on every gainItem hook call
    // regardless of consumption/acquisition, it inherently satisfies both
    // meanings at once -- "infinite (doesn't decrease when consumed)" and
    // "fixed quantity". Turning it on uses the currently-held quantity as the
    // lock value.
    function buildItemLikeDescriptors(dataArray) {
        const list = [];
        if (!dataArray) return list;
        for (let i = 1; i < dataArray.length; i++) {
            const entry = dataArray[i];
            if (!entry || !entry.name) continue;
            list.push({
                name: entry.name,
                type: "item",
                item: entry,
                step: 1, min: 0, max: 999,
                get: () => (typeof $gameParty !== "undefined" && $gameParty ? $gameParty.numItems(entry) : 0),
                set: (v) => {
                    const container = RpgBridge.itemContainer(entry);
                    if (container) {
                        container[entry.id] = Math.max(0, Math.min(999, Math.round(v)));
                        if (container[entry.id] === 0) {
                            delete container[entry.id];
                        }
                    }
                },
                isLocked: () => CheatManager.isItemQuantityLocked(entry),
                toggleLock() {
                    if (this.isLocked()) {
                        CheatManager.unlockItemQuantity(entry);
                    } else {
                        CheatManager.lockItemQuantity(entry, this.get());
                    }
                }
            });
        }
        // Virtualized paging: Window_Selectable#drawAllItems only draws
        // maxPageItems() items starting from topIndex(), so no matter how
        // long this list gets (hundreds of entries), only the rows actually
        // visible on screen get rendered. No separate paging implementation
        // is needed.
        return list;
    }

    function buildItemsDescriptors() {
        const list = [
            {
                name: "Infinite Items (No Consume, All Consumables)",
                type: "boolean",
                get: () => CheatManager.isInfiniteItems(),
                set: (v) => CheatManager.setInfiniteItems(v)
            }
        ];
        list.push(...buildItemLikeDescriptors(typeof $dataItems !== "undefined" ? $dataItems : null));
        return list;
    }
    function buildArmorsDescriptors() {
        return buildItemLikeDescriptors(typeof $dataArmors !== "undefined" ? $dataArmors : null);
    }

    function buildSkillsDescriptors() {
        const actor = leaderActor();
        if (!actor || typeof $dataSkills === "undefined" || !$dataSkills) return [];
        const list = [{ name: `Target: ${actor.name()}`, type: "info", get: () => "" }];
        // In an N-column grid, cells fill in index order, so pad the info row
        // with blank cells up to the next row boundary to keep it from
        // appearing crammed into the same row as the next skill.
        while (list.length % SKILLS_TAB_COLUMNS !== 0) {
            list.push({ name: "", type: "info", get: () => "" });
        }
        for (let i = 1; i < $dataSkills.length; i++) {
            const skill = $dataSkills[i];
            if (!skill || !skill.name) continue;
            list.push({
                name: skill.name,
                type: "boolean",
                get: () => actor.isLearnedSkill(skill.id),
                set: (v) => (v ? actor.learnSkill(skill.id) : actor.forgetSkill(skill.id))
            });
        }
        return list;
    }

    function buildVariablesDescriptors() {
        const names = (typeof $dataSystem !== "undefined" && $dataSystem && $dataSystem.variables) || [];
        const list = [];
        for (let i = 1; i < names.length; i++) {
            if (!names[i]) continue; // Skip variables with no name (= unused).
            list.push({
                name: `#${i} ${names[i]}`,
                type: "variable",
                varId: i,
                get: () => variableRawValue(i)
            });
        }
        return list;
    }

    // Filters by the tab-enable parameters. If they're all off (e.g. a
    // configuration mistake) that would leave an empty menu, so as a
    // safeguard all tabs are restored in that case.
    // columns: how many columns the content list is laid out in (Skills uses
    // a multi-column grid; everything else is a single column that uses the
    // full screen width per line).
    const ALL_TABS = [
        { name: "General", enabled: paramBool(PARAMS, "enableGeneralTab", true), builder: buildGeneralDescriptors, columns: 1 },
        { name: "Party", enabled: paramBool(PARAMS, "enablePartyTab", true), builder: buildPartyDescriptors, columns: 1 },
        { name: "Items", enabled: paramBool(PARAMS, "enableItemsTab", true), builder: buildItemsDescriptors, columns: 1 },
        { name: "Armors", enabled: paramBool(PARAMS, "enableArmorsTab", true), builder: buildArmorsDescriptors, columns: 1 },
        { name: "Skills", enabled: paramBool(PARAMS, "enableSkillsTab", true), builder: buildSkillsDescriptors, columns: SKILLS_TAB_COLUMNS },
        { name: "Variables", enabled: paramBool(PARAMS, "enableVariablesTab", true), builder: buildVariablesDescriptors, columns: 1 }
    ];
    // So that game-specific add-on cheat plugins (e.g. CheatEngine_RJ386773.js)
    // loaded after this file can add their own tab via registerTab(), ALL_TABS
    // is kept as a live array that keeps getting pushed to, and is re-filtered
    // every time it's actually used (each getActiveTabs() call). If it were
    // filtered into a constant just once, tabs added by a plugin loaded after
    // this file would never show up in the tab bar.
    function getActiveTabs() {
        const filtered = ALL_TABS.filter((tab) => tab.enabled);
        return filtered.length > 0 ? filtered : ALL_TABS;
    }
    // Public registration API for game-specific extension plugins to use.
    // tab: { name, enabled, builder, columns }
    // (builder has the same signature as the other entries in ALL_TABS: () => descriptor[])
    window.CheatEngineUI = {
        registerTab(tab) {
            if (tab && typeof tab.builder === "function") {
                ALL_TABS.push(Object.assign({ enabled: true, columns: 1 }, tab));
            }
        }
    };

    //-------------------------------------------------------------------
    // Window_CheatTab: the top tab bar. Up to TAB_MAX_COLS columns; wraps to
    // the next row automatically once there are more tabs than that (e.g. a
    // 6th tab, Variables, wraps to the 2nd row). Simply overriding maxCols()
    // on top of Window_Command lets Window_Selectable's default
    // cursorUp/Down/Left/Right handle the 2D grid movement automatically.
    //-------------------------------------------------------------------
    class Window_CheatTab extends Window_Command {
        // Note: RpgBridge.initWindow() is meant to be called externally
        // against "an already-constructed instance"; calling this.initialize(...)
        // again from inside its own initialize override, as we would do here,
        // would recurse infinitely. So here we branch directly on the
        // RpgBridge.isMZ flag and call super.initialize(...) instead.
        initialize(x, y, width, height) {
            if (RpgBridge.isMZ) {
                super.initialize(new Rectangle(x, y, width, height));
            } else {
                super.initialize(x, y);
            }
            // Default RPG Maker backOpacity (192) lets the map show through
            // enough to clash with the cheat text on top of it; push it much
            // darker/more opaque so the tab bar stays readable over any map.
            this.backOpacity = 240;
        }
        windowWidth() {
            return Graphics.boxWidth;
        }
        windowHeight() {
            return panelHeight(2);
        }
        maxCols() {
            return Math.min(TAB_MAX_COLS, getActiveTabs().length);
        }
        makeCommandList() {
            for (const tab of getActiveTabs()) {
                this.addCommand(tab.name, "select", true);
            }
        }
        setChangeHandler(handler) {
            this._changeHandler = handler;
            this.callUpdateHelp();
        }
        callUpdateHelp() {
            if (this._changeHandler) this._changeHandler();
        }
        // If the tab bar is already on its last row and Down is pressed,
        // trigger the same thing as Z (ok): "confirm the current tab -> move
        // focus into the content list". While there's still another row
        // above, this simply moves the cursor to that row as usual. Reuses
        // the same condition the default cursorDown() uses to decide whether
        // it can move (index + maxCols < maxItems) to determine "there's no
        // row below".
        cursorDown(wrap) {
            const index = this.index();
            const cols = this.maxCols();
            const hasRowBelow = index + cols < this.maxItems();
            if (hasRowBelow) {
                super.cursorDown(wrap);
            } else {
                this.processOk();
            }
        }
    }

    //-------------------------------------------------------------------
    // Window_CheatContent: a single content window that uses the full screen
    // width. Left/Right arrows (on non-grid, single-column tabs) are used to
    // adjust the value in place rather than move through the list, and Z (Ok)
    // immediately applies a toggle/cycle/big-step adjustment inline, keeping
    // focus in this window afterward (it never hands off to another window).
    //-------------------------------------------------------------------
    class Window_CheatContent extends Window_Command {
        // _descriptors / _columns / _cheatWidth / _cheatHeight must be set
        // before calling super.initialize(...), since windowWidth()/windowHeight()
        // (on the MV code path) and makeCommandList() (on both code paths)
        // are called during it.
        initialize(x, y, width, height) {
            this._descriptors = [];
            this._columns = 1;
            this._cheatWidth = width;
            this._cheatHeight = height;
            this._directInputHandler = null;
            if (RpgBridge.isMZ) {
                super.initialize(new Rectangle(x, y, width, height));
            } else {
                super.initialize(x, y);
            }
            // Same readability fix as Window_CheatTab: a much darker/more
            // opaque background so cheat values never wash out against the
            // map or battle scene behind this window.
            this.backOpacity = 240;
        }
        windowWidth() {
            return this._cheatWidth || Graphics.boxWidth;
        }
        windowHeight() {
            return this._cheatHeight || Graphics.boxHeight - panelHeight(2);
        }
        maxCols() {
            return this._columns || 1;
        }
        makeCommandList() {
            for (const desc of this._descriptors) {
                const enabled = desc.type !== "info";
                this.addCommand(desc.name, "select", enabled, desc);
            }
        }
        setDescriptors(list, columns) {
            this._descriptors = list || [];
            this._columns = columns || 1;
            this.refresh();
            this.select(this._descriptors.length > 0 ? 0 : -1);
            // MV's select() internally calls ensureCursorVisible() and
            // auto-adjusts scroll, but MZ's select() only refreshes the
            // cursor display and doesn't touch scroll (scrollTo is only
            // called from things like cursorDown/Up). As a result, if you
            // scrolled far down a list on a previous tab and then switched
            // tabs, the scroll position would stay put, and only get
            // corrected late -- with a smooth-scroll animation -- on the next
            // arrow key press in MZ, making the screen appear to jitter up
            // and down. Calling it with no arguments is safe on both MV/MZ
            // (both signatures accept it), and on MZ, with no smooth
            // argument, it snaps the scroll immediately with no animation.
            this.ensureCursorVisible();
            this.callUpdateHelp();
        }
        setChangeHandler(handler) {
            this._changeHandler = handler;
            this.callUpdateHelp();
        }
        callUpdateHelp() {
            if (this._changeHandler) this._changeHandler();
        }
        setDirectInputHandler(handler) {
            this._directInputHandler = handler;
        }
        update() {
            super.update();
            if (this.active && Input.isTriggered("shift")) {
                const desc = this.currentExt();
                if (desc && this._supportsDirectInput(desc) && this._directInputHandler) {
                    this._directInputHandler(desc);
                }
            }
        }
        _supportsDirectInput(desc) {
            if (desc.type === "number" || desc.type === "item") return true;
            if (desc.type === "variable") return variableKind(desc.varId) === "number";
            return false;
        }
        // On the grid tab (Skills), Left/Right are used for column movement,
        // so the default behavior is kept as-is; on single-column tabs
        // (General/Party/Items/Armors/Variables), Left/Right are redefined to
        // "adjust the value in place".
        cursorRight() {
            if (this._columns > 1) {
                super.cursorRight();
            } else {
                this._adjust(1);
            }
        }
        cursorLeft() {
            if (this._columns > 1) {
                super.cursorLeft();
            } else {
                this._adjust(-1);
            }
        }
        // The default Window_Command#processOk deactivates the window and
        // hands off to a handler after being called, so this is fully
        // overridden to keep focus in this window for inline toggling.
        processOk() {
            const desc = this.currentExt();
            if (!desc || desc.type === "info") {
                this.playBuzzerSound();
                return;
            }
            SoundManager.playOk();
            this._applyOkAction(desc);
            this.refresh();
        }
        _adjust(direction) {
            const desc = this.currentExt();
            if (!desc) return;
            switch (desc.type) {
                case "boolean":
                    desc.set(!desc.get());
                    break;
                case "number":
                case "item":
                    this._stepValue(desc, direction);
                    break;
                case "choice":
                    this._cycleChoice(desc, direction);
                    break;
                case "variable":
                    this._adjustVariable(desc, direction);
                    break;
                case "enemy":
                case "action":
                    desc.action();
                    break;
                default:
                    return; // "info" etc.: not adjustable, no sound
            }
            SoundManager.playCursor();
            this.refresh();
        }
        _applyOkAction(desc) {
            switch (desc.type) {
                case "boolean":
                    desc.set(!desc.get());
                    break;
                case "item":
                    desc.toggleLock();
                    break;
                case "choice":
                    this._cycleChoice(desc, 1);
                    break;
                case "variable":
                    this._applyVariableOk(desc);
                    break;
                case "enemy":
                case "action":
                    desc.action();
                    break;
                case "number":
                    this._stepValue(desc, 10); // Z: big-step adjustment (step * 10)
                    break;
                default:
                    break; // "info": no action
            }
        }
        _stepValue(desc, direction) {
            const step = (desc.step || 1) * direction;
            let v = (desc.get() || 0) + step;
            if (desc.min !== undefined) v = Math.max(desc.min, v);
            if (desc.max !== undefined) v = Math.min(desc.max, v);
            v = Math.round(v * 100) / 100;
            desc.set(v);
        }
        _cycleChoice(desc, direction) {
            const values = desc.values || [];
            if (values.length === 0) return;
            let idx = values.indexOf(desc.get());
            if (idx < 0) idx = 0;
            idx = (idx + direction + values.length) % values.length;
            desc.set(values[idx]);
        }
        _adjustVariable(desc, direction) {
            const kind = variableKind(desc.varId);
            if (kind === "number") {
                CheatManager.setNumberVariable(desc.varId, CheatManager.getNumberVariable(desc.varId) + direction);
            } else if (kind === "boolean") {
                CheatManager.setBooleanVariable(desc.varId, !CheatManager.getBooleanVariable(desc.varId));
            } else {
                this.playBuzzerSound(); // [Read-Only]: value cannot be changed
            }
        }
        _applyVariableOk(desc) {
            const kind = variableKind(desc.varId);
            if (kind === "boolean") {
                CheatManager.setBooleanVariable(desc.varId, !CheatManager.getBooleanVariable(desc.varId));
            } else if (kind === "number") {
                CheatManager.setNumberVariable(desc.varId, CheatManager.getNumberVariable(desc.varId) + 10);
            } else {
                this.playBuzzerSound();
            }
        }
        // Draws directly instead of relying on Window_Command#drawItem's
        // default implementation: MV's itemTextAlign() is "left" while MZ's is
        // "center", which can make the name and the value/status overlap
        // differently in a grid cell, so both engines are unified to the same
        // rule -- "name from the left, value/status from the right".
        drawItem(index) {
            const desc = this._list[index] && this._list[index].ext;
            if (!desc) return;
            const rect = RpgBridge.itemLineRect(this, index);
            this.changePaintOpacity(this.isCommandEnabled(index));
            this.resetTextColor();

            if (desc.type === "info") {
                this.drawText(desc.name, rect.x, rect.y, rect.width, "left");
            } else if (desc.type === "item") {
                this._drawItemRow(desc, rect);
            } else if (this._columns > 1) {
                this._drawGridRow(desc, rect);
            } else {
                this._drawLineRow(desc, rect);
            }

            this.changePaintOpacity(true);
        }
        // Three independent columns -- [icon+name] / [Qty] / [Lock status] --
        // laid out by anchoring each right-aligned column to a fixed pixel
        // offset from the rect's right edge, rather than two adjacent
        // fixed-width boxes flush against each other. That gap between the
        // two anchors (180px and 40px) is what keeps "Qty: 0" and
        // "[Lock: ON]" from ever visually crowding into each other on a
        // narrow value like "0".
        _drawItemRow(desc, rect) {
            const QTY_RIGHT_OFFSET = 180;
            const LOCK_RIGHT_OFFSET = 40;
            const QTY_COL_WIDTH = 110;
            const LOCK_COL_WIDTH = 130;
            const NAME_GAP = 10;
            const iconWidth = desc.item && desc.item.iconIndex ? 36 : 0;

            let x = rect.x;
            if (iconWidth > 0) {
                this.drawIcon(desc.item.iconIndex, x, rect.y + 2);
                x += iconWidth;
            }

            const qtyRight = rect.x + rect.width - QTY_RIGHT_OFFSET;
            const qtyX = qtyRight - QTY_COL_WIDTH;
            const nameWidth = Math.max(0, qtyX - NAME_GAP - x);
            this.drawText(desc.name, x, rect.y, nameWidth, "left");

            this.resetTextColor();
            this.drawText(`Qty: ${desc.get()}`, qtyX, rect.y, QTY_COL_WIDTH, "right");

            const lockRight = rect.x + rect.width - LOCK_RIGHT_OFFSET;
            const lockX = lockRight - LOCK_COL_WIDTH;
            const locked = desc.isLocked();
            // High-contrast gold for ON, subtle gray for OFF -- immediately
            // readable regardless of the current windowskin's own palette.
            this.changeTextColor(locked ? "#ffd700" : "#8a8f96");
            this.drawText(`[Lock: ${locked ? "ON" : "OFF"}]`, lockX, rect.y, LOCK_COL_WIDTH, "right");
            this.resetTextColor();
        }
        // Grid (Skills): name plus a short ON/OFF indicator in a narrow cell.
        // The name is drawn in a slightly smaller font to avoid overlapping text.
        _drawGridRow(desc, rect) {
            const indicatorWidth = 60;
            const nameWidth = Math.max(0, rect.width - indicatorWidth - 8);
            const originalFontSize = this.contents.fontSize;
            this.contents.fontSize = Math.min(originalFontSize, 22);
            this.drawText(desc.name, rect.x, rect.y, nameWidth, "left");
            this.contents.fontSize = originalFontSize;

            const on = !!desc.get();
            if (on) this.changeTextColor(RpgBridge.textColor(this, 17));
            this.drawText(on ? "ON" : "OFF", rect.x + rect.width - indicatorWidth, rect.y, indicatorWidth, "right");
            this.resetTextColor();
        }
        // Single-column tabs (General/Party/Variables): name on the left, value/status on the right.
        _drawLineRow(desc, rect) {
            this.drawText(desc.name, rect.x, rect.y, rect.width, "left");
            if (desc.type === "boolean" && desc.get()) {
                this.changeTextColor(RpgBridge.textColor(this, 17));
            }
            this.drawText(this._formatValue(desc), rect.x, rect.y, rect.width, "right");
            this.resetTextColor();
        }
        _formatValue(desc) {
            const value = desc.get();
            if (desc.type === "boolean") return value ? "ON" : "OFF";
            if (desc.type === "action") return "Execute: Z / ◀▶";
            if (desc.type === "choice") return desc.format ? desc.format(value) : `${value}`;
            if (desc.type === "variable") return formatVariableValue(desc.varId);
            if (desc.type === "enemy") return value;
            if (desc.format) return desc.format(value);
            return `${value}`;
        }
    }

    //-------------------------------------------------------------------
    // Window_CheatNumberInput: a Shift-triggered direct-input (digit-editing)
    // overlay, reskinned as a compact sci-fi dial: the native windowskin
    // back/frame/cursor are hidden entirely (opacity = 0) and replaced with a
    // hand-drawn dark glass panel, a glowing neon border, oversized digits,
    // and floating ▲/▼ arrows over whichever digit is currently selected.
    //-------------------------------------------------------------------
    class Window_CheatNumberInput extends Window_Selectable {
        initialize(x, y, width, height) {
            this._number = 0;
            this._maxDigits = 6;
            this._descriptor = null;
            if (RpgBridge.isMZ) {
                super.initialize(new Rectangle(x, y, width, height));
            } else {
                super.initialize(x, y, width, height);
            }
            // Hide the windowskin-drawn back/frame/cursor entirely; contents
            // (everything drawn below) stays fully visible via the separate
            // contentsOpacity property. backOpacity is set for consistency
            // with the other cheat windows, though with opacity 0 the actual
            // darkness/readability here comes from NUMBER_INPUT_BG_COLOR's
            // own alpha in _drawPanelBackground() instead.
            this.opacity = 0;
            this.backOpacity = 240;
            this.deactivate();
            this.hide();
        }
        maxCols() {
            return this._maxDigits;
        }
        maxItems() {
            return this._maxDigits;
        }
        itemWidth() {
            const cw = this.contents ? this.contents.width : NUMBER_INPUT_WIDTH;
            const available = Math.max(10, cw - NUMBER_INPUT_DIGIT_MARGIN_X * 2);
            return Math.floor(available / Math.max(1, this._maxDigits));
        }
        // Fully custom placement (rather than the default row/col + spacing
        // math) so every digit cell sits exactly on the dial's digit row,
        // regardless of how many digits this particular value needs.
        itemRect(index) {
            const width = this.itemWidth();
            const x = NUMBER_INPUT_DIGIT_MARGIN_X + index * width;
            return new Rectangle(x, NUMBER_INPUT_DIGIT_TOP, width, NUMBER_INPUT_DIGIT_HEIGHT);
        }
        setup(descriptor) {
            this._descriptor = descriptor;
            const rawMax = descriptor.max !== undefined ? Math.abs(descriptor.max) : 99999999;
            this._maxDigits = Math.max(1, Math.min(9, String(Math.floor(rawMax)).length));
            const current = Math.max(0, Math.floor(Number(descriptor.get()) || 0));
            this._number = Math.min(current, Math.pow(10, this._maxDigits) - 1);
            this.refresh();
            this.select(0);
        }
        getDescriptor() {
            return this._descriptor;
        }
        confirmedValue() {
            return this._number;
        }
        update() {
            super.update();
            this._processDigitChange();
        }
        // Up/Down are used for incrementing/decrementing the digit value
        // (since this is a single-row window, the default cursor movement
        // wouldn't otherwise trigger). Left/Right are handled by
        // Window_Selectable's default cursorRight/cursorLeft, which already
        // move the digit cursor correctly.
        _processDigitChange() {
            if (this.isOpenAndActive()) {
                if (Input.isRepeated("up")) {
                    this._changeDigit(true);
                } else if (Input.isRepeated("down")) {
                    this._changeDigit(false);
                }
            }
        }
        _changeDigit(up) {
            const index = this.index();
            const place = Math.pow(10, this._maxDigits - 1 - index);
            let n = Math.floor(this._number / place) % 10;
            this._number -= n * place;
            n = up ? (n + 1) % 10 : (n + 9) % 10;
            this._number += n * place;
            this.refresh();
            SoundManager.playCursor();
        }
        // Draw order: dark glass panel + neon border first (bottom layer),
        // then every digit (via the inherited per-item loop, calling our
        // drawItem() override below), then the dial arrows over the active
        // digit and the instruction legend on top of everything.
        drawAllItems() {
            this._drawPanelBackground();
            super.drawAllItems();
            this._drawDialArrows();
            this._drawLegend();
        }
        // Dark, semi-transparent glass panel with rounded corners and a
        // thin, glowing neon cyan border, drawn directly via the contents
        // bitmap's underlying canvas context (Bitmap has no built-in
        // rounded-rect/stroke helpers of its own).
        _drawPanelBackground() {
            if (!this.contents) return;
            const w = this.contents.width;
            const h = this.contents.height;
            const r = NUMBER_INPUT_CORNER_RADIUS;
            const ctx = this.contents.context;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(r, 0);
            ctx.arcTo(w, 0, w, h, r);
            ctx.arcTo(w, h, 0, h, r);
            ctx.arcTo(0, h, 0, 0, r);
            ctx.arcTo(0, 0, w, 0, r);
            ctx.closePath();
            ctx.fillStyle = NUMBER_INPUT_BG_COLOR;
            ctx.fill();
            ctx.shadowColor = NUMBER_INPUT_BORDER_COLOR;
            ctx.shadowBlur = 10;
            ctx.lineWidth = 2;
            ctx.strokeStyle = NUMBER_INPUT_BORDER_COLOR;
            ctx.stroke();
            ctx.restore();
            // Bitmap has no public "I just drew on your canvas directly"
            // method of its own; poking its PIXI baseTexture is the
            // standard way plugins flag a manually-drawn canvas region for
            // a GPU texture refresh (Bitmap's own fillRect/drawText/etc.
            // do the same internally after they touch the context).
            if (this.contents.baseTexture && typeof this.contents.baseTexture.update === "function") {
                this.contents.baseTexture.update();
            }
        }
        // Large, clean, high-contrast digits -- the currently active digit
        // rendered bigger and pure white, the rest dimmed, so the dial's
        // current focus is unmistakable at a glance.
        drawItem(index) {
            if (!this.contents) return;
            const rect = this.itemRect(index);
            const s = this._number.padZero(this._maxDigits);
            const isActive = index === this.index();
            this.contents.fontSize = Math.min(isActive ? 34 : 28, rect.width - 4);
            this.changeTextColor(isActive ? "#ffffff" : "#7fb8c9");
            this.drawText(s[index], rect.x, rect.y, rect.width, "center");
            this.resetFontSettings();
        }
        // Elegant ▲/▼ dial-arrow indicators floating directly above/below
        // the active digit, replacing the native cursor box that opacity=0
        // hides.
        _drawDialArrows() {
            if (!this.contents) return;
            const rect = this.itemRect(this.index());
            this.contents.fontSize = 18;
            this.changeTextColor(NUMBER_INPUT_BORDER_COLOR);
            this.drawText("▲", rect.x, rect.y - 20, rect.width, "center");
            this.drawText("▼", rect.x, rect.y + rect.height + 2, rect.width, "center");
            this.resetFontSettings();
        }
        // Small, muted instruction legend along the bottom edge of the panel.
        _drawLegend() {
            if (!this.contents) return;
            const w = this.contents.width;
            const y = this.contents.height - 20;
            this.contents.fontSize = 14;
            this.changeTextColor("#8a99a6");
            this.drawText(NUMBER_INPUT_LEGEND_TEXT, 4, y, w - 8, "center");
            this.resetFontSettings();
        }
    }

    //-------------------------------------------------------------------
    // Scene_Cheat
    //-------------------------------------------------------------------
    class Scene_Cheat extends RpgBridge.baseMenuSceneClass() {
        create() {
            super.create();
            this.createTabWindow();
            this.createContentWindow();
            this.createNumberInputWindow();

            this._tabWindow.setHandler("select", this.onTabOk.bind(this));
            this._tabWindow.setHandler("cancel", this.onTabCancel.bind(this));
            this._tabWindow.setChangeHandler(this.onTabChange.bind(this));

            this._contentWindow.setHandler("cancel", this.onContentCancel.bind(this));
            this._contentWindow.setDirectInputHandler(this.onRequestDirectInput.bind(this));

            this._numberInputWindow.setHandler("ok", this.onNumberInputOk.bind(this));
            this._numberInputWindow.setHandler("cancel", this.onNumberInputCancel.bind(this));

            this.onTabChange();
            this._contentWindow.deactivate();
            this._tabWindow.activate();
            this._refreshFocusVisuals();
        }
        createTabWindow() {
            this._tabWindow = new Window_CheatTab(0, 0, Graphics.boxWidth, panelHeight(2));
            this.addWindow(this._tabWindow);
        }
        createContentWindow() {
            const y = this._tabWindow.height;
            const width = Graphics.boxWidth;
            const height = Graphics.boxHeight - y;
            this._contentWindow = new Window_CheatContent(0, y, width, height);
            this.addWindow(this._contentWindow);
        }
        // Deliberately NOT added via this.addWindow() (which would put it
        // inside this._windowLayer, alongside the tab/content windows).
        // WindowLayer uses a stencil-buffer trick so overlapping window
        // backgrounds don't double-blend, and since Window_CheatContent's
        // rect covers nearly the whole screen, that masking could still
        // swallow this window in the overlap regardless of its order among
        // WindowLayer's own children. Adding it as a direct child of the
        // Scene instead -- rendered after _windowLayer in the Scene's own
        // child list -- makes it plain, unambiguous top-most PIXI z-order,
        // completely bypassing that masking.
        createNumberInputWindow() {
            const width = NUMBER_INPUT_WIDTH;
            const height = NUMBER_INPUT_HEIGHT;
            const x = (Graphics.boxWidth - width) / 2;
            const y = (Graphics.boxHeight - height) / 2;
            this._numberInputWindow = new Window_CheatNumberInput(x, y, width, height);
            this.addChild(this._numberInputWindow);
        }
        onTabChange() {
            const tab = getActiveTabs()[this._tabWindow.index()];
            this._contentWindow.setDescriptors(tab ? tab.builder(this) : [], tab ? tab.columns : 1);
        }
        onTabOk() {
            this._tabWindow.deactivate();
            this._contentWindow.activate();
            this._refreshFocusVisuals();
        }
        onTabCancel() {
            this.popScene();
        }
        onContentCancel() {
            this._contentWindow.deactivate();
            this._tabWindow.activate();
            this._refreshFocusVisuals();
        }
        onRequestDirectInput(descriptor) {
            this._contentWindow.deactivate();
            this._numberInputWindow.setup(descriptor);
            this._bringNumberInputToFront();
            this._numberInputWindow.show();
            this._numberInputWindow.activate();
        }
        // Even though createNumberInputWindow() already runs last in create()
        // (so it starts on top of everything else), re-adding it directly to
        // the Scene immediately before every open is a cheap guard against
        // any future change to that creation order, or against some other
        // plugin adding its own window/sprite to the Scene afterward --
        // removeChild + addChild moves it to the very end of the Scene's own
        // children, which PIXI always renders last (i.e. on top of
        // everything, including the entire _windowLayer).
        _bringNumberInputToFront() {
            if (this._numberInputWindow) {
                this.removeChild(this._numberInputWindow);
                this.addChild(this._numberInputWindow);
            }
        }
        onNumberInputOk() {
            const d = this._numberInputWindow.getDescriptor();
            if (d && d.set) {
                let v = this._numberInputWindow.confirmedValue();
                if (d.min !== undefined) v = Math.max(d.min, v);
                if (d.max !== undefined) v = Math.min(d.max, v);
                d.set(v);
            }
            this._closeNumberInput();
        }
        onNumberInputCancel() {
            this._closeNumberInput();
        }
        _closeNumberInput() {
            this._numberInputWindow.hide();
            this._numberInputWindow.deactivate();
            this._contentWindow.refresh();
            this._contentWindow.activate();
        }
        // Dims the contents opacity of whichever window doesn't have focus,
        // so it's clear at a glance whether you're currently picking a tab or
        // operating on a content item below.
        _refreshFocusVisuals() {
            const tabActive = this._tabWindow.active;
            this._tabWindow.contentsOpacity = tabActive ? 255 : 160;
            this._contentWindow.contentsOpacity = tabActive ? 160 : 255;
        }
    }

    //-------------------------------------------------------------------
    // Toggle input: keyboard (TOGGLE_KEY_CODE) / gamepad (GAMEPAD_START_BUTTON, configurable via parameter)
    //-------------------------------------------------------------------
    let gamepadStartWasPressed = false;
    let messageSkipWasPressed = false;

    function isCheatSceneActive() {
        return typeof SceneManager !== "undefined" && SceneManager._scene instanceof Scene_Cheat;
    }

    function toggleCheatScene() {
        if (!RpgBridge.isGameReady()) return;
        if (isCheatSceneActive()) {
            SceneManager.pop();
        } else {
            SceneManager.push(Scene_Cheat);
        }
    }

    document.addEventListener("keydown", (event) => {
        if (event.keyCode === TOGGLE_KEY_CODE) {
            event.preventDefault();
            toggleCheatScene();
        } else if (event.key === "F7") {
            event.preventDefault();
            CheatManager.setMessageSkip(!CheatManager.isMessageSkip());
        } else if (event.key === "F12") {
            event.preventDefault();
            require("nw.gui").Window.get().showDevTools();
        }
    });

    // The gamepad Start button (index 9 by default) isn't included in RPG
    // Maker's default Input.gamepadMapper, so it's polled manually every
    // frame by piggybacking on Input.update(). Can be turned off entirely via
    // the enableGamepadToggle parameter.
    if (ENABLE_GAMEPAD_TOGGLE && typeof Input !== "undefined") {
        const _inputUpdate = Input.update;
        Input.update = function () {
            _inputUpdate.call(this);
            const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : null;
            const pad = pads && pads[0];
            const button1 = pad && pad.buttons && pad.buttons[GAMEPAD_START_BUTTON];
            const button2 = pad && pad.buttons && pad.buttons[8];
            const pressed1 = !!(button1 && button1.pressed);
            const pressed2 = !!(button2 && button2.pressed);
            if (pressed1 && !gamepadStartWasPressed) {
                toggleCheatScene();
            }
            gamepadStartWasPressed = pressed1;
            if (pressed2 && !messageSkipWasPressed) {
                CheatManager.setMessageSkip(!CheatManager.isMessageSkip());
            }
            messageSkipWasPressed = pressed2;
        };
    }

    window.Scene_Cheat = Scene_Cheat;
    window.Window_CheatTab = Window_CheatTab;
    window.Window_CheatContent = Window_CheatContent;
    window.Window_CheatNumberInput = Window_CheatNumberInput;
})();
