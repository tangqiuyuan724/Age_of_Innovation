import { describe, it, expect } from "vitest";
import { applyMove, createGame, getLegalMoves, type GameState, type Move, type SetupMode } from "@aoi/engine/aoi";
import { MoveSchema } from "../src/rooms/moveSchema.js";

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

/** 随便打一局，把每一步能走的所有指令都交给 check */
function playRandomGame(playerCount: number, setupMode: SetupMode, seed: number, check: (moves: Move[]) => void) {
    const random = randomFrom(seed);
    let state: GameState = createGame({ playerCount, mapId: "aoi-base", setupMode }, `schema-${seed}`);
    for (let step = 0; step < 3000 && state.phase !== "ended"; step++) {
        const seat = state.pending[0]?.seat ?? state.turn!.seat;
        const moves = getLegalMoves(state, seat);
        check(moves);
        // 有结束回合就结束回合，免得一直做自由行动
        const move = moves.find((m) => m.t === "endTurn") ?? moves[Math.floor(random() * moves.length)];
        state = applyMove(state, seat, move).state;
    }
    expect(state.phase).toBe("ended");
}

describe("MoveSchema：指令的格式检查", () => {
    it("随机打两局：每一步能走的每一条指令都能通过检查，检查完和原来一模一样", () => {
        let count = 0;
        const check = (moves: Move[]) => {
            for (const move of moves) {
                const result = MoveSchema.safeParse(move);
                expect(result.success, JSON.stringify(move)).toBe(true);
                expect(result.data).toEqual(move);
                count++;
            }
        };
        playRandomGame(3, { kind: "sets" }, 1, check);
        playRandomGame(4, { kind: "draft", order: "snake" }, 2, check);
        expect(count).toBeGreaterThan(1000);
    });

    it("形状不对的通不过", () => {
        const bad: unknown[] = [
            null,
            "endTurn",
            {},
            { t: "fly" },
            { t: "convert", conversion: "power1ToCoin" },               // 少了 times
            { t: "convert", conversion: "magic", times: 1 },            // 没有这种转换
            { t: "convert", conversion: "power1ToCoin", times: 0 },     // 至少 1 次
            { t: "upgrade", hex: 7, to: "guild" },                      // 格子编号要是字符串
            { t: "upgrade", hex: "E7", to: "castle" },                  // 没有这种建筑
            { t: "terraformAndBuild", hex: "E7", spades: "2", build: true },
            { t: "sendScholar", discipline: "law", space: 9 },
            { t: "bookAction", id: "power5", books: { law: -1 } },
            { t: "pass" },                                              // 第 6 轮也要写 bonusTile: null
            { t: "decide", id: "d1", choice: { kind: "leech" } },
            { t: "decide", id: "d1", choice: { kind: "spades", skip: false } },
        ];
        for (const move of bad) {
            expect(MoveSchema.safeParse(move).success, JSON.stringify(move)).toBe(false);
        }
    });

    it("多出来的字段会被去掉", () => {
        expect(MoveSchema.parse({ t: "endTurn", cheat: 999 })).toEqual({ t: "endTurn" });
    });
});