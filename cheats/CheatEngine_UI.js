//=============================================================================
// CheatEngine_UI.js
//=============================================================================
/*:
 * @plugindesc [Cheat Engine] UI v1.2.0 - In-game cheat menu UI consuming CheatEngine_Core.js.
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
 * @desc Show the Party tab (level/EXP/params/God Mode, in-battle enemy Instant Kill) in the tab bar.
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
 *   - Arrow keys : switch tab / move list selection / adjust value
 *   - Z (ok)     : toggle, cycle choice, big-step adjust, execute Instant Kill...
 *   - X (cancel) : go back one level
 *   - Shift      : open the direct-input overlay (number/item qty/variable)
 *   - PageUp/PageDown : (Party/Skills tab) switch target party member
 *
 * Layout:
 *   - Window_CheatTab        : horizontal tab bar (General/Party/Items/Armors/Skills/Variables)
 *   - Window_CheatCommand    : left-side feature list
 *   - Window_CheatValueEdit  : right-side value adjust / toggle pane
 *   - Window_CheatNumberInput: Shift-triggered direct-input overlay
 *
 * Each tab can be hidden from the tab bar via its "Enable ... Tab" parameter
 * above (the underlying CheatManager feature stays fully usable via script
 * calls either way -- the parameter only controls menu visibility).
 * -----------------------------------------------------------------------------
 */
/*:ko
 * @plugindesc [치트 엔진] UI v1.2.0 - CheatEngine_Core.js의 API를 사용하는 인게임 치트 UI
 * @author rpghack
 * @base CheatEngine_Core
 * @orderAfter CheatEngine_Core
 * @url
 *
 * @param toggleKeyCode
 * @text 토글 단축키 (keyCode)
 * @type number
 * @min 0
 * @max 255
 * @default 119
 * @desc 치트 메뉴를 열고 닫는 브라우저 keyCode입니다. 기본값 119 = F8.
 *
 * @param enableGamepadToggle
 * @text 게임패드 토글 사용
 * @type boolean
 * @on 사용
 * @off 사용 안 함
 * @default true
 * @desc true(사용)면 게임패드 버튼으로도 메뉴를 열고 닫을 수 있습니다
 * (기본 Input.gamepadMapper에 없는 버튼이라 직접 폴링합니다).
 *
 * @param gamepadStartButtonIndex
 * @text 게임패드 버튼 번호
 * @type number
 * @min 0
 * @max 31
 * @default 9
 * @desc 메뉴를 토글할 표준 Gamepad API 버튼 인덱스입니다. 기본값 9 = Start.
 *
 * @param enableGeneralTab
 * @text "General" 탭 사용
 * @type boolean
 * @default true
 * @desc 상단 탭 목록에 General 탭(골드/배속/이동속도/메시지 스킵)을 표시합니다.
 *
 * @param enablePartyTab
 * @text "Party" 탭 사용
 * @type boolean
 * @default true
 * @desc 상단 탭 목록에 Party 탭(레벨/EXP/파라미터/God Mode, 전투 중 적 즉사)을 표시합니다.
 *
 * @param enableItemsTab
 * @text "Items" 탭 사용
 * @type boolean
 * @default true
 * @desc 상단 탭 목록에 Items 탭을 표시합니다.
 *
 * @param enableArmorsTab
 * @text "Armors" 탭 사용
 * @type boolean
 * @default true
 * @desc 상단 탭 목록에 Armors 탭을 표시합니다.
 *
 * @param enableSkillsTab
 * @text "Skills" 탭 사용
 * @type boolean
 * @default true
 * @desc 상단 탭 목록에 Skills 탭을 표시합니다.
 *
 * @param enableVariablesTab
 * @text "Variables" 탭 사용
 * @type boolean
 * @default true
 * @desc 상단 탭 목록에 Variables 탭을 표시합니다.
 *
 * @help
 * CheatEngine_UI.js
 * -----------------------------------------------------------------------------
 * CheatEngine_Core.js(window.CheatManager / window.RpgBridge)를 소비하는
 * 인게임 치트 메뉴 UI입니다.
 *
 * 설치 방법:
 *   1) 분리형 설치: 플러그인 목록에서 CheatEngine_Core.js를 이 플러그인보다
 *      위쪽(먼저 로드되도록) 배치하고 둘 다 켜(ON) 두세요.
 *   2) 단일 파일(결합형) 설치: 이 파일의 본문을 CheatEngine_Core.js의 본문과
 *      하나의 .js 파일로 이어 붙여도 됩니다. 두 코드 블록 모두 자신이 실행 중인
 *      <script> 태그(document.currentScript)로부터 스스로의 플러그인 이름을
 *      알아내므로 그대로 잘 동작합니다(자세한 내용은 CheatEngine_Core.js의
 *      도움말 참고).
 *
 * 토글 입력:
 *   - 키보드 F8 ("토글 단축키" 파라미터로 변경 가능)
 *   - 게임패드 Start 버튼 (기본 index 9, 파라미터로 변경/비활성화 가능)
 *
 * 창이 열린 뒤 기본 조작:
 *   - 방향키 : 탭 전환 / 목록 이동 / 값 조절
 *   - Z(확인) : 토글, 전환, 큰 폭 조절, 즉사 실행 등
 *   - X(취소) : 한 단계 뒤로
 *   - Shift : (숫자/아이템 수량/변수 항목에서) 직접 입력 창 열기
 *   - PageUp / PageDown : (Party/Skills 탭에서) 대상 파티원 전환
 *
 * 레이아웃:
 *   - Window_CheatTab        : 상단 가로 탭 (General/Party/Items/Armors/Skills/Variables)
 *   - Window_CheatCommand    : 좌측 기능 목록
 *   - Window_CheatValueEdit  : 우측 수치 조절 / 토글 창
 *   - Window_CheatNumberInput: Shift로 여는 직접 입력 오버레이 창
 *
 * 위의 "... 탭 사용" 파라미터로 각 탭을 상단 탭 목록에서 숨길 수 있습니다
 * (탭을 숨겨도 해당 CheatManager 기능 자체는 스크립트 호출로 계속 사용할 수
 * 있으며, 파라미터는 메뉴에 보이는지 여부만 제어합니다).
 * -----------------------------------------------------------------------------
 */

(() => {
    "use strict";

    if (
        typeof Window_Selectable === "undefined" ||
        typeof Window_Command === "undefined" ||
        typeof Window_HorzCommand === "undefined" ||
        typeof Scene_Base === "undefined"
    ) {
        console.error("CheatEngine_UI.js: RPG Maker 코어 스크립트가 로드되지 않았습니다.");
        return;
    }
    if (typeof RpgBridge === "undefined" || typeof CheatManager === "undefined" || !CheatManager) {
        console.error("CheatEngine_UI.js: CheatEngine_Core.js가 먼저 로드되어야 합니다.");
        return;
    }

    //-------------------------------------------------------------------
    // 플러그인 이름 동적 해석 + 파라미터 읽기 (분리형/결합형 설치 양쪽 대응)
    // CheatEngine_Core.js와 동일한 방식: document.currentScript로 "지금 실행
    // 중인 <script> 태그"의 파일명을 알아내 PluginManager.parameters()를 조회한다.
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
    // RpgBridge 확장 : MV/MZ 메서드명 차이 흡수
    //-------------------------------------------------------------------
    // MZ는 색상 관련 기능을 Window_Base에서 ColorManager로 분리했다.
    RpgBridge.textColor = function (windowInstance, colorId) {
        if (typeof ColorManager !== "undefined" && ColorManager.textColor) {
            return ColorManager.textColor(colorId);
        }
        return windowInstance.textColor(colorId);
    };

    // Window_Command#drawItem이 내부적으로 쓰는 "텍스트 영역" 계산 메서드명이
    // MV(itemRectForText)와 MZ(itemLineRect)에서 서로 다르다.
    RpgBridge.itemLineRect = function (windowInstance, index) {
        return RpgBridge.isMZ
            ? windowInstance.itemLineRect(index)
            : windowInstance.itemRectForText(index);
    };

    // 레이아웃 상수 (기본 폰트 크기 26 / 라인높이 36 / 패딩 12 기준 고정값)
    const LINE_HEIGHT = 36;
    const WINDOW_PADDING = 12;
    function panelHeight(lines) {
        return lines * LINE_HEIGHT + WINDOW_PADDING * 2;
    }

    const PARAM_NAMES = ["최대HP", "최대MP", "공격력", "방어력", "마법력", "마법방어", "민첩성", "운"];
    const SKILLS_TAB_COLUMNS = 4;

    //-------------------------------------------------------------------
    // 파티원별 파라미터 증감 값을 기억해 두는 장부.
    // Game_BattlerBase#addParam(paramId, value)는 상대값(delta)만 더할 수
    // 있으므로, "현재까지 이 캐릭터에게 몰아준 보너스 총량"을 직접 추적해야
    // 절대값 편집(증감/직접입력) UI를 만들 수 있다.
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
    // 변수(Variable) 런타임 타입 판별.
    // RPG Maker 변수는 타입이 고정되어 있지 않고 이벤트 실행 중 어떤 JS 값이든
    // 담길 수 있으므로, 매번 typeof로 실제 저장된 값의 타입을 확인해서
    // Number/Boolean만 편집을 허용하고 나머지는 [Read-Only]로 표시한다.
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
    // 데이터 서술자(descriptor) 빌더
    // type: "number" | "boolean" | "choice" | "item" | "variable" | "enemy" | "info"
    //-------------------------------------------------------------------
    function buildGeneralDescriptors() {
        return [
            {
                name: "골드",
                type: "number", step: 100, min: 0, max: 99999999,
                get: () => CheatManager.getGold(),
                set: (v) => CheatManager.setGold(v)
            },
            {
                name: "게임 배속",
                type: "choice", values: [1, 2, 4, 8],
                format: (v) => `x${v}`,
                get: () => CheatManager.getGameSpeed(),
                set: (v) => CheatManager.setGameSpeed(v)
            },
            {
                name: "대시/이동 속도 배율",
                type: "number", step: 0.5, min: 0, max: 8,
                format: (v) => `x${v}`,
                get: () => CheatManager.getMoveSpeedMultiplier(),
                set: (v) => CheatManager.setMoveSpeedMultiplier(v)
            },
            {
                name: "메시지 초고속 스킵",
                type: "boolean",
                get: () => CheatManager.isMessageSkip(),
                set: (v) => CheatManager.setMessageSkip(v)
            }
        ];
    }

    function buildActorDescriptors(actor) {
        if (!actor) return [];
        const list = [];
        list.push({ name: `대상: ${actor.name()}  Lv.${actor.level}`, type: "info", get: () => "" });
        list.push({
            name: "레벨",
            type: "number", step: 1, min: 1, max: actor.maxLevel(),
            get: () => actor.level,
            set: (v) => actor.changeLevel(Math.round(v), false)
        });
        list.push({
            name: "경험치(EXP)",
            type: "number", step: 100, min: 0, max: 99999999,
            get: () => actor.currentExp(),
            set: (v) => actor.changeExp(Math.max(0, Math.round(v)), false)
        });
        list.push({
            name: "God Mode (HP/MP 고정)",
            type: "boolean",
            get: () => CheatManager.isGodMode(),
            set: (v) => CheatManager.setGodMode(v)
        });
        list.push({
            name: "즉사 모드 (아군 -> 적)",
            type: "boolean",
            get: () => CheatManager.isInstantKillMode(),
            set: (v) => CheatManager.setInstantKillMode(v)
        });
        for (let paramId = 0; paramId < PARAM_NAMES.length; paramId++) {
            list.push({
                name: `${PARAM_NAMES[paramId]} 증감 (이 캐릭터)`,
                type: "number", step: 1, min: -999, max: 999,
                get: () => getActorParamBonus(actor, paramId),
                set: (v) => setActorParamBonus(actor, paramId, Math.round(v))
            });
        }
        return list;
    }

    function buildPartyGlobalDescriptors() {
        const list = [];
        for (let paramId = 0; paramId < PARAM_NAMES.length; paramId++) {
            list.push({
                name: `전체 파티 ${PARAM_NAMES[paramId]} 배율`,
                type: "number", step: 0.1, min: 0, max: 10,
                format: (v) => `x${v.toFixed(1)}`,
                get: () => CheatManager.getStatMultiplier(paramId),
                set: (v) => CheatManager.setStatMultiplier(paramId, v)
            });
        }
        return list;
    }

    // 전투 중(Scene_Battle)일 때만 노출되는 적(Enemy) 대상 Instant Kill 목록.
    // $gameParty.inBattle()은 어떤 Scene이 최상단인지와 무관하게 전투 진행
    // 여부를 알려주므로, 치트 씬이 전투 위에 push되어도 정확히 동작한다.
    function buildEnemyDescriptors() {
        if (typeof $gameParty === "undefined" || !$gameParty || !$gameParty.inBattle()) return [];
        if (typeof $gameTroop === "undefined" || !$gameTroop) return [];
        const enemies = $gameTroop.members().filter((e) => !e.isHidden());
        if (enemies.length === 0) return [];
        const list = [{ name: "── 전투 중: 적 대상 ──", type: "info", get: () => "" }];
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

    function buildPartyDescriptors(scene) {
        return [
            ...buildActorDescriptors(scene.actor()),
            ...buildEnemyDescriptors(),
            ...buildPartyGlobalDescriptors()
        ];
    }

    // includeInfiniteToggle: 소모품(Items)만 "무한(소비 안 함)"이 의미가 있고,
    // 장비(Armors/Weapons)는 통상 소모되지 않으므로 그 탭에서는 아예 노출하지
    // 않는다. 무한 토글은 (전역 1개가 아니라) 아이템별로 개별 작동한다 -
    // $dataItems 안에는 실제로는 소모되지 않는 특수 항목이 섞여 있을 수 있어
    // 전역 스위치 하나로 묶으면 그런 항목에도 의도치 않게 영향을 주기 때문.
    function buildItemLikeDescriptors(dataArray, includeInfiniteToggle) {
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
                    if (container) container[entry.id] = Math.max(0, Math.min(999, Math.round(v)));
                },
                isFixed99: () => CheatManager.isItemQuantityLocked(entry),
                toggleFixed99() {
                    if (this.isFixed99()) {
                        CheatManager.unlockItemQuantity(entry);
                    } else {
                        CheatManager.lockItemQuantity(entry, 99);
                    }
                }
            });
            if (includeInfiniteToggle) {
                list.push({
                    name: `　└ 무한 (소비 안 함)`,
                    type: "boolean",
                    get: () => CheatManager.isItemInfinite(entry),
                    set: (v) => CheatManager.setItemInfinite(entry, v)
                });
            }
        }
        // 가상화 페이징: Window_Selectable#drawAllItems는 topIndex()부터
        // maxPageItems()개만 그리므로, 이 목록이 아무리 길어도(수백 개) 실제로는
        // 화면에 보이는 행만 렌더링된다. 별도의 페이징 구현이 필요 없다.
        return list;
    }

    function buildItemsDescriptors() {
        return buildItemLikeDescriptors(typeof $dataItems !== "undefined" ? $dataItems : null, true);
    }
    function buildArmorsDescriptors() {
        return buildItemLikeDescriptors(typeof $dataArmors !== "undefined" ? $dataArmors : null, false);
    }

    function buildSkillsDescriptors(scene) {
        const actor = scene.actor();
        if (!actor || typeof $dataSkills === "undefined" || !$dataSkills) return [];
        const list = [{ name: `대상: ${actor.name()}`, type: "info", get: () => "" }];
        // 4열 그리드에서는 인덱스 순서대로 칸이 채워지므로, 안내 행이 스킬 1~3과
        // 같은 줄에 끼어 보이지 않도록 다음 행 경계까지 빈 칸으로 채워 둔다.
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
            if (!names[i]) continue; // 이름이 없는(=사용하지 않는) 변수는 건너뛴다.
            list.push({
                name: `#${i} ${names[i]}`,
                type: "variable",
                varId: i,
                get: () => variableRawValue(i)
            });
        }
        return list;
    }

    // 탭 활성화 파라미터로 필터링한다. 전부 꺼져 있으면(설정 실수 등) 빈 메뉴가
    // 되어버리는 것을 막기 위해 안전하게 전체 탭을 되살린다.
    // listWidthRatio: 좌측 목록 창이 전체 폭에서 차지하는 비율(우측 상세 창은
    // 나머지). columns: 목록을 몇 열 그리드로 배치할지(Skills는 4열 그리드).
    const ALL_TABS = [
        { name: "General", enabled: paramBool(PARAMS, "enableGeneralTab", true), builder: buildGeneralDescriptors, listWidthRatio: 0.4, columns: 1 },
        { name: "Party", enabled: paramBool(PARAMS, "enablePartyTab", true), builder: buildPartyDescriptors, listWidthRatio: 0.4, columns: 1 },
        { name: "Items", enabled: paramBool(PARAMS, "enableItemsTab", true), builder: buildItemsDescriptors, listWidthRatio: 0.6, columns: 1 },
        { name: "Armors", enabled: paramBool(PARAMS, "enableArmorsTab", true), builder: buildArmorsDescriptors, listWidthRatio: 0.6, columns: 1 },
        { name: "Skills", enabled: paramBool(PARAMS, "enableSkillsTab", true), builder: buildSkillsDescriptors, listWidthRatio: 0.78, columns: SKILLS_TAB_COLUMNS },
        { name: "Variables", enabled: paramBool(PARAMS, "enableVariablesTab", true), builder: buildVariablesDescriptors, listWidthRatio: 0.4, columns: 1 }
    ];
    const FILTERED_TABS = ALL_TABS.filter((tab) => tab.enabled);
    const ACTIVE_TABS = FILTERED_TABS.length > 0 ? FILTERED_TABS : ALL_TABS;

    //-------------------------------------------------------------------
    // Window_CheatTab : 상단 가로 탭
    //-------------------------------------------------------------------
    class Window_CheatTab extends Window_HorzCommand {
        // 주의: RpgBridge.initWindow()는 "완성된 인스턴스"에 대해 외부에서 호출하는
        // 용도이며, 여기서처럼 자기 자신의 initialize 오버라이드 내부에서
        // this.initialize(...)를 다시 호출하면 무한 재귀에 빠진다. 따라서 여기서는
        // RpgBridge.isMZ 플래그로 직접 분기하여 super.initialize(...)를 호출한다.
        initialize(x, y, width, height) {
            if (RpgBridge.isMZ) {
                super.initialize(new Rectangle(x, y, width, height));
            } else {
                super.initialize(x, y);
            }
        }
        windowWidth() {
            return Graphics.boxWidth;
        }
        windowHeight() {
            return panelHeight(1);
        }
        maxCols() {
            return ACTIVE_TABS.length;
        }
        makeCommandList() {
            for (const tab of ACTIVE_TABS) {
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
    }

    //-------------------------------------------------------------------
    // Window_CheatCommand : 좌측 기능 목록
    //-------------------------------------------------------------------
    class Window_CheatCommand extends Window_Command {
        // _descriptors / _cheatWidth / _cheatHeight는 super.initialize(...) 도중
        // (MV 경로에서는 windowWidth()/windowHeight()가, 양쪽 경로 모두
        // makeCommandList()가 즉시 호출되므로) 반드시 super 호출 이전에 세팅한다.
        initialize(x, y, width, height) {
            this._descriptors = [];
            this._columns = 1;
            this._cheatWidth = width;
            this._cheatHeight = height;
            if (RpgBridge.isMZ) {
                super.initialize(new Rectangle(x, y, width, height));
            } else {
                super.initialize(x, y);
            }
        }
        windowWidth() {
            return this._cheatWidth || Math.floor(Graphics.boxWidth * 0.4);
        }
        windowHeight() {
            return this._cheatHeight || Graphics.boxHeight - panelHeight(1);
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
        // columns: 1이면 기존처럼 세로 한 줄 목록, 그 이상이면(Skills 탭의 4열
        // 그리드 등) 가로 N열 그리드로 배치한다. maxCols()가 이 값을 그대로
        // 반환하므로 Window_Selectable의 기본 itemWidth()/itemRect() 계산이
        // 자동으로 N등분된 열 폭을 만들어 준다.
        setDescriptors(list, columns) {
            this._descriptors = list || [];
            this._columns = columns || 1;
            this.refresh();
            this.select(this._descriptors.length > 0 ? 0 : -1);
            // MV의 select()는 내부적으로 ensureCursorVisible()을 호출해 스크롤을
            // 자동으로 맞춰주지만, MZ의 select()는 커서 표시만 갱신할 뿐 스크롤은
            // 건드리지 않는다(scrollTo는 cursorDown/Up 등에서만 호출됨). 그 결과
            // 이전 탭에서 목록을 한참 내려본 뒤 탭을 전환하면 스크롤 위치가 그대로
            // 남아 있다가 다음 방향키 입력 때 MZ가 뒤늦게 부드러운 스크롤
            // 애니메이션으로 보정하면서 화면이 위아래로 흔들리는 것처럼 보였다.
            // 인자 없이 호출하면 MV/MZ 모두 안전하고(둘 다 시그니처 호환),
            // MZ에서는 smooth 인자가 없어 애니메이션 없이 즉시 스크롤을 맞춘다.
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
        // Window_Command#drawItem 기본 구현에 의존하지 않고 직접 그린다: MV는
        // itemTextAlign()이 "left", MZ는 "center"라서 그리드 칸에서 이름과
        // 값/상태 표시가 서로 다르게 겹칠 수 있기 때문에, 두 엔진 모두 동일하게
        // "이름은 왼쪽부터, 값/상태는 오른쪽부터" 규칙으로 통일한다.
        drawItem(index) {
            const desc = this._list[index] && this._list[index].ext;
            if (!desc) return;
            const rect = RpgBridge.itemLineRect(this, index);
            this.changePaintOpacity(this.isCommandEnabled(index));
            this.resetTextColor();

            if (desc.type === "info") {
                this.drawText(desc.name, rect.x, rect.y, rect.width, "left");
            } else if (desc.type === "item") {
                // "값 컬럼"과 "고정 컬럼"을 하나로 합친 문자열이 아니라 서로 다른
                // 고정폭 열로 분리해서, 고정 여부 표시가 항상 값 컬럼 오른쪽의
                // 정해진 자리에 오도록 한다.
                const fixedColWidth = 76;
                const valueColWidth = 64;
                const nameWidth = Math.max(0, rect.width - valueColWidth - fixedColWidth);
                this.drawText(desc.name, rect.x, rect.y, nameWidth, "left");
                this.drawText(`${desc.get()}`, rect.x + nameWidth, rect.y, valueColWidth, "right");
                if (desc.isFixed99()) {
                    this.changeTextColor(RpgBridge.textColor(this, 17)); // "강화(powerUp)" 색상 재사용
                    this.drawText("FIXED", rect.x + nameWidth + valueColWidth, rect.y, fixedColWidth, "right");
                    this.resetTextColor();
                }
            } else if (this._columns > 1) {
                // 그리드(예: Skills 4xN): 좁은 칸 안에 이름 + 짧은 ON/OFF 표시.
                const indicatorWidth = 56;
                const nameWidth = Math.max(0, rect.width - indicatorWidth);
                this.drawText(desc.name, rect.x, rect.y, nameWidth, "left");
                this.drawText(this._formatValue(desc), rect.x + nameWidth, rect.y, indicatorWidth, "right");
            } else {
                this.drawText(desc.name, rect.x, rect.y, rect.width, "left");
                this.drawText(this._formatValue(desc), rect.x, rect.y, rect.width, "right");
            }

            this.changePaintOpacity(true);
        }
        _formatValue(desc) {
            const value = desc.get();
            if (desc.type === "boolean") return value ? "ON" : "OFF";
            if (desc.type === "item") return `${value}${desc.isFixed99() ? " [FIXED]" : ""}`;
            if (desc.type === "choice") return desc.format ? desc.format(value) : `${value}`;
            if (desc.type === "variable") return formatVariableValue(desc.varId);
            if (desc.type === "enemy") return value;
            if (desc.format) return desc.format(value);
            return `${value}`;
        }
    }

    //-------------------------------------------------------------------
    // Window_CheatValueEdit : 우측 수치 조절 / 토글 창
    //-------------------------------------------------------------------
    class Window_CheatValueEdit extends Window_Selectable {
        // Window_Selectable은 Window_Command와 달리 MV에서도 (x,y,width,height)를
        // 그대로 받으므로 windowWidth()/windowHeight() 오버라이드 없이 인자만
        // 그대로 분기 전달하면 된다.
        initialize(x, y, width, height) {
            this._descriptor = null;
            this._directInputHandler = null;
            if (RpgBridge.isMZ) {
                super.initialize(new Rectangle(x, y, width, height));
            } else {
                super.initialize(x, y, width, height);
            }
            this.refresh();
        }
        maxItems() {
            return 1;
        }
        // Window_Selectable#isOkEnabled 기본 구현은 isHandled('ok')를 반환하므로
        // (Window_Command와 달리) 'ok' 핸들러를 등록하지 않으면 processOk()가
        // 아예 호출되지 않는다. 이 창은 핸들러 시스템 대신 직접 로직을 처리하므로
        // 항상 true를 반환하도록 재정의한다.
        isOkEnabled() {
            return true;
        }
        setDescriptor(desc) {
            this._descriptor = desc || null;
            this.select(this._descriptor ? 0 : -1);
            this.refresh();
        }
        setDirectInputHandler(handler) {
            this._directInputHandler = handler;
        }
        update() {
            super.update();
            if (this.active && this._descriptor && Input.isTriggered("shift") && this._supportsDirectInput()) {
                if (this._directInputHandler) this._directInputHandler(this._descriptor);
            }
        }
        _supportsDirectInput() {
            const d = this._descriptor;
            if (d.type === "number" || d.type === "item") return true;
            if (d.type === "variable") return variableKind(d.varId) === "number";
            return false;
        }
        // 좌/우 방향키는 목록 이동이 아니라 값 조절로 재정의한다.
        cursorRight() {
            this._adjust(1);
        }
        cursorLeft() {
            this._adjust(-1);
        }
        // 기본 Window_Selectable#processOk는 호출 후 창을 비활성화하므로,
        // 값 조절 중에는 포커스를 유지하기 위해 완전히 재정의한다.
        processOk() {
            if (!this._descriptor) {
                this.playBuzzerSound();
                return;
            }
            SoundManager.playOk();
            this._applyOkAction();
            this.refresh();
        }
        _adjust(direction) {
            const d = this._descriptor;
            if (!d) return;
            switch (d.type) {
                case "boolean":
                    d.set(!d.get());
                    break;
                case "number":
                case "item":
                    this._stepValue(d, direction);
                    break;
                case "choice":
                    this._cycleChoice(d, direction);
                    break;
                case "variable":
                    this._adjustVariable(d, direction);
                    break;
                case "enemy":
                    d.action();
                    break;
                default:
                    return; // "info" 등: 조절 불가, 사운드 없음
            }
            SoundManager.playCursor();
            this.refresh();
        }
        _applyOkAction() {
            const d = this._descriptor;
            switch (d.type) {
                case "boolean":
                    d.set(!d.get());
                    break;
                case "item":
                    d.toggleFixed99();
                    break;
                case "choice":
                    this._cycleChoice(d, 1);
                    break;
                case "variable":
                    this._applyVariableOk(d);
                    break;
                case "enemy":
                    d.action();
                    break;
                case "number":
                    this._stepValue(d, 10); // Z: 큰 폭(스텝*10) 조절
                    break;
                default:
                    break; // "info": 아무 동작 없음
            }
        }
        _stepValue(d, direction) {
            const step = (d.step || 1) * direction;
            let v = (d.get() || 0) + step;
            if (d.min !== undefined) v = Math.max(d.min, v);
            if (d.max !== undefined) v = Math.min(d.max, v);
            v = Math.round(v * 100) / 100;
            d.set(v);
        }
        _cycleChoice(d, direction) {
            const values = d.values || [];
            if (values.length === 0) return;
            let idx = values.indexOf(d.get());
            if (idx < 0) idx = 0;
            idx = (idx + direction + values.length) % values.length;
            d.set(values[idx]);
        }
        _adjustVariable(d, direction) {
            const kind = variableKind(d.varId);
            if (kind === "number") {
                CheatManager.setNumberVariable(d.varId, CheatManager.getNumberVariable(d.varId) + direction);
            } else if (kind === "boolean") {
                CheatManager.setBooleanVariable(d.varId, !CheatManager.getBooleanVariable(d.varId));
            } else {
                this.playBuzzerSound(); // [Read-Only]: 값 변경 불가
            }
        }
        _applyVariableOk(d) {
            const kind = variableKind(d.varId);
            if (kind === "boolean") {
                CheatManager.setBooleanVariable(d.varId, !CheatManager.getBooleanVariable(d.varId));
            } else if (kind === "number") {
                CheatManager.setNumberVariable(d.varId, CheatManager.getNumberVariable(d.varId) + 10);
            } else {
                this.playBuzzerSound();
            }
        }
        refresh() {
            this.contents.clear();
            const w = this.contentsWidth();
            if (!this._descriptor) {
                this.drawText("← 좌측에서 조절할 항목을 선택하세요", 0, LINE_HEIGHT, w, "center");
                return;
            }
            const d = this._descriptor;
            this.drawText(d.name, 0, 0, w, "left");
            if (d.type === "info") return;

            this.resetTextColor();
            this.contents.fontSize = 26;
            this.drawText(this._valueText(d), 0, LINE_HEIGHT * 1.5, w, "center");
            this.resetFontSettings();

            this.resetTextColor();
            this.drawText(this._hintText(d), 0, LINE_HEIGHT * 3.2, w, "center");
        }
        _valueText(d) {
            if (d.type === "boolean") return d.get() ? "ON" : "OFF";
            if (d.type === "item") return `${d.get()}${d.isFixed99() ? "  [FIXED 99]" : ""}`;
            if (d.type === "choice") return d.format ? d.format(d.get()) : `${d.get()}`;
            if (d.type === "variable") return formatVariableValue(d.varId);
            if (d.type === "enemy") return d.get();
            if (d.format) return d.format(d.get());
            return `${d.get()}`;
        }
        _hintText(d) {
            if (d.type === "enemy") return "◄► / Z : Instant Kill 실행     X : 뒤로";
            if (d.type === "variable" && variableKind(d.varId) === "readonly") {
                return "[Read-Only] 이 타입은 수정할 수 없습니다     X : 뒤로";
            }
            const parts = ["◄► : 값 조절"];
            if (d.type === "boolean" || d.type === "choice") {
                parts.push("Z : 토글/전환");
            } else {
                parts.push("Z : 큰 폭 조절");
            }
            if (this._supportsDirectInput()) parts.push("Shift : 직접 입력");
            parts.push("X : 뒤로");
            return parts.join("   ");
        }
    }

    //-------------------------------------------------------------------
    // Window_CheatNumberInput : Shift로 여는 직접 입력(자리수 편집) 오버레이
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
            return 32;
        }
        spacing() {
            return 0;
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
        // Up/Down은 (한 줄짜리 창이라 기본 커서 이동이 어차피 발생하지 않으므로)
        // 자릿수 값 증감으로 사용한다. Left/Right는 Window_Selectable 기본
        // cursorRight/cursorLeft가 그대로 자릿수 커서 이동을 처리해 준다.
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
        drawItem(index) {
            const rect = this.itemRect(index);
            const s = this._number.padZero(this._maxDigits);
            this.resetTextColor();
            this.drawText(s[index], rect.x, rect.y, rect.width, "center");
        }
    }

    //-------------------------------------------------------------------
    // Scene_Cheat
    //-------------------------------------------------------------------
    class Scene_Cheat extends RpgBridge.baseMenuSceneClass() {
        create() {
            super.create();
            this.createTabWindow();
            this.createCommandWindow();
            this.createValueEditWindow();
            this.createNumberInputWindow();

            this._tabWindow.setHandler("select", this.onTabOk.bind(this));
            this._tabWindow.setHandler("cancel", this.onTabCancel.bind(this));
            this._tabWindow.setChangeHandler(this.onTabChange.bind(this));

            this._commandWindow.setHandler("select", this.onCommandOk.bind(this));
            this._commandWindow.setHandler("cancel", this.onCommandCancel.bind(this));
            this._commandWindow.setHandler("pagedown", this.nextActor.bind(this));
            this._commandWindow.setHandler("pageup", this.previousActor.bind(this));
            this._commandWindow.setChangeHandler(this.onCommandChange.bind(this));

            this._valueEditWindow.setHandler("cancel", this.onValueEditCancel.bind(this));
            this._valueEditWindow.setDirectInputHandler(this.onRequestDirectInput.bind(this));

            this._numberInputWindow.setHandler("ok", this.onNumberInputOk.bind(this));
            this._numberInputWindow.setHandler("cancel", this.onNumberInputCancel.bind(this));

            // 시작 탭(보통 첫 번째 활성 탭)에 맞는 폭 배분을 최초 1회 적용한다.
            // 이후에는 onTabOk()에서 탭을 확정할 때만 다시 계산한다.
            this._layoutWindowsForTab(ACTIVE_TABS[this._tabWindow.index()]);
            this.onTabChange();
            this._commandWindow.deactivate();
            this._valueEditWindow.deactivate();
            this._tabWindow.activate();
        }
        createTabWindow() {
            this._tabWindow = new Window_CheatTab(0, 0, Graphics.boxWidth, panelHeight(1));
            this.addWindow(this._tabWindow);
        }
        createCommandWindow() {
            const y = this._tabWindow.height;
            const width = Math.floor(Graphics.boxWidth * 0.4);
            const height = Graphics.boxHeight - y;
            this._commandWindow = new Window_CheatCommand(0, y, width, height);
            this.addWindow(this._commandWindow);
        }
        createValueEditWindow() {
            const y = this._tabWindow.height;
            const x = this._commandWindow.width;
            const width = Graphics.boxWidth - x;
            const height = Graphics.boxHeight - y;
            this._valueEditWindow = new Window_CheatValueEdit(x, y, width, height);
            this.addWindow(this._valueEditWindow);
        }
        createNumberInputWindow() {
            const width = 8 * 32 + WINDOW_PADDING * 2;
            const height = panelHeight(1);
            const x = (Graphics.boxWidth - width) / 2;
            const y = (Graphics.boxHeight - height) / 2;
            this._numberInputWindow = new Window_CheatNumberInput(x, y, width, height);
            this.addWindow(this._numberInputWindow);
        }
        _isActorTab() {
            const tab = ACTIVE_TABS[this._tabWindow.index()];
            return !!tab && (tab.name === "Party" || tab.name === "Skills");
        }
        // Party/Skills 탭에서만 PageUp/PageDown으로 대상 파티원을 순환한다.
        // Scene_MenuBase#nextActor/previousActor(->$gameParty.makeMenuActorNext
        // 등)와 onActorChange() 훅을 그대로 재사용한다.
        nextActor() {
            if (!this._isActorTab()) {
                this._commandWindow.activate();
                return;
            }
            super.nextActor();
        }
        previousActor() {
            if (!this._isActorTab()) {
                this._commandWindow.activate();
                return;
            }
            super.previousActor();
        }
        onActorChange() {
            this.onTabChange();
            this._commandWindow.activate();
        }
        // 탭마다 목록/상세 창의 폭 배분을 다시 계산한다. Items/Armors는 값+FIXED
        // 두 열을 나란히 보여주려고, Skills는 4열 그리드를 위해 목록 창에 더
        // 넓은 영역을 준다(그만큼 상세 창은 좁아진다).
        _layoutWindowsForTab(tab) {
            const ratio = tab ? tab.listWidthRatio : 0.4;
            const y = this._tabWindow.height;
            const height = Graphics.boxHeight - y;
            const listWidth = Math.floor(Graphics.boxWidth * ratio);
            const controlWidth = Graphics.boxWidth - listWidth;

            this._commandWindow.move(0, y, listWidth, height);
            this._valueEditWindow.move(listWidth, y, controlWidth, height);
            // Window_CheatCommand는 곧이어 호출되는 setDescriptors()->refresh()가
            // Window_Command#refresh() 안에서 createContents()를 다시 호출해
            // 주므로 여기서 따로 처리할 필요가 없다. Window_CheatValueEdit는
            // refresh()를 직접 구현해서 createContents()를 부르지 않으므로,
            // 새 크기의 컨텐츠 비트맵을 여기서 직접 다시 만들어야 한다.
            this._valueEditWindow.createContents();
        }
        // 탭 바를 좌우로 훑어보는 동안(아직 확정 전) 목록 "내용"만 미리 보여주고
        // 창 크기는 건드리지 않는다. 예전에는 여기서 매번 _layoutWindowsForTab()을
        // 호출했는데, 탭 바 위에서 방향키를 누를 때마다(탭을 실제로 선택하기도
        // 전에) 목록/상세 창 경계가 탭마다 다른 폭 비율로 계속 다시 계산되어
        // 화면이 흔들리는 것처럼 보였다. 크기 변경은 onTabOk()에서 탭을 확정할
        // 때 한 번만 적용한다.
        onTabChange() {
            const tab = ACTIVE_TABS[this._tabWindow.index()];
            this._commandWindow.setDescriptors(tab ? tab.builder(this) : [], tab ? tab.columns : 1);
        }
        onCommandChange() {
            const desc = this._commandWindow.currentExt();
            this._valueEditWindow.setDescriptor(desc);
        }
        onTabOk() {
            const tab = ACTIVE_TABS[this._tabWindow.index()];
            this._layoutWindowsForTab(tab);
            this._tabWindow.deactivate();
            this._commandWindow.activate();
        }
        onTabCancel() {
            this.popScene();
        }
        onCommandOk() {
            const desc = this._commandWindow.currentExt();
            if (!desc || desc.type === "info") {
                this._commandWindow.activate();
                return;
            }
            // 토글(boolean)은 우측 상세 창으로 넘어갈 필요 없이 목록에서 Z로
            // 바로 켜고 끈다. processOk()가 이미 이 창을 deactivate() 했으므로
            // 다시 activate()해서 포커스를 목록에 그대로 둔다.
            if (desc.type === "boolean") {
                desc.set(!desc.get());
                this._commandWindow.refresh();
                this._valueEditWindow.refresh();
                this._commandWindow.activate();
                return;
            }
            this._commandWindow.deactivate();
            this._valueEditWindow.activate();
        }
        onCommandCancel() {
            this._commandWindow.deactivate();
            this._tabWindow.activate();
        }
        onValueEditCancel() {
            this._valueEditWindow.deactivate();
            this._commandWindow.activate();
            this._commandWindow.refresh();
        }
        onRequestDirectInput(descriptor) {
            this._valueEditWindow.deactivate();
            this._numberInputWindow.setup(descriptor);
            this._numberInputWindow.show();
            this._numberInputWindow.activate();
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
            this._commandWindow.refresh();
            this._valueEditWindow.refresh();
            this._valueEditWindow.activate();
        }
    }

    //-------------------------------------------------------------------
    // 토글 입력: 키보드(TOGGLE_KEY_CODE) / 게임패드(GAMEPAD_START_BUTTON, 파라미터로 설정)
    //-------------------------------------------------------------------
    let gamepadStartWasPressed = false;

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
        }
    });

    // 게임패드 Start 버튼(기본 9번)은 RPG Maker의 기본 Input.gamepadMapper에
    // 포함되어 있지 않으므로, Input.update()에 편승해 매 프레임 직접
    // 폴링(polling)한다. enableGamepadToggle 파라미터로 완전히 끌 수도 있다.
    if (ENABLE_GAMEPAD_TOGGLE && typeof Input !== "undefined") {
        const _inputUpdate = Input.update;
        Input.update = function () {
            _inputUpdate.call(this);
            const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : null;
            const pad = pads && pads[0];
            const button = pad && pad.buttons && pad.buttons[GAMEPAD_START_BUTTON];
            const pressed = !!(button && button.pressed);
            if (pressed && !gamepadStartWasPressed) {
                toggleCheatScene();
            }
            gamepadStartWasPressed = pressed;
        };
    }

    window.Scene_Cheat = Scene_Cheat;
    window.Window_CheatTab = Window_CheatTab;
    window.Window_CheatCommand = Window_CheatCommand;
    window.Window_CheatValueEdit = Window_CheatValueEdit;
    window.Window_CheatNumberInput = Window_CheatNumberInput;
})();
