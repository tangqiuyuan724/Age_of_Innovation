// 规则常量。每个数字后面注明来源，方便以后核对规则书。

import type {
    BookActionId, BuildingType, Discipline, DraftCategory, PowerActionId, PowerBowls, ResourceBundle,
    StructureType, Terrain, TerrainCode,
} from "./types.js";

/** 地形轮（terraforming circle）顺序，首尾相连。来源：规则书"改造"一节 */
export const TERRAIN_WHEEL: readonly Terrain[] = [
    "desert", "plains", "swamp", "lake", "forest", "mountain", "wasteland",
];

/** 地图文件里的地形代码 */
export const TERRAIN_BY_CODE: Record<TerrainCode, Terrain> = {
    D: "desert", P: "plains", S: "swamp", L: "lake", F: "forest", M: "mountain", W: "wasteland",
};

export const DISCIPLINES: readonly Discipline[] = ["banking", "law", "engineering", "medicine"];

/** 建筑的能量值：用于组成城市和吸能。来源：规则书"能量值" */
export const STRUCTURE_POWER: Record<StructureType, number> = {
    workshop: 1, guild: 2, school: 2, university: 3, palace: 3, tower: 2, monument: 4,
};

/** 建造与升级费用。来源：规则书 Phase II */
export const BUILD_WORKSHOP_COST: ResourceBundle = { tools: 1, coins: 2 };
export const UPGRADE_COST: Record<"guild" | "guildWithNeighbor" | "palace" | "school" | "university", ResourceBundle> = {
    guild: { tools: 2, coins: 6 },
    guildWithNeighbor: { tools: 2, coins: 3 }, // 工坊旁边有别家建筑时
    palace: { tools: 4, coins: 6 },
    school: { tools: 3, coins: 5 },
    university: { tools: 5, coins: 8 },
};

/** 能量行动、书本行动的花费。来源：规则书 Phase II */
export const POWER_ACTION_COST: Record<PowerActionId, number> = {
    bridge: 3, scholar: 3, tools2: 4, coins7: 4, spade1: 4, spade2: 6,
};

export const BOOK_ACTION_COST: Record<BookActionId, number> = {
    power5: 1, levels2: 1, coins6: 2, freeGuild: 2, guildVp: 2, spade3: 3,
};

/** 开局能量分布：默认 5/7/0，沼泽 3/9/0，森林 4/8/0。来源：规则书"玩家设置" */
export const STARTING_POWER: Record<Terrain, PowerBowls> = {
    desert: [5, 7, 0], plains: [5, 7, 0], swamp: [3, 9, 0], lake: [5, 7, 0],
    forest: [4, 8, 0], mountain: [5, 7, 0], wasteland: [5, 7, 0],
};

export const STARTING_VP = 20;
export const SCHOLARS_TOTAL = 7;
export const BRIDGES_TOTAL = 3;
export const MAX_INNOVATIONS = 3;

/** 学科：最高 12 级；超过 7 级需要钥匙；12 级每门学科只能一人 */
export const SCIENCE_MAX = 12;
export const SCIENCE_KEY_THRESHOLD = 7;

/** 组成城市：至少 4 座相连建筑、能量值合计至少 7 */
export const CITY_MIN_BUILDINGS = 4;
export const CITY_MIN_POWER = 7;

/** 终局计分。来源：规则书"终局计分" */
export const AREA_SCORE_POINTS: readonly number[] = [18, 12, 6];    // 区域分数
export const SCIENCE_SCORE_POINTS: readonly number[] = [8, 4, 2];   // 学科分数
export const COINS_PER_VP = 5;  // 1vp/5c

/** 每种建筑的总数，也就是规划板上这一行的格子数。来源：规划板 */
export const BUILDINGS_TOTAL: Record<BuildingType, number> = {
    workshop: 9, guild: 4, school: 3, university: 1, palace: 1,
};

/** 学科到 9 级及以上，每轮收入阶段额外获得。来源：学科展示板第 9 格旁边印的收入 */
export const SCIENCE_INCOME_LEVEL = 9;
export const SCIENCE_INCOME: Record<Discipline, ResourceBundle> = {
    banking: { coins: 3 },
    law: { power: 6 },
    engineering: { tools: 1 },
    medicine: { vp: 3 },
};

/**
 * 轮抽开局时每一类摆出"人数 + 几"个。
 * 回合奖励板块多摆 3 个，选完剩下的 3 个放到场上，和固定组合开局一样。
 * 规则书的轮抽变体里规划板是翻开 6 块；我们按"人数 + 1"，要改只改这里。
 */
export const DRAFT_EXTRA: Record<DraftCategory, number> = {
    planning: 1, faction: 1, bonusTile: 3, palaceTile: 1,
};

/** 改造轨每一级：每把铲子要付几个工具。来源：规划板改造轨 */
export const TOOLS_PER_SPADE: readonly number[] = [3, 2, 1];

/** 升级路线：升级成某种建筑，原来必须是哪种建筑。来源：规则书"升级建筑" */
export const UPGRADE_FROM: Record<"guild" | "school" | "palace" | "university", BuildingType> = {
    guild: "workshop",
    school: "guild",
    palace: "guild",
    university: "school",
};