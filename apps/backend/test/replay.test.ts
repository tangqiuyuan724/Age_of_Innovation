import { describe, it, expect } from "vitest";
import { applyMove, createGame, getLegalMoves, type GameState, type Move, type Seat, type SetupOptions } from "@aoi/engine/aoi";
import { replay } from "../src/rooms/replay.js";
import type { SavedGame } from "../src/rooms/store.js";

/** 测试用的随机数：同一个种子每次挑的都一样 */
function randomFrom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** 随便走 steps 步，返回走完的局面和每一步的指令（就是存档里存的东西） */
function playRandom(options: SetupOptions, seed: string, steps: number) {
    const random = randomFrom(3);
    let state: GameState = createGame(options, seed);
    const moves: { seat: Seat; move: Move }[] = [];
    for (let i = 0; i < steps && state.phase !== "ended"; i++) {
        const seat = state.pending[0]?.seat ?? state.turn!.seat;
        const legal = getLegalMoves(state, seat);
        const move = legal.find((m) => m.t === "endTurn") ?? legal[Math.floor(random() * legal.length)];
        state = applyMove(state, seat, move).state;
        moves.push({ seat, move });
    }
    return { state, moves };
}

const options: SetupOptions = { playerCount: 3, mapId: "aoi-base", setupMode: { kind: "draft", order: "snake" } };

function saved(moves: { seat: Seat; move: Move }[]): SavedGame {
    return { code: "ABCDE", options, seed: "replay-test", seats: [], contractVersion: 8, moves };
}

describe("replay：用存档把局面重新算出来", () => {
    it("重放出来的局面和一步步走出来的一模一样", () => {
        const live = playRandom(options, "replay-test", 150);
        const { state, steps } = replay(saved(live.moves));
        expect(state).toEqual(live.state);
        expect(steps).toHaveLength(live.moves.length);
        expect(steps.map((s) => s.move)).toEqual(live.moves.map((m) => m.move));
    });

    it("没有指令：就是刚开局的局面", () => {
        expect(replay(saved([])).state).toEqual(createGame(options, "replay-test"));
    });

    it("某一步引擎不认：抛错，说明是第几步", () => {
        const live = playRandom(options, "replay-test", 10);
        const broken = [...live.moves];
        broken[4] = { seat: broken[4].seat, move: { t: "pass", bonusTile: null } };
        expect(() => replay(saved(broken))).toThrow("第 5 步");
    });
});