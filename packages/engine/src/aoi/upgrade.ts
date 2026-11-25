// 主行动"升级建筑"，以及升级成宫殿后的决策"选宫殿板块"。
import { UPGRADE_COST, UPGRADE_FROM } from "./constants.js";
import { isAdjacent } from "./map.js";
import { geometryOf } from "./reach.js";
import { negateBundle, payResources } from "./resources.js";
import { checkMainAction, type Applied } from "./turn.js";
import type {
    BuildingType, Decision, GameState, HexId, PalaceTileId, PlayerState, ResourceBundle, RuleError, Seat,
} from "./types.js";

/** 可以升级成的建筑：UPGRADE_FROM 的键，也就是 "guild" | "school" | "palace" | "university" */
export type UpgradeTarget = keyof typeof UPGRADE_FROM;

/** 升级的费用。工坊升行会时，旁边有别人的建筑就便宜一些 */
export function upgradeCost(state: GameState, seat: Seat, hex: HexId, to: UpgradeTarget): ResourceBundle {
    if (to !== "guild") return UPGRADE_COST[to];
    const geo = geometryOf(state);
    const neighbor = Object.entries(state.hexes).some(
        ([id, h]) => h.structure !== null && h.structure.owner !== seat && isAdjacent(geo, state.bridges, id, hex),
    );
    return neighbor ? UPGRADE_COST.guildWithNeighbor : UPGRADE_COST.guild;
}

export function validateUpgrade(state: GameState, seat: Seat, hex: HexId, to: UpgradeTarget): RuleError | null {
    const error = checkMainAction(state, seat);
    if (error !== null) return error;
    const s = state.hexes[hex]?.structure;
    if (s === undefined || s === null || s.owner !== seat) return "no-own-building";
    if (s.neutral || s.type !== UPGRADE_FROM[to]) return "cannot-upgrade";
    const p = state.players[seat];
    if (p.buildingsLeft[to] === 0) return "limit-reached";
    if (payResources(p, upgradeCost(state, seat, hex, to)) === null) return "insufficient-resources";
    return null;
}

/**
 * 升级：新建筑从规划板上拿走，旧建筑放回规划板。调用前先用 validateUpgrade 检查。
 * 升级成宫殿时，还没有宫殿板块的人（固定组合开局）要选一个。
 * 升级成学校、大学时拿能力板块，在 M1-5 加。
 */
export function applyUpgrade(state: GameState, seat: Seat, hex: HexId, to: UpgradeTarget): Applied {
    const p = state.players[seat];
    const h = state.hexes[hex];
    const from = h.structure!.type as BuildingType;
    const cost = upgradeCost(state, seat, hex, to);
    const paid = payResources(p, cost)!;
    const player: PlayerState = {
        ...paid,
        buildingsLeft: { ...paid.buildingsLeft, [to]: paid.buildingsLeft[to] - 1, [from]: paid.buildingsLeft[from] + 1 },
    };

    const pending: Decision[] = [...state.pending];
    if (to === "palace" && p.palaceTile === null) {
        pending.push({ id: `palaceTile-${state.version}`, seat, kind: "palaceTile", options: state.board.palaceTilesAvailable });
    }
    const turn = state.turn!;
    return {
        state: {
            ...state,
            hexes: { ...state.hexes, [hex]: { ...h, structure: { ...h.structure!, type: to } } },
            players: state.players.map((q) => (q.seat === seat ? player : q)),
            pending,
            turn: { ...turn, mainActionDone: true, builtHexes: [...turn.builtHexes, hex] },
        },
        events: [
            { type: "upgraded", seat, hex, from, to },
            { type: "resources", seat, delta: negateBundle(cost), reason: "upgrade" },
        ],
    };
}

// ---------- 决策：选宫殿板块 ----------

export function validatePalaceTile(state: GameState, seat: Seat, tile: PalaceTileId): RuleError | null {
    const d = state.pending[0];
    if (d === undefined || d.kind !== "palaceTile") return "wrong-phase";
    if (d.seat !== seat) return "not-your-decision";
    if (!d.options.includes(tile)) return "invalid-choice";
    return null;
}

/** 选宫殿板块：归这位玩家，从场上拿走。调用前先用 validatePalaceTile 检查 */
export function applyPalaceTile(state: GameState, seat: Seat, tile: PalaceTileId): Applied {
    const players = state.players.map((p) => (p.seat === seat ? { ...p, palaceTile: tile } : p));
    const palaceTilesAvailable = state.board.palaceTilesAvailable.filter((t) => t !== tile);
    return {
        state: { ...state, players, board: { ...state.board, palaceTilesAvailable }, pending: state.pending.slice(1) },
        events: [{ type: "tileTaken", seat, tile: String(tile), kind: "palace" }],
    };
}