import { reactive, readonly } from "vue";
import type {
  AlertStage,
  JourneyContext,
  Purchase,
} from "@/shared/domain";
import {
  makeStock,
  evacuateStock,
  bringCaravanStock,
  displayedStockCount,
  type StockItem,
} from "../lib/stock";
import { priceFor } from "../lib/pricing";

interface ShopRuntime {
  context: JourneyContext | null;
  stock: StockItem[];
  purchases: Purchase[];
  open: boolean;
  /** 已确认但尚未提交 / 取消的交易报价 */
  pending: Purchase | null;
  /** 撤离后等待在后续地区摆摊的追赶商队（按商队 id 各存一组有限库存） */
  caravans: Record<string, StockItem[]>;
}

const state = reactive<ShopRuntime>({
  context: null,
  stock: [] as StockItem[],
  purchases: [] as Purchase[],
  open: false,
  pending: null,
  caravans: {},
});

export const shopState = readonly(state);

function caravanList(): { id: string; cargo: StockItem[] }[] {
  return Object.entries(state.caravans).map(([id, cargo]) => ({
    id,
    cargo,
  }));
}

export function openShop(c: JourneyContext, alertStage: AlertStage = 0) {
  if (state.context?.nodeId === c.nodeId && state.open) return;
  state.context = c;
  state.pending = null;

  // 1. 先让此前撤离的追赶商队在此摆摊（复用同 id 货物，非全新库存）
  const caravanStock: StockItem[] = [];
  for (const { id, cargo } of caravanList()) {
    caravanStock.push(...bringCaravanStock(cargo, id));
  }
  state.caravans = {};

  // 2. 本营地自己的新货（商队 id 即当前节点 id）
  const own = makeStock(c);

  // 3. 警戒阶段下商人提前撤离：未售库存按撤离后库存处理
  const limit = displayedStockCount(alertStage);
  const ownOnShelf = own.slice(0, limit);
  const ownEvacuated = own
    .slice(limit)
    .map((item) => ({ ...item, evacuated: true }));
  if (ownEvacuated.length) {
    state.caravans[c.nodeId] = ownEvacuated;
  }

  state.stock = [...caravanStock, ...ownOnShelf];
  state.open = true;
}

export function itemPrice(id: string) {
  const item = state.stock.find((s) => s.id === id);
  return item && state.context
    ? priceFor(item.basePrice, state.context.influence)
    : Infinity;
}

/**
 * 确认交易报价：报价在提交或取消前保持不变；
 * 同一时间只允许一笔已确认报价，新确认会顶替旧报价。
 */
export function preparePurchase(id: string): Purchase | null {
  const item = state.stock.find((s) => s.id === id);
  if (!state.open || !item || item.sold || item.evacuated) return null;
  const quote: Purchase = {
    id: item.id,
    card: item.card,
    price: itemPrice(id),
  };
  state.pending = quote;
  return quote;
}

export function pendingQuote() {
  return state.pending;
}

/** 提交已确认报价：按报价时锁定的价格与货物成交 */
export function completePurchase(p: Purchase) {
  const locked = state.pending;
  if (
    !locked ||
    locked.id !== p.id ||
    locked.price !== p.price ||
    locked.card !== p.card
  )
    return false;
  const item = state.stock.find((s) => s.id === p.id);
  if (!item || item.sold || item.evacuated) {
    state.pending = null;
    return false;
  }
  item.sold = true;
  state.purchases.push(p);
  state.pending = null;
  return true;
}

/** 取消已确认报价，不产生任何交易 */
export function cancelPurchase() {
  state.pending = null;
}

export function closeShop() {
  // 未确认 / 未提交的交易不随离店成交；未售库存按商队分别撤离
  state.pending = null;
  const remaining = state.stock.filter((s) => !s.sold && !s.evacuated);
  for (const item of remaining) {
    const caravan = state.caravans[item.caravanId] ?? [];
    caravan.push({ ...item, evacuated: true });
    state.caravans[item.caravanId] = caravan;
  }
  state.stock = state.stock.map((item) =>
    item.sold ? item : { ...item, evacuated: true },
  );
  state.open = false;
}

export function exportShop() {
  return JSON.parse(JSON.stringify(state));
}

export function restoreShop(d: ReturnType<typeof exportShop>) {
  Object.assign(state, d);
  // 旧存档兼容：caravans 可能是数组形式
  if (Array.isArray(state.caravans)) {
    const legacy = state.caravans as unknown as StockItem[][];
    const map: Record<string, StockItem[]> = {};
    for (const cargo of legacy) {
      if (cargo?.length) map[cargo[0]!.caravanId] = cargo;
    }
    state.caravans = map;
  }
  // 已确认报价在保存恢复后仍然保持，直到旅人提交或取消
  state.pending = d.pending ?? null;
}

export function resetShop() {
  state.context = null;
  state.stock = [];
  state.purchases = [];
  state.open = false;
  state.pending = null;
  state.caravans = {};
}
