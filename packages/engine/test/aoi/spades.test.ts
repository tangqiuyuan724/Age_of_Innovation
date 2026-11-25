import { describe, it, expect } from "vitest";
import { applyDecide, validateDecide, type Decision, type GameState, type HexId } from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer } from "./fixtures.ts";

// 平原玩家的工坊在 C6 和 E1。C6 旁边：D5 沙漠（离平原 1 铲）、D6 荒地（2 铲）、C5 山地（3 铲）
const base = readyGame();
const plains = seatOf(base, "plains");
const game = withPlayer(turnOf(base, plains), plains, { tools: 10, coins: 20 });

/** 在队列里放一个免费铲子决策（就像刚做完能量行动"1 铲"） */
function withSpades(state: GameState, spades: number, canBuild: boolean): GameState {
    const d: Decision = { id: "sp", seat: plains, kind: "spades", spades, canBuild };
    return { ...state, pending: [d] };
}
const check = (state: GameState, hex: HexId, build: boolean) =>
    validateDecide(state, plains, "sp", { kind: "spades", hex, build });
const use = (state: GameState, hex: HexId, build: boolean) =>
    applyDecide(state, plains, { kind: "spades", hex, build });

describe("免费铲子顺带建工坊", () => {
    it("1 把免费铲子用在 D5：改成平原、建工坊，只付工坊的 1 工具 2 金币", () => {
        const s = withSpades(game, 1, true);
        expect(check(s, "D5", true)).toBeNull();
        const { state, events } = use(s, "D5", true);
        const p = state.players[plains];
        expect(state.hexes.D5).toEqual({
            terrain: "plains",
            structure: { owner: plains, type: "workshop", neutral: false, annex: false, city: null },
        });
        expect(p.tools).toBe(9);
        expect(p.coins).toBe(18);
        expect(p.buildingsLeft.workshop).toBe(game.players[plains].buildingsLeft.workshop - 1);
        expect(state.turn!.builtHexes).toEqual(["D5"]); // 回合结束时从这里发起吸能
        expect(state.pending).toEqual([]);
        expect(events).toEqual([
            { type: "terraformed", seat: plains, hex: "D5", from: "desert", to: "plains" },
            { type: "built", seat: plains, hex: "D5", structure: "workshop" },
            { type: "resources", seat: plains, delta: { tools: -1, coins: -2 }, reason: "build" },
        ]);
    });
    it("D6 要 2 铲，免费的只有 1 把：缺的 1 铲用 3 个工具买，再加工坊", () => {
        const { state } = use(withSpades(game, 1, true), "D6", true);
        expect(state.hexes.D6.terrain).toBe("plains");
        expect(state.players[plains].tools).toBe(10 - 3 - 1);
        expect(state.players[plains].coins).toBe(18);
    });
    it("3 把免费铲子正好把 C5（山地）改成平原，只付工坊", () => {
        const { state } = use(withSpades(game, 3, true), "C5", true);
        expect(state.hexes.C5.terrain).toBe("plains");
        expect(state.players[plains].tools).toBe(9);
    });
    it("工具不够买缺的铲子：insufficient-resources；工坊用完了：limit-reached", () => {
        const poor = withSpades(withPlayer(game, plains, { tools: 3 }), 1, true);
        expect(check(poor, "D6", true)).toBe("insufficient-resources");
        expect(check(poor, "D5", true)).toBeNull();
        const left = { ...game.players[plains].buildingsLeft, workshop: 0 };
        expect(check(withSpades(withPlayer(game, plains, { buildingsLeft: left }), 1, true), "D5", true)).toBe("limit-reached");
    });
    it("这个决策不让建（比如沙漠开局的铲子）：invalid-choice", () => {
        expect(check(withSpades(game, 1, false), "D5", true)).toBe("invalid-choice");
    });
});

describe("只改造、不建", () => {
    it("1 把铲子用在 D6：朝平原走一步变成沙漠，没有剩下的铲子", () => {
        const { state, events } = use(withSpades(game, 1, true), "D6", false);
        expect(state.hexes.D6).toEqual({ terrain: "desert", structure: null });
        expect(state.players[plains].tools).toBe(10); // 不建就不能另外买铲子，什么都不付
        expect(state.turn!.builtHexes).toEqual([]);
        expect(state.pending).toEqual([]);
        expect(events).toEqual([{ type: "terraformed", seat: plains, hex: "D6", from: "wasteland", to: "desert" }]);
    });
});

describe("一格用不完的铲子", () => {
    it("2 把铲子在 D5 只用掉 1 把：剩下 1 把排成新决策，不能再建", () => {
        const { state } = use(withSpades(game, 2, true), "D5", true);
        expect(state.pending).toEqual([{ id: "sp-rest", seat: plains, kind: "spades", spades: 1, canBuild: false }]);
    });
    it("剩下的铲子用在 D6：变成沙漠；想在那里建工坊：invalid-choice", () => {
        const { state } = use(withSpades(game, 2, true), "D5", true);
        const again = (hex: HexId, build: boolean) =>
            validateDecide(state, plains, "sp-rest", { kind: "spades", hex, build });
        expect(again("D6", true)).toBe("invalid-choice");
        expect(again("D6", false)).toBeNull();
        const { state: after } = applyDecide(state, plains, { kind: "spades", hex: "D6", build: false });
        expect(after.hexes.D6.terrain).toBe("desert");
        expect(after.pending).toEqual([]);
    });
    it("不建也一样：3 把铲子在 D5 用掉 1 把，剩 2 把", () => {
        const { state } = use(withSpades(game, 3, true), "D5", false);
        expect(state.hexes.D5).toEqual({ terrain: "plains", structure: null });
        expect(state.pending).toEqual([{ id: "sp-rest", seat: plains, kind: "spades", spades: 2, canBuild: false }]);
    });
});