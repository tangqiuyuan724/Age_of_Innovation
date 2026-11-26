import { describe, it, expect } from "vitest";
import {
    applyMove, bookSplits, createGame, getLegalMoves, toPublicState, validateMove,
    type GameState, type Move,
} from "../../src/aoi/index.ts";
import { readyGame, seatOf, withPlayer } from "./fixtures.ts";

const game = readyGame();
const active = game.turn!.seat;
const other = game.players.find((p) => p.seat !== active)!.seat;
const kinds = (moves: Move[]) => new Set(moves.map((m) => m.t));

describe("书的分法", () => {
    it("2 本书分到 4 种颜色：10 种分法，每种加起来都是 2", () => {
        const splits = bookSplits(2);
        expect(splits).toHaveLength(10);
        for (const b of splits) expect(Object.values(b).reduce((a, n) => a + (n ?? 0), 0)).toBe(2);
        expect(splits).toContainEqual({ banking: 2 });
        expect(splits).toContainEqual({ law: 1, medicine: 1 });
    });
    it("每种颜色有上限：只有 1 本法律书、1 本医学书，付 2 本只有一种付法", () => {
        expect(bookSplits(2, { banking: 0, law: 1, engineering: 0, medicine: 1 })).toEqual([{ law: 1, medicine: 1 }]);
    });
});

describe("能做的指令", () => {
    it("列出来的每一条，引擎都认", () => {
        const moves = getLegalMoves(game, active);
        expect(moves.length).toBeGreaterThan(10);
        for (const m of moves) expect(validateMove(game, active, m)).toBeNull();
    });
    it("轮到的人：有改造建造、推进轨道、pass，还没做主行动不能结束回合", () => {
        const k = kinds(getLegalMoves(game, active));
        expect(k.has("terraformAndBuild")).toBe(true);
        expect(k.has("pass")).toBe(true);
        expect(k.has("endTurn")).toBe(false);
    });
    it("pass：场上每块回合奖励板块各一条", () => {
        const passes = getLegalMoves(game, active).filter((m) => m.t === "pass");
        expect(passes).toHaveLength(game.board.bonusTiles.length);
    });
    it("没轮到的人：什么都不能做", () => {
        expect(getLegalMoves(game, other)).toEqual([]);
    });
    it("做完主行动：可以结束回合，不能再做主行动", () => {
        const s: GameState = { ...game, turn: { ...game.turn!, mainActionDone: true } };
        const k = kinds(getLegalMoves(s, active));
        expect(k.has("endTurn")).toBe(true);
        expect(k.has("terraformAndBuild")).toBe(false);
        expect(k.has("pass")).toBe(false);
    });
    it("有能量时可以转换：只列做 1 次的", () => {
        const s = withPlayer(game, active, { power: [0, 0, 5] });
        const converts = getLegalMoves(s, active).filter((m) => m.t === "convert");
        expect(converts.length).toBeGreaterThan(0);
        for (const m of converts) expect(m.t === "convert" && m.times).toBe(1);
    });
    it("游戏结束了：什么都不能做", () => {
        expect(getLegalMoves({ ...game, phase: "ended" }, active)).toEqual([]);
    });
});

describe("等人做决定时", () => {
    it("开局选组合：等的那个人有 7 种选法，别人没有", () => {
        const s = createGame({ playerCount: 3, mapId: "aoi-base", setupMode: { kind: "sets" } }, "legal");
        const seat = s.pending[0].seat;
        expect(getLegalMoves(s, seat)).toHaveLength(7);
        expect(getLegalMoves(s, (seat + 1) % 3)).toEqual([]);
    });
    it("选学科前进：4 门学科 + 放弃", () => {
        const plains = seatOf(game, "plains");
        const s: GameState = {
            ...game,
            pending: [{ id: "t", seat: plains, kind: "scienceLevels", levels: 1 }],
        };
        const moves = getLegalMoves(s, plains);
        expect(moves).toHaveLength(5);
        const next = applyMove(s, plains, moves[0]).state;
        expect(next.pending).toEqual([]);
    });
});

describe("发给客户端的状态", () => {
    it("去掉随机数生成器的状态，别的都不变", () => {
        const pub = toPublicState(game);
        expect(pub.rng).toBe(0);
        expect({ ...pub, rng: game.rng }).toEqual(game);
    });
});