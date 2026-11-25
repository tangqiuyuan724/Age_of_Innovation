import { describe, it, expect } from "vitest";
import {
    advanceScience, applyDecide, gainPower, scienceCap, validateDecide, type GameState,
} from "../../src/aoi/index.ts";
import { readyGame, seatOf, withPlayer } from "./fixtures.ts";

const game = readyGame();
const plains = seatOf(game, "plains");
const swamp = seatOf(game, "swamp");
const p = game.players[plains];

/** 把平原玩家的法律学科设成 level，钥匙设成 keys */
function lawAt(level: number, keys = 0, state: GameState = game): GameState {
    return withPlayer(state, plains, { science: { ...p.science, law: level }, keys });
}

describe("学科前进", () => {
    it("开局：平原玩家是哲学家，银行学 2 级，其他 0 级", () => {
        expect(p.science).toEqual({ banking: 2, law: 0, engineering: 0, medicine: 0 });
    });
    it("银行学 2 → 4：经过 3 级，拿 1 点能量", () => {
        const { state, events } = advanceScience(game, plains, "banking", 2);
        expect(state.players[plains].science.banking).toBe(4);
        expect(state.players[plains].power).toEqual(gainPower(p.power, 1).bowls);
        expect(events).toEqual([
            { type: "science", seat: plains, discipline: "banking", from: 2, to: 4 },
            { type: "resources", seat: plains, delta: { power: 1 }, reason: "science" },
        ]);
    });
    it("一次经过好几个能量格：法律 0 → 7，拿 1 + 2 + 2 = 5 点能量", () => {
        const { state } = advanceScience(game, plains, "law", 7);
        expect(state.players[plains].science.law).toBe(7);
        expect(state.players[plains].power).toEqual(gainPower(p.power, 5).bowls);
    });
    it("从 3 级升到 4 级：3 级的能量已经拿过了，不会再拿一次", () => {
        const g = lawAt(3);
        const { state } = advanceScience(g, plains, "law", 1);
        expect(state.players[plains].power).toEqual(g.players[plains].power);
    });
    it("没经过能量格：只有学科事件", () => {
        const { events } = advanceScience(game, plains, "law", 1);
        expect(events).toEqual([{ type: "science", seat: plains, discipline: "law", from: 0, to: 1 }]);
    });
    it("不修改传入的状态", () => {
        advanceScience(game, plains, "law", 3);
        expect(game.players[plains].science.law).toBe(0);
    });
});

describe("城市钥匙和 12 级", () => {
    it("没有钥匙：最多到 7 级，多出来的作废", () => {
        expect(scienceCap(lawAt(6), plains, "law")).toBe(7);
        expect(advanceScience(lawAt(6), plains, "law", 3).state.players[plains].science.law).toBe(7);
    });
    it("有 1 把钥匙：可以越过 7 级", () => {
        expect(advanceScience(lawAt(6, 1), plains, "law", 3).state.players[plains].science.law).toBe(9);
    });
    it("唯一的钥匙已经用在银行学上：法律还是只能到 7", () => {
        const g = withPlayer(lawAt(6, 1), plains, { science: { ...p.science, banking: 8, law: 6 } });
        expect(scienceCap(g, plains, "law")).toBe(7);
        expect(scienceCap(g, plains, "banking")).toBe(12);
    });
    it("已经越过 7 级的学科，接着升不用再要钥匙", () => {
        expect(advanceScience(lawAt(8, 1), plains, "law", 2).state.players[plains].science.law).toBe(10);
    });
    it("升到 12 级：占住这门学科的 12 级，拿 3 点能量", () => {
        const { state } = advanceScience(lawAt(11, 1), plains, "law", 1);
        expect(state.board.level12.law).toBe(plains);
        expect(state.players[plains].power).toEqual(gainPower(p.power, 3).bowls);
    });
    it("别人已经占了 12 级：最多到 11", () => {
        const taken = { ...lawAt(10, 1), board: { ...game.board, level12: { ...game.board.level12, law: swamp } } };
        expect(advanceScience(taken, plains, "law", 3).state.players[plains].science.law).toBe(11);
    });
    it("已经到上限：状态原样返回，没有事件", () => {
        const g = lawAt(7);
        const result = advanceScience(g, plains, "law", 1);
        expect(result.state).toBe(g);
        expect(result.events).toEqual([]);
    });
});

describe("决策：选一门学科前进", () => {
    // 第 4 组是湖泊 + 蜥蜴：开局有 2 次"任选学科前进 1 级"
    const setup = readyGame([3, 0, 1]);
    const lizards = seatOf(setup, "lake");
    const d = setup.pending[0];

    it("开局结束后排着两个选学科的决策", () => {
        expect(setup.pending.map((x) => x.kind)).toEqual(["scienceLevels", "scienceLevels"]);
        expect(d).toEqual({ id: `setup-level-${lizards}-0`, seat: lizards, kind: "scienceLevels", levels: 1 });
    });
    it("选医学：医学 +1，这个决策移出队列", () => {
        expect(validateDecide(setup, lizards, d.id, { kind: "scienceLevels", discipline: "medicine" })).toBeNull();
        const before = setup.players[lizards].science.medicine;
        const { state } = applyDecide(setup, lizards, { kind: "scienceLevels", discipline: "medicine" });
        expect(state.players[lizards].science.medicine).toBe(before + 1);
        expect(state.pending).toHaveLength(1);
    });
    it("不是学科：invalid-choice；别人来选：not-your-decision", () => {
        const choice = { kind: "scienceLevels" as const, discipline: "magic" as "law" };
        expect(validateDecide(setup, lizards, d.id, choice)).toBe("invalid-choice");
        expect(validateDecide(setup, seatOf(setup, "plains"), d.id, { kind: "scienceLevels", discipline: "law" }))
            .toBe("not-your-decision");
    });
});