<script setup lang="ts">
import { computed } from "vue";
import { routeState, choices, previewRoute } from "../model/state";
import { pursuitBadge, alertLabel } from "../lib/alert";
import { regionNames } from "@/shared/domain";
const emit = defineEmits<{ enter: [id: string] }>();
const allowed = computed(() => choices());
const layers = computed(() =>
  Array.from({ length: 9 }, (_, d) =>
    routeState.nodes.filter((n) => n.depth === d),
  ),
);
const symbols = { battle: "⚔", elite: "♜", shop: "⚖", camp: "♨", boss: "◈" };
function badge(nodeId: string) {
  const node = routeState.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  return pursuitBadge(node, routeState.pursuit);
}
</script>
<template>
  <section class="panel route-panel">
    <div class="section-top">
      <span class="eyebrow">01 / THE PATH</span
      ><span>已走 {{ routeState.visited.length }} / 9</span>
    </div>
    <h2>每一步，留下回响</h2>
    <p class="muted">
      林地 → 熔铁边境 → 无声深渊。连续险路会触发地区警戒：拖延越久，追兵越近，商人也会提前撤离。
    </p>
    <div class="alert-line" :class="`stage-${routeState.alertStage}`">
      地区警戒 ·
      <b>{{ alertLabel[routeState.alertStage] }}</b>
      <span v-if="routeState.riskyStreak">（连续险路 {{ routeState.riskyStreak }}）</span>
      <em v-if="routeState.pursuit.active"
        >· 追击倒计时：{{ routeState.pursuit.remaining }} 场战斗后拦截</em
      >
    </div>
    <div class="route-scroll">
      <div v-for="(layer, d) in layers" :key="d" class="route-row">
        <span class="depth">{{ d + 1 }}</span
        ><button
          v-for="node in layer"
          :key="node.id"
          :data-node="node.id"
          class="route-node"
          :class="{
            available: allowed.includes(node.id),
            visited: routeState.visited.includes(node.id),
            intercept: badge(node.id) === 'intercept',
          }"
          :disabled="!allowed.includes(node.id)"
          @mouseenter="previewRoute(node.id)"
          @mouseleave="previewRoute('')"
          @click="emit('enter', node.id)"
        >
          <b>{{ symbols[node.kind] }}</b
          ><span
            >{{ node.title
            }}<small
              >{{ regionNames[node.region] }} ·
              {{ node.lane ? "威胁 +1 / 稀缺 +1" : "好感 +1" }}</small
            ></span
          >
          <i v-if="badge(node.id) === 'intercept'" class="pursuit-tag"
            >追击拦截</i
          >
          <i v-else-if="typeof badge(node.id) === 'number'" class="pursuit-tag countdown"
            >追兵 {{ badge(node.id) }}</i
          >
          <i v-else>{{ routeState.visited.includes(node.id) ? "✓" : "↗" }}</i>
        </button>
      </div>
    </div>
    <div v-if="routeState.preview" class="notice">
      路途预览 · 威胁 {{ routeState.preview.influence.heat }} / 好感
      {{ routeState.preview.influence.favor }} / 稀缺
      {{ routeState.preview.influence.scarcity }}
    </div>
  </section>
</template>
