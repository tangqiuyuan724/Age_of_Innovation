import { describe, it, expect } from "vitest";
import { applyPass, validatePass, type BonusTileOnBoard, type GameState } from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer, withStructure } from "./fixtures.ts";

// 平原玩家手上是 coins6，工坊在 C6 和 E1。场上摆 3 块回合奖励板块，上面积攒的金币不一样
const base = readyGame();
const plains = seatOf(base, "plains");
const swamp = seatOf(base, "swamp");
const TILES: BonusTileOnBoard[] = [
    { id: "spadeAction", coins: 2 },
    { id: "riverWorkshop", coins: 0 },
    { id: "bridgeAction", coins: 1 },
];
const ready = turnOf(base, plains);
const game: GameState = { ...ready, board: { ...ready.board, bonusTiles: TILES } };

describe("pass：换回合奖励板块", () => {
    it("拿走 spadeAction 和上面的 2 金币；coins6 放回场上，金币清零；记下 pass 的先后", () => {
        expect(validatePass(game, plains, "spadeAction")).toBeNull();
        const { state, events } = applyPass(game, plains, "spadeAction");
        const p = state.players[plains];
        expect(p.bonusTile).toBe("spadeAction");
        expect(p.coins).toBe(game.players[plains].coins + 2);
        expect(p.passed).toBe(true);
        expect(state.board.bonusTiles).toEqual([
            { id: "riverWorkshop", coins: 0 },
            { id: "bridgeAction", coins: 1 },
            { id: "coins6", coins: 0 },
        ]);
        expect(state.nextTurnOrder).toEqual([plains]);
        expect(state.turn!.mainActionDone).toBe(true);
        expect(events).toEqual([
            { type: "tileTaken", seat: plains, tile: "spadeAction", kind: "bonus" },
            { type: "resources", seat: plains, delta: { coins: 2 }, reason: "bonusTile" },
            { type: "passed", seat: plains, bonusTile: "spadeAction" },
        ]);
    });
    it("后 pass 的人排在后面", () => {
        const first = applyPass(game, plains, "spadeAction").state;
        const second = applyPass({ ...first, turn: { seat: swamp, mainActionDone: false, builtHexes: [] } }, swamp, "coins6");
        expect(second.state.nextTurnOrder).toEqual([plains, swamp]);
        expect(second.state.players[swamp].bonusTile).toBe("coins6");
    });
    it("场上没有这块：tile-unavailable；第 1~5 轮不拿板块：bad-move", () => {
        expect(validatePass(game, plains, "guildBuild")).toBe("tile-unavailable"); // 在沼泽玩家手上
        expect(validatePass(game, plains, null)).toBe("bad-move");
    });
    it("做过主行动了：main-action-done", () => {
        const { state } = applyPass(game, plains, "spadeAction");
        expect(validatePass(state, plains, "riverWorkshop")).toBe("main-action-done");
    });
});

describe("pass 奖励", () => {
    it("bigBuildingsPass：每座大学、宫殿 4 分", () => {
        let s = withPlayer(game, plains, { bonusTile: "bigBuildingsPass" });
        s = withStructure(withStructure(s, "C6", plains, "palace"), "E1", plains, "university");
        const { state, events } = applyPass(s, plains, "riverWorkshop");
        expect(state.players[plains].vp).toBe(game.players[plains].vp + 8);
        expect(events[0]).toEqual({ type: "resources", seat: plains, delta: { vp: 8 }, reason: "pass" });
        expect(state.board.bonusTiles.at(-1)).toEqual({ id: "bigBuildingsPass", coins: 0 });
    });
    it("schoolsPass：每座学校选一门学科前进 1 级（一座一个决策）", () => {
        let s = withPlayer(game, plains, { bonusTile: "schoolsPass" });
        s = withStructure(withStructure(s, "C6", plains, "school"), "E1", plains, "school");
        const { state } = applyPass(s, plains, "riverWorkshop");
        expect(state.pending).toEqual([
            { id: `pass-${s.version}-0`, seat: plains, kind: "scienceLevels", levels: 1 },
            { id: `pass-${s.version}-1`, seat: plains, kind: "scienceLevels", levels: 1 },
        ]);
    });
    it("一座都没有：什么都不给", () => {
        const s = withPlayer(game, plains, { bonusTile: "bigBuildingsPass" });
        const { state, events } = applyPass(s, plains, "riverWorkshop");
        expect(state.players[plains].vp).toBe(game.players[plains].vp);
        expect(events.some((e) => e.type === "resources" && e.reason === "pass")).toBe(false);
    });
});

describe("第 6 轮的 pass", () => {
    const last = { ...game, round: 6 };
    it("不拿新板块：只能传 null", () => {
        expect(validatePass(last, plains, null)).toBeNull();
        expect(validatePass(last, plains, "spadeAction")).toBe("bad-move");
    });
    it("板块留在手上，场上不变；pass 奖励照样拿", () => {
        let s = withPlayer(last, plains, { bonusTile: "bigBuildingsPass" });
        s = withStructure(s, "C6", plains, "palace");
        const { state, events } = applyPass(s, plains, null);
        expect(state.players[plains].bonusTile).toBe("bigBuildingsPass");
        expect(state.players[plains].vp).toBe(game.players[plains].vp + 4);
        expect(state.board.bonusTiles).toEqual(TILES);
        expect(state.players[plains].passed).toBe(true);
        expect(events.at(-1)).toEqual({ type: "passed", seat: plains, bonusTile: null });
    });
});