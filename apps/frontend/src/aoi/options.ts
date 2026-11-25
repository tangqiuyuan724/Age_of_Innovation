// "现在能做什么"：把可能的指令一条条列出来，交给引擎的 validateMove 判断行不行。
// 前端自己不写任何规则：费用用引擎的函数算，能不能做由 validateMove 说了算。
// 引擎还没实现的指令，validateMove 会返回 "bad-move"，界面上就显示"引擎还没实现"。
import {
    BONUS_TILES, BOOK_ACTION_COST, BUILD_WORKSHOP_COST, DISCIPLINES, LAST_ROUND, POWER_ACTION_COST, SCHOLAR_SPACE_LEVELS,
    UPGRADE_FROM,
    addBundles, bridgeOptions, spadeCost, spadesBuildCost, terrainDistance, terraformToward, upgradeCost, validateMove,
    type BookActionId, type BookPayment, type Discipline, type GameState, type HexId, type MapGeometry, type Move,
    type PlayerState, type PowerActionId, type ResourceBundle, type RuleError, type Seat, type Terrain,
} from "@aoi/engine/aoi";
import {
    BONUS_TILE_LABEL, BOOK_ACTION_LABEL, POWER_ACTION_LABEL, SPECIAL_ACTION_LABEL, STRUCTURE_NAME, TERRAIN_NAME,
} from "./labels.ts";

/** 现在该谁操作：队列里有待决策就是第一个决策的人，否则是当前回合的人；都没有返回 null */
export function actingSeat(state: GameState): Seat | null {
    if (state.pending.length > 0) return state.pending[0].seat;
    return state.turn?.seat ?? null;
}

/** 一个可以点的选项：按钮上的字、对应的指令、要付什么，以及引擎说能不能做 */
export interface Choice {
    label: string;
    move: Move;
    cost: ResourceBundle;
    /** null 表示可以做；否则是引擎给的原因 */
    error: RuleError | null;
}

function choice(state: GameState, seat: Seat, label: string, move: Move, cost: ResourceBundle = {}): Choice {
    return { label, move, cost, error: validateMove(state, seat, move) };
}

/** 能升级成的建筑：UPGRADE_FROM 的键 */
const UPGRADE_TARGETS = Object.keys(UPGRADE_FROM) as (keyof typeof UPGRADE_FROM)[];

/**
 * 点了地图上的一个格子以后，seat 在这里能做的事：
 *  - 待决策是"放初始工坊""用免费铲子""建桥"时：在这一格回应决策
 *  - 自己的回合：空地可以改造（改几铲都行）、改完可以建工坊；自己的建筑可以升级
 * hexName 把引擎编号换成版图上印的名字，用在"和某格之间建桥"这种按钮上
 */
export function hexChoices(state: GameState, seat: Seat, hex: HexId, hexName: (id: HexId) => string = (id) => id): Choice[] {
    const h = state.hexes[hex];
    const p = state.players[seat];
    if (h === undefined || p === undefined) return [];

    const d = state.pending[0];
    if (d !== undefined) {
        if (d.seat !== seat) return [];
        if (d.kind === "initialWorkshop") {
            return [choice(state, seat, "在这里放初始工坊", { t: "decide", id: d.id, choice: { kind: "initialWorkshop", hex } })];
        }
        if (d.kind === "spades") return spadeChoices(state, seat, hex, d.id, d.spades, d.canBuild);
        if (d.kind === "bridge") {
            return bridgeOptions(state, seat)
                .filter((o) => o.a === hex || o.b === hex)
                .map((o) => choice(state, seat, `和 ${hexName(o.a === hex ? o.b : o.a)} 之间建桥`,
                    { t: "decide", id: d.id, choice: { kind: "bridge", a: o.a, b: o.b } }));
        }
        return [];
    }
    if (state.turn?.seat !== seat) return [];

    if (h.structure === null) {
        const distance = terrainDistance(h.terrain, p.homeTerrain);
        const result: Choice[] = [];
        for (let spades = 1; spades <= distance; spades++) {
            const after = terraformToward(h.terrain, p.homeTerrain, spades);
            result.push(choice(state, seat, `改造 ${spades} 铲，变成${TERRAIN_NAME[after]}`,
                { t: "terraformAndBuild", hex, spades, build: false }, spadeCost(p, spades)));
        }
        result.push(choice(state, seat, distance === 0 ? "建工坊" : `改造 ${distance} 铲并建工坊`,
            { t: "terraformAndBuild", hex, spades: distance, build: true },
            addBundles(spadeCost(p, distance), BUILD_WORKSHOP_COST)));
        return result;
    }
    if (h.structure.owner === seat && !h.structure.neutral) {
        const from = h.structure.type;
        return UPGRADE_TARGETS
            .filter((to) => UPGRADE_FROM[to] === from)
            .map((to) => choice(state, seat, `升级成${STRUCTURE_NAME[to]}`, { t: "upgrade", hex, to },
                upgradeCost(state, seat, hex, to)));
    }
    return [];
}

/**
 * 免费铲子用在 hex 的两种做法：只改造（只用免费铲子，能改多少改多少），改到家园地形再建工坊（铲子不够用工具补）。
 * 按钮上写清楚会变成什么地形、会不会剩铲子
 */
function spadeChoices(state: GameState, seat: Seat, hex: HexId, id: string, spades: number, canBuild: boolean): Choice[] {
    const p = state.players[seat];
    const h = state.hexes[hex];
    const distance = terrainDistance(h.terrain, p.homeTerrain);
    const move: Move = { t: "decide", id, choice: { kind: "spades", hex, build: false } };
    if (distance === 0) return [choice(state, seat, "这里已经是家园地形，铲子用不上", move)];
    const used = Math.min(spades, distance);
    const left = Math.max(0, spades - distance);
    const after = terraformToward(h.terrain, p.homeTerrain, used);
    const rest = left > 0 ? `，剩 ${left} 把下一格用` : "";
    const result = [choice(state, seat, `只改造：变成${TERRAIN_NAME[after]}（用 ${used} 把${rest}）`, move)];
    if (canBuild) {
        const bought = Math.max(0, distance - spades);
        result.push(choice(state, seat,
            `改成${TERRAIN_NAME[p.homeTerrain]}并建工坊${bought > 0 ? `（另买 ${bought} 铲）` : ""}${rest}`,
            { t: "decide", id, choice: { kind: "spades", hex, build: true } },
            spadesBuildCost(p, spades, distance)));
    }
    return result;
}

/** 待决策是"放初始工坊""用免费铲子""建桥"时，地图上哪些格子可以点 */
export function decisionTargets(state: GameState, geo: MapGeometry, seat: Seat): Set<HexId> {
    const d = state.pending[0];
    const targets = new Set<HexId>();
    if (d === undefined || d.seat !== seat || !["initialWorkshop", "spades", "bridge"].includes(d.kind)) return targets;
    for (const h of geo.hexes) {
        if (h.river) continue;
        if (hexChoices(state, seat, h.id).some((c) => c.error === null)) targets.add(h.id);
    }
    return targets;
}

/** 6 个能量行动，按游戏板上的顺序 */
export const POWER_ACTIONS: PowerActionId[] = ["bridge", "scholar", "tools2", "coins7", "spade1", "spade2"];

/** 能量行动：每个一个选项，花多少能量 */
export function powerActionChoices(state: GameState, seat: Seat): Choice[] {
    return POWER_ACTIONS.map((id) =>
        choice(state, seat, POWER_ACTION_LABEL[id], { t: "powerAction", id }, { power: POWER_ACTION_COST[id] }));
}

/**
 * 付 n 本书的一种默认付法：先从手上最多的颜色付，这样剩下的颜色更平均。书不够返回 null。
 * 只是给界面一个起点，玩家可以自己改
 */
export function autoBooks(p: PlayerState, n: number): BookPayment | null {
    const pay: Record<Discipline, number> = { banking: 0, law: 0, engineering: 0, medicine: 0 };
    for (let i = 0; i < n; i++) {
        const best = DISCIPLINES.filter((x) => p.books[x] - pay[x] > 0)
            .sort((a, b) => (p.books[b] - pay[b]) - (p.books[a] - pay[a]))[0];
        if (best === undefined) return null;
        pay[best]++;
    }
    return Object.fromEntries(DISCIPLINES.filter((x) => pay[x] > 0).map((x) => [x, pay[x]]));
}

/** 书本行动：本局翻开的每一个一个选项，用默认付法问引擎。书不够时问引擎用"全付银行书"，拿到不够的原因 */
export function bookActionChoices(state: GameState, seat: Seat): Choice[] {
    const p = state.players[seat];
    return state.board.bookActions.map((id: BookActionId) => {
        const cost = BOOK_ACTION_COST[id];
        const books = autoBooks(p, cost) ?? { banking: cost };
        return choice(state, seat, BOOK_ACTION_LABEL[id], { t: "bookAction", id, books }, { books: { gray: cost } });
    });
}

/** 特殊行动：现在只有回合奖励板块上的（宫殿、能力、大创板块、派系的在 M3） */
export function specialActionChoices(state: GameState, seat: Seat): Choice[] {
    const tile = state.players[seat]?.bonusTile;
    const special = tile == null ? undefined : BONUS_TILES[tile].special;
    if (tile == null || special === undefined) return [];
    return [choice(state, seat, SPECIAL_ACTION_LABEL[special], { t: "specialAction", source: `bonus:${tile}` })];
}

/** pass 的选项：第 1~5 轮从场上拿一块回合奖励板块（连同上面的金币）；第 6 轮只有一个不拿板块的选项 */
export function passChoices(state: GameState, seat: Seat): Choice[] {
    if (state.round === LAST_ROUND) return [choice(state, seat, "结束本轮（最后一轮，不拿板块）", { t: "pass", bonusTile: null })];
    return state.board.bonusTiles.map((t) => choice(state, seat,
        `「${BONUS_TILE_LABEL[t.id].short}」${t.coins > 0 ? ` +${t.coins} 金币` : ""}`,
        { t: "pass", bonusTile: t.id }));
}

/** 一门学科能派学者的选项：放到 4 个学者格里的某一格（格子被占了引擎会说 space-occupied），或者退回供应区 */
export function scholarChoices(state: GameState, seat: Seat, d: Discipline): Choice[] {
    const result = SCHOLAR_SPACE_LEVELS.map((levels, space) =>
        choice(state, seat, `第 ${space + 1} 格 +${levels} 级`, { t: "sendScholar", discipline: d, space }));
    result.push(choice(state, seat, "退回 +1 级", { t: "sendScholar", discipline: d, space: "return" }));
    return result;
}

/** 改造的预览：从现在的地形开始，每多一铲变成什么，直到变成家园地形 */
export function terraformSteps(from: Terrain, home: Terrain): Terrain[] {
    const steps = [from];
    for (let s = 1; s <= terrainDistance(from, home); s++) steps.push(terraformToward(from, home, s));
    return steps;
}
