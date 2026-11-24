import { describe, it, expect } from "vitest";
import { nextRandom, randomInt, seedFromString, shuffle } from "../../src/aoi/index.ts";

describe("seedFromString", () => {
    it("同一个字符串得到同一个种子", () => {
        expect(seedFromString("room-ABCDE")).toBe(seedFromString("room-ABCDE"));
    });
    it("不同字符串得到不同种子", () => {
        expect(seedFromString("a")).not.toBe(seedFromString("b"));
    });
    it("种子是非负整数", () => {
        const s = seedFromString("任意中文也可以");
        expect(Number.isInteger(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
    });
});

describe("nextRandom", () => {
    it("结果在 [0, 1) 之间，并返回新状态", () => {
        let rng = seedFromString("x");
        for (let i = 0; i < 1000; i++) {
            const [r, next] = nextRandom(rng);
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThan(1);
            expect(next).not.toBe(rng);
            rng = next;
        }
    });
    it("同一个状态永远得到同一个结果", () => {
        expect(nextRandom(12345)).toEqual(nextRandom(12345));
    });
});

describe("randomInt", () => {
    it("结果在 0 ~ n-1，而且每个数出现的次数差不多", () => {
        const counts = [0, 0, 0, 0, 0, 0, 0];
        let rng = seedFromString("dice");
        for (let i = 0; i < 7000; i++) {
            let k: number;
            [k, rng] = randomInt(rng, 7);
            counts[k]++;
        }
        for (const c of counts) {
            expect(c).toBeGreaterThan(800);
            expect(c).toBeLessThan(1200);
        }
    });
});

describe("shuffle", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];

    it("元素不多不少，只是顺序变了", () => {
        const [result] = shuffle(items, seedFromString("s1"));
        expect([...result].sort()).toEqual(items);
        expect(result).not.toEqual(items);
    });
    it("不修改原数组", () => {
        const copy = [...items];
        shuffle(items, seedFromString("s1"));
        expect(items).toEqual(copy);
    });
    it("同一个种子洗出同一个顺序；不同种子洗出不同顺序", () => {
        expect(shuffle(items, 42)).toEqual(shuffle(items, 42));
        expect(shuffle(items, 42)[0]).not.toEqual(shuffle(items, 43)[0]);
    });
});