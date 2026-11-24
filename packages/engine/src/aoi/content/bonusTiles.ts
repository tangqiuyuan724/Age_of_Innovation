// 10 个回合奖励板块。M1-3 只用到收入；行动得分、pass 得分、特殊行动后面几课再加。
// 每个板块的完整效果写在 types.ts 的 BonusTileId 注释里。
import type { BonusTileId, ResourceBundle } from "../types.js";

export interface BonusTileDef {
    id: BonusTileId;
    /** 收入阶段获得（板块上手掌图标上面的东西） */
    income: ResourceBundle;
}

export const BONUS_TILES: Record<BonusTileId, BonusTileDef> = {
    riverWorkshop: { id: "riverWorkshop", income: {} },
    scholarSend: { id: "scholarSend", income: { scholars: 1 } },
    guildBuild: { id: "guildBuild", income: { power: 3 } },
    bigBuildingsPass: { id: "bigBuildingsPass", income: { tools: 1 } },
    spadeAction: { id: "spadeAction", income: { books: { gray: 1 } } },
    bridgeAction: { id: "bridgeAction", income: { books: { gray: 1 } } },
    levelAction: { id: "levelAction", income: { tools: 2 } },
    schoolsPass: { id: "schoolsPass", income: { coins: 4 } },
    power4coins2: { id: "power4coins2", income: { power: 4, coins: 2 } },
    coins6: { id: "coins6", income: { coins: 6 } },
};

export const BONUS_TILE_IDS = Object.keys(BONUS_TILES) as BonusTileId[];