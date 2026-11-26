import { describe, it, expect } from "vitest";
import {
    FINAL_ROUND_SCORES, FINAL_ROUND_SCORE_IDS, LAST_ROUND, MAPS, ROUND_SCORE_TILES,
    actionPoints, createGame, isBorder, parseMap, pickFinalRoundScore, scoreActions,
    type FinalRoundScoreId, type GameEvent, type GameState, type RoundScoreId,
} from "../../src/aoi/index.ts";
import { readyGame, seatOf } from "./fixtures.ts";

const geo = parseMap(MAPS["aoi-base"]);
const game = readyGame();
const plains = seatOf(game, "plains");

/** 改成第 round 轮，这一轮的回合计分板块是 tile，终局回合计分板块是 final */
function inRound(state: GameState, round: number, tile: RoundScoreId, final: FinalRoundScoreId): GameState {
    const roundScores = [...state.board.roundScores];
    roundScores[round - 1] = tile;
    return { ...state, round, board: { ...state.board, roundScores, finalRoundScore: final } };
}

describe("终局回合计分板块", () => {
    it("4 块：行会 3 分、版图边缘的工坊 3 分、学校 4 分、工坊 2 分", () => {
        expect(FINAL_ROUND_SCORE_IDS).toHaveLength(4);
        expect(FINAL_ROUND_SCORES.guild).toEqual({ id: "guild", action: "guild", vp: 3 });
        expect(FINAL_ROUND_SCORES.borderWorkshop).toEqual({ id: "borderWorkshop", action: "borderWorkshop", vp: 3 });
        expect(FINAL_ROUND_SCORES.school).toEqual({ id: "school", action: "school", vp: 4 });
        expect(FINAL_ROUND_SCORES.workshop).toEqual({ id: "workshop", action: "workshop", vp: 2 });
    });
    it("第 6 轮是工坊板块：两块工坊的都跳过", () => {
        expect(pickFinalRoundScore(["workshop", "borderWorkshop", "guild", "school"], "workshopLaw")).toBe("guild");
    });
    it("第 6 轮是行会板块：跳过行会", () => {
        expect(pickFinalRoundScore(["guild", "school", "workshop", "borderWorkshop"], "guildMedicine")).toBe("school");
    });
    it("第 6 轮和建筑无关：直接用第一块", () => {
        expect(pickFinalRoundScore(["borderWorkshop", "guild", "school", "workshop"], "levelMedicine")).toBe("borderWorkshop");
    });
    it("开 50 局：终局板块从来不和第 6 轮的板块是同一种建筑", () => {
        const building = (action: string) => (action === "borderWorkshop" ? "workshop" : action);
        for (let i = 0; i < 50; i++) {
            const s = createGame({ playerCount: 3, mapId: "aoi-base", setupMode: { kind: "sets" } }, `final-${i}`);
            const round6 = ROUND_SCORE_TILES[s.board.roundScores[LAST_ROUND - 1]].action;
            const final = FINAL_ROUND_SCORES[s.board.finalRoundScore].action;
            expect(building(final)).not.toBe(building(round6));
        }
    });
});

describe("版图边缘", () => {
    it("最外圈的格子是边缘，里面的不是", () => {
        expect(isBorder(geo, "E1")).toBe(true);
        expect(isBorder(geo, "A5")).toBe(true);
        expect(isBorder(geo, "I8")).toBe(true);
        expect(isBorder(geo, "C6")).toBe(false);
    });
    it("在边缘建工坊：同时算工坊和边缘工坊", () => {
        expect(scoreActions(geo, { type: "built", seat: 0, hex: "E1", structure: "workshop" }))
            .toEqual({ workshop: 1, borderWorkshop: 1 });
        expect(scoreActions(geo, { type: "built", seat: 0, hex: "C6", structure: "workshop" })).toEqual({ workshop: 1 });
    });
});

describe("第 6 轮的行动得分", () => {
    const built = (hex: string): GameEvent => ({ type: "built", seat: plains, hex, structure: "workshop" });

    it("第 6 轮：回合计分板块和终局板块都算", () => {
        const s = inRound(game, LAST_ROUND, "trackEngineering", "borderWorkshop");
        const { state, events } = actionPoints(s, [built("E1"), { type: "track", seat: plains, track: "sailing", from: 0, to: 1 }]);
        expect(state.players[plains].vp).toBe(s.players[plains].vp + 3 + 3);
        expect(events).toEqual([
            { type: "resources", seat: plains, delta: { vp: 3 }, reason: "finalRoundScore" },
            { type: "resources", seat: plains, delta: { vp: 3 }, reason: "roundScore" },
        ]);
    });
    it("第 6 轮：不在边缘的工坊不算边缘工坊", () => {
        const s = inRound(game, LAST_ROUND, "trackEngineering", "borderWorkshop");
        const { events } = actionPoints(s, [built("C6")]);
        expect(events).toEqual([]);
    });
    it("第 5 轮：终局板块还不算", () => {
        const s = inRound(game, 5, "trackEngineering", "workshop");
        const { events } = actionPoints(s, [built("C6")]);
        expect(events).toEqual([]);
    });
});