import { describe, it, expect } from "vitest";
import {
    hexId, parseMap, initialHexes, neighbors, isAdjacent, reachFrom, hexesInReach, groupHexes,
    type Bridge, type MapDef,
} from "../../src/aoi/index.ts";

// 测试用小地图（B 行向右错开半格）：
//   A:  P  P  ~  F  F
//   B:    P  ~  ~  F  F
//   C:  P  P  ~  F  F
const TEST_MAP: MapDef = { id: "test", name: "测试地图", rows: ["PP~FF", "P~~FF", "PP~FF"] };
const geo = parseMap(TEST_MAP);
const NO_BRIDGES: Bridge[] = [];

describe("解析地图", () => {
    it("格子编号：行字母 + 列号", () => {
        expect(hexId(0, 0)).toBe("A1");
        expect(hexId(4, 6)).toBe("E7");
    });

    it("15 个格子，其中 4 个河流格", () => {
        expect(geo.hexes).toHaveLength(15);
        expect(geo.hexes.filter((h) => h.river)).toHaveLength(4);
        expect(geo.rowCount).toBe(3);
    });

    it("按编号查格子", () => {
        expect(geo.byId["A1"]).toEqual({ id: "A1", row: 0, col: 0, river: false, terrain: "plains" });
        expect(geo.byId["B2"]).toEqual({ id: "B2", row: 1, col: 1, river: true, terrain: null });
    });

    it("不认识的字符报错", () => {
        expect(() => parseMap({ id: "bad", name: "坏地图", rows: ["PX"] })).toThrow();
    });

    it("初始状态只包含陆地格，都没有建筑", () => {
        const hexes = initialHexes(geo);
        expect(Object.keys(hexes)).toHaveLength(11);
        expect(hexes["A4"]).toEqual({ terrain: "forest", structure: null });
        expect(hexes["A3"]).toBeUndefined();
    });
});

describe("邻居", () => {
    it("A 行（不错开）的格子：下一行取左下、右下是同列和前一列", () => {
        expect(neighbors(geo, "A2").sort()).toEqual(["A1", "A3", "B1", "B2"]);
    });

    it("B 行（向右错开）的格子：上下两行取同列和后一列", () => {
        expect(neighbors(geo, "B2").sort()).toEqual(["A2", "A3", "B1", "B3", "C2", "C3"]);
    });

    it("地图边上的格子邻居少", () => {
        expect(neighbors(geo, "A1").sort()).toEqual(["A2", "B1"]);
    });

    it("相邻判断：共用边，或者有桥", () => {
        expect(isAdjacent(geo, NO_BRIDGES, "A2", "B1")).toBe(true);
        expect(isAdjacent(geo, NO_BRIDGES, "A2", "A4")).toBe(false);
        const bridges: Bridge[] = [{ owner: 0, a: "A2", b: "A4" }];
        expect(isAdjacent(geo, bridges, "A4", "A2")).toBe(true);
    });
});

describe("可达范围", () => {
    it("航行 0：只有相邻的陆地格", () => {
        expect(reachFrom(geo, "A2", 0, NO_BRIDGES)).toEqual(["A1", "B1"]);
    });

    it("航行 1：还能跨过 1 个河流格", () => {
        expect(reachFrom(geo, "A2", 1, NO_BRIDGES)).toEqual(["A1", "A4", "B1", "C2"]);
    });

    it("航行 2：能跨过 2 个河流格", () => {
        expect(reachFrom(geo, "A2", 2, NO_BRIDGES)).toEqual(["A1", "A4", "B1", "B4", "C2", "C4"]);
    });

    it("上岸后不能继续走陆路：A5 只能从陆地走到，不在范围内", () => {
        expect(reachFrom(geo, "A2", 2, NO_BRIDGES)).not.toContain("A5");
    });

    it("桥对岸的格子算相邻", () => {
        const bridges: Bridge[] = [{ owner: 0, a: "A2", b: "A4" }];
        expect(reachFrom(geo, "A2", 0, bridges)).toEqual(["A1", "A4", "B1"]);
    });

    it("多个起点取并集", () => {
        expect(hexesInReach(geo, ["A1", "C5"], 0, NO_BRIDGES)).toEqual(["A2", "B1", "B4", "B5", "C4"]);
    });
});

describe("分组", () => {
    it("相邻的格子归为一组", () => {
        const linked = (a: string, b: string) => isAdjacent(geo, NO_BRIDGES, a, b);
        expect(groupHexes(["A1", "A2", "C5", "B1", "C4"], linked)).toEqual([
            ["A1", "A2", "B1"],
            ["C4", "C5"],
        ]);
    });
});