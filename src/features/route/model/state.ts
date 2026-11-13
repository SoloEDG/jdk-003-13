import { reactive, readonly } from "vue";
import type {
  AlertStage,
  Influence,
  JourneyContext,
  PursuitState,
  RouteNode,
} from "@/shared/domain";
import { makeMap } from "../lib/map";
import { available, contextFor } from "../lib/rules";
import {
  alertStageFor,
  armPursuit,
  inactivePursuit,
  isCombat,
  isRisky,
} from "../lib/alert";

interface RouteRuntime {
  nodes: ReturnType<typeof makeMap>;
  visited: string[];
  resolved: boolean;
  influence: Influence;
  preview: JourneyContext | null;
  riskyStreak: number;
  alertStage: AlertStage;
  pursuit: PursuitState;
  /** 已经兑现过的拦截节点，防止保存恢复 / 重复结算让追击再次出现 */
  resolvedIntercepts: string[];
}

const state = reactive<RouteRuntime>({
  nodes: makeMap(),
  visited: [] as string[],
  resolved: true,
  influence: { heat: 0, favor: 0, scarcity: 0 } as Influence,
  preview: null,
  riskyStreak: 0,
  alertStage: 0,
  pursuit: inactivePursuit(),
  resolvedIntercepts: [],
});

export const routeState = readonly(state);

export function choices() {
  return available(state.nodes, state.visited, state.resolved);
}

export function previewRoute(id: string) {
  const n = state.nodes.find((n) => n.id === id);
  state.preview = n ? contextFor(n, state.influence) : null;
}

/**
 * 当前节点是否为追击拦截点：
 * 追击处于激活、当前节点位于拦截战斗层、且本场拦截尚未兑现。
 * 同层两条路线的战斗节点都会拦截，换线无法甩掉追兵。
 */
export function isInterceptNode(nodeId: string): boolean {
  if (!state.pursuit.active || state.pursuit.interceptDepth === null)
    return false;
  if (state.resolvedIntercepts.includes(nodeId)) return false;
  const node = state.nodes.find((n) => n.id === nodeId);
  return !!node && node.depth === state.pursuit.interceptDepth && isCombat(node);
}

export function enterRoute(id: string): JourneyContext | null {
  if (!choices().includes(id)) return null;
  const node = state.nodes.find((n) => n.id === id)!;
  const context = contextFor(node, state.influence);
  state.visited.push(id);
  state.influence = context.influence;
  state.resolved = false;
  state.preview = null;

  // 连续险路计数：安路中断，险路累加
  if (isRisky(node)) state.riskyStreak += 1;
  else state.riskyStreak = 0;

  const stage = alertStageFor(state.riskyStreak);
  const stageRose = stage > state.alertStage;
  state.alertStage = stage;

  // 已有追击：进入战斗层就推进倒计时（商店 / 篝火不拖延追兵）
  if (state.pursuit.active && isCombat(node)) {
    state.pursuit.remaining = Math.max(0, state.pursuit.remaining - 1);
  }
  // 进入拦截层时记录实际节点 id，供保存恢复与兑现判定使用
  if (isInterceptNode(id)) {
    state.pursuit.interceptNodeId = id;
  }

  // 警戒升级时（重新）布设追击：未来战斗层标出追击倒计时
  if (stageRose && stage > 0) {
    state.pursuit = armPursuit(state.nodes, state.visited, stage as 1 | 2);
  }

  return context;
}

export function resolveRoute() {
  state.resolved = true;
  // 节点结算时若该节点是拦截点，登记为已兑现并解除追击
  const lastId = state.visited.at(-1);
  if (
    lastId &&
    state.pursuit.active &&
    state.pursuit.interceptNodeId === lastId &&
    !state.resolvedIntercepts.includes(lastId)
  ) {
    state.resolvedIntercepts.push(lastId);
    state.pursuit = inactivePursuit();
  }
}

export function exportRoute() {
  return JSON.parse(
    JSON.stringify({
      visited: state.visited,
      resolved: state.resolved,
      influence: state.influence,
      riskyStreak: state.riskyStreak,
      alertStage: state.alertStage,
      pursuit: state.pursuit,
      resolvedIntercepts: state.resolvedIntercepts,
    }),
  );
}

export function restoreRoute(data: ReturnType<typeof exportRoute>) {
  state.visited = data.visited;
  state.resolved = data.resolved;
  state.influence = data.influence;
  state.riskyStreak = data.riskyStreak ?? 0;
  state.alertStage = (data.alertStage ?? 0) as AlertStage;
  state.pursuit = data.pursuit ?? inactivePursuit();
  // 旧存档兼容：补出拦截层字段
  if (state.pursuit.active && state.pursuit.interceptDepth === null) {
    state.pursuit = inactivePursuit();
  }
  state.resolvedIntercepts = data.resolvedIntercepts ?? [];
  state.preview = null;
}

export function resetRoute() {
  state.visited = [];
  state.resolved = true;
  state.influence = { heat: 0, favor: 0, scarcity: 0 };
  state.preview = null;
  state.riskyStreak = 0;
  state.alertStage = 0;
  state.pursuit = inactivePursuit();
  state.resolvedIntercepts = [];
}
