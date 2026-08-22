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
/*:ko
 * @plugindesc [치트 엔진] Core v1.3.0 - RPG Maker MV/MZ 공통 치트 엔진 코어 모듈 (UI 없음)
 * @author rpghack
 * @url
 *
 * @param persistCheatStateOnLoad
 * @text 로드 시 치트 상태 유지
 * @type boolean
 * @on 유지
 * @off 리셋
 * @default false
 * @desc true(유지)면 배속/God Mode 등 치트 상태가 세이브 파일에 저장되어 로드 시 복원됩니다.
 * false(리셋)면 로드 직후 항상 안전하게 기본값으로 초기화됩니다.
 *
 * @help
 * CheatEngine_Core.js
 * -----------------------------------------------------------------------------
 * RPG Maker MV / MZ에서 공통으로 사용하는 치트 엔진의 코어 모듈입니다.
 *
 * 이 플러그인은 어떠한 Window/Scene도 직접 그리지 않습니다. 대신 다른 치트 UI
 * 플러그인(예: CheatEngine_UI.js)이나 직접 작성한 스크립트가 사용할 수 있도록
 * 전역 객체 window.RpgBridge / window.CheatManager 를 노출하는
 * "순수 로직 라이브러리" 입니다.
 *
 * 설치 방법:
 *   1) 분리형 설치: 플러그인 목록에서 이 플러그인을 CheatEngine_UI.js(또는 이
 *      Core를 사용하는 다른 플러그인)보다 위쪽(먼저 로드되도록) 배치하고 둘 다
 *      켜(ON) 두세요.
 *   2) 단일 파일(결합형) 설치: 이 파일의 본문과 CheatEngine_UI.js의 본문을 하나의
 *      .js 파일로 이어 붙여도 됩니다. 두 코드 블록 모두 자신이 실제로 실행되고
 *      있는 <script> 태그(document.currentScript)를 통해 스스로의 플러그인
 *      이름을 알아내므로, 합쳐진 파일이 두 플러그인의 @param을 모두 포함하지
 *      않더라도 각자 문서화된 기본값으로 안전하게 동작합니다.
 *
 * 비정상 데이터 방지:
 *   - 골드/게임 배속/이동 배율/스탯 배율/아이템 수량 고정/숫자 변수 등 모든
 *     공개 setter는 숫자가 아니거나(NaN/Infinity) 범위를 벗어난 입력을 걸러내고
 *     안전한 범위로 clamp합니다(예: 골드는 $gameParty.maxGold()를 넘지 않음).
 *     UI나 스크립트에서 어떤 값을 넘기더라도 게임 상태가 깨지지 않습니다.
 *
 * 세이브/로드 동작:
 *   - 위 "로드 시 치트 상태 유지" 파라미터로 제어됩니다.
 *   - 새 게임을 시작하면 파라미터 설정과 무관하게 항상 치트 상태가 초기화됩니다
 *     (복원할 세이브 데이터 자체가 없으므로).
 *
 * Plugin Command 없음 (순수 스크립트 API).
 * -----------------------------------------------------------------------------
 */

var RpgBridge = RpgBridge || {};
var CheatManager = CheatManager || null;

(() => {
    "use strict";

    //-------------------------------------------------------------------
    // 플러그인 이름 동적 해석 (분리형/결합형 설치 양쪽 대응)
    // PluginManager.parameters(name)는 plugins.js에 등록된 파일명(확장자 제외)을
    // 키로 사용한다. document.currentScript는 "지금 실행 중인 <script> 태그"를
    // 가리키므로, 파일을 분리해서 쓰든 다른 파일과 합쳐서 쓰든 항상 자기 자신이
    // 실제로 로드된 파일명을 정확히 알아낼 수 있다.
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

    // 메시지 초고속 스킵이 켜져 있고 메시지가 표시 중일 때, SceneManager의
    // 고정 타임스텝(_deltaTime)을 이 값만큼 더 잘게 쪼갠다. MV/MZ 모두
    // "실제 경과 시간 / _deltaTime"에 비례해 한 렌더 프레임 안에서 게임 로직
    // update를 몇 번 도는지 정하므로(= setGameSpeed()가 배속을 구현하는 바로
    // 그 메커니즘), 이렇게 하면 테스트 플레이의 Ctrl 키 초고속 스킵과 동등하거나
    // 그 이상으로 한 프레임 안에 여러 번의 로직 업데이트가 몰아서 실행된다.
    const MESSAGE_SKIP_BURST_DIVISOR = 8;

    //-------------------------------------------------------------------
    // RpgBridge : MV / MZ 공통 추상화 계층
    //-------------------------------------------------------------------
    const ENGINE_NAME = (typeof Utils !== "undefined" && Utils.RPGMAKER_NAME) || "MV";
    const IS_MZ = ENGINE_NAME === "MZ";
    const IS_MV = !IS_MZ;

    RpgBridge.engineName = ENGINE_NAME;
    RpgBridge.isMZ = IS_MZ;
    RpgBridge.isMV = IS_MV;

    /**
     * Window_* 생성자 시그니처 차이를 흡수한다.
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

    // Scene_MenuBase 상속 체계는 MV/MZ 동일하게 유지되므로 존재 여부만 확인해서
    // 안전한 기본 부모 클래스를 골라준다 (부트 시점 등 미정의 상황 대비).
    RpgBridge.baseMenuSceneClass = function () {
        return typeof Scene_MenuBase !== "undefined" ? Scene_MenuBase : Scene_Base;
    };

    // ---- 데이터베이스 접근 래퍼 ----
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

    // ---- 게임 오브젝트 접근 래퍼 ----
    RpgBridge.game = {
        variables() { return $gameVariables; },
        switches() { return $gameSwitches; },
        party() { return $gameParty; },
        troop() { return $gameTroop; }
    };

    /**
     * 아이템 종류(소모품/무기/방어구)에 따른 내부 보관 컨테이너를 반환한다.
     * ($gameParty._items / _weapons / _armors 는 MV/MZ 동일 구조)
     */
    RpgBridge.itemContainer = function (item) {
        if (!item || typeof $gameParty === "undefined" || !$gameParty) return null;
        if (DataManager.isItem(item)) return $gameParty._items;
        if (DataManager.isWeapon(item)) return $gameParty._weapons;
        if (DataManager.isArmor(item)) return $gameParty._armors;
        return null;
    };

    //-------------------------------------------------------------------
    // CheatManager : 싱글톤
    //-------------------------------------------------------------------
    class CheatManagerClass {
        constructor() {
            this._state = {
                messageSkip: false,
                godMode: false,
                instantKillMode: false,
                moveSpeedMultiplier: 1,
                gameSpeedMultiplier: 1,
                statMultipliers: Object.create(null), // paramId -> multiplier
                infiniteItemKeys: new Set(), // "I1"/"W1"/"A1" -> 개별 아이템 단위 무한(소비 무시) 플래그
                lockedItems: new Map() // "I1"/"W1"/"A1" -> { item, amount }
            };
            this._defaultDeltaTime = null; // SceneManager._deltaTime 원본 값 (지연 캡처)
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
         * 게임 배속을 설정한다. SceneManager._deltaTime(고정 타임스텝)을
         * 배율만큼 줄여서, 실시간 1초당 게임 로직(update)이 더 많이 도는
         * 방식으로 배속을 구현한다. (렌더링 프레임과 무관하게 MV/MZ 모두
         * 동일한 accumulator 구조를 사용하므로 안전하게 동작한다.)
         * 0에 가까운 값이나 과도하게 큰 값은 update 폭주/정지를 유발할 수 있어
         * [0.05, 32] 범위로 clamp한다.
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
        setGodMode(flag) {
            this._state.godMode = !!flag;
        }
        isGodMode() {
            return this._state.godMode;
        }

        setInstantKillMode(flag) {
            this._state.instantKillMode = !!flag;
        }
        isInstantKillMode() {
            return this._state.instantKillMode;
        }

        /** 지정한 전투원을 즉시 사망 처리한다 (수동 호출용). */
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
         * 아이템별로 "소비해도 줄어들지 않음"을 켜고 끈다. 장비(무기/방어구)는
         * 통상적으로 소모되지 않으므로 이 API는 소모품 위주로 사용을 권장한다.
         * (예전의 전역 setInfiniteItems()는 $dataItems 안에 실제 소모되지 않는
         * 항목이 섞여 있을 수 있어 개별 아이템 단위 제어로 대체되었다.)
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

        /** 특정 아이템/무기/방어구의 보유 수량을 고정값으로 고정한다. */
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
        /** 세이브 파일에 안전하게 넣을 수 있는 순수 JSON 스냅샷을 만든다. */
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
                godMode: this._state.godMode,
                instantKillMode: this._state.instantKillMode,
                moveSpeedMultiplier: this._state.moveSpeedMultiplier,
                gameSpeedMultiplier: this._state.gameSpeedMultiplier,
                statMultipliers: Object.assign({}, this._state.statMultipliers),
                infiniteItems,
                lockedItems
            };
        }
        /** serialize()가 만든 스냅샷으로부터 상태를 복원한다. */
        deserialize(data) {
            if (!data) {
                this.resetSessionState();
                return;
            }
            this.setMessageSkip(data.messageSkip);
            this.setGodMode(data.godMode);
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
        /** 치트 상태를 전부 기본값으로 안전하게 되돌린다 (새 게임 시작, 미저장 로드 등). */
        resetSessionState() {
            this.setMessageSkip(false);
            this.setGodMode(false);
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

        // 메시지 초고속 스킵.
        //   1) "확인 입력 감지"를 강제로 true 처리 -> 문장 끝 대기(pause) 즉시 해제
        //   2) \.  \| 같은 대기 코드(startWait)를 0으로 바이패스
        //   3) (현재 비활성화) 메시지가 떠 있는 동안 SceneManager의 로직
        //      업데이트를 한 프레임에 여러 번 몰아서 실행하는 실험적 기능.
        //      SceneManager.update를 감싸는 방식이라 부팅 직후(플레이어 입력
        //      전부터) 매 프레임 실행되는 유일한 신규 코드라서, 검은 화면
        //      부팅 멈춤 증상의 1순위 용의자로 지목되어 원인 확인 전까지
        //      호출을 꺼 둔다. 문제없음이 확인되면 아래 줄의 주석만 풀면 된다.
        _hookMessageSkip() {
            this._hookMessageSkipTrigger();
            this._hookMessageSkipWait();
            // this._hookMessageSkipBurstUpdate(); // TODO: 부팅 멈춤 원인 확인 후 재활성화
        }

        // 메시지 창의 "확인 입력 감지"를 강제로 true 처리하여 자동 진행 구현
        _hookMessageSkipTrigger() {
            if (typeof Window_Message === "undefined") return;
            const manager = this;
            const _isTriggered = Window_Message.prototype.isTriggered;
            Window_Message.prototype.isTriggered = function () {
                if (manager.isMessageSkip()) return true;
                return _isTriggered.call(this);
            };
        }

        // \.(0.25초) \|(1초) 같은 대기 코드가 만드는 startWait(count) 대기를
        // 스킵 중에는 0으로 바이패스한다. MV는 Window_Message.prototype에,
        // MZ는 Window_Base.prototype에 정의되어 있지만 프로토타입 체인을 통해
        // 어느 쪽이든 Window_Message.prototype.startWait로 조회되므로, 이
        // 하나의 지점만 감싸면 두 엔진 모두 안전하게 처리된다.
        _hookMessageSkipWait() {
            if (typeof Window_Message === "undefined" || typeof Window_Message.prototype.startWait !== "function") return;
            const manager = this;
            const target = Window_Message.prototype;
            const _startWait = target.startWait;
            target.startWait = function (count) {
                _startWait.call(this, manager.isMessageSkip() ? 0 : count);
            };
        }

        // 메시지가 표시 중(busy)이고 스킵이 켜져 있으면, 이번 한 프레임만
        // SceneManager._deltaTime을 MESSAGE_SKIP_BURST_DIVISOR분의 1로 줄였다가
        // 원래 값으로 되돌린다. setGameSpeed()로 이미 배속이 걸려 있어도(현재
        // _deltaTime 값을 기준으로 다시 나누므로) 자연스럽게 곱으로 누적되며,
        // 메시지가 끝나는 즉시(다음 프레임부터 busy가 false) 원래 속도로 복귀한다.
        _hookMessageSkipBurstUpdate() {
            if (typeof SceneManager === "undefined" || typeof SceneManager.update !== "function") return;
            const manager = this;
            const _update = SceneManager.update;
            SceneManager.update = function () {
                const messageBusy =
                    manager.isMessageSkip() &&
                    typeof $gameMessage !== "undefined" && $gameMessage &&
                    typeof $gameMessage.isBusy === "function" && $gameMessage.isBusy();
                if (!messageBusy || typeof this._deltaTime !== "number") {
                    _update.call(this);
                    return;
                }
                const savedDeltaTime = this._deltaTime;
                this._deltaTime = savedDeltaTime / MESSAGE_SKIP_BURST_DIVISOR;
                try {
                    _update.call(this);
                } finally {
                    this._deltaTime = savedDeltaTime;
                }
            };
        }

        // refresh() 이후 파티원 HP/MP를 최대치로 고정 + gainHp 음수 변화 무시
        _hookGodMode() {
            const manager = this;

            if (typeof Game_BattlerBase !== "undefined") {
                const _refresh = Game_BattlerBase.prototype.refresh;
                Game_BattlerBase.prototype.refresh = function () {
                    _refresh.call(this);
                    if (manager.isGodMode() && manager._isProtectedBattler(this)) {
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
                    if (manager.isGodMode() && manager._isProtectedBattler(this) && value < 0) {
                        return;
                    }
                    _gainHp.call(this, value);
                };
            }
        }

        // 파티(아군)가 적에게 가하는 데미지를 즉사급으로 강제
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

        // paramRate()에 커스텀 배율을 곱해 파티원 스탯 버프 적용
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

        // 캐릭터 이동 거리(distancePerFrame)에 배율 적용
        _hookMoveSpeed() {
            if (typeof Game_CharacterBase === "undefined") return;
            const manager = this;
            const _distancePerFrame = Game_CharacterBase.prototype.distancePerFrame;
            Game_CharacterBase.prototype.distancePerFrame = function () {
                return _distancePerFrame.call(this) * manager.getMoveSpeedMultiplier();
            };
        }

        // gainItem 인터셉트: 무한 아이템 / 보유량 고정
        _hookLoseItem() {
            if (typeof Game_Party === "undefined") return;
            const manager = this;
            const _loseItem = Game_Party.prototype.loseItem;
            Game_Party.prototype.loseItem = function (item, amount, includeEquip) {
                if (!item) return;

                if (amount < 0 && manager.isItemInfinite(item)) {
                    return; // 이 아이템의 소비(감소)만 무시하여 사실상 무한 아이템으로 동작
                }

                _loseItem.call(this, item, amount, includeEquip);

                const lock = manager._state.lockedItems.get(manager._itemKey(item));
                if (lock) {
                    const container = RpgBridge.itemContainer(item);
                    if (container) container[item.id] = lock.amount;
                }
            };
        }

        // 세이브 데이터에 치트 상태를 (설정에 따라) 함께 저장/복원하고,
        // 새 게임 시작 시에는 항상 안전하게 초기화한다.
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
         * value를 숫자로 강제 변환해 [min, max] 범위로 clamp한다. NaN/Infinity 등
         * 비정상 입력이면 fallback(보통 "현재 값")을 그대로 사용해 절대 게임
         * 상태를 깨뜨리지 않는다.
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
