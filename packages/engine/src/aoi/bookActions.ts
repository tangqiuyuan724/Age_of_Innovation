// 主行动"书本行动"：付书，做本局翻开的 3 个书本行动之一。和能量行动一样，每一格每轮只能用一次。
// 付书时颜色随意，只要总数对。只要付得起就能做，拿到的效果可以放弃（免费升行会不填 hex，学科前进、铲子的决策选放弃）。
import { BOOK_ACTION_COST, DISCIPLINES } from "./constants.js";
import { structuresOf } from "./reach.js";
import { addBundles, gainResources, negateBundle, payResources } from "./resources.js";
import { checkMainAction, type Applied } from "./turn.js";
import type {
    BookActionId, BookPayment, Decision, GameEvent, GameState, HexId, ResourceBundle, RuleError, Seat,
} from "./types.js";

/** 付的书：每种颜色都是学科颜色、都是不小于 0 的整数，总数正好是 cost。不对返回 false */
function isValidPayment(books: BookPayment, cost: number): boolean {
    let total = 0;
    for (const [color, n] of Object.entries(books)) {
        if (!(DISCIPLINES as readonly string[]).includes(color)) return false; // 不能付灰色，也不能写错颜色
        if (!Number.isInteger(n) || n! < 0) return false;
        total += n!;
    }
    return total === cost;
}

/** 免费升行会：不填 hex 就是放弃升级；填了的话，hex 上要有自己的工坊（不能是中立建筑），规划板上还有行会 */
function validateFreeGuild(state: GameState, seat: Seat, hex: HexId | undefined): RuleError | null {
    if (hex === undefined) return null;
    const s = state.hexes[hex]?.structure;
    if (s === undefined || s === null || s.owner !== seat) return "no-own-building";
    if (s.neutral || s.type !== "workshop") return "cannot-upgrade";
    if (state.players[seat].buildingsLeft.guild === 0) return "limit-reached";
    return null;
}

export function validateBookAction(
    state: GameState, seat: Seat, id: BookActionId, books: BookPayment, hex?: HexId,
): RuleError | null {
    const error = checkMainAction(state, seat);
    if (error !== null) return error;
    if (!state.board.bookActions.includes(id)) return "bad-move"; // 这一局没翻开这个行动
    if (state.board.bookActionsUsed.includes(id)) return "action-taken";
    if (!isValidPayment(books, BOOK_ACTION_COST[id])) return "bad-move";
    if (payResources(state.players[seat], { books }) === null) return "insufficient-resources";
    if (id === "freeGuild") return validateFreeGuild(state, seat, hex);
    if (hex !== undefined) return "bad-move"; // 别的书本行动不用填 hex
    return null;
}

/** 做书本行动。调用前先用 validateBookAction 检查 */
export function applyBookAction(
    state: GameState, seat: Seat, id: BookActionId, books: BookPayment, hex?: HexId,
): Applied {
    let player = payResources(state.players[seat], { books })!;
    let hexes = state.hexes;
    const pending: Decision[] = [...state.pending];
    const turn = state.turn!;
    let builtHexes = turn.builtHexes;
    const events: GameEvent[] = [];

    let gain: ResourceBundle = {};
    if (id === "power5") gain = { power: 5 };
    if (id === "coins6") gain = { coins: 6 };
    if (id === "guildVp") {
        const guilds = structuresOf(state, seat).filter((h) => state.hexes[h].structure!.type === "guild").length;
        gain = { vp: 2 * guilds };
    }
    player = gainResources(player, gain).player;

    if (id === "levels2") pending.push({ id: `levels-${state.version}`, seat, kind: "scienceLevels", levels: 2 });
    if (id === "spade3") pending.push({ id: `spades-${state.version}`, seat, kind: "spades", spades: 3, canBuild: true });
    if (id === "freeGuild" && hex !== undefined) {
        // 和升级一样：行会从规划板上拿走，工坊放回去；算作建造，回合结束时邻居可以吸能
        const h = state.hexes[hex];
        hexes = { ...hexes, [hex]: { ...h, structure: { ...h.structure!, type: "guild" } } };
        const left = player.buildingsLeft;
        player = { ...player, buildingsLeft: { ...left, guild: left.guild - 1, workshop: left.workshop + 1 } };
        builtHexes = [...builtHexes, hex];
        events.push({ type: "upgraded", seat, hex, from: "workshop", to: "guild" });
    }
    events.push({ type: "resources", seat, delta: addBundles(negateBundle({ books }), gain), reason: "bookAction" });

    return {
        state: {
            ...state,
            hexes,
            players: state.players.map((q) => (q.seat === seat ? player : q)),
            board: { ...state.board, bookActionsUsed: [...state.board.bookActionsUsed, id] },
            pending,
            turn: { ...turn, mainActionDone: true, builtHexes },
        },
        events,
    };
}