import { describe, it, expect } from "vitest";
import { applyMove, createGame, validateMove, type GameState, type HexId, type Move, type Seat } from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer, withStructure } from "./fixtures.ts";

const game = readyGame();
const first = game.turnOrder[0];
const second = game.turnOrder[1];
const toCoin: Move = { t: "convert", conversion: "toolToCoin", times: 1 };

describe("validateMove / applyMove：按指令种类分给各自的函数", () => {
    const plains = seatOf(game, "plains");
    const swamp = seatOf(game, "swamp");
    const g = withPlayer(turnOf(game, plains), plains, { tools: 10, coins: 20 });

    it("改造并建造", () => {
        const move: Move = { t: "terraformAndBuild", hex: "D5", spades: 1, build: true };
        expect(validateMove(g, plains, move)).toBeNull();
        expect(applyMove(g, plains, move).state.hexes.D5.structure!.owner).toBe(plains);
    });
    it("升级", () => {
        const move: Move = { t: "upgrade", hex: "C6", to: "guild" };
        expect(validateMove(g, plains, move)).toBeNull();
        expect(applyMove(g, plains, move).state.hexes.C6.structure!.type).toBe("guild");
    });
    it("结束回合，再由下一个人回应吸能", () => {
        const withGuild = withStructure(g, "C7", swamp, "guild");
        const upgraded = applyMove(withGuild, plains, { t: "upgrade", hex: "C6", to: "guild" }).state;
        const { state } = applyMove(upgraded, plains, { t: "endTurn" });
        const id = state.pending[0].id;
        const answer: Move = { t: "decide", id, choice: { kind: "leech", accept: true } };
        expect(validateMove(state, swamp, answer)).toBeNull();
        expect(applyMove(state, swamp, answer).state.pending).toEqual([]);
    });
        it("还没实现的主行动（研发创新板块在 M3）：bad-move", () => {
        expect(validateMove(game, first, { t: "developInnovation", tile: "x", books: {} })).toBe("bad-move");
    });
    it("每执行一条指令，version 加 1；传入的状态不变", () => {
        const { state } = applyMove(game, first, toCoin);
        expect(state.version).toBe(game.version + 1);
        expect(game.players[first].tools).toBe(state.players[first].tools + 1);
    });
});

describe("自由行动：资源转换", () => {
    it("转换成功：资源变了，主行动还没做", () => {
        const { state } = applyMove(game, first, { t: "convert", conversion: "toolToCoin", times: 2 });
        expect(state.players[first].coins).toBe(game.players[first].coins + 2);
        expect(state.turn!.mainActionDone).toBe(false);
    });
    it("不是你的回合：not-your-turn", () => {
        expect(validateMove(game, second, toCoin)).toBe("not-your-turn");
    });
    it("次数不对、缺颜色：bad-move", () => {
        expect(validateMove(game, first, { t: "convert", conversion: "toolToCoin", times: 0 })).toBe("bad-move");
        expect(validateMove(game, first, { t: "convert", conversion: "bookToCoin", times: 1 })).toBe("bad-move");
    });
    it("资源不够：insufficient-resources", () => {
        expect(validateMove(withPlayer(game, first, { tools: 0 }), first, toCoin)).toBe("insufficient-resources");
    });
});

describe("自由行动：牺牲能量", () => {
    const swamp = seatOf(game, "swamp");
    const state = turnOf(game, swamp);

    it("每次：碗 II 里 1 个移出游戏、1 个移到碗 III", () => {
        const before = state.players[swamp].power;
        const { state: after } = applyMove(state, swamp, { t: "sacrificePower", times: 2 });
        expect(after.players[swamp].power).toEqual([before[0], before[1] - 4, before[2] + 2]);
    });
    it("碗 II 不够：insufficient-power；次数不对：bad-move", () => {
        expect(validateMove(state, swamp, { t: "sacrificePower", times: 9 })).toBe("insufficient-power");
        expect(validateMove(state, swamp, { t: "sacrificePower", times: 0 })).toBe("bad-move");
    });
});

describe("自动推进", () => {
    it("回应开局最后一个决策：自动拿收入、开始第 1 轮", () => {
        const waiting = readyGame([5, 0, 1]); // 荒地要选书的颜色
        const waste = seatOf(waiting, "wasteland");
        const move: Move = { t: "decide", id: waiting.pending[0].id, choice: { kind: "bookColor", books: { law: 1 } } };
        const { state } = applyMove(waiting, waste, move);
        expect(state.phase).toBe("actions");
        expect(state.turn!.seat).toBe(state.turnOrder[0]);
        expect(state.players[waste].coins).toBeGreaterThan(waiting.players[waste].coins); // 拿过收入了
    });
    it("从新开一局开始，全程只用 applyMove 也能走到第 1 轮的行动阶段", () => {
        let state: GameState = createGame({ playerCount: 3, mapId: "aoi-base", setupMode: { kind: "sets" } }, "m14");
        let steps = 0;
        while (state.phase !== "actions" && steps < 50) {
            const d = state.pending[0];
            const choice =
                d.kind === "pickSet" ? { kind: "pickSet" as const, set: freeSet(state) }
                    : d.kind === "initialWorkshop" ? { kind: "initialWorkshop" as const, hex: firstFreeHome(state, d.seat) }
                        : d.kind === "bookColor" ? { kind: "bookColor" as const, books: { banking: d.count } }
                            : d.kind === "scienceLevels" ? { kind: "scienceLevels" as const, discipline: "law" as const }
                                : { kind: "spades" as const, skip: true as const };
            const move: Move = { t: "decide", id: d.id, choice };
            expect(validateMove(state, d.seat, move)).toBeNull();
            state = applyMove(state, d.seat, move).state;
            steps++;
        }
        expect(state.phase).toBe("actions");
        expect(state.round).toBe(1);
    });
});

/** 测试用：第一个还没人选的组合 */
function freeSet(state: GameState): number {
    return state.board.setupSets.find((s) => s.takenBy === null)!.id;
}

/** 测试用：这位玩家家园地形的第一块空地（初始工坊可以放在任何一块家园地形上） */
function firstFreeHome(state: GameState, seat: Seat): HexId {
    const home = state.players[seat].homeTerrain;
    return Object.keys(state.hexes).find((id) => state.hexes[id].terrain === home && state.hexes[id].structure === null)!;
}

describe("M1-5 的两个主行动、两个决策", () => {
    const plains = seatOf(game, "plains");
    const g = withPlayer(turnOf(game, plains), plains, { tools: 10, coins: 20, scholars: 2 });

    it("派学者", () => {
        const move: Move = { t: "sendScholar", discipline: "law", space: 0 };
        expect(validateMove(g, plains, move)).toBeNull();
        expect(applyMove(g, plains, move).state.players[plains].science.law).toBe(3);
    });
    it("推进航行轨", () => {
        const move: Move = { t: "advanceTrack", track: "sailing" };
        expect(validateMove(g, plains, move)).toBeNull();
        expect(applyMove(g, plains, move).state.players[plains].sailing).toBe(1);
    });
    it("升学校 → 选能力板块 → 才能结束回合", () => {
        let state = withStructure(g, "C6", plains, "guild");
        state = applyMove(state, plains, { t: "upgrade", hex: "C6", to: "school" }).state;
        expect(validateMove(state, plains, { t: "endTurn" })).toBe("decision-pending");
        const d = state.pending[0];
        if (d.kind !== "competency") throw new Error("队列第一个应该是选能力板块");
        const answer: Move = { t: "decide", id: d.id, choice: { kind: "competency", tile: d.options[0] } };
        state = applyMove(state, plains, answer).state;
        expect(state.players[plains].competencies).toEqual([d.options[0]]);
        expect(validateMove(state, plains, { t: "endTurn" })).toBeNull();
    });
});

describe("M1-6 的四个主行动", () => {
    const plains = seatOf(game, "plains");
    const forest = seatOf(game, "forest");
    const g = withPlayer(turnOf(game, plains), plains, { tools: 10, coins: 20, power: [0, 5, 7] });

    it("能量行动 1 铲 → 用在 D5 并建工坊 → 结束回合", () => {
        let state = applyMove(g, plains, { t: "powerAction", id: "spade1" }).state;
        const id = state.pending[0].id;
        state = applyMove(state, plains, { t: "decide", id, choice: { kind: "spades", hex: "D5", build: true } }).state;
        expect(state.hexes.D5.structure!.type).toBe("workshop");
        expect(validateMove(state, plains, { t: "endTurn" })).toBeNull();
    });
    it("书本行动：付 2 本法律书拿 6 金币", () => {
        const s0 = withPlayer(g, plains, { books: { banking: 0, law: 2, engineering: 0, medicine: 0 } });
        const s: GameState = { ...s0, board: { ...s0.board, bookActions: ["coins6", "power5", "spade3"] } };
        const move: Move = { t: "bookAction", id: "coins6", books: { law: 2 } };
        expect(validateMove(s, plains, move)).toBeNull();
        expect(applyMove(s, plains, move).state.players[plains].coins).toBe(26);
    });
    it("特殊行动：森林玩家的学科前进 1 级", () => {
        const s = turnOf(game, forest);
        const move: Move = { t: "specialAction", source: "bonus:levelAction" };
        expect(validateMove(s, forest, move)).toBeNull();
        expect(applyMove(s, forest, move).state.pending[0]).toMatchObject({ kind: "scienceLevels", levels: 1 });
    });
    it("三个人依次 pass、结束回合：轮到的人跳过已经 pass 的；最后没人可轮了", () => {
        const tiles = [{ id: "spadeAction" as const, coins: 0 }, { id: "riverWorkshop" as const, coins: 0 }, { id: "bridgeAction" as const, coins: 0 }];
        let state: GameState = { ...game, board: { ...game.board, bonusTiles: tiles } };
        const order = state.turnOrder;
        for (const [i, seat] of order.entries()) {
            expect(state.turn!.seat).toBe(seat);
            state = applyMove(state, seat, { t: "pass", bonusTile: tiles[i].id }).state;
            state = applyMove(state, seat, { t: "endTurn" }).state;
        }
        expect(state.turn).toBeNull();
        expect(state.nextTurnOrder).toEqual(order);
        expect(state.players.every((p) => p.passed)).toBe(true);
    });
});