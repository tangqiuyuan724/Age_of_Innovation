import { describe, it, expect } from "vitest";
import {
    COMPETENCY_IDS, applyCompetency, applyDecide, applyUpgrade, competencyOptions, competencyPosition, createGame,
    validateCompetency, validateDecide, type GameState,
} from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer, withStructure } from "./fixtures.ts";

const base = readyGame();
const plains = seatOf(base, "plains");
const swamp = seatOf(base, "swamp");
const grid = base.board.competencyGrid;

describe("开局摆放", () => {
    it("12 种能力板块各占一格：4 门学科各一列，每列 3 格", () => {
        expect(Object.values(grid).every((column) => column.length === 3)).toBe(true);
        expect(Object.values(grid).flat().sort()).toEqual([...COMPETENCY_IDS].sort());
    });
    it("每种 4 张", () => {
        expect(Object.values(base.board.competenciesLeft)).toEqual(Array(12).fill(4));
    });
    it("同一个 seed 摆法一样，换一个 seed 摆法不一样", () => {
        const options = { playerCount: 3, mapId: "aoi-base", setupMode: { kind: "sets" as const } };
        expect(createGame(options, "m14").board.competencyGrid).toEqual(grid);
        expect(createGame(options, "another").board.competencyGrid).not.toEqual(grid);
    });
    it("competencyPosition：在哪一列、第几行", () => {
        expect(competencyPosition(base, grid.law[2])).toEqual({ discipline: "law", row: 2 });
    });
});

describe("能拿哪些", () => {
    it("一开始 12 种都能拿，按展示区一列一列排", () => {
        expect(competencyOptions(base, plains)).toEqual([...grid.banking, ...grid.law, ...grid.engineering, ...grid.medicine]);
    });
    it("自己已经有的不能再拿；被拿光的也不能拿", () => {
        const owned = withPlayer(base, plains, { competencies: [grid.banking[0]] });
        const empty = { ...owned, board: { ...owned.board, competenciesLeft: { ...owned.board.competenciesLeft, [grid.law[1]]: 0 } } };
        const options = competencyOptions(empty, plains);
        expect(options).toHaveLength(10);
        expect(options).not.toContain(grid.banking[0]);
        expect(options).not.toContain(grid.law[1]);
    });
});

describe("升级成学校、大学：排进选能力板块的决策", () => {
    const g = withPlayer(turnOf(withStructure(base, "C6", plains, "guild"), plains), plains, { tools: 10, coins: 20 });

    it("升学校：排进一个决策，选项是现在能拿的那些", () => {
        const { state } = applyUpgrade(g, plains, "C6", "school");
        expect(state.pending).toEqual([
            { id: `competency-${g.version}`, seat: plains, kind: "competency", options: competencyOptions(g, plains) },
        ]);
    });
    it("升大学：也要选", () => {
        const s = withStructure(g, "C6", plains, "school");
        expect(applyUpgrade(s, plains, "C6", "university").state.pending[0].kind).toBe("competency");
    });
    it("升行会、宫殿：不用选能力板块", () => {
        expect(applyUpgrade(withStructure(g, "C6", plains, "workshop"), plains, "C6", "guild").state.pending).toEqual([]);
        expect(applyUpgrade(g, plains, "C6", "palace").state.pending.map((d) => d.kind)).toEqual(["palaceTile"]);
    });
    it("一张都拿不了：不排决策", () => {
        const none = withPlayer(g, plains, { competencies: [...COMPETENCY_IDS] });
        expect(applyUpgrade(none, plains, "C6", "school").state.pending).toEqual([]);
    });
});

describe("选能力板块", () => {
    const g = withPlayer(turnOf(withStructure(base, "C6", plains, "guild"), plains), plains, { tools: 10, coins: 20 });
    const waiting = applyUpgrade(g, plains, "C6", "school").state;
    const p = waiting.players[plains];

    /** 从第 row 行、学科 d 那一列拿 */
    function take(d: "banking" | "law" | "engineering" | "medicine", row: number): GameState {
        return applyCompetency(waiting, plains, grid[d][row]).state;
    }

    it("能选的可以；不在选项里：invalid-choice；别人来选：not-your-decision", () => {
        expect(validateCompetency(waiting, plains, grid.law[0])).toBeNull();
        expect(validateCompetency(waiting, swamp, grid.law[0])).toBe("not-your-decision");
        const fewer = { ...waiting, pending: [{ id: "c", seat: plains, kind: "competency" as const, options: [grid.law[0]] }] };
        expect(validateCompetency(fewer, plains, grid.law[1])).toBe("invalid-choice");
    });
    it("第 1 行：这一列的学科前进 3 级，不给书", () => {
        const after = take("law", 0).players[plains];
        expect(after.science.law).toBe(p.science.law + 3);
        expect(after.books).toEqual(p.books);
    });
    it("第 2 行：前进 2 级，1 本这门学科的书", () => {
        const after = take("medicine", 1).players[plains];
        expect(after.science.medicine).toBe(p.science.medicine + 2);
        expect(after.books.medicine).toBe(p.books.medicine + 1);
    });
    it("第 3 行：前进 1 级，2 本这门学科的书", () => {
        const after = take("engineering", 2).players[plains];
        expect(after.science.engineering).toBe(p.science.engineering + 1);
        expect(after.books.engineering).toBe(p.books.engineering + 2);
    });
    it("板块归这位玩家，那一叠少一张，决策移出队列", () => {
        const after = take("law", 0);
        expect(after.players[plains].competencies).toEqual([grid.law[0]]);
        expect(after.board.competenciesLeft[grid.law[0]]).toBe(3);
        expect(after.pending).toEqual([]);
    });
    it("事件：拿板块、拿书、学科前进", () => {
        const { events } = applyCompetency(waiting, plains, grid.medicine[1]);
        expect(events).toEqual([
            { type: "tileTaken", seat: plains, tile: grid.medicine[1], kind: "competency" },
            { type: "resources", seat: plains, delta: { books: { medicine: 1 } }, reason: "competency" },
            { type: "science", seat: plains, discipline: "medicine", from: 0, to: 2 },
        ]);
    });
    it("通过 decide 回应也一样", () => {
        const d = waiting.pending[0];
        expect(validateDecide(waiting, plains, d.id, { kind: "competency", tile: grid.law[0] })).toBeNull();
        expect(applyDecide(waiting, plains, { kind: "competency", tile: grid.law[0] }).state).toEqual(take("law", 0));
    });
});