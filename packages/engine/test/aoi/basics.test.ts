import { describe, it, expect } from "vitest";
import {
    advance, checkFreeAction, checkMainAction, isInReach, reachRange, structuresOf,
} from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer } from "./fixtures.ts";

const game = readyGame();
const [first, second, third] = game.turnOrder;
const plains = seatOf(game, "plains");
const swamp = seatOf(game, "swamp");

describe("测试用的开局", () => {
    it("开局结束、第 1 轮收入拿过了：行动阶段，轮到行动顺序第一个人", () => {
        expect(game.round).toBe(1);
        expect(game.phase).toBe("actions");
        expect(game.turn).toEqual({ seat: first, mainActionDone: false, builtHexes: [] });
        expect(game.pending).toEqual([]);
    });
    it("收入：平原玩家拿着\"6 金币\"板块，开局 15 金币 + 6", () => {
        expect(game.players[plains].coins).toBe(21);
    });
});

describe("可达范围的小工具", () => {
    it("structuresOf：平原玩家的两个工坊", () => {
        expect(structuresOf(game, plains).sort()).toEqual(["C6", "E1"]);
    });
    it("reachRange：航行等级，拿着\"河边工坊\"板块再 +1", () => {
        expect(reachRange(game.players[swamp])).toBe(0);
        expect(reachRange({ ...game.players[swamp], sailing: 1, bonusTile: "riverWorkshop" })).toBe(2);
    });
    it("isInReach：沼泽玩家的 C7 和 D8 之间隔一格河，航行 0 够不着，航行 1 够得着", () => {
        expect(isInReach(game, swamp, "C6")).toBe(true);
        expect(isInReach(game, swamp, "D8")).toBe(false);
        expect(isInReach(withPlayer(game, swamp, { sailing: 1 }), swamp, "D8")).toBe(true);
    });
});

describe("行动前的通用检查", () => {
    it("轮到你、没有待决策、还没做主行动：都通过", () => {
        expect(checkFreeAction(game, first)).toBeNull();
        expect(checkMainAction(game, first)).toBeNull();
    });
    it("不是你的回合：not-your-turn", () => {
        expect(checkFreeAction(game, second)).toBe("not-your-turn");
    });
    it("不在行动阶段：wrong-phase；游戏结束：game-over", () => {
        expect(checkFreeAction({ ...game, phase: "income" }, first)).toBe("wrong-phase");
        expect(checkFreeAction({ ...game, phase: "ended" }, first)).toBe("game-over");
    });
    it("还有待处理的决策：decision-pending", () => {
        const waiting = { ...game, pending: [{ id: "x", seat: second, kind: "leech" as const, from: first, power: 2, vpCost: 1 }] };
        expect(checkFreeAction(waiting, first)).toBe("decision-pending");
    });
    it("做过主行动：主行动不行（main-action-done），自由行动还可以", () => {
        const done = { ...game, turn: { ...game.turn!, mainActionDone: true } };
        expect(checkMainAction(done, first)).toBe("main-action-done");
        expect(checkFreeAction(done, first)).toBeNull();
    });
    it("turnOf：测试里直接跳到某人的回合", () => {
        expect(checkMainAction(turnOf(game, third), third)).toBeNull();
    });
});

describe("自动推进", () => {
    it("开局还有决策没处理（荒地要选书的颜色）：停在收入阶段，advance 不动它", () => {
        const waiting = readyGame([5, 0, 1]);
        expect(waiting.phase).toBe("income");
        expect(waiting.pending).toHaveLength(1);
        expect(advance(waiting)).toBe(waiting);
    });
    it("已经在行动阶段：advance 不动它", () => {
        expect(advance(game)).toBe(game);
    });
});