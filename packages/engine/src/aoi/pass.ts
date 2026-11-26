// 主行动"pass"：这一轮不再行动。
//  1. 拿手上回合奖励板块的 pass 奖励（按自己的某种建筑数量得分、或者学科前进）
//  2. 从场上拿一块新的回合奖励板块，连同上面积攒的金币（第 6 轮没有这一步）
//  3. 旧的板块放回场上，正面朝上，上面没有金币
//  4. 下一轮的行动顺序按 pass 的先后排
import { LAST_ROUND } from "./constants.js";
import { BONUS_TILES } from "./content/bonusTiles.js";
import { sacrificePower } from "./power.js";
import { structuresOf } from "./reach.js";
import { checkMainAction, type Applied } from "./turn.js";
import type { BonusTileId, BuildingType, Decision, GameEvent, GameState, RuleError, Seat } from "./types.js";

export function validatePass(state: GameState, seat: Seat, bonusTile: BonusTileId | null): RuleError | null {
    const error = checkMainAction(state, seat);
    if (error !== null) return error;
    if (state.round === LAST_ROUND) return bonusTile === null ? null : "bad-move";
    if (bonusTile === null) return "bad-move"; // 第 1~5 轮一定要拿一块
    if (!state.board.bonusTiles.some((t) => t.id === bonusTile)) return "tile-unavailable";
    return null;
}

/** 这位玩家有几座 types 里的建筑 */
function countBuildings(state: GameState, seat: Seat, types: BuildingType[]): number {
    return structuresOf(state, seat).filter((h) => types.some((t) => t === state.hexes[h].structure!.type)).length;
}

/** pass。调用前先用 validatePass 检查 */
export function applyPass(state: GameState, seat: Seat, bonusTile: BonusTileId | null): Applied {
    const p = state.players[seat];
    const events: GameEvent[] = [];
    const pending: Decision[] = [...state.pending];
    let player = p;

    // 1. pass 奖励
    const bonus = p.bonusTile === null ? undefined : BONUS_TILES[p.bonusTile].pass;
    if (bonus !== undefined) {
        const count = countBuildings(state, seat, bonus.buildings);
        if (bonus.vp > 0 && count > 0) {
            player = { ...player, vp: player.vp + bonus.vp * count };
            events.push({ type: "resources", seat, delta: { vp: bonus.vp * count }, reason: "pass" });
        }
        for (let i = 0; i < count * bonus.levels; i++) {
            pending.push({ id: `pass-${state.version}-${i}`, seat, kind: "scienceLevels", levels: 1 });
        }
    }

    // 2、3. 换回合奖励板块（第 6 轮不换）
    let tiles = state.board.bonusTiles;
    if (bonusTile !== null) {
        const taken = tiles.find((t) => t.id === bonusTile)!;
        tiles = tiles.filter((t) => t.id !== bonusTile);
        if (p.bonusTile !== null) tiles = [...tiles, { id: p.bonusTile, coins: 0 }];
        player = { ...player, bonusTile, coins: player.coins + taken.coins };
        events.push({ type: "tileTaken", seat, tile: bonusTile, kind: "bonus" });
        if (taken.coins > 0) events.push({ type: "resources", seat, delta: { coins: taken.coins }, reason: "bonusTile" });
    }

    // 最后一轮（第 6 轮）pass 以后不会再行动了：碗 II 里能牺牲的能量全部牺牲掉，碗 III 里的能量终局时能换分
    const sacrifices = Math.floor(player.power[1] / 2);
    if (state.round === LAST_ROUND && sacrifices > 0) {
        player = { ...player, power: sacrificePower(player.power, sacrifices)! };
    }

    // 4. 记下 pass 的先后，下一轮按这个顺序行动
    player = { ...player, passed: true };
    events.push({ type: "passed", seat, bonusTile });
    return {
        state: {
            ...state,
            players: state.players.map((q) => (q.seat === seat ? player : q)),
            board: { ...state.board, bonusTiles: tiles },
            nextTurnOrder: [...state.nextTurnOrder, seat],
            pending,
            turn: { ...state.turn!, mainActionDone: true },
        },
        events,
    };
}