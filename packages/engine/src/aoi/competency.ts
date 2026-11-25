// 能力板块：升级成学校、大学时，从展示区选一张自己还没有的。
// 拿到的学科奖励由它在展示区的位置决定：哪一列就是哪门学科，第几行决定几级、几本书。
// 板块本身的效果（收入、立即奖励等）在 M3 实现。
import { COMPETENCY_ROW_REWARD, DISCIPLINES } from "./constants.js";
import { advanceScience } from "./science.js";
import type { Applied } from "./turn.js";
import type { CompetencyId, Discipline, GameState, PlayerState, RuleError, Seat } from "./types.js";

/** 能力板块在展示区的位置：哪门学科那一列、第几行（0~2） */
export function competencyPosition(state: GameState, tile: CompetencyId): { discipline: Discipline; row: number } {
    for (const discipline of DISCIPLINES) {
        const row = state.board.competencyGrid[discipline].indexOf(tile);
        if (row >= 0) return { discipline, row };
    }
    throw new Error(`展示区里没有这种能力板块：${tile}`);
}

/** 这位玩家现在能拿的能力板块：还有剩的、自己还没有的。按展示区一列一列的顺序排 */
export function competencyOptions(state: GameState, seat: Seat): CompetencyId[] {
    const owned = state.players[seat].competencies;
    return DISCIPLINES.flatMap((d) => state.board.competencyGrid[d])
        .filter((id) => state.board.competenciesLeft[id] > 0 && !owned.includes(id));
}

// ---------- 决策：选能力板块 ----------

export function validateCompetency(state: GameState, seat: Seat, tile: CompetencyId): RuleError | null {
    const d = state.pending[0];
    if (d === undefined || d.kind !== "competency") return "wrong-phase";
    if (d.seat !== seat) return "not-your-decision";
    if (!d.options.includes(tile)) return "invalid-choice";
    return null;
}

/** 拿能力板块，按位置拿书和学科等级。调用前先用 validateCompetency 检查 */
export function applyCompetency(state: GameState, seat: Seat, tile: CompetencyId): Applied {
    const { discipline, row } = competencyPosition(state, tile);
    const reward = COMPETENCY_ROW_REWARD[row];
    const p = state.players[seat];
    const player: PlayerState = {
        ...p,
        competencies: [...p.competencies, tile],
        books: { ...p.books, [discipline]: p.books[discipline] + reward.books },
    };
    const taken: GameState = {
        ...state,
        players: state.players.map((q) => (q.seat === seat ? player : q)),
        board: {
            ...state.board,
            competenciesLeft: { ...state.board.competenciesLeft, [tile]: state.board.competenciesLeft[tile] - 1 },
        },
        pending: state.pending.slice(1),
    };
    const result = advanceScience(taken, seat, discipline, reward.levels);
    const events: Applied["events"] = [{ type: "tileTaken", seat, tile, kind: "competency" }];
    if (reward.books > 0) {
        events.push({ type: "resources", seat, delta: { books: { [discipline]: reward.books } }, reason: "competency" });
    }
    return { state: result.state, events: [...events, ...result.events] };
}