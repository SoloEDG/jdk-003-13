<script setup lang="ts">
import { computed } from "vue";
import { shopState, itemPrice } from "../model/state";
import { quoteMessage } from "../lib/pricing";
import { cards } from "@/shared/cards";
defineProps<{ gold: number }>();
defineEmits<{
  buy: [id: string];
  confirm: [];
  cancel: [];
  leave: [];
}>();
const pending = computed(() => shopState.pending);
const pendingCard = computed(() =>
  pending.value ? cards[pending.value.card]?.name : "",
);
</script>
<template>
  <section class="panel">
    <div class="section-top">
      <span class="eyebrow">04 / THE TRADER</span><span>旅途补给</span>
    </div>
    <h2>路上的旧相识</h2>
    <template v-if="shopState.open"
      ><p class="muted">
        {{
          quoteMessage(
            shopState.context!.influence.favor,
            shopState.context!.influence.scarcity,
          )
        }}
      </p>
      <div v-if="pending" class="notice quote-box">
        已确认报价 · <b>{{ pendingCard }}</b> · {{ pending.price }} 金
        <small>报价保持到提交或取消，期间价格不再变化。</small>
        <div class="toolbar">
          <button
            data-action="confirm-buy"
            :disabled="gold < pending.price"
            @click="$emit('confirm')"
          >
            提交购买
          </button>
          <button data-action="cancel-quote" @click="$emit('cancel')">
            取消报价
          </button>
        </div>
      </div>
      <div class="stock">
        <div v-for="item in shopState.stock" :key="item.id">
          <div>
            <b>{{ cards[item.card]?.name }}</b
            ><small>{{ cards[item.card]?.text }}</small>
          </div>
          <button
            :disabled="
              item.sold ||
              item.evacuated ||
              (!!pending && pending.id !== item.id) ||
              (!pending && gold < itemPrice(item.id))
            "
            :data-stock="item.id"
            @click="$emit('buy', item.id)"
          >
            <template v-if="item.sold">已售出</template>
            <template v-else-if="item.evacuated">已随商队撤离</template>
            <template v-else-if="pending?.id === item.id">报价已确认</template>
            <template v-else>{{ itemPrice(item.id) }} 金 · 确认报价</template>
          </button>
        </div>
      </div>
      <p
        v-if="Object.keys(shopState.caravans).length"
        class="caravan-note"
      >
        ⚖ 有 {{ Object.keys(shopState.caravans).length }} 支商队带着未售库存提前撤离，
        会在下一地区摆摊等你——库存有限，已售出的货物不会补货。
      </p>
      <button data-action="leave-shop" @click="$emit('leave')">
        收好行囊，继续前进 →
      </button></template
    >
    <div v-else class="empty-mini">
      寻找路线上的天平标记。安路的好感让金币走得更远。
    </div>
  </section>
</template>
