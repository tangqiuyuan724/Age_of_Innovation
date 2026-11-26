import { describe, it, expect } from "vitest";
import {
    LAST_ROUND, applyMove, endGame, finalScores, largestArea, resourceValue,
    type GameState, type Seat,
} from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer, withStructure } from "./fixtures.ts";

const game = readyGame();
const plains = seatOf(game, "plains"); // 工坊在 C6、E1，航行 0 级
const swamp = seatOf(game, "swamp");   // 工坊在 C7、A10
const forest = seatOf(game, "forest"); // 工坊在 B6、I1

const LEVELS0 = { banking: 0, law: 0, engineering: 0, medicine: 0 };
const NO_BOOKS = { banking: 0, law: 0, engineering: 0, medicine: 0 };

describe("区域：最大一片建筑", () => {
    it("开局两个工坊离得很远：最大一片 1 座", () => {
        expect(largestArea(game, plains)).toBe(1);
    });
    it("D5 挨着 C6：连成 2 座", () => {
        expect(largestArea(withStructure(game, "D5", plains, "workshop"), plains)).toBe(2);
    });
    it("E4 和 D5 隔着河：航行 0 级、没有桥，连不上", () => {
        let s = withStructure(game, "D5", plains, "workshop");
        s = withStructure(s, "E4", plains, "workshop");
        expect(largestArea(s, plains)).toBe(2);
    });
    it("D5 和 E4 之间有自己的桥：连上，3 座", () => {
        let s = withStructure(game, "D5", plains, "workshop");
        s = withStructure(s, "E4", plains, "workshop");
        s = { ...s, bridges: [{ a: "D5", b: "E4", owner: plains }] };
        expect(largestArea(s, plains)).toBe(3);
    });
    it("别人的桥不算", () => {
        let s = withStructure(game, "D5", plains, "workshop");
        s = withStructure(s, "E4", plains, "workshop");
        s = { ...s, bridges: [{ a: "D5", b: "E4", owner: swamp }] };
        expect(largestArea(s, plains)).toBe(2);
    });
    it("航行 1 级：隔一格河也够得着，3 座", () => {
        let s = withStructure(game, "D5", plains, "workshop");
        s = withStructure(s, "E4", plains, "workshop");
        s = withPlayer(s, plains, { sailing: 1 });
        expect(largestArea(s, plains)).toBe(3);
    });
});

describe("剩下的资源", () => {
    it("金币、工具、书、学者、碗 III 的能量各算 1 金币；碗 I、II 不算", () => {
        const p = { ...game.players[plains], coins: 3, tools: 2, scholars: 1, power: [4, 6, 4] as [number, number, number],
            books: { ...NO_BOOKS, law: 1, medicine: 1 } };
        expect(resourceValue(p)).toBe(3 + 2 + 2 + 1 + 4);
    });
});

/** 三个人都没有资源、学科都是 0 级、都是 10 分，再按 overrides 改 */
function plainScoring(overrides: Partial<Record<Seat, Parameters<typeof withPlayer>[2]>>): GameState {
    let s: GameState = game;
    for (const p of game.players) {
        s = withPlayer(s, p.seat, {
            vp: 10, coins: 0, tools: 0, scholars: 0, power: [0, 0, 0], books: NO_BOOKS, science: LEVELS0,
            ...overrides[p.seat],
        });
    }
    return s;
}

describe("终局分", () => {
    it("区域：最大一片 2、1、1 座：18 分，另外两人并列第 2，(12 + 6) / 2 = 9 分", () => {
        const s = plainScoring({});
        const scores = finalScores(withStructure(s, "D5", plains, "workshop"));
        expect(scores[plains].breakdown.area).toBe(18);
        expect(scores[swamp].breakdown.area).toBe(9);
        expect(scores[forest].breakdown.area).toBe(9);
    });
    it("学科：每门学科分开排名，0 级不得分", () => {
        const s = plainScoring({
            [plains]: { science: { ...LEVELS0, law: 5, banking: 3 } },
            [swamp]: { science: { ...LEVELS0, law: 5 } },
            [forest]: { science: { ...LEVELS0, law: 2, banking: 1 } },
        });
        const scores = finalScores(s);
        // 法律：5、5 并列第 1 → (8 + 4) / 2 = 6；2 级第 3 → 2。银行：3 级 8 分，1 级 4 分
        expect(scores[plains].breakdown.science).toBe(6 + 8);
        expect(scores[swamp].breakdown.science).toBe(6);
        expect(scores[forest].breakdown.science).toBe(2 + 4);
    });
    it("资源：每 5 金币 1 分，不够 5 的不算", () => {
        const s = plainScoring({ [plains]: { coins: 7, tools: 2, power: [0, 0, 5] }, [swamp]: { coins: 4 } });
        const scores = finalScores(s);
        expect(scores[plains].breakdown.resources).toBe(2); // 7 + 2 + 5 = 14
        expect(scores[swamp].breakdown.resources).toBe(0);
    });
    it("总分 = 游戏中的分 + 区域 + 学科 + 资源", () => {
        const s = plainScoring({ [plains]: { coins: 5, science: { ...LEVELS0, medicine: 1 } } });
        const mine = finalScores(withStructure(s, "D5", plains, "workshop"))[plains];
        expect(mine.breakdown).toEqual({ game: 10, area: 18, science: 8, resources: 1 });
        expect(mine.total).toBe(10 + 18 + 8 + 1);
    });
});

describe("游戏结束", () => {
    it("分数加上去，阶段变成 ended，记下终局分；最后一个事件是 gameEnded", () => {
        const s: GameState = { ...plainScoring({}), round: LAST_ROUND };
        const { state, events } = endGame(s);
        expect(state.phase).toBe("ended");
        expect(state.finalScores).toEqual(finalScores(s));
        for (const sc of state.finalScores!) expect(state.players[sc.seat].vp).toBe(sc.total);
        expect(events).toContainEqual({ type: "resources", seat: swamp, delta: { vp: 12 }, reason: "finalArea" });
        expect(events).toContainEqual({ type: "phase", round: LAST_ROUND, phase: "ended" });
        expect(events[events.length - 1]).toEqual({ type: "gameEnded", scores: state.finalScores });
    });
});

describe("最后一轮 pass：自动牺牲能量", () => {
    it("第 6 轮 pass：碗 II 里能牺牲的全牺牲掉", () => {
        let s: GameState = { ...turnOf(game, plains), round: LAST_ROUND };
        s = withPlayer(s, plains, { power: [1, 5, 0], bonusTile: null });
        const { state } = applyMove(s, plains, { t: "pass", bonusTile: null });
        expect(state.players[plains].power).toEqual([1, 1, 2]);
    });
    it("第 5 轮 pass：不动能量", () => {
        let s: GameState = { ...turnOf(game, plains), round: 5 };
        s = withPlayer(s, plains, { power: [1, 5, 0] });
        const bonusTile = s.board.bonusTiles[0].id;
        const { state } = applyMove(s, plains, { t: "pass", bonusTile });
        expect(state.players[plains].power).toEqual([1, 5, 0]);
    });
});