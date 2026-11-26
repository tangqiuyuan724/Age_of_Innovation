// 主行动"派学者"：把手上 1 个学者放到学科展示板下面一门学科的学者格上，
// 这门学科前进 3 级（第 1 格）或 2 级（其他 3 格），学者永远留在那里；
// 也可以把学者退回供应区，任选学科前进 1 级。
import { DISCIPLINES, SCHOLAR_SPACE_LEVELS } from "./constants.js";
import { advanceScience } from "./science.js";
import { checkMainAction, type Applied } from "./turn.js";
import type { Discipline, GameState, PlayerState, RuleError, Seat } from "./types.js";

/** space：学者格的下标 0~3，或者 "return"（退回供应区） */
export type ScholarSpace = number | "return";

export function validateSendScholar(
    state: GameState, seat: Seat, discipline: Discipline, space: ScholarSpace,
): RuleError | null {
    const error = checkMainAction(state, seat);
    if (error !== null) return error;
    if (!DISCIPLINES.includes(discipline)) return "bad-move";
    if (space !== "return") {
        if (!Number.isInteger(space) || space < 0 || space >= SCHOLAR_SPACE_LEVELS.length) return "bad-move";
        if (state.board.scholarSpaces[discipline][space] !== null) return "space-occupied";
    }
    if (state.players[seat].scholars < 1) return "insufficient-resources";
    return null;
}

/** 派学者。调用前先用 validateSendScholar 检查 */
export function applySendScholar(state: GameState, seat: Seat, discipline: Discipline, space: ScholarSpace): Applied {
    const p = state.players[seat];
    let next: GameState;
    let levels: number;
    if (space === "return") {
        // 退回供应区：以后还能通过收入、能量行动再拿回来
        const player: PlayerState = { ...p, scholars: p.scholars - 1, scholarsInSupply: p.scholarsInSupply + 1 };
        next = { ...state, players: state.players.map((q) => (q.seat === seat ? player : q)) };
        levels = 1;
    } else {
        // 放到学者格上：这个学者就一直留在那里，不回供应区
        const player: PlayerState = { ...p, scholars: p.scholars - 1 };
        const spaces = [...state.board.scholarSpaces[discipline]];
        spaces[space] = seat;
        next = {
            ...state,
            players: state.players.map((q) => (q.seat === seat ? player : q)),
            board: { ...state.board, scholarSpaces: { ...state.board.scholarSpaces, [discipline]: spaces } },
        };
        levels = SCHOLAR_SPACE_LEVELS[space];
    }
    const result = advanceScience(next, seat, discipline, levels);
    return {
        state: { ...result.state, turn: { ...state.turn!, mainActionDone: true } },
        events: [
            { type: "scholarSent", seat, discipline, space },
            { type: "resources", seat, delta: { scholars: -1 }, reason: "sendScholar" },
            ...result.events,
        ],
    };
}