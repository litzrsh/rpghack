//=============================================================================
// CheatEngine_Core.js
//=============================================================================
/*:
 * @plugindesc [Cheat Engine] Core v1.0.0 - RPG Maker MV/MZ 공통 치트 엔진 코어 모듈 (UI 없음)
 * @author rpghack
 *
 * @help
 * CheatEngine_Core.js
 * -----------------------------------------------------------------------------
 * RPG Maker MV / MZ에서 공통으로 사용하는 치트 엔진의 코어 모듈입니다.
 *
 * 이 플러그인은 어떠한 Window/Scene도 직접 그리지 않습니다. 대신 다른 치트 UI
 * 플러그인이 사용할 수 있도록 전역 객체 window.RpgBridge / window.CheatManager
 * 를 노출하는 "순수 로직 라이브러리" 입니다.
 *
 * 사용법:
 *   1) 플러그인 목록에서 이 플러그인을 다른 Cheat UI 플러그인보다 위쪽(먼저
 *      로드되도록) 배치하세요.
 *   2) 다른 플러그인에서 CheatManager.setGodMode(true) 처럼 API를 직접
 *      호출하거나, 입력 이벤트 핸들러에서 호출하십시오.
 *
 * Plugin Command 없음 / Parameter 없음.
 * -----------------------------------------------------------------------------
 */

var RpgBridge = RpgBridge || {};
var CheatManager = CheatManager || null;

(() => {
    "use strict";

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
                infiniteItems: false,
                lockedItems: new Map() // "I1"/"W1"/"A1" -> { item, amount }
            };
            this._defaultDeltaTime = null; // SceneManager._deltaTime 원본 값 (지연 캡처)
            this._installHooks();
        }

        // ================= General =================
        setGold(amount) {
            if (typeof $gameParty === "undefined" || !$gameParty) return;
            $gameParty._gold = Math.max(0, Math.floor(Number(amount) || 0));
        }
        getGold() {
            return typeof $gameParty !== "undefined" && $gameParty ? $gameParty.gold() : 0;
        }

        /**
         * 게임 배속을 설정한다. SceneManager._deltaTime(고정 타임스텝)을
         * 배율만큼 줄여서, 실시간 1초당 게임 로직(update)이 더 많이 도는
         * 방식으로 배속을 구현한다. (렌더링 프레임과 무관하게 MV/MZ 모두
         * 동일한 accumulator 구조를 사용하므로 안전하게 동작한다.)
         */
        setGameSpeed(multiplier) {
            const m = Math.max(0.01, Number(multiplier) || 1);
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
            this._state.moveSpeedMultiplier = Math.max(0, Number(multiplier) || 1);
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
            this._state.statMultipliers[paramId] = Number(multiplier) || 1;
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
        setInfiniteItems(flag) {
            this._state.infiniteItems = !!flag;
        }
        isInfiniteItems() {
            return this._state.infiniteItems;
        }

        /** 특정 아이템/무기/방어구의 보유 수량을 고정값으로 고정한다. */
        lockItemQuantity(item, amount) {
            if (!item) return;
            this._state.lockedItems.set(this._itemKey(item), { item, amount: Math.max(0, Math.floor(amount)) });
            const container = RpgBridge.itemContainer(item);
            if (container) container[item.id] = Math.max(0, Math.floor(amount));
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
            return Number($gameVariables.value(id)) || 0;
        }
        setNumberVariable(id, value) {
            if (typeof $gameVariables === "undefined" || !$gameVariables) return;
            $gameVariables.setValue(id, Number(value) || 0);
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

        // ================= internal hooks =================
        _installHooks() {
            this._hookMessageSkip();
            this._hookGodMode();
            this._hookInstantKill();
            this._hookStatMultiplier();
            this._hookMoveSpeed();
            this._hookGainItem();
        }

        // 메시지 창의 "확인 입력 감지"를 강제로 true 처리하여 자동 스킵 구현
        _hookMessageSkip() {
            if (typeof Window_Message === "undefined") return;
            const manager = this;
            const _isTriggered = Window_Message.prototype.isTriggered;
            Window_Message.prototype.isTriggered = function () {
                if (manager.isMessageSkip()) return true;
                return _isTriggered.call(this);
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
        _hookGainItem() {
            if (typeof Game_Party === "undefined") return;
            const manager = this;
            const _gainItem = Game_Party.prototype.gainItem;
            Game_Party.prototype.gainItem = function (item, amount, includeEquip) {
                if (!item) return;

                if (manager.isInfiniteItems() && amount < 0) {
                    return; // 소비(감소)만 무시하여 사실상 무한 아이템으로 동작
                }

                _gainItem.call(this, item, amount, includeEquip);

                const lock = manager._state.lockedItems.get(manager._itemKey(item));
                if (lock) {
                    const container = RpgBridge.itemContainer(item);
                    if (container) container[item.id] = lock.amount;
                }
            };
        }
    }

    CheatManager = new CheatManagerClass();
    window.RpgBridge = RpgBridge;
    window.CheatManager = CheatManager;
})();
