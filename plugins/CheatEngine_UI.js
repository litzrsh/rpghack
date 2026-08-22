//=============================================================================
// CheatEngine_UI.js
//=============================================================================
/*:
 * @plugindesc [Cheat Engine] UI v2.3.0 - In-game cheat menu UI consuming CheatEngine_Core.js.
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
 * @desc Show the Party tab (every party member's level/EXP/params/full-heal/God Mode, in-battle enemy Instant Kill) in the tab bar.
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
 * The Party tab has no party-member switching (no PageUp/PageDown, no touch
 * UI for it) -- instead every current party member's block is listed one
 * after another in a single scrollable list, each starting with a
 * non-selectable "[ Character: Name ]" header row followed by that member's
 * own one-shot "Full Heal HP/MP/TP" action row (Z or Left/Right executes it
 * immediately), Level/EXP, God Mode toggle, and per-character param bonuses.
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
/*:ko
 * @plugindesc [치트 엔진] UI v2.3.0 - CheatEngine_Core.js의 API를 사용하는 인게임 치트 UI
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
 * @desc 상단 탭 목록에 Party 탭(파티원 전원의 레벨/EXP/파라미터/전회복/God Mode, 전투 중 적 즉사)을 표시합니다.
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
 *   - 방향키 : 탭 바 커서 이동(2행까지 자동 랩핑되는 2차원 이동) / 콘텐츠
 *              목록 커서 이동 / 선택된 항목의 값 조절
 *   - Z(확인) : 탭 확정 -> 콘텐츠 목록으로 진입, 또는 (콘텐츠 목록 안에서는)
 *              선택한 행을 그 자리에서 토글/전환/큰 폭 조절
 *   - ▼(탭 바 마지막 줄에서) : Z와 동일하게 콘텐츠 목록으로 진입
 *   - X(취소) : 콘텐츠 목록 -> 탭 바로 복귀 / 탭 바에서는 메뉴 닫기
 *   - Shift : (숫자/아이템 수량/변수 항목에서) 직접 입력 창 열기
 *
 * Party 탭은 조작 대상을 "전환"하는 개념 자체가 없습니다 - PageUp/PageDown도,
 * 터치 조작도 없습니다. 대신 현재 파티에 있는 모든 멤버의 항목 블록을 한
 * 스크롤 목록에 순서대로 이어 붙여 보여줍니다. 각 블록은 선택할 수 없는
 * "[ 캐릭터: 이름 ]" 구분선 행으로 시작하고, 그 아래로 그 캐릭터의
 * "HP/MP/TP 즉시 전회복"(Z 또는 좌/우 방향키로 즉시 실행, 아래의 God Mode
 * 스위치와는 별개의 기능), 레벨, 경험치, God Mode, 능력치 증감이 이어집니다.
 * Skills 탭은 스킬 그리드가 캐릭터 1인 기준으로만 의미가 있으므로 여전히
 * 파티 리더(주인공, $gameParty.leader())만 조작 대상으로 고정됩니다.
 *
 * 레이아웃:
 *   - Window_CheatTab        : 상단 탭 바, 최대 5열이며 탭이 더 많으면 2번째
 *                               줄로 자동 랩핑됩니다.
 *   - Window_CheatContent    : 화면 전체 폭을 쓰는 단일 콘텐츠 창. 별도의
 *                               상세 창 없이 모든 값의 조회/조절/토글이 이
 *                               창 안에서 바로(인라인으로) 이루어집니다.
 *   - Window_CheatNumberInput: Shift로 여는 직접 입력(자리수 편집) 오버레이 창
 *
 * 위의 "... 탭 사용" 파라미터로 각 탭을 상단 탭 목록에서 숨길 수 있습니다
 * (탭을 숨겨도 해당 CheatManager 기능 자체는 스크립트 호출로 계속 사용할 수
 * 있으며, 파라미터는 메뉴에 보이는지 여부만 제어합니다).
 *
 * 게임별 전용 탭 확장하기:
 *   - 이 플러그인보다 나중에 로드되는 별도 파일(예: CheatEngine_RJ386773.js)에서
 *     window.CheatEngineUI.registerTab({ name, enabled, builder, columns })를
 *     호출하면 자신만의 탭을 탭 바에 추가할 수 있습니다. builder는 다른 기본
 *     탭들과 동일한 시그니처(() => descriptor[])를 가집니다. 이를 통해 특정
 *     변수 ID나 다른 플러그인의 커맨드 같은 특정 게임 전용 로직을 이 범용
 *     파일 밖으로 완전히 분리할 수 있습니다.
 * -----------------------------------------------------------------------------
 */

(() => {
    "use strict";

    if (
        typeof Window_Selectable === "undefined" ||
        typeof Window_Command === "undefined" ||
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
    const SKILLS_TAB_COLUMNS = 3;
    const TAB_MAX_COLS = 5;

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
    // type: "number" | "boolean" | "choice" | "item" | "variable" | "enemy" | "action" | "info"
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

    // 파티원 한 명 분량의 기술자 블록을 만든다. 맨 앞의 "info" 행은 클릭 불가한
    // 구분선 헤더로, 여러 캐릭터의 블록을 한 목록에 이어 붙였을 때 어디부터
    // 어디까지가 누구의 항목인지 한눈에 구분되게 해 준다.
    function buildActorDescriptors(actor) {
        if (!actor) return [];
        const list = [];
        list.push({
            name: `▼ [ 캐릭터: ${actor.name()} ]  Lv.${actor.level}  ${"─".repeat(16)}`,
            type: "info",
            get: () => ""
        });
        list.push({
            name: "HP/MP/TP 즉시 전회복",
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

    // Skills 탭은 파티원 전환(PageUp/PageDown) 기능 자체가 없이 항상 파티
    // 리더(주인공, $gameParty.leader())만 조작 대상으로 고정한다. (스킬
    // 그리드는 캐릭터 1인 기준으로만 의미가 있어 여러 명을 동시에 펼치지 않는다.)
    function leaderActor() {
        return typeof $gameParty !== "undefined" && $gameParty && typeof $gameParty.leader === "function"
            ? $gameParty.leader()
            : null;
    }

    // Party 탭은 "액티브 캐릭터 전환" 개념을 아예 없애고, 현재 파티에 있는
    // 모든 멤버(리더 포함)의 블록을 순서대로 이어 붙인 단일 스크롤 목록으로
    // 만든다. 예전에는 PageUp/PageDown으로 조작 대상을 바꾸는 방식이라 화면에
    // 보이는 캐릭터와 실제로 값이 반영되는 캐릭터가 어긋나는 사고가 났었는데,
    // 애초에 "전환"이라는 상태 자체가 없으면 그 버그 자체가 성립하지 않는다.
    function buildPartyDescriptors() {
        const members = typeof $gameParty !== "undefined" && $gameParty && typeof $gameParty.members === "function"
            ? $gameParty.members()
            : [];
        const list = [];
        for (const member of members) {
            list.push(...buildActorDescriptors(member));
        }
        list.push(...buildEnemyDescriptors());
        list.push(...buildPartyGlobalDescriptors());
        return list;
    }

    // 아이템/방어구 공용 서술자 빌더. 한 줄에 [아이콘+이름] - [수량] - [무한 고정]
    // 세 컬럼을 모두 담기 위해, "무한 고정"은 CheatManager의 수량 잠금 기능
    // (lockItemQuantity/unlockItemQuantity)을 그대로 재사용한다: 이 잠금은
    // gainItem 훅에서 소비/획득과 무관하게 매번 잠긴 수량으로 되돌리므로, 그
    // 자체로 "무한(소비돼도 줄지 않음) + 고정 수량" 두 가지 의미를 모두
    // 만족한다. 켤 때는 지금 보유 수량을 그대로 잠금값으로 사용한다.
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
        // 가상화 페이징: Window_Selectable#drawAllItems는 topIndex()부터
        // maxPageItems()개만 그리므로, 이 목록이 아무리 길어도(수백 개) 실제로는
        // 화면에 보이는 행만 렌더링된다. 별도의 페이징 구현이 필요 없다.
        return list;
    }

    function buildItemsDescriptors() {
        return buildItemLikeDescriptors(typeof $dataItems !== "undefined" ? $dataItems : null);
    }
    function buildArmorsDescriptors() {
        return buildItemLikeDescriptors(typeof $dataArmors !== "undefined" ? $dataArmors : null);
    }

    function buildSkillsDescriptors() {
        const actor = leaderActor();
        if (!actor || typeof $dataSkills === "undefined" || !$dataSkills) return [];
        const list = [{ name: `대상: ${actor.name()}`, type: "info", get: () => "" }];
        // N열 그리드에서는 인덱스 순서대로 칸이 채워지므로, 안내 행이 다음 스킬과
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
    // columns: 콘텐츠 목록을 몇 열 그리드로 배치할지(Skills는 다열 그리드,
    // 그 외에는 전부 1열 - 화면 전체 폭을 한 줄에 그대로 쓴다).
    const ALL_TABS = [
        { name: "General", enabled: paramBool(PARAMS, "enableGeneralTab", true), builder: buildGeneralDescriptors, columns: 1 },
        { name: "Party", enabled: paramBool(PARAMS, "enablePartyTab", true), builder: buildPartyDescriptors, columns: 1 },
        { name: "Items", enabled: paramBool(PARAMS, "enableItemsTab", true), builder: buildItemsDescriptors, columns: 1 },
        { name: "Armors", enabled: paramBool(PARAMS, "enableArmorsTab", true), builder: buildArmorsDescriptors, columns: 1 },
        { name: "Skills", enabled: paramBool(PARAMS, "enableSkillsTab", true), builder: buildSkillsDescriptors, columns: SKILLS_TAB_COLUMNS },
        { name: "Variables", enabled: paramBool(PARAMS, "enableVariablesTab", true), builder: buildVariablesDescriptors, columns: 1 }
    ];
    // 게임별 추가 치트 플러그인(예: CheatEngine_RJ386773.js)이 이 파일 로드 이후에
    // registerTab()으로 자기 탭을 얹을 수 있도록, ALL_TABS는 이후에도 계속
    // push되는 살아있는 배열로 두고 실제 사용 시점(getActiveTabs 호출 시)마다
    // 다시 필터링한다. 상수로 한 번만 필터링해 버리면 이 파일보다 나중에 로드된
    // 플러그인이 추가한 탭이 하단 탭 바에 반영되지 않는다.
    function getActiveTabs() {
        const filtered = ALL_TABS.filter((tab) => tab.enabled);
        return filtered.length > 0 ? filtered : ALL_TABS;
    }
    // 게임별 확장 플러그인이 사용할 공개 등록 API. tab: { name, enabled, builder, columns }
    // (builder는 ALL_TABS의 다른 항목들과 동일한 시그니처: () => descriptor[])
    window.CheatEngineUI = {
        registerTab(tab) {
            if (tab && typeof tab.builder === "function") {
                ALL_TABS.push(Object.assign({ enabled: true, columns: 1 }, tab));
            }
        }
    };

    //-------------------------------------------------------------------
    // Window_CheatTab : 상단 탭 바. 최대 TAB_MAX_COLS열이며, 그보다 탭이
    // 많으면 자동으로 다음 줄로 넘어간다(예: 6번째 탭 Variables는 2번째
    // 줄로). Window_Command 그대로에 maxCols()만 재정의하면 Window_Selectable
    // 기본 cursorUp/Down/Left/Right가 알아서 2차원 그리드 이동을 처리해 준다.
    //-------------------------------------------------------------------
    class Window_CheatTab extends Window_Command {
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
        // 탭 바가 이미 마지막 줄일 때 아래 방향키를 누르면 Z(확인)와 동일하게
        // "현재 탭 확정 -> 콘텐츠 목록으로 포커스 이동"을 트리거한다. 아직 위에
        // 다른 줄이 남아 있을 때는 평범하게 그 줄로 커서만 이동한다. 기본
        // cursorDown()가 이동 가능 여부를 판단하는 조건(index + maxCols <
        // maxItems)을 그대로 재사용해 "내려갈 줄이 없다"를 판별한다.
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
    // Window_CheatContent : 화면 전체 폭을 쓰는 단일 콘텐츠 창.
    // 좌/우 방향키는(그리드가 아닌 1열 탭에서는) 목록 이동이 아니라 그 자리에서
    // 값을 조절하는 데 쓰이고, Z(Ok)는 토글/전환/큰 폭 조절을 인라인으로 즉시
    // 적용한 뒤 계속 이 창에 포커스를 남겨 둔다(다른 창으로 넘어가지 않음).
    //-------------------------------------------------------------------
    class Window_CheatContent extends Window_Command {
        // _descriptors / _columns / _cheatWidth / _cheatHeight는 super.initialize(...)
        // 도중(MV 경로에서는 windowWidth()/windowHeight()가, 양쪽 경로 모두
        // makeCommandList()가 즉시 호출되므로) 반드시 super 호출 이전에 세팅한다.
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
        // 그리드 탭(Skills)에서는 좌/우가 열 이동에 쓰이므로 기본 동작을 그대로
        // 두고, 1열 탭(General/Party/Items/Armors/Variables)에서는 좌/우를
        // "그 자리에서 값 조절"로 재정의한다.
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
        // 기본 Window_Command#processOk는 호출 후 창을 비활성화하고 핸들러로
        // 넘어가므로, 인라인 토글을 위해 완전히 재정의해서 포커스를 이 창에
        // 그대로 유지한다.
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
                    return; // "info" 등: 조절 불가, 사운드 없음
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
                    this._stepValue(desc, 10); // Z: 큰 폭(스텝*10) 조절
                    break;
                default:
                    break; // "info": 아무 동작 없음
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
                this.playBuzzerSound(); // [Read-Only]: 값 변경 불가
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
                this._drawItemRow(desc, rect);
            } else if (this._columns > 1) {
                this._drawGridRow(desc, rect);
            } else {
                this._drawLineRow(desc, rect);
            }

            this.changePaintOpacity(true);
        }
        // 단 한 줄에 [아이콘+이름] - [수량: N] - [무한 고정: ON/OFF] 세 컬럼을
        // 모두 담는다. 이름 폭은 나머지 두 고정폭 컬럼을 뺀 나머지 전부.
        _drawItemRow(desc, rect) {
            const qtyColWidth = 130;
            const fixedColWidth = 170;
            const iconWidth = desc.item && desc.item.iconIndex ? 36 : 0;

            let x = rect.x;
            if (iconWidth > 0) {
                this.drawIcon(desc.item.iconIndex, x, rect.y + 2);
                x += iconWidth;
            }
            const nameWidth = Math.max(0, rect.width - iconWidth - qtyColWidth - fixedColWidth);
            this.drawText(desc.name, x, rect.y, nameWidth, "left");

            const qtyX = rect.x + rect.width - fixedColWidth - qtyColWidth;
            this.drawText(`수량: ${desc.get()}`, qtyX, rect.y, qtyColWidth, "right");

            const fixedX = rect.x + rect.width - fixedColWidth;
            const locked = desc.isLocked();
            if (locked) this.changeTextColor(RpgBridge.textColor(this, 17)); // "강화(powerUp)" 색상 재사용
            this.drawText(`무한 고정: ${locked ? "ON" : "OFF"}`, fixedX, rect.y, fixedColWidth, "right");
            this.resetTextColor();
        }
        // 그리드(Skills): 좁은 칸 안에 이름 + 짧은 ON/OFF 표시. 글자 겹침을
        // 막기 위해 이름은 살짝 작은 폰트로 그린다.
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
        // 1열 탭(General/Party/Variables): 이름은 왼쪽, 값/상태는 오른쪽.
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
            if (desc.type === "action") return "Z / ◀▶ 실행";
            if (desc.type === "choice") return desc.format ? desc.format(value) : `${value}`;
            if (desc.type === "variable") return formatVariableValue(desc.varId);
            if (desc.type === "enemy") return value;
            if (desc.format) return desc.format(value);
            return `${value}`;
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
        createNumberInputWindow() {
            const width = 8 * 32 + WINDOW_PADDING * 2;
            const height = panelHeight(1);
            const x = (Graphics.boxWidth - width) / 2;
            const y = (Graphics.boxHeight - height) / 2;
            this._numberInputWindow = new Window_CheatNumberInput(x, y, width, height);
            this.addWindow(this._numberInputWindow);
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
            this._contentWindow.refresh();
            this._contentWindow.activate();
        }
        // 포커스가 없는 창은 콘텐츠 불투명도를 낮춰서, 지금 탭을 고르는 중인지
        // 하단 콘텐츠 항목을 조작하는 중인지 한눈에 구분되게 한다.
        _refreshFocusVisuals() {
            const tabActive = this._tabWindow.active;
            this._tabWindow.contentsOpacity = tabActive ? 255 : 160;
            this._contentWindow.contentsOpacity = tabActive ? 160 : 255;
        }
    }

    //-------------------------------------------------------------------
    // 토글 입력: 키보드(TOGGLE_KEY_CODE) / 게임패드(GAMEPAD_START_BUTTON, 파라미터로 설정)
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
