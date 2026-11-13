import type {
  AlertStage,
  PursuitState,
  RouteNode,
} from "@/shared/domain";

/** 连续走多少个险路节点后触发哨戒 / 围猎 */
export const ALERT_STREAK_STAGE_1 = 2;
export const ALERT_STREAK_STAGE_2 = 4;
/** 追击倒计时：警戒触发后，第 N 个未来战斗层由追击者拦截 */
export const PURSUIT_COMBAT_WINDOW = 3;
/** 战斗超过该回合数原敌人仍未被击倒，即撤离并由追击者替换 */
export const PURSUIT_DEADLINE_TURNS = 3;

export const inactivePursuit = (): PursuitState => ({
  active: false,
  stage: 0,
  remaining: 0,
  interceptDepth: null,
  interceptNodeId: null,
});

export function isRisky(node: RouteNode): boolean {
  return node.influence.heat > 0;
}

export function isCombat(node: RouteNode): boolean {
  return (
    node.kind === "battle" ||
    node.kind === "elite" ||
    node.kind === "boss"
  );
}

export function alertStageFor(riskyStreak: number): AlertStage {
  if (riskyStreak >= ALERT_STREAK_STAGE_2) return 2;
  if (riskyStreak >= ALERT_STREAK_STAGE_1) return 1;
  return 0;
}

export const alertLabel: Record<AlertStage, string> = {
  0: "平静",
  1: "哨戒",
  2: "围猎",
};

/**
 * 布设追击：拦截层为当前位置之后第 N 个战斗层。
 * 地图上每个战斗层的两条路线都是战斗节点，因此无论旅人走哪条路，
 * 到达该层时倒计时都必定归零，不会因为换线而甩掉追兵。
 * 若剩余战斗层不足 N 个，则落在最后一个战斗层。
 */
export function armPursuit(
  nodes: RouteNode[],
  visited: string[],
  stage: Exclude<AlertStage, 0>,
): PursuitState {
  const lastDepth = visited.length
    ? nodes.find((n) => n.id === visited.at(-1))?.depth ?? -1
    : -1;
  const futureDepths = [
    ...new Set(
      nodes
        .filter((n) => n.depth > lastDepth && isCombat(n))
        .map((n) => n.depth),
    ),
  ].sort((a, b) => a - b);
  if (!futureDepths.length) return inactivePursuit();
  const remaining = Math.min(PURSUIT_COMBAT_WINDOW, futureDepths.length);
  return {
    active: true,
    stage,
    remaining,
    interceptDepth: futureDepths[remaining - 1]!,
    interceptNodeId: null,
  };
}

/** 九段地图中所有战斗层（商店层 1/4/7、篝火层不在其中） */
export const COMBAT_DEPTHS = [0, 2, 3, 5, 6, 8];

type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

/**
 * 路线图上每个战斗节点展示的追击标记：
 * 拦截层的两个节点都标记 "intercept"；
 * 之前战斗层显示到达拦截层还剩几场战斗；拦截层之后不再显示。
 */
export function pursuitBadge(
  node: DeepReadonly<RouteNode>,
  pursuit: PursuitState,
): number | "intercept" | null {
  if (
    !pursuit.active ||
    pursuit.interceptDepth === null ||
    !isCombat(node as RouteNode)
  )
    return null;
  if (node.depth === pursuit.interceptDepth) return "intercept";
  if (node.depth > pursuit.interceptDepth) return null;
  const interceptIndex = COMBAT_DEPTHS.indexOf(pursuit.interceptDepth);
  const nodeIndex = COMBAT_DEPTHS.indexOf(node.depth);
  if (interceptIndex < 0 || nodeIndex < 0) return null;
  return interceptIndex - nodeIndex + 1;
}
