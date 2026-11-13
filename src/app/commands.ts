import { enterRoute, resolveRoute, isInterceptNode, resetRoute, routeState } from "@/features/route";
import {
  battleState,
  beginBattle,
  playCard,
  endTurn,
  disengagePursuit,
  resetBattle,
} from "@/features/battle";
import {
  deckState,
  deckCards,
  addCard,
  earnGold,
  spendGold,
  setHp,
  heal,
  upgradeCard,
  removeCard,
  openCamp,
  useCamp,
  resetDeck,
} from "@/features/deck";
import { openReward, claimReward, resetReward } from "@/features/reward";
import {
  shopState,
  openShop,
  preparePurchase,
  completePurchase,
  cancelPurchase,
  closeShop,
  resetShop,
} from "@/features/shop";
import {
  session,
  switchTab,
  setContext,
  notify,
  finishRun,
  resetSession,
} from "./session";
import { save, clearSave } from "./persistence";

function persist() {
  if (!save()) notify("本地保存失败，请保留当前页面。");
}

export function navigate(id: string) {
  if (session.ended) return;
  const c = enterRoute(id);
  if (!c) return;
  setContext(c);
  if (c.kind === "shop") {
    openShop(c, routeState.alertStage);
    switchTab("shop");
    notify(
      routeState.alertStage > 0
        ? `警戒阶段：${routeState.alertStage === 2 ? "围猎" : "哨戒"}。商人提前撤离，未售库存将在下一地区赶上你。`
        : `进入 ${c.nodeId} · 威胁 ${c.influence.heat} / 好感 ${c.influence.favor}`,
    );
  } else if (c.kind === "camp") {
    openCamp();
    switchTab("deck");
  } else {
    const intercept = isInterceptNode(c.nodeId);
    // 拦截战按追击被布设时锁定的警戒阶段执行，不受之后走安路影响
    const stage = intercept ? routeState.pursuit.stage : routeState.alertStage;
    beginBattle(
      c,
      deckCards(),
      deckState.hero.hp,
      deckState.hero.maxHp,
      intercept,
      stage,
    );
    switchTab("battle");
    notify(
      intercept
        ? `追击倒计时归零：${stage === 2 ? "围猎" : "哨戒"}追兵将在指定回合后接替敌人。`
        : `进入 ${c.nodeId} · 威胁 ${c.influence.heat} / 好感 ${c.influence.favor}`,
    );
  }
  persist();
}

export function play(id: string) {
  playCard(id);
  persist();
}

export function turn() {
  endTurn();
  persist();
}

/** 追击者登场后，主动放其脱身，按敌人撤退结局结算 */
export function disengage() {
  if (!disengagePursuit()) return;
  notify("你放追兵脱离战场，按敌人撤退结算，原敌人掉落不会出现。");
  persist();
}

export function settle() {
  const r = battleState.result;
  if (!r) return;
  if (!r.won) {
    setHp(r.hp);
    finishRun();
    notify("这次旅途已经结束。重新启程可保留你的经验。");
    persist();
    return;
  }
  if (openReward(JSON.parse(JSON.stringify(r)))) {
    setHp(r.hp);
    switchTab("reward");
    notify(
      r.retreated
        ? "原敌人已撤离：奖励页会说明你为何没有拿到它的掉落。"
        : "胜利！选择一张牌或跳过卡牌，金币都会结算。",
    );
  }
  persist();
}

export function claim(skip: boolean) {
  const grant = claimReward(skip);
  if (!grant) return;
  if (grant.card) addCard(grant.card);
  earnGold(grant.gold);
  heal(grant.heal);
  resolveRoute();
  if (session.context?.kind === "boss") {
    finishRun();
    notify("裂隙已被封存。你把余烬带回了黎明。");
  } else notify("奖励已结算，新的路线开放。");
  switchTab("route");
  persist();
}

/** 确认一笔交易报价，报价会保持到提交或取消 */
export function quote(id: string) {
  const p = preparePurchase(id);
  if (!p) {
    notify("该货物已售出或已随商队撤离。");
    return;
  }
  notify(`报价已确认：${p.price} 金。提交成交，或取消后改选其他货物。`);
  persist();
}

/** 提交已确认的报价 */
export function confirmBuy() {
  const pending = shopState.pending
    ? JSON.parse(JSON.stringify(shopState.pending))
    : null;
  if (!pending) {
    notify("没有已确认的交易报价。");
    return;
  }
  if (!spendGold(pending.price)) {
    notify("无法购买：金币不足，报价仍然保留，可取消后改选。");
    return;
  }
  if (!completePurchase(pending)) {
    earnGold(pending.price);
    notify("报价已失效（货物售出或撤离），金币已退回。");
    return;
  }
  addCard(pending.card);
  notify("交易完成，卡牌已收入牌组。");
  persist();
}

/** 取消已确认报价 */
export function cancelQuote() {
  cancelPurchase();
  notify("报价已取消。");
  persist();
}

/** 兼容旧入口：点击货物直接确认报价 */
export function buy(id: string) {
  quote(id);
}

export function leaveShop() {
  closeShop();
  resolveRoute();
  switchTab("route");
  persist();
}

export function camp(action: "rest" | "upgrade") {
  if (
    !session.context ||
    session.context.kind !== "camp" ||
    !useCamp(action, session.context.influence.heat)
  )
    return;
  resolveRoute();
  notify("篝火逐渐熄灭，你准备好继续上路。");
  persist();
}

export function upgrade(id: string) {
  if (battleState.phase === "playing") return;
  notify(upgradeCard(id) ? "卡牌强化完成。" : "无法强化：金币不足或已经强化。");
  persist();
}

export function remove(id: string) {
  if (battleState.phase === "playing") return;
  notify(
    removeCard(id)
      ? "已移除卡牌。"
      : "无法移除：至少保留五张牌，且需要足够金币。",
  );
  persist();
}

export function restart() {
  resetRoute();
  resetBattle();
  resetDeck();
  resetReward();
  resetShop();
  resetSession();
  clearSave();
  persist();
}
