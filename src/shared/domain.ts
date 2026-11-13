export type Region = "forest" | "forge" | "abyss";
export type NodeKind = "battle" | "elite" | "shop" | "camp" | "boss";
/** 地区警戒阶段：0 无警戒，1 哨戒，2 围猎 */
export type AlertStage = 0 | 1 | 2;
/** 本场战斗的结束方式，决定掉落与奖励页说明 */
export type BattleOutcome =
  | "slain" // 原敌人被击败（限时内）
  | "pursuer-slain" // 原敌人撤退后，追击者被击败
  | "retreated"; // 原敌人撤退，旅人放其脱身
export interface Influence {
  heat: number;
  favor: number;
  scarcity: number;
}
/** 追击状态：连续险路触发后在后续节点上标出倒计时 */
export interface PursuitState {
  active: boolean;
  stage: AlertStage;
  /** 距离下一场战斗拦截还剩几个战斗层 */
  remaining: number;
  /** 倒计时归零后将被拦截的地图层（该层两个战斗节点都会拦截） */
  interceptDepth: number | null;
  /** 已实际进入的拦截节点 id，用于保存恢复时判定本场拦截是否兑现 */
  interceptNodeId: string | null;
}
export interface RouteNode {
  id: string;
  region: Region;
  depth: number;
  lane: number;
  kind: NodeKind;
  title: string;
  influence: Influence;
  next: string[];
}
export interface CardInstance {
  id: string;
  key: string;
  upgraded: boolean;
}
export interface CardSpec {
  key: string;
  name: string;
  cost: number;
  kind: "attack" | "skill" | "power";
  text: string;
  rarity: "common" | "rare";
  effects: Effect[];
}
export type Effect = {
  type: "damage" | "block" | "draw" | "poison" | "strength" | "heal" | "energy";
  amount: number;
  target: "hero" | "enemy";
};
export interface Actor {
  hp: number;
  maxHp: number;
  block: number;
  strength: number;
  poison: number;
  thorns: number;
}
export interface JourneyContext {
  nodeId: string;
  region: Region;
  depth: number;
  kind: NodeKind;
  influence: Influence;
}
export interface BattleResult {
  id: string;
  nodeId: string;
  won: boolean;
  hp: number;
  gold: number;
  context: JourneyContext;
  /** 结束方式；失败（阵亡）时为 null */
  outcome: BattleOutcome | null;
  /** 原敌人是否在战斗中撤退 */
  retreated: boolean;
  /** 原敌人的掉落金币（撤退时旅人无法获得） */
  originalGold: number;
  /** 追击者是否已经登场（无论之后是否被击败） */
  pursuerEngaged: boolean;
}
export interface RewardOffer {
  id: string;
  source: string;
  cards: string[];
  gold: number;
  heal: number;
  claimed: boolean;
  /** 奖励来源方式，用于解释为何没有原敌人掉落 */
  outcome: BattleOutcome | null;
  /** 被错过的原敌人掉落金币，仅用于展示 */
  missedOriginalGold: number;
  /** 奖励页说明文案 */
  reason: string;
}
export interface Purchase {
  id: string;
  card: string;
  price: number;
}
export interface ExpeditionSummary {
  hp: number;
  maxHp: number;
  gold: number;
  scars: number;
}
export const regionNames: Record<Region, string> = {
  forest: "苔光林地",
  forge: "熔铁边境",
  abyss: "无声深渊",
};
