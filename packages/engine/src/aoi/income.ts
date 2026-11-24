import { BUILDINGS_TOTAL, DISCIPLINES, SCIENCE_INCOME, SCIENCE_INCOME_LEVEL } from "./constants.js";
import { BONUS_TILES } from "./content/bonusTiles.js";
import { PALACE_TILE_INCOME } from "./content/palaceTiles.js";
import { PLANNING_DISPLAYS } from "./content/planning.js";
import { addBundles, gainResources } from "./resources.js";
import type { BuildingType, GameState, PlayerState, ResourceBundle } from "./types.js";

const BUILDING_TYPES: readonly BuildingType[] = ["workshop", "guild", "school", "university", "palace"];

/**
 * 一位玩家这一轮的收入：
 *  1. 规划板上一直都有的收入
 *  2. 规划板上建筑建出去后露出来的格子
 *  3. 宫殿板块（宫殿建好后）
 *  4. 手上的回合奖励板块
 *  5. 学科 9 级及以上的额外收入
 * 能力板块、创新板块、派系能力的收入在 M3 加。
 */
export function incomeOf(p: PlayerState): ResourceBundle {
    const display = PLANNING_DISPLAYS[p.planning];
    let total = display.baseIncome;
    for (const type of BUILDING_TYPES) {
        const built = BUILDINGS_TOTAL[type] - p.buildingsLeft[type];
        for (let i = 0; i < built; i++) total = addBundles(total, display.income[type][i]);
    }
    // 轮抽开局时宫殿板块一开始就在手上，但宫殿建好了才有收入
    if (p.palaceTile !== null && p.buildingsLeft.palace === 0) {
        total = addBundles(total, PALACE_TILE_INCOME[p.palaceTile]);
    }
    if (p.bonusTile !== null) total = addBundles(total, BONUS_TILES[p.bonusTile].income);
    for (const d of DISCIPLINES) {
        if (p.science[d] >= SCIENCE_INCOME_LEVEL) total = addBundles(total, SCIENCE_INCOME[d]);
    }
    return total;
}

/** 收入阶段：所有玩家同时拿收入。要选颜色的书排进待决策队列 */
export function collectIncome(state: GameState): GameState {
    const pending = [...state.pending];
    const players = state.players.map((p) => {
        const { player, bookChoices } = gainResources(p, incomeOf(p));
        if (bookChoices > 0) {
            pending.push({ id: `income-${state.round}-${p.seat}`, seat: p.seat, kind: "bookColor", count: bookChoices });
        }
        return player;
    });
    return { ...state, players, pending };
}