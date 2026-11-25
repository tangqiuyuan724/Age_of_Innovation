import { describe, it, expect } from "vitest";
import { applySendScholar, validateSendScholar } from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer } from "./fixtures.ts";

const base = readyGame();
const plains = seatOf(base, "plains");
const swamp = seatOf(base, "swamp");
const game = withPlayer(turnOf(base, plains), plains, { scholars: 2, scholarsInSupply: 5 });

describe("派学者：能不能做", () => {
    it("有学者、格子空着：可以；退回供应区：也可以", () => {
        expect(validateSendScholar(game, plains, "law", 0)).toBeNull();
        expect(validateSendScholar(game, plains, "law", "return")).toBeNull();
    });
    it("手上没有学者：insufficient-resources", () => {
        expect(validateSendScholar(withPlayer(game, plains, { scholars: 0 }), plains, "law", 1))
            .toBe("insufficient-resources");
    });
    it("格子已经有人了：space-occupied", () => {
        const taken = {
            ...game,
            board: { ...game.board, scholarSpaces: { ...game.board.scholarSpaces, law: [swamp, null, null, null] } },
        };
        expect(validateSendScholar(taken, plains, "law", 0)).toBe("space-occupied");
        expect(validateSendScholar(taken, plains, "law", 1)).toBeNull();
    });
    it("格子编号不对、不是学科：bad-move", () => {
        expect(validateSendScholar(game, plains, "law", 4)).toBe("bad-move");
        expect(validateSendScholar(game, plains, "law", 1.5)).toBe("bad-move");
        expect(validateSendScholar(game, plains, "magic" as "law", 0)).toBe("bad-move");
    });
    it("不是你的回合：not-your-turn", () => {
        expect(validateSendScholar(game, swamp, "law", 0)).toBe("not-your-turn");
    });
});

describe("派学者：执行", () => {
    it("放到第 1 格：前进 3 级，学者留在格子上，不回供应区", () => {
        const { state } = applySendScholar(game, plains, "law", 0);
        const p = state.players[plains];
        expect(p.science.law).toBe(3);
        expect(p.scholars).toBe(1);
        expect(p.scholarsInSupply).toBe(5);
        expect(state.board.scholarSpaces.law).toEqual([plains, null, null, null]);
    });
    it("放到其他格：前进 2 级", () => {
        const { state } = applySendScholar(game, plains, "medicine", 2);
        expect(state.players[plains].science.medicine).toBe(2);
        expect(state.board.scholarSpaces.medicine).toEqual([null, null, plains, null]);
    });
    it("退回供应区：前进 1 级，学者回到供应区，学者格不变", () => {
        const { state } = applySendScholar(game, plains, "law", "return");
        const p = state.players[plains];
        expect(p.science.law).toBe(1);
        expect(p.scholars).toBe(1);
        expect(p.scholarsInSupply).toBe(6);
        expect(state.board.scholarSpaces).toEqual(game.board.scholarSpaces);
    });
    it("主行动做过了；事件：付学者、学科前进、经过 3 级拿能量", () => {
        const { state, events } = applySendScholar(game, plains, "law", 0);
        expect(state.turn!.mainActionDone).toBe(true);
        expect(events).toEqual([
            { type: "resources", seat: plains, delta: { scholars: -1 }, reason: "sendScholar" },
            { type: "science", seat: plains, discipline: "law", from: 0, to: 3 },
            { type: "resources", seat: plains, delta: { power: 1 }, reason: "science" },
        ]);
    });
    it("学科已经到上限：学者照样放上去，等级作废", () => {
        const capped = withPlayer(game, plains, { science: { ...game.players[plains].science, law: 7 } });
        const { state } = applySendScholar(capped, plains, "law", 0);
        expect(state.players[plains].science.law).toBe(7);
        expect(state.board.scholarSpaces.law[0]).toBe(plains);
    });
});