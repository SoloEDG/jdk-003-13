import type { Actor, AlertStage, JourneyContext } from "@/shared/domain";
import { PURSUIT_DEADLINE_TURNS } from "@/features/route/lib/alert";

export interface Enemy extends Actor {
  name: string;
  attack: number;
  reward: number;
  pattern: number[];
}

export function spawnEnemy(c: JourneyContext): Enemy {
  const elite = c.kind === "elite";
  const boss = c.kind === "boss";
  const hp = (boss ? 80 : elite ? 40 : 25) + c.depth * 4 + c.influence.heat * 2;
  return {
    name: boss
      ? "裂隙守望者"
      : c.region === "forest"
        ? "孢冠巡游者"
        : c.region === "forge"
          ? "熔炉卫兵"
          : "空洞回声",
    hp,
    maxHp: hp,
    block: 0,
    strength: Math.floor(c.influence.heat / 2),
    poison: 0,
    thorns: c.region === "forge" ? 1 : 0,
    attack: (elite ? 8 : 5) + Math.floor(c.depth / 2),
    reward: (elite ? 28 : 18) + c.influence.heat * 3,
    pattern: boss ? [1.5, 0.7, 1.2] : [1, 0.7, 1.3],
  };
}

/**
 * 生成追击者。追击者是全新的敌人：
 * 不继承原敌人的生命、中毒、格挡等任何状态，只带着本地区的警戒而来。
 */
export function spawnPursuer(
  c: JourneyContext,
  stage: Exclude<AlertStage, 0>,
): Enemy {
  const hp = 30 + c.depth * 3 + stage * 12 + c.influence.heat;
  return {
    name: stage === 2 ? "围猎追缉者" : "哨戒追兵",
    hp,
    maxHp: hp,
    block: 0,
    strength: stage + Math.floor(c.influence.heat / 3),
    poison: 0,
    thorns: 0,
    attack: 7 + Math.floor(c.depth / 2) + stage,
    reward: 14 + stage * 8 + c.influence.heat * 2,
    pattern: [1.2, 0.8, 1],
  };
}

/**
 * 原敌人在第几回合结束后撤退。
 * 警戒阶段越高，留给旅人击倒原敌人的回合越少。
 */
export function retreatDeadline(stage: AlertStage): number {
  return stage === 2
    ? PURSUIT_DEADLINE_TURNS - 1
    : PURSUIT_DEADLINE_TURNS;
}

export function enemyIntent(enemy: Enemy, turn: number) {
  return (
    Math.floor(
      enemy.attack * enemy.pattern[(turn - 1) % enemy.pattern.length]!,
    ) + enemy.strength
  );
}
