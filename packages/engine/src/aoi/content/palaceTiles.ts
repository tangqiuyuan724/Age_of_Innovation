// 17 个宫殿板块的收入。效果（特殊行动、一次性奖励）在 M3 实现。
// 数据照中文版宫殿板块抄录，和规则书附录的列表一致。
import type { PalaceTileId, ResourceBundle } from "../types.js";

export const PALACE_TILE_INCOME: Record<PalaceTileId, ResourceBundle> = {
    1: { power: 5 },
    2: {},
    3: { power: 2 },
    4: { power: 2 },
    5: { power: 4 },
    6: { power: 2, books: { gray: 1 } },
    7: { power: 4 },
    8: { coins: 2, power: 2, tools: 1 },
    9: { scholars: 1 },
    10: { coins: 6 },
    11: { tools: 1 },
    12: { power: 8 },
    13: {},
    14: { power: 6 },
    15: { power: 6 },
    16: { power: 2, books: { gray: 1 } },
    17: { power: 2 },
};

/** 宫殿板块 1~17；17 号（红色背面）每局都在 */
export const PALACE_TILE_IDS: readonly PalaceTileId[] = Array.from({ length: 17 }, (_, i) => i + 1);
export const PALACE_TILE_ALWAYS: PalaceTileId = 17;