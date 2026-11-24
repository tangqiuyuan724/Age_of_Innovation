import { describe, it, expect } from "vitest";
import {
    parseMap, initialHexes, findCityCandidate, structurePower,
    type Bridge, type HexId, type HexState, type StructureType,
} from "../../src/aoi/index.ts";

//   A:  P  P  ~  F  F
//   B:    P  ~  ~  F  F
//   C:  P  P  ~  F  F
const geo = parseMap({ id: "test", name: "测试地图", rows: ["PP~FF", "P~~FF", "PP~FF"] });
const NO_BRIDGES: Bridge[] = [];

/** 测试小工具：在初始地图上放一些建筑 */
function withBuildings(
    list: { hex: HexId; type: StructureType; owner?: number; annex?: boolean; city?: number }[],
): Record<HexId, HexState> {
    const hexes = initialHexes(geo);
    for (const b of list) {
        hexes[b.hex] = {
            ...hexes[b.hex],
            structure: { owner: b.owner ?? 0, type: b.type, neutral: false, annex: b.annex ?? false, city: b.city ?? null },
        };
    }
    return hexes;
}

describe("组成城市", () => {
    it("4 座相连但能量只有 5：不够", () => {
        const hexes = withBuildings([
            { hex: "A1", type: "workshop" }, { hex: "A2", type: "guild" },
            { hex: "B1", type: "workshop" }, { hex: "C1", type: "workshop" },
        ]);
        expect(findCityCandidate(geo, hexes, NO_BRIDGES, 0)).toBeNull();
    });

    it("4 座相连、能量 7：可以组城", () => {
        const hexes = withBuildings([
            { hex: "A1", type: "workshop" }, { hex: "A2", type: "palace" },
            { hex: "B1", type: "guild" }, { hex: "C1", type: "workshop" },
        ]);
        expect(findCityCandidate(geo, hexes, NO_BRIDGES, 0)).toEqual(["A1", "A2", "B1", "C1"]);
    });

    it("有大学时 3 座就够", () => {
        const hexes = withBuildings([
            { hex: "A1", type: "guild" }, { hex: "A2", type: "university" }, { hex: "B1", type: "school" },
        ]);
        expect(findCityCandidate(geo, hexes, NO_BRIDGES, 0)).toEqual(["A1", "A2", "B1"]);
    });

    it("有纪念碑时 2 座就够", () => {
        const hexes = withBuildings([{ hex: "A2", type: "monument" }, { hex: "B1", type: "palace" }]);
        expect(findCityCandidate(geo, hexes, NO_BRIDGES, 0)).toEqual(["A2", "B1"]);
    });

    it("附楼：能量 +1，算 2 座", () => {
        const hexes = withBuildings([
            { hex: "A1", type: "guild", annex: true }, { hex: "A2", type: "guild" }, { hex: "B1", type: "guild" },
        ]);
        expect(structurePower(hexes["A1"].structure!)).toBe(3);
        expect(findCityCandidate(geo, hexes, NO_BRIDGES, 0)).toEqual(["A1", "A2", "B1"]);
    });

    it("不相连的建筑不能凑在一起", () => {
        const hexes = withBuildings([
            { hex: "A1", type: "palace" }, { hex: "A2", type: "guild" },
            { hex: "C4", type: "school" }, { hex: "C5", type: "workshop" },
        ]);
        expect(findCityCandidate(geo, hexes, NO_BRIDGES, 0)).toBeNull();
    });

    it("桥能把两岸的建筑连起来", () => {
        const hexes = withBuildings([
            { hex: "A1", type: "palace" }, { hex: "A2", type: "guild" },
            { hex: "A4", type: "school" }, { hex: "A5", type: "workshop" },
        ]);
        const bridges: Bridge[] = [{ owner: 0, a: "A2", b: "A4" }];
        expect(findCityCandidate(geo, hexes, bridges, 0)).toEqual(["A1", "A2", "A4", "A5"]);
    });

    it("别人的建筑、已经归入城市的建筑都不算", () => {
        const hexes = withBuildings([
            { hex: "A1", type: "palace" }, { hex: "A2", type: "guild", owner: 1 },
            { hex: "B1", type: "guild", city: 1 }, { hex: "C1", type: "workshop" },
        ]);
        expect(findCityCandidate(geo, hexes, NO_BRIDGES, 0)).toBeNull();
    });

    it("宫殿 #8 这类效果可以降低能量要求", () => {
        const hexes = withBuildings([
            { hex: "A1", type: "workshop" }, { hex: "A2", type: "guild" },
            { hex: "B1", type: "guild" }, { hex: "C1", type: "workshop" },
        ]);
        expect(findCityCandidate(geo, hexes, NO_BRIDGES, 0)).toBeNull();
        expect(findCityCandidate(geo, hexes, NO_BRIDGES, 0, 6)).toEqual(["A1", "A2", "B1", "C1"]);
    });
});