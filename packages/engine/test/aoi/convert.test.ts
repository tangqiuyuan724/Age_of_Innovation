import { describe, it, expect } from "vitest";
import { convert, type PlayerState } from "../../src/aoi/index.ts";

function player(overrides: Partial<PlayerState> = {}): PlayerState {
    return {
        seat: 0, faction: "goblins", planning: "plains", homeTerrain: "plains",
        vp: 20, coins: 0, tools: 2, scholars: 1, scholarsInSupply: 5,
        books: { banking: 0, law: 2, engineering: 0, medicine: 0 },
        power: [0, 2, 10], bridges: 3, sailing: 0, terraforming: 0,
        science: { banking: 0, law: 0, engineering: 0, medicine: 0 }, keys: 0,
        buildingsLeft: { workshop: 9, guild: 4, school: 3, university: 1, palace: 1 },
        palaceTile: null, innovations: [], competencies: [], cityTiles: [], bonusTile: null,
        specialsUsed: [], passed: false,
        ...overrides,
    };
}

describe("convert：能量换东西", () => {
    it("5 能量 → 1 学者", () => {
        const p = convert(player(), "power5ToScholar", 1)!;
        expect(p.power).toEqual([5, 2, 5]);
        expect(p.scholars).toBe(2);
        expect(p.scholarsInSupply).toBe(4);
    });
    it("做 2 次就付 10 能量", () => {
        expect(convert(player(), "power5ToScholar", 2)!.power).toEqual([10, 2, 0]);
    });
    it("能量不够返回 null", () => {
        expect(convert(player(), "power5ToScholar", 3)).toBeNull();
    });
    it("学者供应区不够返回 null", () => {
        expect(convert(player({ scholarsInSupply: 1 }), "power5ToScholar", 2)).toBeNull();
    });
    it("5 能量 → 1 本书：必须指定颜色", () => {
        expect(convert(player(), "power5ToBook", 1)).toBeNull();
        expect(convert(player(), "power5ToBook", 1, "medicine")!.books.medicine).toBe(1);
    });
    it("3 能量 → 1 工具；1 能量 → 1 金币", () => {
        expect(convert(player(), "power3ToTool", 3)!.tools).toBe(5);
        expect(convert(player(), "power1ToCoin", 10)!.coins).toBe(10);
    });
});

describe("convert：其他", () => {
    it("学者 → 工具：学者回到供应区", () => {
        const p = convert(player(), "scholarToTool", 1)!;
        expect(p.scholars).toBe(0);
        expect(p.scholarsInSupply).toBe(6);
        expect(p.tools).toBe(3);
    });
    it("工具 → 金币", () => {
        expect(convert(player(), "toolToCoin", 2)!.coins).toBe(2);
        expect(convert(player(), "toolToCoin", 3)).toBeNull();
    });
    it("书 → 金币：按指定颜色付", () => {
        const p = convert(player(), "bookToCoin", 2, "law")!;
        expect(p.books.law).toBe(0);
        expect(p.coins).toBe(2);
        expect(convert(player(), "bookToCoin", 1, "banking")).toBeNull();
        expect(convert(player(), "bookToCoin", 1)).toBeNull();
    });
    it("次数必须是正整数", () => {
        expect(convert(player(), "toolToCoin", 0)).toBeNull();
        expect(convert(player(), "toolToCoin", 1.5)).toBeNull();
        expect(convert(player(), "toolToCoin", -1)).toBeNull();
    });
    it("不修改传入的玩家", () => {
        const before = player();
        convert(before, "power5ToScholar", 1);
        expect(before).toEqual(player());
    });
});