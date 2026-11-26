// 7 种城市板块，每种 3 张。组成城市时拿一张：得分、拿奖励、再拿 1 把钥匙。
// 来源：规则书附录 VII，和 Images 里的 47~51 号图核对过（"5 分 2 本书""8 分 1 学者"两种没有图）。
import type { CityTileId, ResourceBundle } from "../types.js";

export interface CityTileDef {
    id: CityTileId;
    /** 马上获得：分数和资源。books 里的 gray 是任选颜色的书 */
    gain: ResourceBundle;
    /** 一次"改造并建造"，带几把免费铲子（可以顺带建工坊） */
    spades?: number;
    /** 每门学科前进几级 */
    levels?: number;
}

export const CITY_TILES: Record<CityTileId, CityTileDef> = {
    tools: { id: "tools", gain: { vp: 4, tools: 3 } },
    spades: { id: "spades", gain: { vp: 5 }, spades: 2 },
    books: { id: "books", gain: { vp: 5, books: { gray: 2 } } },
    coins: { id: "coins", gain: { vp: 6, coins: 6 } },
    levels: { id: "levels", gain: { vp: 7 }, levels: 1 },
    power: { id: "power", gain: { vp: 8, power: 8 } },
    scholar: { id: "scholar", gain: { vp: 8, scholars: 1 } },
};

export const CITY_TILE_IDS = Object.keys(CITY_TILES) as CityTileId[];

/** 每种城市板块有几张 */
export const CITY_TILE_COPIES = 3;