// 12 种能力板块。每种 4 张，开局随机摆进创新展示板下方的 12 个格子。
// 每张板块的效果（收入、立即奖励、pass 奖励……）在 M3 实现；
// 这一课只用到编号，以及"从展示区哪一格拿"决定的学科奖励。
import type { CompetencyId, Discipline } from "../types.js";

/** 顺序和图片编号 #1~#12 一样（Images 里的 14~25 号图） */
export const COMPETENCY_IDS: readonly CompetencyId[] = [
    "incomeBookPower", "bonusToolVpCoins", "passLowestScience", "incomeToolLevel",
    "bonusSpades", "tower", "incomeVpCoins", "passCityVp",
    "borderWorkshopVp", "actionPower4", "scholarVp", "annexes",
];

/** 开局摆放：把打乱后的 12 种板块按顺序放进 4 列，每列从上到下 3 格 */
export function layCompetencies(order: readonly CompetencyId[]): Record<Discipline, CompetencyId[]> {
    return {
        banking: order.slice(0, 3),
        law: order.slice(3, 6),
        engineering: order.slice(6, 9),
        medicine: order.slice(9, 12),
    };
}