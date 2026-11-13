import type {
  BattleOutcome,
  BattleResult,
  RewardOffer,
} from "@/shared/domain";
import { rewardPool } from "./pool";

/** 让原敌人撤退（未与追兵缠斗）时的保底金币 */
export const RETREAT_CONSOLATION_GOLD = 8;

export function outcomeReason(
  outcome: BattleOutcome,
  originalGold: number,
  pursuerGold: number,
): string {
  if (outcome === "slain")
    return "你在追兵赶到前击倒了原敌人，它的掉落全部归你所有。";
  if (outcome === "pursuer-slain")
    return `原敌人带着 ${originalGold} 金的掉落撤离了，你击败的是接替上场的追击者，因此获得追击者的 ${pursuerGold} 金掉落，而非原敌人的掉落。`;
  return `原敌人在追兵掩护下带着 ${originalGold} 金的掉落撤离，你没有获得它的掉落；追击者也脱离了战场，只留下 ${RETREAT_CONSOLATION_GOLD} 金的安慰补给。`;
}

export function offerFrom(result: BattleResult): RewardOffer {
  const outcome = result.outcome;
  const pursuerGold = result.gold;
  const favorBonus = result.context.influence.favor * 2;
  let gold: number;
  if (outcome === "slain") {
    gold = result.originalGold + favorBonus;
  } else if (outcome === "pursuer-slain") {
    gold = pursuerGold + favorBonus;
  } else {
    gold = RETREAT_CONSOLATION_GOLD + favorBonus;
  }
  return {
    id: `reward-${result.id}`,
    source: result.id,
    // 敌人撤退、旅人脱身时战局未定，不提供新的卡牌奖励
    cards: outcome === "retreated" ? [] : rewardPool(result.context),
    gold,
    heal: result.context.region === "forest" ? 3 : 0,
    claimed: false,
    outcome,
    missedOriginalGold:
      outcome === "slain" ? 0 : result.originalGold,
    reason: outcomeReason(
      outcome ?? "slain",
      result.originalGold,
      pursuerGold,
    ),
  };
}

export function validChoice(offer: RewardOffer | null, key: string | null) {
  return (
    !!offer &&
    !offer.claimed &&
    (key === null || offer.cards.includes(key))
  );
}
