import type { JourneyContext } from "@/shared/domain";
import { shuffle, hash } from "@/shared/random";
import type { AlertStage } from "@/shared/domain";

export interface StockItem {
  id: string;
  card: string;
  basePrice: number;
  sold: boolean;
  /** 所属商队 id；追赶商队会沿用原商队 id，保证是同一批有限库存 */
  caravanId: string;
  /** 该货物是否已随商队撤离（撤离后本地商店不可再购买） */
  evacuated: boolean;
}

/** 警戒阶段下，商人在离开前只来得及摆出的货物数 */
export function displayedStockCount(stage: AlertStage): number {
  if (stage === 2) return 1;
  if (stage === 1) return 2;
  return 3;
}

export function makeStock(
  c: JourneyContext,
  caravanId: string = c.nodeId,
): StockItem[] {
  return shuffle(
    ["venom", "focus", "fury", "burst", "shelter", "guard"],
    hash(c.nodeId),
  )
    .slice(0, 3)
    .map((card, i) => ({
      id: `${c.nodeId}-stock-${i}`,
      card,
      basePrice: ["fury", "burst", "focus"].includes(card) ? 48 : 32,
      sold: false,
      caravanId,
      evacuated: false,
    }));
}

/**
 * 警戒阶段下商人提前撤离：未售出的库存随队撤离，
 * 已售出的货物留在旅人手中（sold 保持 true）。
 */
export function evacuateStock(stock: StockItem[]): StockItem[] {
  return stock.map((item) =>
    item.sold ? item : { ...item, evacuated: true },
  );
}

/**
 * 追赶商队抵达下一地区：把撤离的货物重新摆上货架。
 * 复用原 StockItem（同 id、同 caravanId、同 sold 状态），
 * 因此这不是全新的无限库存，已售出的货物不会补货。
 */
export function bringCaravanStock(
  stock: StockItem[],
  caravanId: string,
): StockItem[] {
  return stock
    .filter((item) => item.caravanId === caravanId)
    .map((item) => ({ ...item, evacuated: false }));
}
