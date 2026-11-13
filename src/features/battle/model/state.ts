import { reactive, readonly } from "vue";
import type {
  Actor,
  AlertStage,
  BattleOutcome,
  BattleResult,
  CardInstance,
  JourneyContext,
} from "@/shared/domain";
import { cards } from "@/shared/cards";
import { uid } from "@/shared/random";
import {
  spawnEnemy,
  spawnPursuer,
  retreatDeadline,
  enemyIntent,
  type Enemy,
} from "../lib/enemies";
import { makePiles, drawCards, discardHand, type Piles } from "../lib/piles";
import {
  resolveEffect,
  poisonTick,
  damage,
  type EffectEvent,
} from "../lib/effects";

interface BattleState {
  id: string;
  context: JourneyContext | null;
  hero: Actor;
  enemy: Enemy | null;
  piles: Piles;
  energy: number;
  turn: number;
  phase: "idle" | "playing" | "won" | "lost";
  queue: EffectEvent[];
  log: string[];
  result: BattleResult | null;
  /** 本节点是否为追击拦截点 */
  intercept: boolean;
  /** 警戒阶段（决定原敌人第几回合撤退） */
  alertStage: AlertStage;
  /** 原敌人最迟存活到第几回合结束 */
  deadline: number;
  /** 原敌人是否已撤退 */
  retreated: boolean;
  /** 追击者是否已登场 */
  pursuerEngaged: boolean;
  /** 撤退前的原敌人快照（仅用于掉落结算，不会重新上场） */
  originalEnemy: Enemy | null;
}

const emptyHero = (): Actor => ({
  hp: 72,
  maxHp: 72,
  block: 0,
  strength: 0,
  poison: 0,
  thorns: 0,
});

const state = reactive<BattleState>({
  id: "",
  context: null,
  hero: emptyHero(),
  enemy: null,
  piles: makePiles([], ""),
  energy: 3,
  turn: 1,
  phase: "idle",
  queue: [],
  log: [],
  result: null,
  intercept: false,
  alertStage: 0,
  deadline: 0,
  retreated: false,
  pursuerEngaged: false,
  originalEnemy: null,
});

export const battleState = readonly(state);

export function beginBattle(
  context: JourneyContext,
  deck: CardInstance[],
  hp: number,
  maxHp: number,
  intercept = false,
  alertStage: AlertStage = 0,
) {
  state.id = uid("battle");
  state.context = context;
  state.hero = { ...emptyHero(), hp, maxHp };
  state.enemy = spawnEnemy(context);
  state.piles = makePiles(deck, context.nodeId);
  state.energy = 3;
  state.turn = 1;
  state.phase = "playing";
  state.queue = [];
  state.result = null;
  state.intercept = intercept;
  state.alertStage = alertStage;
  state.deadline = intercept ? retreatDeadline(alertStage) : 0;
  state.retreated = false;
  state.pursuerEngaged = false;
  state.originalEnemy = null;
  state.log = [
    intercept
      ? `战斗开始。${state.alertStage === 2 ? "围猎" : "哨戒"}追兵将至，第 ${state.deadline} 回合结束后原敌人若未倒下便会撤离。`
      : "战斗开始。状态和牌堆仅属于本场遭遇。",
  ];
  drawCards(state.piles, 5, 1);
}

function buildResult(won: boolean): BattleResult {
  const outcome: BattleOutcome | null = !won
    ? null
    : !state.retreated
      ? "slain"
      : state.pursuerEngaged && state.enemy?.hp === 0
        ? "pursuer-slain"
        : "retreated";
  return {
    id: state.id,
    nodeId: state.context!.nodeId,
    won,
    hp: state.hero.hp,
    // 撤退脱身时战斗内不产金，保底金币在奖励结算中发放
    gold: won && outcome !== "retreated" ? state.enemy!.reward : 0,
    context: JSON.parse(JSON.stringify(state.context)),
    outcome,
    retreated: state.retreated,
    originalGold:
      state.originalEnemy?.reward ?? state.enemy?.reward ?? 0,
    pursuerEngaged: state.pursuerEngaged,
  };
}

function finish() {
  if (!state.enemy || !state.context || state.phase !== "playing") return;
  if (state.hero.hp <= 0 || state.enemy.hp <= 0) {
    state.phase = state.hero.hp <= 0 ? "lost" : "won";
    state.result = buildResult(state.phase === "won");
    state.queue = [];
  }
}

/**
 * 原敌人撤退、追击者替换上场。
 * 只保留旅人状态与已用牌堆（抽牌 / 手牌 / 弃牌 / 消耗原样延续），
 * 新敌人不继承原敌人的中毒、格挡、力量、荆棘或残血。
 */
function replaceWithPursuer() {
  if (!state.enemy || !state.context || state.retreated) return;
  const original = state.enemy;
  state.originalEnemy = JSON.parse(JSON.stringify(original));
  state.retreated = true;
  state.pursuerEngaged = true;
  state.enemy = spawnPursuer(state.context, state.alertStage === 2 ? 2 : 1);
  state.log.unshift(
    `${original.name} 在第 ${state.turn} 回合结束后撤离，${state.enemy.name} 接替上场（不继承中毒与格挡）。`,
  );
}

function drain() {
  while (state.queue.length && state.phase === "playing") {
    const event = state.queue.shift()!;
    if (event.effect.type === "draw") {
      drawCards(state.piles, event.effect.amount, state.turn);
      state.log.unshift(`抽取 ${event.effect.amount} 张牌`);
    } else if (event.effect.type === "energy") {
      state.energy += event.effect.amount;
    } else if (state.enemy)
      state.log.unshift(resolveEffect(event, state.hero, state.enemy));
    finish();
  }
  state.log = state.log.slice(0, 18);
}

export function playCard(id: string) {
  if (state.phase !== "playing") return false;
  const card = state.piles.hand.find((c) => c.id === id);
  if (!card) return false;
  const spec = cards[card.key]!;
  if (state.energy < spec.cost) return false;
  state.energy -= spec.cost;
  state.piles.hand = state.piles.hand.filter((c) => c.id !== id);
  (spec.kind === "power" ? state.piles.exhaust : state.piles.discard).push(
    card,
  );
  state.queue.push(
    ...spec.effects.map((e) => ({
      effect: {
        ...e,
        amount: e.amount + (card.upgraded && e.type !== "energy" ? 2 : 0),
      },
      source: "hero" as const,
      label: spec.name,
    })),
  );
  drain();
  return true;
}

export function endTurn() {
  if (state.phase !== "playing" || !state.enemy) return;
  const poison = poisonTick(state.enemy);
  if (poison) state.log.unshift(`敌人中毒失去 ${poison} 生命`);
  finish();
  if (state.phase !== "playing") return;
  const amount = enemyIntent(state.enemy, state.turn);
  damage(state.hero, amount);
  state.log.unshift(`敌人攻击 ${amount}`);
  poisonTick(state.hero);
  finish();
  if (state.phase !== "playing") return;

  // 指定回合结束、原敌人仍存活：撤退并由追击者替换（单敌人战场不变）
  if (
    state.intercept &&
    !state.retreated &&
    state.deadline > 0 &&
    state.turn >= state.deadline
  ) {
    replaceWithPursuer();
  }

  discardHand(state.piles);
  state.turn++;
  state.energy = 3;
  state.hero.block = 0;
  state.enemy.block = state.turn % 3 === 0 ? 5 : 0;
  drawCards(state.piles, 5, state.turn);
}

/** 追击者登场后，旅人可主动放其脱身：按“敌人撤退”结局结算 */
export function disengagePursuit() {
  if (
    state.phase !== "playing" ||
    !state.pursuerEngaged ||
    state.retreated !== true
  )
    return false;
  state.phase = "won";
  state.queue = [];
  state.result = buildResult(true);
  state.log.unshift("你选择不再缠斗，追兵脱离战场。");
  return true;
}

/** 距离原敌人撤退还剩几个可行动回合（仅拦截战有意义） */
export function turnsUntilRetreat() {
  if (!state.intercept || state.retreated || state.deadline === 0) return null;
  return Math.max(0, state.deadline - state.turn + 1);
}

export function currentIntent() {
  return state.enemy ? enemyIntent(state.enemy, state.turn) : 0;
}

export function exportBattle() {
  return JSON.parse(JSON.stringify(state)) as BattleState;
}

export function restoreBattle(d: BattleState) {
  Object.assign(state, d);
}

export function resetBattle() {
  state.phase = "idle";
  state.context = null;
  state.enemy = null;
  state.result = null;
  state.piles = makePiles([], "");
  state.log = [];
  state.intercept = false;
  state.alertStage = 0;
  state.deadline = 0;
  state.retreated = false;
  state.pursuerEngaged = false;
  state.originalEnemy = null;
}
