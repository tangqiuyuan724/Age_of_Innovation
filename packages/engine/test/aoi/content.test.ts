import { describe, it, expect } from "vitest";
import {
    BONUS_TILES, BONUS_TILE_IDS, BUILDINGS_TOTAL, FACTIONS, FACTION_IDS, MAPS, PALACE_TILE_IDS,
    PALACE_TILE_INCOME, PLANNING_DISPLAYS, PLANNING_IDS, STARTING_POWER, TERRAIN_WHEEL, parseMap,
    type BuildingType,
} from "../../src/aoi/index.ts";

const BUILDING_TYPES: BuildingType[] = ["workshop", "guild", "school", "university", "palace"];

describe("规划板", () => {
    it("7 块，每种地形一块，编号和表里的 key 一致", () => {
        expect([...PLANNING_IDS].sort()).toEqual([...TERRAIN_WHEEL].sort());
        for (const id of PLANNING_IDS) expect(PLANNING_DISPLAYS[id].id).toBe(id);
    });
    it("每一行收入的格子数等于这种建筑的总数", () => {
        for (const id of PLANNING_IDS) {
            for (const type of BUILDING_TYPES) {
                expect(PLANNING_DISPLAYS[id].income[type]).toHaveLength(BUILDINGS_TOTAL[type]);
            }
        }
    });
    it("开局都是 15 金币；只有荒地是 4 工具", () => {
        for (const id of PLANNING_IDS) {
            expect(PLANNING_DISPLAYS[id].start.coins).toBe(15);
            expect(PLANNING_DISPLAYS[id].start.tools).toBe(id === "wasteland" ? 4 : 3);
        }
    });
    it("每块规划板开局都是 12 个能量指示物", () => {
        for (const id of PLANNING_IDS) {
            const [a, b, c] = STARTING_POWER[id];
            expect(a + b + c).toBe(12);
        }
    });
    it("山脉的不同之处：固定收入多 2 金币，第一个行会多 1 金币", () => {
        expect(PLANNING_DISPLAYS.mountain.baseIncome).toEqual({ tools: 1, coins: 2 });
        expect(PLANNING_DISPLAYS.mountain.income.guild[0]).toEqual({ power: 1, coins: 3 });
        expect(PLANNING_DISPLAYS.mountain.income.guild[1]).toEqual({ power: 1, coins: 2 });
        expect(PLANNING_DISPLAYS.plains.income.guild[0]).toEqual({ power: 1, coins: 2 });
    });
});

describe("派系、回合奖励板块、宫殿板块", () => {
    it("12 个派系、10 个回合奖励板块、17 个宫殿板块", () => {
        expect(FACTION_IDS).toHaveLength(12);
        expect(BONUS_TILE_IDS).toHaveLength(10);
        expect(PALACE_TILE_IDS).toHaveLength(17);
        for (const id of PALACE_TILE_IDS) expect(PALACE_TILE_INCOME[id]).toBeDefined();
    });
    it("表里的 id 和 key 一致", () => {
        for (const id of FACTION_IDS) expect(FACTIONS[id].id).toBe(id);
        for (const id of BONUS_TILE_IDS) expect(BONUS_TILES[id].id).toBe(id);
    });
    it("开局学科等级加起来：大多数派系是 2 级，航海家 3 级，圣者 4 级", () => {
        const total = (id: keyof typeof FACTIONS) =>
            Object.values(FACTIONS[id].startScience).reduce((a, b) => a + (b ?? 0), 0);
        expect(total("navigators")).toBe(3);
        expect(total("blessed")).toBe(4);
        expect(total("philosophers")).toBe(2);
        expect(total("lizards")).toBe(0); // 蜥蜴是开局自己选
        expect(FACTIONS.lizards.scienceChoices).toBe(2);
    });
});

describe("地图", () => {
    it("aoi-base 有 9 行，81 个陆地格", () => {
        const geo = parseMap(MAPS["aoi-base"]);
        expect(geo.rowCount).toBe(9);
        expect(geo.hexes.filter((h) => !h.river)).toHaveLength(81);
    });
});