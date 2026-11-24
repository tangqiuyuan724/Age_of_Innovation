import { describe, it, expect } from "vitest";
import {
    addBundles, gainResources, payResources, scaleBundle, type PlayerState,
} from "../../src/aoi/index.ts";

/** 测试用的玩家：先填一组普通的值，再用 overrides 覆盖 */
function player(overrides: Partial<PlayerState> = {}): PlayerState {
    return {
        seat: 0, faction: "goblins", planning: "plains", homeTerrain: "plains",
        vp: 20, coins: 10, tools: 3, scholars: 1, scholarsInSupply: 6,
        books: { banking: 1, law: 0, engineering: 0, medicine: 0 },
        power: [5, 7, 0], bridges: 3, sailing: 0, terraforming: 0,
        science: { banking: 0, law: 0, engineering: 0, medicine: 0 }, keys: 0,
        buildingsLeft: { workshop: 9, guild: 4, school: 3, university: 1, palace: 1 },
        palaceTile: null, innovations: [], competencies: [], cityTiles: [], bonusTile: null,
        specialsUsed: [], passed: false,
        ...overrides,
    };
}

describe("addBundles", () => {
    it("同名的数量相加，书按颜色分别相加", () => {
        expect(addBundles({ coins: 2, books: { law: 1 } }, { coins: 3, tools: 1, books: { law: 1, gray: 1 } }))
            .toEqual({ coins: 5, tools: 1, books: { law: 2, gray: 1 } });
    });
    it("加起来是 0 的项不保留；空 + 空 = 空", () => {
        expect(addBundles({ coins: 2 }, { coins: -2 })).toEqual({});
        expect(addBundles({}, {})).toEqual({});
    });
    it("不修改传入的对象", () => {
        const a = { coins: 1, books: { law: 1 } };
        addBundles(a, { coins: 1, books: { law: 1 } });
        expect(a).toEqual({ coins: 1, books: { law: 1 } });
    });
});

describe("scaleBundle", () => {
    it("每一项乘以次数", () => {
        expect(scaleBundle({ power: 5, books: { gray: 1 } }, 3)).toEqual({ power: 15, books: { gray: 3 } });
    });
});

describe("gainResources", () => {
    it("金币、工具、分数直接加", () => {
        const { player: p } = gainResources(player(), { coins: 2, tools: 1, vp: 3 });
        expect(p.coins).toBe(12);
        expect(p.tools).toBe(4);
        expect(p.vp).toBe(23);
    });
    it("能量按能量碗规则流动", () => {
        expect(gainResources(player(), { power: 7 }).player.power).toEqual([0, 10, 2]);
    });
    it("学者从供应区拿，供应区不够就能拿几个拿几个", () => {
        const { player: p } = gainResources(player({ scholarsInSupply: 1 }), { scholars: 3 });
        expect(p.scholars).toBe(2);
        expect(p.scholarsInSupply).toBe(0);
    });
    it("有颜色的书直接加；灰色的书算进 bookChoices", () => {
        const { player: p, bookChoices } = gainResources(player(), { books: { banking: 2, gray: 1 } });
        expect(p.books).toEqual({ banking: 3, law: 0, engineering: 0, medicine: 0 });
        expect(bookChoices).toBe(1);
    });
    it("不修改传入的玩家", () => {
        const before = player();
        gainResources(before, { coins: 5, books: { law: 1 } });
        expect(before).toEqual(player());
    });
    it("铲子不能获得成资源", () => {
        expect(() => gainResources(player(), { spades: 1 })).toThrow();
    });
});

describe("payResources", () => {
    it("够付就扣掉", () => {
        const p = payResources(player(), { coins: 6, tools: 2 })!;
        expect(p.coins).toBe(4);
        expect(p.tools).toBe(1);
    });
    it("任何一项不够都返回 null", () => {
        expect(payResources(player(), { coins: 11 })).toBeNull();
        expect(payResources(player(), { tools: 4 })).toBeNull();
        expect(payResources(player(), { scholars: 2 })).toBeNull();
        expect(payResources(player(), { books: { law: 1 } })).toBeNull();
        expect(payResources(player(), { power: 1 })).toBeNull(); // 碗 III 是空的
    });
    it("付能量从碗 III 拿，回到碗 I", () => {
        expect(payResources(player({ power: [0, 4, 8] }), { power: 5 })!.power).toEqual([5, 4, 3]);
    });
    it("付出去的学者回到供应区", () => {
        const p = payResources(player({ scholars: 2, scholarsInSupply: 5 }), { scholars: 2 })!;
        expect(p.scholars).toBe(0);
        expect(p.scholarsInSupply).toBe(7);
    });
    it("付书要写清楚颜色", () => {
        expect(payResources(player(), { books: { banking: 1 } })!.books.banking).toBe(0);
        expect(() => payResources(player(), { books: { gray: 1 } })).toThrow();
    });
});