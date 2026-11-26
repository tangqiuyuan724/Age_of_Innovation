import { describe, it, expect } from "vitest";
import {
    MAPS, actionPoints, applyMove, isRiverside, parseMap, scoreActions,
    type GameEvent, type GameState, type RoundScoreId,
} from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer, withStructure } from "./fixtures.ts";

const geo = parseMap(MAPS["aoi-base"]);
const game = readyGame();
const plains = seatOf(game, "plains");
const swamp = seatOf(game, "swamp"); // 拿着回合奖励板块"建行会得 3 分"

/** 把本轮（第 1 轮）的回合计分板块换成 id */
function withRoundTile(state: GameState, id: RoundScoreId): GameState {
    const roundScores = [...state.board.roundScores];
    roundScores[state.round - 1] = id;
    return { ...state, board: { ...state.board, roundScores } };
}

describe("事件算成哪些行动", () => {
    it("河边：D5 旁边有河，C6 四周都是陆地", () => {
        expect(isRiverside(geo, "D5")).toBe(true);
        expect(isRiverside(geo, "C6")).toBe(false);
    });
    it("建工坊；在河边建工坊同时也算河边工坊", () => {
        expect(scoreActions(geo, { type: "built", seat: 0, hex: "C6", structure: "workshop" })).toEqual({ workshop: 1 });
        expect(scoreActions(geo, { type: "built", seat: 0, hex: "D5", structure: "workshop" })).toEqual({ workshop: 1, riverWorkshop: 1 });
    });
    it("升级：行会、学校、宫殿和大学都算大建筑", () => {
        const up = (to: "guild" | "school" | "palace" | "university"): GameEvent =>
            ({ type: "upgraded", seat: 0, hex: "C6", from: "workshop", to });
        expect(scoreActions(geo, up("guild"))).toEqual({ guild: 1 });
        expect(scoreActions(geo, up("school"))).toEqual({ school: 1 });
        expect(scoreActions(geo, up("palace"))).toEqual({ bigBuilding: 1 });
        expect(scoreActions(geo, up("university"))).toEqual({ bigBuilding: 1 });
    });
    it("改造几步就是几把铲子；学科前进几级、轨道前进几格", () => {
        expect(scoreActions(geo, { type: "terraformed", seat: 0, hex: "D6", from: "wasteland", to: "plains" })).toEqual({ spade: 2 });
        expect(scoreActions(geo, { type: "science", seat: 0, discipline: "law", from: 2, to: 5 })).toEqual({ level: 3 });
        expect(scoreActions(geo, { type: "track", seat: 0, track: "sailing", from: 0, to: 1 })).toEqual({ track: 1 });
    });
    it("派学者、拿城市板块、拿创新板块；拿回合奖励板块不算", () => {
        expect(scoreActions(geo, { type: "scholarSent", seat: 0, discipline: "law", space: "return" })).toEqual({ scholar: 1 });
        expect(scoreActions(geo, { type: "tileTaken", seat: 0, tile: "coins", kind: "city" })).toEqual({ city: 1 });
        expect(scoreActions(geo, { type: "tileTaken", seat: 0, tile: "x", kind: "innovation" })).toEqual({ innovation: 1 });
        expect(scoreActions(geo, { type: "tileTaken", seat: 0, tile: "coins6", kind: "bonus" })).toEqual({});
    });
});

describe("行动得分", () => {
    const built: GameEvent = { type: "built", seat: plains, hex: "C6", structure: "workshop" };

    it("回合计分板块是建工坊 2 分：建一个工坊 +2", () => {
        const s = withRoundTile(game, "workshopLaw");
        const { state, events } = actionPoints(s, [built]);
        expect(state.players[plains].vp).toBe(s.players[plains].vp + 2);
        expect(events).toEqual([{ type: "resources", seat: plains, delta: { vp: 2 }, reason: "roundScore" }]);
    });
    it("和板块无关的行动：不加分，原样返回", () => {
        const s = withRoundTile(game, "schoolBanking");
        expect(actionPoints(s, [built]).state).toBe(s);
    });
    it("不在行动阶段（比如轮末用科学奖励的铲子）：不加分", () => {
        const s: GameState = { ...withRoundTile(game, "spadeEngineering"), phase: "scienceBonus" };
        const e: GameEvent = { type: "terraformed", seat: plains, hex: "D6", from: "wasteland", to: "plains" };
        expect(actionPoints(s, [e]).events).toEqual([]);
    });
    it("拿着回合奖励板块「河边工坊」：在河边建工坊另加 2 分", () => {
        const s = withPlayer(withRoundTile(game, "workshopLaw"), plains, { bonusTile: "riverWorkshop" });
        const e: GameEvent = { type: "built", seat: plains, hex: "D5", structure: "workshop" };
        const { state, events } = actionPoints(s, [e]);
        expect(state.players[plains].vp).toBe(s.players[plains].vp + 4);
        expect(events).toEqual([
            { type: "resources", seat: plains, delta: { vp: 2 }, reason: "roundScore" },
            { type: "resources", seat: plains, delta: { vp: 2 }, reason: "bonusTileAction" },
        ]);
    });
});

describe("通过 applyMove 得分", () => {
    it("改造并建造：改 1 铲 2 分；另一局建工坊 2 分", () => {
        const s = turnOf(withRoundTile(game, "spadeEngineering"), plains);
        const move = { t: "terraformAndBuild" as const, hex: "D5", spades: 1, build: true };
        expect(applyMove(s, plains, move).state.players[plains].vp).toBe(s.players[plains].vp + 2);
        const w = turnOf(withRoundTile(game, "workshopBanking"), plains);
        expect(applyMove(w, plains, move).state.players[plains].vp).toBe(w.players[plains].vp + 2);
    });
    it("派学者到法律第 1 格：前进 3 级得 3 分；拿着「派学者」板块再加 2 分", () => {
        const s0 = withPlayer(turnOf(withRoundTile(game, "levelMedicine"), plains), plains, { scholars: 1 });
        const s = withPlayer(s0, plains, { bonusTile: "scholarSend" });
        const { state } = applyMove(s, plains, { t: "sendScholar", discipline: "law", space: 0 });
        expect(state.players[plains].vp).toBe(s.players[plains].vp + 3 + 2);
    });
    it("沼泽拿着「建行会」板块：工坊升行会得 3 分，本轮板块也是建行会再加 3 分", () => {
        const s = turnOf(withRoundTile(game, "guildLaw"), swamp);
        const { state } = applyMove(s, swamp, { t: "upgrade", hex: "C7", to: "guild" });
        expect(state.players[swamp].vp).toBe(s.players[swamp].vp + 3 + 3);
    });
    it("推进航行轨 3 分", () => {
        const s = turnOf(withRoundTile(game, "trackEngineering"), swamp);
        // 航行轨第 1 格本身奖励 2 分，再加板块的 3 分
        expect(applyMove(s, swamp, { t: "advanceTrack", track: "sailing" }).state.players[swamp].vp).toBe(s.players[swamp].vp + 2 + 3);
    });
    it("组成城市、拿城市板块 5 分", () => {
        const s0 = withStructure(withStructure(withStructure(game, "C5", plains, "palace"), "B5", plains, "guild"), "D5", plains, "workshop");
        const s = withRoundTile(s0, "cityEngineering");
        const waiting: GameState = {
            ...s,
            cities: [{ id: 0, owner: plains, hexes: ["B5", "C5", "C6", "D5"], tile: null }],
            pending: [{ id: "city-0", seat: plains, kind: "cityTile", cityId: 0, options: ["coins"] }],
        };
        const { state } = applyMove(waiting, plains, { t: "decide", id: "city-0", choice: { kind: "cityTile", tile: "coins" } });
        expect(state.players[plains].vp).toBe(s.players[plains].vp + 6 + 5);
    });
});