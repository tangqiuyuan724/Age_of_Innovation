// 学科：在 4 门学科上前进。规则印在学科展示板上：
//  - 升到 3、5、7、12 级时获得能量
//  - 升到 8 级以上要有城市钥匙，而且每门学科各要一把
//  - 12 级每门学科只能有一个人
// 超过上限的等级作废。
import { DISCIPLINES, SCIENCE_KEY_THRESHOLD, SCIENCE_MAX, SCIENCE_POWER } from "./constants.js";
import { gainPower } from "./power.js";
import type { Applied } from "./turn.js";
import type { Discipline, GameEvent, GameState, PlayerState, RuleError, Seat } from "./types.js";

/** 这位玩家在这门学科上最多能升到几级 */
export function scienceCap(state: GameState, seat: Seat, discipline: Discipline): number {
    const p = state.players[seat];
    if (p.science[discipline] <= SCIENCE_KEY_THRESHOLD) {
        // 已经越过 7 级的其他学科，各用掉一把钥匙
        const keysUsed = DISCIPLINES.filter((d) => d !== discipline && p.science[d] > SCIENCE_KEY_THRESHOLD).length;
        if (keysUsed >= p.keys) return SCIENCE_KEY_THRESHOLD;
    }
    const owner = state.board.level12[discipline];
    if (owner !== null && owner !== seat) return SCIENCE_MAX - 1;
    return SCIENCE_MAX;
}

/**
 * 在一门学科上前进 levels 级，超过上限的部分作废。
 * 经过 3、5、7、12 级时拿能量；升到 12 级时占住这门学科的 12 级。
 */
export function advanceScience(state: GameState, seat: Seat, discipline: Discipline, levels: number): Applied {
    const p = state.players[seat];
    const from = p.science[discipline];
    const to = Math.min(from + levels, scienceCap(state, seat, discipline));
    if (to <= from) return { state, events: [] };

    let gained = 0; // 经过的能量格加起来
    for (let level = from + 1; level <= to; level++) gained += SCIENCE_POWER[level] ?? 0;
    const player: PlayerState = {
        ...p,
        science: { ...p.science, [discipline]: to },
        power: gainPower(p.power, gained).bowls,
    };
    const level12 = to === SCIENCE_MAX ? { ...state.board.level12, [discipline]: seat } : state.board.level12;

    const events: GameEvent[] = [{ type: "science", seat, discipline, from, to }];
    if (gained > 0) events.push({ type: "resources", seat, delta: { power: gained }, reason: "science" });
    return {
        state: {
            ...state,
            players: state.players.map((q) => (q.seat === seat ? player : q)),
            board: { ...state.board, level12 },
        },
        events,
    };
}

// ---------- 决策：选一门学科前进 ----------

export function validateScienceLevels(state: GameState, seat: Seat, discipline: Discipline): RuleError | null {
    const d = state.pending[0];
    if (d === undefined || d.kind !== "scienceLevels") return "wrong-phase";
    if (d.seat !== seat) return "not-your-decision";
    if (!DISCIPLINES.includes(discipline)) return "invalid-choice";
    return null;
}

/** 在选的学科上前进，决策移出队列。调用前先用 validateScienceLevels 检查 */
export function applyScienceLevels(state: GameState, seat: Seat, discipline: Discipline): Applied {
    const d = state.pending[0];
    if (d.kind !== "scienceLevels") throw new Error("队列第一个不是选学科");
    return advanceScience({ ...state, pending: state.pending.slice(1) }, seat, discipline, d.levels);
}