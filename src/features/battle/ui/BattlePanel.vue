<script setup lang="ts">
import { battleState, currentIntent, turnsUntilRetreat } from "../model/state";
import { cards } from "@/shared/cards";
import ActorCard from "./ActorCard.vue";
defineEmits<{
  play: [id: string];
  end: [];
  settle: [];
  disengage: [];
}>();
</script>
<template>
  <section class="panel battle-panel">
    <div class="section-top">
      <span class="eyebrow">02 / THE ENCOUNTER</span
      ><span>回合 {{ battleState.turn }}</span>
    </div>
    <h2>{{ battleState.enemy?.name ?? "等待下一场遭遇" }}</h2>
    <div
      v-if="battleState.intercept && battleState.phase === 'playing'"
      class="pursuit-banner"
      :class="{ engaged: battleState.pursuerEngaged }"
    >
      <template v-if="!battleState.retreated">
        ⚠ 追击拦截战 · 原敌人将在
        <b>{{ turnsUntilRetreat() }}</b>
        个回合后撤离，由
        {{ battleState.alertStage === 2 ? "围猎追缉者" : "哨戒追兵" }}
        接替
      </template>
      <template v-else>
        ⚠ 原敌人已带着掉落撤离，当前是接替上场的
        <b>{{ battleState.enemy?.name }}</b
        >：它不继承原敌人的中毒与格挡
      </template>
    </div>
    <div v-if="battleState.enemy" class="arena">
      <ActorCard :actor="battleState.hero" name="余烬旅人" />
      <div class="versus">
        VS<br /><small>{{ battleState.context?.region.toUpperCase() }}</small>
      </div>
      <ActorCard
        :actor="battleState.enemy"
        :name="battleState.enemy.name"
        enemy
        :intent="currentIntent()"
      />
    </div>
    <div v-else class="empty-art">
      ✧
      <p>在路线图中选择一个哨站<br /><small>每次出牌都可能改变战局</small></p>
    </div>
    <div v-if="battleState.phase === 'playing'">
      <div class="energy-line">
        <b>◉ {{ battleState.energy }} / 3 能量</b
        ><span
          >抽牌 {{ battleState.piles.draw.length }} · 弃牌
          {{ battleState.piles.discard.length }} · 消耗
          {{ battleState.piles.exhaust.length }}</span
        ><button data-action="end-turn" @click="$emit('end')">
          结束回合 →
        </button>
      </div>
      <div class="hand">
        <button
          v-for="c in battleState.piles.hand"
          :key="c.id"
          class="playing-card"
          :data-hand-id="c.id"
          :disabled="cards[c.key]!.cost > battleState.energy"
          @click="$emit('play', c.id)"
        >
          <i>{{ cards[c.key]!.cost }}</i
          ><span>{{
            cards[c.key]!.kind === "attack"
              ? "⚔"
              : cards[c.key]!.kind === "power"
                ? "✺"
                : "◇"
          }}</span>
          <h3>{{ cards[c.key]!.name }}{{ c.upgraded ? " +" : "" }}</h3>
          <p>{{ cards[c.key]!.text }}<b v-if="c.upgraded"> 效果 +2</b></p>
          <small>{{ cards[c.key]!.kind.toUpperCase() }}</small>
        </button>
      </div>
      <button
        v-if="battleState.pursuerEngaged"
        class="disengage"
        data-action="disengage"
        @click="$emit('disengage')"
      >
        不再缠斗，放追兵脱身（按敌人撤退结算）
      </button>
    </div>
    <div
      v-if="battleState.phase === 'won' || battleState.phase === 'lost'"
      class="notice"
    >
      <h3>
        {{
          battleState.phase === "won"
            ? battleState.retreated
              ? "遭遇结束 · 敌人已撤退"
              : "遭遇胜利 · 火种仍在"
            : "旅途结束 · 余烬熄灭"
        }}
      </h3>
      <button data-action="settle" @click="$emit('settle')">
        {{ battleState.phase === "won" ? "收取战利品 →" : "查看旅程结果" }}
      </button>
    </div>
    <details v-if="battleState.log.length" open>
      <summary>效果记录 · 最新在前</summary>
      <div class="battle-log">
        <p v-for="(line, i) in battleState.log" :key="i">{{ line }}</p>
      </div>
    </details>
  </section>
</template>
