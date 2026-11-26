// 10 个回合奖励板块：收入、特殊行动、pass 时的奖励、拿着板块时做某些行动得分。
// 每个板块的完整效果写在 types.ts 的 BonusTileId 注释里。
import type { BonusTileId, BuildingType, ResourceBundle } from "../types.js";
import type { ScoreAction } from "./roundScores.js";

export interface BonusTileDef {
    id: BonusTileId;
    /** 收入阶段获得（板块上手掌图标上面的东西） */
    income: ResourceBundle;
    /** 特殊行动（橙色八边形，每轮一次）：免费 1 铲改造并建造、免费建桥、任选学科前进 1 级 */
    special?: "spade" | "bridge" | "level";
    /** pass 时的奖励：自己每有一座 buildings 里的建筑，得 vp 分、任选学科前进 levels 级 */
    pass?: { buildings: BuildingType[]; vp: number; levels: number };
    /** 拿着这块板块时，每做一次 action 得 vp 分（和回合计分板块一样，只在行动阶段算） */
    action?: { action: ScoreAction; vp: number };
}

export const BONUS_TILES: Record<BonusTileId, BonusTileDef> = {
    riverWorkshop: { id: "riverWorkshop", income: {}, action: { action: "riverWorkshop", vp: 2 } },
    scholarSend: { id: "scholarSend", income: { scholars: 1 }, action: { action: "scholar", vp: 2 } },
    guildBuild: { id: "guildBuild", income: { power: 3 }, action: { action: "guild", vp: 3 } },
    bigBuildingsPass: {
        id: "bigBuildingsPass", income: { tools: 1 },
        pass: { buildings: ["university", "palace"], vp: 4, levels: 0 },
    },
    spadeAction: { id: "spadeAction", income: { books: { gray: 1 } }, special: "spade" },
    bridgeAction: { id: "bridgeAction", income: { books: { gray: 1 } }, special: "bridge" },
    levelAction: { id: "levelAction", income: { tools: 2 }, special: "level" },
    schoolsPass: {
        id: "schoolsPass", income: { coins: 4 },
        pass: { buildings: ["school"], vp: 0, levels: 1 },
    },
    power4coins2: { id: "power4coins2", income: { power: 4, coins: 2 } },
    coins6: { id: "coins6", income: { coins: 6 } },
};

export const BONUS_TILE_IDS = Object.keys(BONUS_TILES) as BonusTileId[];