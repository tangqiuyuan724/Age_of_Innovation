import { describe, it, expect } from "vitest";
import {
    CITY_TILE_IDS, applyCityTile, applyMove, updateCities, validateCityTile, validateMove,
    type Decision, type GameState, type HexId, type Seat,
} from "../../src/aoi/index.ts";
import { readyGame, seatOf, turnOf, withPlayer, withStructure } from "./fixtures.ts";

// 平原玩家的初始工坊在 C6。C6 旁边：C5、B5、D5、D6；D5 隔河对着 E4（D5 和 E4 之间能架桥）
const game = readyGame();
const plains = seatOf(game, "plains");

/** 平原玩家在 C6（工坊）旁边再放宫殿 C5、行会 B5：3 座，能量值 1 + 3 + 2 = 6，还不够 */
const almost: GameState = withStructure(withStructure(game, "C5", plains, "palace"), "B5", plains, "guild");

/** 队列里放一个选城市板块的决策 */
function choosing(state: GameState, seat: Seat, cityId = 0): GameState {
    const d: Decision = { id: "city-0", seat, kind: "cityTile", cityId, options: [...CITY_TILE_IDS] };
    return {
        ...state,
        cities: [{ id: cityId, owner: seat, hexes: ["B5", "C5", "C6", "D5"], tile: null }],
        pending: [d],
    };
}

describe("组成城市", () => {
    it("3 座、能量值 6：不成城市", () => {
        const { state, events } = updateCities(almost, plains);
        expect(state).toBe(almost);
        expect(events).toEqual([]);
    });
    it("在 D5 建工坊：4 座、能量值 7，组成城市；选城市板块的决策排在最前面", () => {
        const { state, events } = applyMove(turnOf(almost, plains), plains, { t: "terraformAndBuild", hex: "D5", spades: 1, build: true });
        expect(state.cities).toEqual([{ id: 0, owner: plains, hexes: ["B5", "C5", "C6", "D5"], tile: null }]);
        for (const id of ["B5", "C5", "C6", "D5"]) expect(state.hexes[id].structure!.city).toBe(0);
        expect(events).toContainEqual({ type: "cityFounded", seat: plains, cityId: 0, hexes: ["B5", "C5", "C6", "D5"] });
        expect(state.pending[0]).toEqual({ id: "city-0", seat: plains, kind: "cityTile", cityId: 0, options: CITY_TILE_IDS });
        expect(validateMove(state, plains, { t: "endTurn" })).toBe("decision-pending");
    });
    it("4 座但能量值只有 6（宫殿换成行会）：不成城市", () => {
        const weak = withStructure(withStructure(almost, "C5", plains, "guild"), "D5", plains, "workshop");
        expect(updateCities(weak, plains).state.cities).toEqual([]);
    });
    it("有大学：3 座、能量值 7 就够了", () => {
        const s = withStructure(withStructure(game, "C5", plains, "university"), "B5", plains, "palace");
        const { state } = updateCities(s, plains);
        expect(state.cities[0].hexes).toEqual(["B5", "C5", "C6"]);
    });
    it("别人的建筑不算：B6 是森林玩家的", () => {
        const s = withStructure(almost, "B6", seatOf(game, "forest"), "palace");
        expect(updateCities(s, plains).state.cities).toEqual([]);
    });
    it("城市旁边新建的建筑归入这座城市，不再组新城市", () => {
        const founded = updateCities(withStructure(almost, "D5", plains, "workshop"), plains).state;
        const more = withStructure({ ...founded, pending: [] }, "D6", plains, "workshop");
        const { state, events } = updateCities(more, plains);
        expect(state.hexes.D6.structure!.city).toBe(0);
        expect(state.cities).toEqual([{ id: 0, owner: plains, hexes: ["B5", "C5", "C6", "D5", "D6"], tile: null }]);
        expect(events).toEqual([]);
        expect(state.pending).toEqual([]);
    });
    it("隔着河的建筑：没桥不相连，建了桥就连成一片", () => {
        // C6 工坊、C5 宫殿、D5 工坊（能量值 5），河对岸 E4 行会（2）
        const s = withStructure(withStructure(withStructure(game, "C5", plains, "palace"), "D5", plains, "workshop"), "E4", plains, "guild");
        expect(updateCities(s, plains).state.cities).toEqual([]);
        const bridged: GameState = { ...s, bridges: [{ owner: plains, a: "D5", b: "E4" }] };
        expect(updateCities(bridged, plains).state.cities[0].hexes).toEqual(["C5", "C6", "D5", "E4"]);
    });
    it("升大学的同时组成城市：先选城市板块（拿到钥匙），再选能力板块", () => {
        // C6 行会、C5 学校、B5 行会：能量值 6；C5 升大学以后 7，有大学 3 座就够
        const s = withStructure(withStructure(withStructure(game, "C6", plains, "guild"), "C5", plains, "school"), "B5", plains, "guild");
        const { state } = applyMove(turnOf(s, plains), plains, { t: "upgrade", hex: "C5", to: "university" });
        expect(state.pending.map((d) => d.kind)).toEqual(["cityTile", "competency"]);
    });
    it("用能量行动建桥连成城市：建桥的决策处理完，马上轮到选城市板块", () => {
        const s0 = withStructure(withStructure(withStructure(game, "C5", plains, "palace"), "D5", plains, "workshop"), "E4", plains, "guild");
        const s = withPlayer(turnOf(s0, plains), plains, { power: [0, 0, 12] });
        let state = applyMove(s, plains, { t: "powerAction", id: "bridge" }).state;
        state = applyMove(state, plains, { t: "decide", id: state.pending[0].id, choice: { kind: "bridge", a: "D5", b: "E4" } }).state;
        expect(state.cities).toHaveLength(1);
        expect(state.pending[0].kind).toBe("cityTile");
    });
});

describe("选城市板块", () => {
    const waiting = choosing(almost, plains);

    it("只能选决策里列出的；被拿光的：tile-unavailable；别人不能替你选", () => {
        expect(validateCityTile(waiting, plains, "coins")).toBeNull();
        expect(validateCityTile(waiting, plains, "gold" as never)).toBe("invalid-choice");
        const empty = { ...waiting, board: { ...waiting.board, cityTilesLeft: { ...waiting.board.cityTilesLeft, coins: 0 } } };
        expect(validateCityTile(empty, plains, "coins")).toBe("tile-unavailable");
        expect(validateCityTile(waiting, seatOf(game, "swamp"), "coins")).toBe("not-your-decision");
    });
    it("6 分 6 金币：得分、金币、1 把钥匙；板块记到城市和玩家身上，剩 2 张", () => {
        const before = waiting.players[plains];
        const { state, events } = applyCityTile(waiting, plains, "coins");
        const p = state.players[plains];
        expect(p.vp).toBe(before.vp + 6);
        expect(p.coins).toBe(before.coins + 6);
        expect(p.keys).toBe(before.keys + 1);
        expect(p.cityTiles).toEqual(["coins"]);
        expect(state.cities[0].tile).toBe("coins");
        expect(state.board.cityTilesLeft.coins).toBe(2);
        expect(state.pending).toEqual([]);
        expect(events).toEqual([
            { type: "tileTaken", seat: plains, tile: "coins", kind: "city" },
            { type: "resources", seat: plains, delta: { vp: 6, coins: 6 }, reason: "cityTile" },
        ]);
    });
    it("5 分 + 2 把免费铲子：排一个能建工坊的免费铲子决策", () => {
        const { state } = applyCityTile(waiting, plains, "spades");
        expect(state.pending).toEqual([{ id: "city-0-spades", seat: plains, kind: "spades", spades: 2, canBuild: true }]);
    });
    it("5 分 + 2 本任选颜色的书：排一个选颜色的决策", () => {
        const { state } = applyCityTile(waiting, plains, "books");
        expect(state.pending).toEqual([{ id: "city-0-books", seat: plains, kind: "bookColor", count: 2 }]);
    });
    it("7 分 + 每门学科 1 级：钥匙先拿到，法律能从 7 级升到 8 级", () => {
        const s = withPlayer(waiting, plains, { science: { banking: 2, law: 7, engineering: 0, medicine: 5 } });
        const p = applyCityTile(s, plains, "levels").state.players[plains];
        expect(p.science).toEqual({ banking: 3, law: 8, engineering: 1, medicine: 6 });
        expect(p.vp).toBe(s.players[plains].vp + 7);
    });
    it("8 分 + 1 学者：供应区没有学者就拿不到", () => {
        const none = withPlayer(waiting, plains, { scholarsInSupply: 0 });
        expect(applyCityTile(none, plains, "scholar").state.players[plains].scholars).toBe(none.players[plains].scholars);
    });
    it("通过 applyMove 选：选完继续本回合", () => {
        const s = { ...waiting, turn: { seat: plains, mainActionDone: true, builtHexes: ["D5" as HexId] } };
        const move = { t: "decide" as const, id: "city-0", choice: { kind: "cityTile" as const, tile: "tools" as const } };
        expect(validateMove(s, plains, move)).toBeNull();
        const { state } = applyMove(s, plains, move);
        expect(state.players[plains].tools).toBe(s.players[plains].tools + 3);
        expect(validateMove(state, plains, { t: "endTurn" })).toBeNull();
    });
});