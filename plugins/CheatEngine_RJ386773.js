//=============================================================================
// CheatEngine_RJ386773.js
//=============================================================================
/*:
 * @plugindesc [Cheat Engine] RJ386773 v1.0.0 - Game-specific cheat tab for RJ386773 (extends CheatEngine_UI.js).
 * @author rpghack
 * @base CheatEngine_Core
 * @base CheatEngine_UI
 * @orderAfter CheatEngine_Core
 * @orderAfter CheatEngine_UI
 * @url
 *
 * @param enableRJ386773Tab
 * @text Enable "RJ386773" Tab
 * @type boolean
 * @default true
 * @desc Show the RJ386773 tab (date/time, sugoroku, food/drink, virginity reset, EXP) in the tab bar.
 *
 * @help
 * CheatEngine_RJ386773.js
 * -----------------------------------------------------------------------------
 * Ported from the RJ386773-specific cheats originally written for the
 * tsukuheck project. Adds one extra tab to CheatEngine_UI.js's menu via its
 * window.CheatEngineUI.registerTab() extension point.
 *
 * Installation:
 *   - Place BELOW both CheatEngine_Core.js and CheatEngine_UI.js in the
 *     Plugin Manager list, and enable all three. This plugin only makes sense
 *     for the RJ386773 project -- do not add it to any other game, since
 *     every value below is a hardcoded variable ID / plugin command specific
 *     to that game's own event data and other installed plugins (SH_Clock,
 *     SH_ParaChecker, and whatever plugin implements $gamePlayer's sugoroku
 *     step).
 *
 * What it adds (see the RJ386773 tab):
 *   - Date (variable #26) and its limit (#103, read-only) / days remaining
 *     (#104, recomputed on every date change, same as the game's own events).
 *   - Time of day (variable #31: 朝/昼/夕方/夜), applied through the SH_Clock
 *     plugin's "ClockTimeZone" command so its own bookkeeping stays correct.
 *   - Sugoroku (board game) turn counter (variable #911) and board position
 *     ($gamePlayer's step), plus a toggle that forces every dice roll to 6.
 *   - Food/drink reset (variables #128, #298).
 *   - Virginity reset (vagina: #145/#201, anal: #200/#202), reapplied through
 *     the SH_ParaChecker plugin's "ParaCheck" command.
 *   - Per party-member EXP editing via each actor's custom `tmpExp` field
 *     (a field owned by one of this game's other plugins, not RPG Maker's
 *     own Game_Actor -- edited directly, same as the original).
 * -----------------------------------------------------------------------------
 */
/*:ko
 * @plugindesc [치트 엔진] RJ386773 v1.0.0 - RJ386773 전용 치트 탭 (CheatEngine_UI.js 확장)
 * @author rpghack
 * @base CheatEngine_Core
 * @base CheatEngine_UI
 * @orderAfter CheatEngine_Core
 * @orderAfter CheatEngine_UI
 * @url
 *
 * @param enableRJ386773Tab
 * @text "RJ386773" 탭 사용
 * @type boolean
 * @default true
 * @desc 상단 탭 목록에 RJ386773 탭(날짜/시간, 스고로쿠, 식사/음료, 버진 상태, EXP)을 표시합니다.
 *
 * @help
 * CheatEngine_RJ386773.js
 * -----------------------------------------------------------------------------
 * tsukuheck 프로젝트에서 RJ386773 전용으로 작성돼 있던 치트를 이식한
 * 플러그인입니다. CheatEngine_UI.js의 window.CheatEngineUI.registerTab()
 * 확장 지점을 통해 탭 하나를 메뉴에 추가합니다.
 *
 * 설치 방법:
 *   - CheatEngine_Core.js와 CheatEngine_UI.js 둘 다보다 아래쪽에 배치하고
 *     셋 다 켜(ON) 두세요. 이 플러그인은 오직 RJ386773 프로젝트에서만
 *     의미가 있습니다 -- 아래의 모든 값이 그 게임 자체의 이벤트 변수 ID와
 *     다른 설치된 플러그인(SH_Clock, SH_ParaChecker, $gamePlayer의 스고로쿠
 *     이동 칸을 구현하는 플러그인)의 커맨드에 하드코딩되어 있으므로, 다른
 *     게임에는 추가하지 마세요.
 *
 * 추가되는 기능 (RJ386773 탭 참고):
 *   - 날짜(변수 #26)와 그 상한(#103, 읽기 전용) / 잔여일(#104, 게임 자체
 *     이벤트와 동일하게 날짜를 바꿀 때마다 재계산).
 *   - 시간대(변수 #31: 朝/昼/夕方/夜) -- SH_Clock 플러그인의 "ClockTimeZone"
 *     커맨드를 통해 적용해 그 플러그인 자체의 내부 상태도 함께 맞춥니다.
 *   - 스고로쿠(보드게임) 턴 수(변수 #911)와 보드 위치($gamePlayer의 이동
 *     칸), 그리고 주사위 눈을 항상 6으로 고정하는 토글.
 *   - 식사/음료 리셋(변수 #128, #298).
 *   - 버진 상태 리셋(질: #145/#201, 항문: #200/#202) -- SH_ParaChecker
 *     플러그인의 "ParaCheck" 커맨드로 재적용합니다.
 *   - 파티원별 EXP 편집 -- 각 액터의 커스텀 `tmpExp` 필드(RPG Maker 기본
 *     Game_Actor 소속이 아니라 이 게임의 다른 플러그인이 쓰는 필드)를 원본과
 *     동일하게 직접 수정합니다.
 * -----------------------------------------------------------------------------
 */

(() => {
    "use strict";

    if (typeof RpgBridge === "undefined" || typeof CheatManager === "undefined" || !CheatManager) {
        console.error("CheatEngine_RJ386773.js: CheatEngine_Core.js가 먼저 로드되어야 합니다.");
        return;
    }
    if (typeof window.CheatEngineUI === "undefined" || typeof window.CheatEngineUI.registerTab !== "function") {
        console.error("CheatEngine_RJ386773.js: CheatEngine_UI.js가 먼저 로드되어야 합니다.");
        return;
    }

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

    const PLUGIN_NAME = resolvePluginName("CheatEngine_RJ386773");
    const PARAMS = (typeof PluginManager !== "undefined" ? PluginManager.parameters(PLUGIN_NAME) : {}) || {};
    const ENABLE_TAB = paramBool(PARAMS, "enableRJ386773Tab", true);

    function hasVariables() {
        return typeof $gameVariables !== "undefined" && !!$gameVariables && !!$gameVariables._data;
    }
    function getVar(id) {
        return hasVariables() ? $gameVariables._data[id] : undefined;
    }
    function setVar(id, value) {
        if (hasVariables()) $gameVariables._data[id] = value;
    }
    function callPluginCommand(pluginName, commandName, args) {
        if (typeof PluginManager === "undefined" || typeof PluginManager.callCommand !== "function") return;
        try {
            PluginManager.callCommand({ eventId: () => 0 }, pluginName, commandName, args || {});
        } catch (e) {
            console.error(`CheatEngine_RJ386773.js: ${pluginName}.${commandName} 호출 실패`, e);
        }
    }

    //-------------------------------------------------------------------
    // Date / Time (변수 #26 현재 날짜, #103 날짜 상한(읽기 전용), #104 잔여일,
    // #31 시간대). 시간대 변경은 SH_Clock 플러그인의 자체 상태도 맞춰야 하므로
    // 그 플러그인의 "ClockTimeZone" 커맨드를 통해 적용한다.
    //-------------------------------------------------------------------
    const TIME_ZONE_LABELS = ["朝", "昼", "夕方", "夜"];

    function getDate() {
        return getVar(26) || 0;
    }
    function setDate(value) {
        const v = Math.max(1, Math.round(Number(value) || 0));
        setVar(26, v);
        setVar(104, (getVar(103) || 0) - v);
        return getVar(26);
    }
    function getTime() {
        return getVar(31) || 0;
    }
    function setTime(value) {
        const v = Math.max(0, Math.min(TIME_ZONE_LABELS.length - 1, Math.round(Number(value) || 0)));
        setVar(31, v);
        callPluginCommand("SH_Clock", "ClockTimeZone", { Elapsed: 0 });
        return getVar(31);
    }

    //-------------------------------------------------------------------
    // Sugoroku (스고로쿠 보드게임): 턴 수(변수 #911), 보드 위치($gamePlayer의
    // step), 주사위 눈 고정. rollDice 몽키패치는 한 번만 설치한다.
    //-------------------------------------------------------------------
    let diceForced = false;
    let diceHooked = false;
    function hookRollDiceOnce() {
        if (diceHooked || typeof Game_Screen === "undefined") return;
        diceHooked = true;
        const _rollDice = Game_Screen.prototype.rollDice;
        Game_Screen.prototype.rollDice = function (count = 0, max = 1) {
            const dice = _rollDice.call(this, count, max);
            return diceForced ? 6 : dice;
        };
    }

    function getSugorokuTurn() {
        return getVar(911) || 0;
    }
    function setSugorokuTurn(value) {
        const v = Math.max(0, Math.min(9999, Math.round(Number(value) || 0)));
        setVar(911, v);
        return getVar(911);
    }
    function getSugorokuStep() {
        return typeof $gamePlayer !== "undefined" && $gamePlayer ? $gamePlayer._step : 0;
    }
    function setSugorokuStep(value) {
        const v = Math.max(1, Math.min(99, Math.round(Number(value) || 0)));
        if (typeof $gamePlayer !== "undefined" && $gamePlayer && typeof $gamePlayer.setStep === "function") {
            $gamePlayer.setStep(v);
        }
        return getSugorokuStep();
    }
    function isDiceForced() {
        return diceForced;
    }
    function setDiceForced(flag) {
        hookRollDiceOnce();
        diceForced = !!flag;
    }

    //-------------------------------------------------------------------
    // Food / Drink reset (변수 #128, #298)
    //-------------------------------------------------------------------
    function resetFoodAndDrink() {
        setVar(128, 0);
        setVar(298, 0);
    }

    //-------------------------------------------------------------------
    // Virginity reset. 리셋 후 SH_ParaChecker 플러그인의 "ParaCheck" 커맨드로
    // 그 플러그인 쪽 파생 상태도 함께 재계산시킨다.
    //-------------------------------------------------------------------
    function makeVaginaVirgin() {
        setVar(145, "なし");
        setVar(201, 0);
        callPluginCommand("SH_ParaChecker", "ParaCheck", {});
    }
    function makeAnalVirgin() {
        setVar(200, "なし");
        setVar(202, 0);
        callPluginCommand("SH_ParaChecker", "ParaCheck", {});
    }

    //-------------------------------------------------------------------
    // Per-actor EXP (커스텀 tmpExp 필드. RPG Maker 기본 Game_Actor 소속이
    // 아니라 이 게임의 다른 플러그인이 관리하는 필드이므로 changeExp()가 아닌
    // 원본과 동일하게 직접 대입한다.)
    //-------------------------------------------------------------------
    function partyActors() {
        if (typeof $gameParty === "undefined" || !$gameParty || !$gameParty._actors) return [];
        if (typeof $gameActors === "undefined" || !$gameActors) return [];
        return $gameParty._actors
            .map((id) => $gameActors._data[id])
            .filter((actor) => !!actor);
    }
    function getTmpExp(actor) {
        return actor.tmpExp || 0;
    }
    function setTmpExp(actor, value) {
        actor.tmpExp = Math.max(0, Math.round(Number(value) || 0));
    }

    //-------------------------------------------------------------------
    // 탭 서술자(descriptor) 빌드. type 규격은 CheatEngine_UI.js와 동일
    // (number / boolean / choice / action / info).
    //-------------------------------------------------------------------
    function buildRJ386773Descriptors() {
        const list = [];

        list.push({ name: `▼ 날짜 / 시간  ${"─".repeat(16)}`, type: "info", get: () => "" });
        list.push({
            name: "날짜",
            type: "number", step: 1, min: 1, max: 99999,
            format: (v) => `${v} / ${getVar(103) || 0}`,
            get: () => getDate(),
            set: (v) => setDate(v)
        });
        list.push({
            name: "시간대",
            type: "choice", values: [0, 1, 2, 3],
            format: (v) => TIME_ZONE_LABELS[v] || `${v}`,
            get: () => getTime(),
            set: (v) => setTime(v)
        });

        list.push({ name: `▼ 스고로쿠  ${"─".repeat(16)}`, type: "info", get: () => "" });
        list.push({
            name: "턴 수",
            type: "number", step: 1, min: 0, max: 9999,
            get: () => getSugorokuTurn(),
            set: (v) => setSugorokuTurn(v)
        });
        list.push({
            name: "보드 위치(칸)",
            type: "number", step: 1, min: 1, max: 99,
            get: () => getSugorokuStep(),
            set: (v) => setSugorokuStep(v)
        });
        list.push({
            name: "주사위 눈 고정 (항상 6)",
            type: "boolean",
            get: () => isDiceForced(),
            set: (v) => setDiceForced(v)
        });

        list.push({ name: `▼ 기타  ${"─".repeat(16)}`, type: "info", get: () => "" });
        list.push({
            name: "식사/음료 리셋",
            type: "action",
            get: () => "",
            action: () => resetFoodAndDrink()
        });
        list.push({
            name: "버진 상태로 되돌리기 (질)",
            type: "action",
            get: () => "",
            action: () => makeVaginaVirgin()
        });
        list.push({
            name: "버진 상태로 되돌리기 (항문)",
            type: "action",
            get: () => "",
            action: () => makeAnalVirgin()
        });

        const actors = partyActors();
        if (actors.length > 0) {
            list.push({ name: `▼ 파티 EXP (커스텀)  ${"─".repeat(16)}`, type: "info", get: () => "" });
            for (const actor of actors) {
                list.push({
                    name: actor.name ? actor.name() : `Actor #${actor.actorId ? actor.actorId() : "?"}`,
                    type: "number", step: 100, min: 0, max: 99999999,
                    get: () => getTmpExp(actor),
                    set: (v) => setTmpExp(actor, v)
                });
            }
        }

        return list;
    }

    //-------------------------------------------------------------------
    // 토글 입력: 키보드(TOGGLE_KEY_CODE) / 게임패드(GAMEPAD_START_BUTTON, 파라미터로 설정)
    //-------------------------------------------------------------------
    let button1WasPressed = false;
    let button2WasPressed = false;
    let button3WasPressed = false;

    document.addEventListener("keydown", (event) => {
        if (event.key === "1") {
            event.preventDefault();
            setSugorokuStep(1);
        }
        if (event.key === "2") {
            event.preventDefault();
            setSugorokuStep(99);
        }
    });

    // 게임패드 Start 버튼(기본 9번)은 RPG Maker의 기본 Input.gamepadMapper에
    // 포함되어 있지 않으므로, Input.update()에 편승해 매 프레임 직접
    // 폴링(polling)한다. enableGamepadToggle 파라미터로 완전히 끌 수도 있다.
    if (typeof Input !== "undefined") {
        const _inputUpdate = Input.update;
        Input.update = function () {
            _inputUpdate.call(this);
            const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : null;
            const pad = pads && pads[0];
            const button1 = pad && pad.buttons && pad.buttons[4];
            const button2 = pad && pad.buttons && pad.buttons[6];
            const button3 = pad && pad.buttons && pad.buttons[5];
            const pressed1 = !!(button1 && button1.pressed);
            if (pressed1 && !button1WasPressed) {
                setSugorokuStep(1);
            }
            button1WasPressed = pressed1;
            const pressed2 = !!(button2 && button2.pressed);
            if (pressed2 && !button2WasPressed) {
                setSugorokuStep(99);
            }
            button2WasPressed = pressed2;
            const pressed3 = !!(button3 && button3.pressed);
            if (pressed3 && !button3WasPressed) {
                setSugorokuTurn(999);
            }
            button3WasPressed = pressed3;
        };
    }

    window.CheatEngineUI.registerTab({
        name: "RJ386773",
        enabled: ENABLE_TAB,
        builder: buildRJ386773Descriptors,
        columns: 1
    });
})();
