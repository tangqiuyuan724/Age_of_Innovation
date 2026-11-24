import { describe, it, expect } from "vitest";
import { rankPoints, AREA_SCORE_POINTS, SCIENCE_SCORE_POINTS } from "../../src/aoi/index.ts";

describe("名次分", () => {
    it("没有并列时按名次给分，第 4 名没分", () => {
        expect(rankPoints([10, 7, 5, 3], AREA_SCORE_POINTS)).toEqual([18, 12, 6, 0]);
    });

    it("并列第二：平分第二、三名的分", () => {
        expect(rankPoints([10, 7, 7, 3], AREA_SCORE_POINTS)).toEqual([18, 9, 9, 0]);
    });

    it("三人并列第一：平分 18+12+6，向下取整", () => {
        expect(rankPoints([5, 5, 5], AREA_SCORE_POINTS)).toEqual([12, 12, 12]);
    });

    it("并列第一的两人平分 8+4 = 6；0 级不得分", () => {
        expect(rankPoints([8, 8, 2, 0], SCIENCE_SCORE_POINTS)).toEqual([6, 6, 2, 0]);
    });

    it("向下取整：两人并列第三，平分 2 分 → 各 1 分", () => {
        expect(rankPoints([9, 6, 3, 3], SCIENCE_SCORE_POINTS)).toEqual([8, 4, 1, 1]);
    });
});