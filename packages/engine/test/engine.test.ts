import { describe, it, expect } from "vitest";
import { activeSeat, applyMove, createGame, getLegalMoves, validateMove } from "../src/index.ts";

describe("抢21规则引擎", () => {
    it("新游戏从0开始，第一个座位先行动", () => {
        const g = createGame([0, 1]);
        expect(g.total).toBe(0);
        expect(activeSeat(g)).toBe(0);
    });
    it("不是你的回合时拒绝", () => {
        const g = createGame([0, 1]);
        expect(validateMove(g, 1, { t: "add", n: 1 })).toBe("not-your-turn");
    });

    it("只能加 1~3", () => {
        const g = createGame([0, 1]);
        expect(validateMove(g, 0, { t: "add", n: 4 })).toBe("bad-amount");
        expect(validateMove(g, 0, { t: "add", n: 0 })).toBe("bad-amount");
    });

    it("执行后轮到下一位，且不修改旧状态", () => {
        const g0 = createGame([0, 1]);
        const { state: g1, events } = applyMove(g0, 0, { t: "add", n: 2 });
        expect(g1.total).toBe(2);
        expect(g1.version).toBe(1);
        expect(activeSeat(g1)).toBe(1);
        expect(g0.total).toBe(0); // 旧状态没被改
        expect(events).toEqual([{ type: "added", seat: 0, n: 2, total: 2 }]);
    });

    it("正好加到 21 获胜，之后不能再操作", () => {
        const g = { ...createGame([0, 1]), total: 19 };
        const r = applyMove(g, 0, { t: "add", n: 2 });
        expect(r.state.winner).toBe(0);
        expect(r.events.at(-1)).toEqual({ type: "won", seat: 0 });
        expect(validateMove(r.state, 1, { t: "add", n: 1 })).toBe("game-over");
    });

    it("不能超过 21；合法动作列表会过滤掉超出的", () => {
        const g = { ...createGame([0, 1]), total: 20 };
        expect(validateMove(g, 0, { t: "add", n: 2 })).toBe("overshoot");
        expect(getLegalMoves(g, 0)).toEqual([{ t: "add", n: 1 }]);
    });
});