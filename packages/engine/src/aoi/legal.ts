// 列出某位玩家现在能做的所有指令。做法很笨但不会错：把"可能的指令"都列出来，再一条条问 validateMove。
// 用处：前端高亮能点的东西；测试里的随机对局机器人。
//  - 有人在等决定时，只有那个人能回应第一个决定
//  - 自由行动（转换、牺牲能量）只列"做 1 次"的
//  - 书本行动、选书的颜色列出所有付法 / 分法
import { BOOK_ACTION_COST, DISCIPLINES, LAST_ROUND, POWER_ACTION_COST, UPGRADE_FROM } from "./constants.js";
import { CONVERSIONS } from "./convert.js";
import { bridgeOptions } from "./bridge.js";
import { validateMove } from "./move.js";
import { terrainDistance } from "./terrain.js";
import type {
    BookPayment, ConversionId, Decision, Discipline, GameState, HexId, Move, PowerActionId, Seat,
} from "./types.js";

const UPGRADE_TO = Object.keys(UPGRADE_FROM) as (keyof typeof UPGRADE_FROM)[];
const POWER_ACTION_IDS = Object.keys(POWER_ACTION_COST) as PowerActionId[];
const CONVERSION_IDS = Object.keys(CONVERSIONS) as ConversionId[];
/** 这两种转换要说明书的颜色 */
const NEEDS_COLOR: ConversionId[] = ["power5ToBook", "bookToCoin"];

/** seat 现在能做的所有指令（每一条 validateMove 都返回 null） */
export function getLegalMoves(state: GameState, seat: Seat): Move[] {
    if (state.phase === "ended") return [];
    const d = state.pending[0];
    let candidates: Move[];
    if (d !== undefined) {
        candidates = d.seat === seat ? decisionMoves(state, d) : [];
    } else {
        candidates = state.turn?.seat === seat ? turnMoves(state, seat) : [];
    }
    return candidates.filter((m) => validateMove(state, seat, m) === null);
}

/** 把 total 本书分到 4 种颜色上的所有分法；limit 是每种颜色最多几本（不传就不限） */
export function bookSplits(total: number, limit?: Record<Discipline, number>): BookPayment[] {
    const result: BookPayment[] = [];
    const walk = (i: number, left: number, books: BookPayment) => {
        if (i === DISCIPLINES.length - 1) {
            const d = DISCIPLINES[i];
            if (limit === undefined || left <= limit[d]) result.push(left > 0 ? { ...books, [d]: left } : books);
            return;
        }
        const d = DISCIPLINES[i];
        const max = limit === undefined ? left : Math.min(left, limit[d]);
        for (let n = 0; n <= max; n++) walk(i + 1, left - n, n > 0 ? { ...books, [d]: n } : books);
    };
    walk(0, total, {});
    return result;
}

/** 所有陆地格 */
function landHexes(state: GameState): HexId[] {
    return Object.keys(state.hexes);
}

/** 回应第一个决定的所有可能 */
function decisionMoves(state: GameState, d: Decision): Move[] {
    const decide = (choice: Extract<Move, { t: "decide" }>["choice"]): Move => ({ t: "decide", id: d.id, choice });
    switch (d.kind) {
        case "pickSet":
            return d.options.map((set) => decide({ kind: "pickSet", set }));
        case "draftPick":
            return d.options.map((item) => decide({ kind: "draftPick", item }));
        case "initialWorkshop":
            return landHexes(state).map((hex) => decide({ kind: "initialWorkshop", hex }));
        case "leech":
            return [decide({ kind: "leech", accept: true }), decide({ kind: "leech", accept: false })];
        case "spades":
            return [
                ...landHexes(state).flatMap((hex) => [
                    decide({ kind: "spades", hex, build: false }),
                    decide({ kind: "spades", hex, build: true }),
                ]),
                decide({ kind: "spades", skip: true }),
            ];
        case "bridge":
            return [
                ...bridgeOptions(state, d.seat).map(({ a, b }) => decide({ kind: "bridge", a, b })),
                decide({ kind: "bridge", skip: true }),
            ];
        case "scienceLevels":
            return [
                ...DISCIPLINES.map((discipline) => decide({ kind: "scienceLevels", discipline })),
                decide({ kind: "scienceLevels", skip: true }),
            ];
        case "bookColor":
            return bookSplits(d.count).map((books) => decide({ kind: "bookColor", books }));
        case "competency":
            return d.options.map((tile) => decide({ kind: "competency", tile }));
        case "palaceTile":
            return d.options.map((tile) => decide({ kind: "palaceTile", tile }));
        case "cityTile":
            return d.options.map((tile) => decide({ kind: "cityTile", tile }));
        default: {
            const unhandled: never = d;
            throw new Error(`没处理的决定：${JSON.stringify(unhandled)}`);
        }
    }
}

/** 轮到 seat、没有人在等决定时，所有可能的指令 */
function turnMoves(state: GameState, seat: Seat): Move[] {
    const p = state.players[seat];
    const moves: Move[] = [];

    // 改造并建造：每个空的陆地格，改 1 铲、2 铲……一直到改成家园地形；改好了可以顺带建工坊
    for (const hex of landHexes(state)) {
        const h = state.hexes[hex];
        if (h.structure !== null) continue;
        const distance = terrainDistance(h.terrain, p.homeTerrain);
        for (let spades = 0; spades <= distance; spades++) {
            if (spades > 0) moves.push({ t: "terraformAndBuild", hex, spades, build: false });
            if (spades === distance) moves.push({ t: "terraformAndBuild", hex, spades, build: true });
        }
    }
    // 升级：自己的每座建筑，升成每一种
    for (const hex of landHexes(state)) {
        if (state.hexes[hex].structure?.owner !== seat) continue;
        for (const to of UPGRADE_TO) moves.push({ t: "upgrade", hex, to });
    }
    moves.push({ t: "advanceTrack", track: "sailing" }, { t: "advanceTrack", track: "terraforming" });
    for (const discipline of DISCIPLINES) {
        for (const space of [0, 1, 2, 3, "return"] as const) moves.push({ t: "sendScholar", discipline, space });
    }
    for (const id of POWER_ACTION_IDS) moves.push({ t: "powerAction", id });
    // 书本行动：每一种付法；"免费升行会"再配上每个工坊，或者不升
    const workshops = landHexes(state).filter((hex) => state.hexes[hex].structure?.owner === seat && state.hexes[hex].structure?.type === "workshop");
    for (const id of state.board.bookActions) {
        for (const books of bookSplits(BOOK_ACTION_COST[id], p.books)) {
            moves.push({ t: "bookAction", id, books });
            if (id === "freeGuild") for (const hex of workshops) moves.push({ t: "bookAction", id, books, hex });
        }
    }
    if (p.bonusTile !== null) moves.push({ t: "specialAction", source: `bonus:${p.bonusTile}` });
    if (state.round === LAST_ROUND) {
        moves.push({ t: "pass", bonusTile: null });
    } else {
        for (const t of state.board.bonusTiles) moves.push({ t: "pass", bonusTile: t.id });
    }
    moves.push({ t: "endTurn" });
    // 自由行动：各做 1 次
    for (const conversion of CONVERSION_IDS) {
        if (NEEDS_COLOR.includes(conversion)) {
            for (const color of DISCIPLINES) moves.push({ t: "convert", conversion, times: 1, color });
        } else {
            moves.push({ t: "convert", conversion, times: 1 });
        }
    }
    moves.push({ t: "sacrificePower", times: 1 });
    return moves;
}

