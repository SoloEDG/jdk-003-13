<script setup lang="ts">
import { rewardState, chooseReward } from "../model/state";
import { cards } from "@/shared/cards";
defineEmits<{ claim: [skip: boolean] }>();
const outcomeText: Record<string, string> = {
  slain: "限时击杀 · 原敌人掉落",
  "pursuer-slain": "击败追兵 · 追击者掉落",
  retreated: "敌人撤退 · 安慰补给",
};
</script>
<template>
  <section class="panel">
    <div class="section-top">
      <span class="eyebrow">03 / THE SPOILS</span
      ><span>三选一</span>
    </div>
    <h2>把胜利带进下一场</h2>
    <p class="muted">
      战斗结束后结算金币，并选择一张新牌。林地额外疗愈，险路改变奖励池。
    </p>
    <div v-if="rewardState.offer && !rewardState.offer.claimed">
      <div class="notice reward-summary">
        <b>{{ outcomeText[rewardState.offer.outcome ?? "slain"] }}</b>
        <span>✦ {{ rewardState.offer.gold }} 金币 · 回复
          {{ rewardState.offer.heal }} 生命</span>
        <p class="reward-reason">{{ rewardState.offer.reason }}</p>
        <p v-if="rewardState.offer.missedOriginalGold > 0" class="reward-missed">
          未获得原敌人掉落：{{ rewardState.offer.missedOriginalGold }} 金
        </p>
      </div>
      <div v-if="rewardState.offer.cards.length" class="reward-options">
        <button
          v-for="key in rewardState.offer.cards"
          :key="key"
          :class="{ selected: rewardState.selected === key }"
          @click="chooseReward(key)"
        >
          <b>{{ cards[key]?.name }}</b
          ><small>{{ cards[key]?.text }}</small
          ><em>{{ cards[key]?.rarity }}</em>
        </button>
      </div>
      <div v-else class="empty-mini">
        敌人撤退后战局未定，本次没有新的卡牌奖励，仅可领取金币。
      </div>
      <div class="toolbar">
        <button
          v-if="rewardState.offer.cards.length"
          :disabled="!rewardState.selected"
          data-action="claim"
          @click="$emit('claim', false)"
        >
          收下选中牌与战利品</button
        ><button
          data-action="skip-reward"
          @click="$emit('claim', true)"
        >
          {{ rewardState.offer.cards.length ? "仅收取金币" : "收取金币并继续" }}
        </button>
      </div>
    </div>
    <div v-else class="empty-mini">
      {{
        rewardState.offer?.claimed
          ? "战利品已收入行囊。下一段路线已开放。"
          : "战胜敌人，发现下一张关键卡牌。"
      }}
    </div>
  </section>
</template>
