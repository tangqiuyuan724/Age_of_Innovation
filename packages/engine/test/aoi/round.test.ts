import { describe, it, expect } from "vitest";
import {
    LAST_ROUND, advance, applyMove, autoAdvance, endActions, incomeOf, nextRound, scienceBonusOf, validateMove,
    type GameState, type RoundScoreId,
} from "../../src/aoi/index.ts";
import { readyGame, seatOf, withPlayer } from "./fixtures.ts";

const game = readyGame();
const plains = seatOf(game, "plains");
const swamp = seatOf(game, "swamp");
const forest = seatOf(game, "forest");

/** 把本轮的回合计分板块换成 id */
function withRoundTile(state: GameState, id: RoundScoreId): GameState {
    const roundScores = [...state.board.roundScores];
    roundScores[state.round - 1] = id;
    return { ...state, board: { ...state.board, roundScores } };
}

/** 所有人都 pass 了、最后一个人也结束了回合：pass 的顺序是 order */
function allPassed(state: GameState, order = [plains, swamp, forest]): GameState {
    return {
        ...state,
        turn: null,
        nextTurnOrder: order,
        players: state.players.map((p) => ({ ...p, passed: true })),
    };
}

describe("科学奖励", () => {
    it("法律每 3 级 1 学者：7 级拿 2 个", () => {
        const s = withPlayer(withRoundTile(game, "workshopLaw"), plains, { science: { banking: 0, law: 7, engineering: 0, medicine: 0 } });
        expect(scienceBonusOf(s, plains)).toEqual({ gain: { scholars: 2 }, spades: 0 });
    });
    it("不到 per 级：什么都没有", () => {
        const s = withRoundTile(game, "workshopLaw");
        expect(scienceBonusOf(s, plains)).toEqual({ gain: {}, spades: 0 });
    });
    it("医学每 4 级 1 铲：8 级 2 把铲子，单独拿出来", () => {
        const s = withPlayer(withRoundTile(game, "guildMedicine"), plains, { science: { banking: 0, law: 0, engineering: 0, medicine: 8 } });
        expect(scienceBonusOf(s, plains)).toEqual({ gain: {}, spades: 2 });
    });
    it("银行每 1 级 1 金币：森林开局银行 2 级拿 2 金币", () => {
        expect(scienceBonusOf(withRoundTile(game, "schoolBanking"), forest)).toEqual({ gain: { coins: 2 }, spades: 0 });
    });
});

describe("一轮的行动阶段结束", () => {
    it("第 1~5 轮：拿科学奖励；铲子、任选颜色的书按下一轮的顺序排进决策", () => {
        // 医学每 4 级 1 铲：只有平原（医学 4 级）拿到；法律、医学每 3 级 1 本书的板块不在这一轮
        const s0 = withPlayer(allPassed(withRoundTile(game, "guildMedicine"), [swamp, plains, forest]), plains,
            { science: { banking: 0, law: 0, engineering: 0, medicine: 4 } });
        const { state, events } = endActions(s0);
        expect(state.phase).toBe("scienceBonus");
        expect(state.pending).toEqual([{ id: "science-1-" + plains, seat: plains, kind: "spades", spades: 1, canBuild: false }]);
        expect(events[0]).toEqual({ type: "phase", round: 1, phase: "scienceBonus" });
    });
    it("书：医学每 3 级 1 本任选颜色的书 → 选颜色的决策；直接给的资源马上加", () => {
        const s0 = withPlayer(allPassed(withRoundTile(game, "levelMedicine")), plains, { science: { banking: 0, law: 0, engineering: 0, medicine: 6 } });
        const { state } = endActions(s0);
        expect(state.pending).toEqual([{ id: `science-1-${plains}-books`, seat: plains, kind: "bookColor", count: 2 }]);
        const t = endActions(allPassed(withRoundTile(game, "schoolBanking")));
        expect(t.state.players[forest].coins).toBe(game.players[forest].coins + 2);
        expect(t.events).toContainEqual({ type: "resources", seat: forest, delta: { coins: 2 }, reason: "scienceBonus" });
    });
    it("整理：能量行动、书本行动、特殊行动的已用标记清掉；场上回合奖励板块各加 1 金币", () => {
        const used: GameState = {
            ...allPassed(game),
            board: { ...game.board, powerActionsUsed: ["coins7"], bookActionsUsed: [game.board.bookActions[0]] },
            players: allPassed(game).players.map((p) => ({ ...p, specialsUsed: ["bonus:levelAction"] })),
        };
        const { state } = endActions(used);
        expect(state.board.powerActionsUsed).toEqual([]);
        expect(state.board.bookActionsUsed).toEqual([]);
        expect(state.players.every((p) => p.specialsUsed.length === 0)).toBe(true);
        expect(state.board.bonusTiles.map((t) => t.coins)).toEqual(game.board.bonusTiles.map((t) => t.coins + 1));
    });
        it("第 6 轮：没有科学奖励，算终局分，游戏结束", () => {
        const s: GameState = { ...allPassed(game), round: LAST_ROUND };
        const { state, events } = endActions(s);
        expect(state.phase).toBe("ended");
        expect(state.pending).toEqual([]);
        expect(state.finalScores).toHaveLength(3);
        expect(events).toContainEqual({ type: "phase", round: LAST_ROUND, phase: "ended" });
        expect(events[events.length - 1].type).toBe("gameEnded");
    });
});

describe("进入下一轮", () => {
    it("轮数 +1；行动顺序按 pass 的先后；大家都还没 pass", () => {
        const s: GameState = { ...allPassed(game, [forest, plains, swamp]), phase: "scienceBonus" };
        const next = nextRound(s);
        expect(next.round).toBe(2);
        expect(next.phase).toBe("income");
        expect(next.turnOrder).toEqual([forest, plains, swamp]);
        expect(next.nextTurnOrder).toEqual([]);
        expect(next.players.every((p) => !p.passed)).toBe(true);
    });
});

describe("自动推进", () => {
    it("所有人都 pass、没有要选的：一路走到第 2 轮，拿了收入，轮到第一个 pass 的人", () => {
        const s = allPassed(withRoundTile(game, "workshopLaw"), [forest, plains, swamp]);
        const { state, events } = autoAdvance(s);
        expect(state.round).toBe(2);
        expect(state.phase).toBe("actions");
        expect(state.turn).toEqual({ seat: forest, mainActionDone: false, builtHexes: [] });
        expect(state.players[plains].coins).toBe(game.players[plains].coins + (incomeOf(game.players[plains]).coins ?? 0));
        expect(events).toContainEqual({ type: "phase", round: 2, phase: "actions" });
        expect(events.at(-1)).toEqual({ type: "turn", seat: forest });
    });
    it("有科学奖励的铲子：停在科学奖励阶段等平原选", () => {
        const s = withPlayer(allPassed(withRoundTile(game, "guildMedicine")), plains, { science: { banking: 0, law: 0, engineering: 0, medicine: 4 } });
        const state = advance(s);
        expect(state.round).toBe(1);
        expect(state.phase).toBe("scienceBonus");
        expect(state.pending[0].seat).toBe(plains);
    });
    it("铲子用掉（或放弃）以后进入第 2 轮", () => {
        const s = advance(withPlayer(allPassed(withRoundTile(game, "guildMedicine")), plains, { science: { banking: 0, law: 0, engineering: 0, medicine: 4 } }));
        const id = s.pending[0].id;
        expect(validateMove(s, plains, { t: "decide", id, choice: { kind: "spades", hex: "D5", build: true } })).toBe("invalid-choice");
        const used = applyMove(s, plains, { t: "decide", id, choice: { kind: "spades", hex: "D5", build: false } }).state;
        expect(used.hexes.D5.terrain).toBe("plains");
        expect(used.round).toBe(2);
        const skipped = applyMove(s, plains, { t: "decide", id, choice: { kind: "spades", skip: true } }).state;
        expect(skipped.round).toBe(2);
    });
    it("还有人没 pass、或者队列里有决策：什么都不做，原样返回", () => {
        expect(autoAdvance(game).state).toBe(game);
        const waiting: GameState = { ...allPassed(game), pending: [{ id: "x", seat: plains, kind: "leech", from: swamp, power: 1, vpCost: 0 }] };
        expect(autoAdvance(waiting).state).toBe(waiting);
    });
    it("第 6 轮最后一个人 pass、结束回合：游戏结束，之后什么都不能做", () => {
        let state: GameState = { ...game, round: LAST_ROUND };
        for (const seat of game.turnOrder) {
            state = applyMove(state, seat, { t: "pass", bonusTile: null }).state;
            state = applyMove(state, seat, { t: "endTurn" }).state;
        }
        expect(state.phase).toBe("ended");
        expect(validateMove(state, plains, { t: "convert", conversion: "power1ToCoin", times: 1 })).toBe("game-over");
    });
});