import { describe, it, expect } from "vitest";
import {
    applyDecide, applyPowerAction, validateDecide, validatePowerAction, type PowerActionId,
} from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer } from "./fixtures.ts";

// 平原玩家的工坊在 C6 和 E1，碗 III 里放 7 点能量
const base = readyGame();
const plains = seatOf(base, "plains");
const swamp = seatOf(base, "swamp");
const game = withPlayer(turnOf(base, plains), plains, { power: [0, 5, 7], tools: 10, coins: 20 });
const check = (id: PowerActionId) => validatePowerAction(game, plains, id);

describe("能量行动：直接拿资源", () => {
    it("7 金币：花 4 点能量（碗 III → 碗 I），金币 +7，这一格盖上 X，主行动做完了", () => {
        expect(check("coins7")).toBeNull();
        const { state, events } = applyPowerAction(game, plains, "coins7");
        const p = state.players[plains];
        expect(p.coins).toBe(27);
        expect(p.power).toEqual([4, 5, 3]);
        expect(state.board.powerActionsUsed).toEqual(["coins7"]);
        expect(state.turn!.mainActionDone).toBe(true);
        expect(state.pending).toEqual([]);
        expect(events).toEqual([{ type: "resources", seat: plains, delta: { coins: 7, power: -4 }, reason: "powerAction" }]);
    });
    it("2 工具：花 4 点能量", () => {
        const { state } = applyPowerAction(game, plains, "tools2");
        expect(state.players[plains].tools).toBe(12);
        expect(state.players[plains].power).toEqual([4, 5, 3]);
    });
    it("1 学者：花 3 点能量，学者从个人供应区拿", () => {
        const { state } = applyPowerAction(game, plains, "scholar");
        const before = game.players[plains];
        expect(state.players[plains].scholars).toBe(before.scholars + 1);
        expect(state.players[plains].scholarsInSupply).toBe(before.scholarsInSupply - 1);
        expect(state.players[plains].power).toEqual([3, 5, 4]);
    });
    it("7 个学者都拿出来了也能做：能量照样花掉，学者拿不到", () => {
        const none = withPlayer(game, plains, { scholarsInSupply: 0 });
        expect(validatePowerAction(none, plains, "scholar")).toBeNull();
        const { state, events } = applyPowerAction(none, plains, "scholar");
        expect(state.players[plains].scholars).toBe(none.players[plains].scholars);
        expect(state.players[plains].power).toEqual([3, 5, 4]);
        expect(events).toEqual([{ type: "resources", seat: plains, delta: { power: -3 }, reason: "powerAction" }]);
    });
});

describe("能量行动：铲子和建桥", () => {
    it("1 铲：花 4 点能量，排一个能顺带建工坊的免费铲子决策", () => {
        const { state } = applyPowerAction(game, plains, "spade1");
        expect(state.pending).toEqual([
            { id: `spades-${game.version}`, seat: plains, kind: "spades", spades: 1, canBuild: true },
        ]);
        expect(state.players[plains].power).toEqual([4, 5, 3]);
    });
    it("接着把铲子用在 D5，建工坊", () => {
        const { state } = applyPowerAction(game, plains, "spade1");
        const id = state.pending[0].id;
        expect(validateDecide(state, plains, id, { kind: "spades", hex: "D5", build: true })).toBeNull();
        const { state: after } = applyDecide(state, plains, { kind: "spades", hex: "D5", build: true });
        expect(after.hexes.D5.structure?.type).toBe("workshop");
        expect(after.turn!.builtHexes).toEqual(["D5"]);
    });
    it("2 铲：花 6 点能量", () => {
        const { state } = applyPowerAction(game, plains, "spade2");
        expect(state.pending[0]).toMatchObject({ kind: "spades", spades: 2, canBuild: true });
        expect(state.players[plains].power).toEqual([6, 5, 1]);
    });
    it("建桥：沼泽玩家能在 C7—D8 架桥，花 3 点能量，排一个建桥决策", () => {
        const s = withPlayer(turnOf(base, swamp), swamp, { power: [0, 0, 5] });
        expect(validatePowerAction(s, swamp, "bridge")).toBeNull();
        const { state } = applyPowerAction(s, swamp, "bridge");
        expect(state.pending).toEqual([{ id: `bridge-${s.version}`, seat: swamp, kind: "bridge" }]);
        expect(state.players[swamp].power).toEqual([3, 0, 2]);
    });
    it("平原玩家没有地方能架桥也能做：能量照样花掉，之后只能放弃建桥", () => {
        expect(check("bridge")).toBeNull();
        const { state } = applyPowerAction(game, plains, "bridge");
        expect(state.players[plains].power).toEqual([3, 5, 4]);
        expect(state.board.powerActionsUsed).toEqual(["bridge"]);
        const { state: after } = applyDecide(state, plains, { kind: "bridge", skip: true });
        expect(after.pending).toEqual([]);
        expect(after.turn!.mainActionDone).toBe(true);
    });
});

describe("能量行动：不能做的情况", () => {
    it("这一格本轮已经有人用过了：action-taken", () => {
        const used = { ...game, board: { ...game.board, powerActionsUsed: ["coins7" as const] } };
        expect(validatePowerAction(used, plains, "coins7")).toBe("action-taken");
        expect(validatePowerAction(used, plains, "tools2")).toBeNull();
    });
    it("碗 III 不够：insufficient-power", () => {
        const poor = withPlayer(game, plains, { power: [0, 9, 3] });
        expect(validatePowerAction(poor, plains, "coins7")).toBe("insufficient-power");
        expect(validatePowerAction(poor, plains, "scholar")).toBeNull();
    });
    it("做过主行动了：main-action-done；不是自己的回合：not-your-turn", () => {
        const { state } = applyPowerAction(game, plains, "coins7");
        expect(validatePowerAction(state, plains, "tools2")).toBe("main-action-done");
        expect(validatePowerAction(game, swamp, "tools2")).toBe("not-your-turn");
    });
    it("没有这个能量行动：bad-move", () => {
        expect(check("fly" as PowerActionId)).toBe("bad-move");
        expect(check("toString" as PowerActionId)).toBe("bad-move");
    });
});