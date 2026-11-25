import { describe, it, expect } from "vitest";
import { applySpecialAction, validateDecide, validateSpecialAction } from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer } from "./fixtures.ts";

// 森林玩家开局拿的是"任选学科前进 1 级"（levelAction）；平原玩家拿的 coins6 没有特殊行动
const base = readyGame();
const plains = seatOf(base, "plains");
const swamp = seatOf(base, "swamp");
const forest = seatOf(base, "forest");

describe("特殊行动：学科前进 1 级", () => {
    const game = turnOf(base, forest);
    it("排一个前进 1 级的决策；记下本轮用过了；主行动做完了", () => {
        expect(validateSpecialAction(game, forest, "bonus:levelAction")).toBeNull();
        const { state } = applySpecialAction(game, forest, "bonus:levelAction");
        expect(state.pending).toEqual([{ id: `special-${game.version}`, seat: forest, kind: "scienceLevels", levels: 1 }]);
        expect(state.players[forest].specialsUsed).toEqual(["bonus:levelAction"]);
        expect(state.turn!.mainActionDone).toBe(true);
    });
    it("本轮已经用过：action-taken", () => {
        const used = withPlayer(game, forest, { specialsUsed: ["bonus:levelAction"] });
        expect(validateSpecialAction(used, forest, "bonus:levelAction")).toBe("action-taken");
    });
    it("做过主行动了：main-action-done", () => {
        const { state } = applySpecialAction(game, forest, "bonus:levelAction");
        expect(validateSpecialAction({ ...state, pending: [] }, forest, "bonus:levelAction")).toBe("main-action-done");
    });
});

describe("特殊行动：免费 1 铲、免费建桥", () => {
    it("1 铲：排一个能顺带建工坊的 1 铲决策", () => {
        const game = withPlayer(turnOf(base, plains), plains, { bonusTile: "spadeAction" });
        const { state } = applySpecialAction(game, plains, "bonus:spadeAction");
        expect(state.pending).toEqual([{ id: `special-${game.version}`, seat: plains, kind: "spades", spades: 1, canBuild: true }]);
    });
    it("建桥：沼泽玩家能在 C7—D8 架桥，排一个建桥决策", () => {
        const game = withPlayer(turnOf(base, swamp), swamp, { bonusTile: "bridgeAction" });
        expect(validateSpecialAction(game, swamp, "bonus:bridgeAction")).toBeNull();
        const { state } = applySpecialAction(game, swamp, "bonus:bridgeAction");
        expect(state.pending).toEqual([{ id: `special-${game.version}`, seat: swamp, kind: "bridge" }]);
    });
    it("3 座桥都建完了也能做，之后放弃建桥", () => {
        const game = withPlayer(turnOf(base, swamp), swamp, { bonusTile: "bridgeAction", bridges: 0 });
        expect(validateSpecialAction(game, swamp, "bonus:bridgeAction")).toBeNull();
        const { state } = applySpecialAction(game, swamp, "bonus:bridgeAction");
        expect(validateDecide(state, swamp, state.pending[0].id, { kind: "bridge", skip: true })).toBeNull();
    });
});

describe("特殊行动：来源不对", () => {
    const game = turnOf(base, plains);
    it("手上的板块没有特殊行动、不是自己手上的板块、写错格式：bad-move", () => {
        expect(validateSpecialAction(game, plains, "bonus:coins6")).toBe("bad-move");
        expect(validateSpecialAction(game, plains, "bonus:levelAction")).toBe("bad-move");
        expect(validateSpecialAction(game, plains, "levelAction")).toBe("bad-move");
    });
});