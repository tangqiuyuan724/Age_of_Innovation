import { describe, it, expect } from "vitest";
import { gainPower, spendPower, sacrificePower, powerCapacity, leechOffer } from "../../src/aoi/index.ts";

describe("能量碗", () => {
    it("获得能量时先清空碗 I，再从碗 II 往碗 III 走", () => {
        expect(gainPower([2, 3, 0], 3)).toEqual({ bowls: [0, 4, 1], gained: 3 });
    });

    it("碗 I、II 都空了就拿不到更多", () => {
        expect(gainPower([1, 0, 11], 5)).toEqual({ bowls: [0, 0, 12], gained: 2 });
        expect(powerCapacity([1, 0, 11])).toBe(2);
    });

    it("花能量只能用碗 III，花掉的回到碗 I", () => {
        expect(spendPower([0, 5, 7], 4)).toEqual([4, 5, 3]);
        expect(spendPower([0, 5, 3], 4)).toBeNull();
    });

    it("牺牲：碗 II 两个换碗 III 一个，总数少 1", () => {
        expect(sacrificePower([0, 7, 5], 2)).toEqual([0, 3, 7]);
        expect(sacrificePower([0, 1, 5], 1)).toBeNull();
    });
});

describe("吸能", () => {
    it("拿 N 点付 N-1 分", () => {
        expect(leechOffer(1, [5, 7, 0], 20)).toEqual({ power: 1, vpCost: 0 });
        expect(leechOffer(4, [5, 7, 0], 20)).toEqual({ power: 4, vpCost: 3 });
    });

    it("碗装不下时，能拿多少拿多少，按实际拿到的付分", () => {
        expect(leechOffer(4, [0, 2, 10], 20)).toEqual({ power: 2, vpCost: 1 });
    });

    it("分数不够时扣到 0，拿到的能量 = 扣的分 + 1", () => {
        expect(leechOffer(4, [5, 7, 0], 1)).toEqual({ power: 2, vpCost: 1 });
        expect(leechOffer(3, [5, 7, 0], 0)).toEqual({ power: 1, vpCost: 0 });
    });

    it("一点都拿不到时不发起吸能", () => {
        expect(leechOffer(3, [0, 0, 12], 20)).toBeNull();
        expect(leechOffer(0, [5, 7, 0], 20)).toBeNull();
    });
});