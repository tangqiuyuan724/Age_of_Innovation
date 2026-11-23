// 抢 21：玩家轮流给总数加 1~3，谁正好加到 21 谁赢。
// 这个文件里只有纯函数：不联网、不读时间、不改传进来的对象。

export type Seat = number;

export interface GameState {
    version: number; // 每执行一步 +1
    total: number;   // 当前总数
    target: number;  // 目标数（默认 21）
    turnOrder: Seat[];   // 行动顺序
    activeIndex: number; // 轮到 turnOrder 里的第几个人
    winner: Seat | null;  // 还没人赢时是 null
}

export type Move = { t: "add"; n: number };

export type RuleError = "game-over" | "not-your-turn" | "bad-amount" | "overshoot"

export type GameEvent =
    | { type: "added"; seat: Seat; n: number; total: number }
    | { type: "won"; seat: Seat };

export function createGame(seats: Seat[], target = 21): GameState {
    return { version: 0, total: 0, target, turnOrder: [...seats], activeIndex: 0, winner: null };
}

export function activeSeat(state: GameState): Seat | null {
    if (state.winner != null) return null;
    return state.turnOrder[state.activeIndex];
}

export function validateMove(state: GameState, seat: Seat, move: Move): RuleError | null {
    if (state.winner !== null) return "game-over";
    if (activeSeat(state) != seat) return "not-your-turn";
    if (!Number.isInteger(move.n) || move.n < 1 || move.n > 3) return "bad-amount";
    if (state.total + move.n > state.target) return "overshoot";
    return null;
}

export function applyMove(
    state: GameState,
    seat: Seat,
    move: Move
): { state: GameState, events: GameEvent[] } {
    const error = validateMove(state, seat, move);
    if (error) throw new Error(`illegal move: ${error}`);

    const total = state.total + move.n;
    const events: GameEvent[] = [{ type: "added", seat, n: move.n, total }];
    const won = total === state.target;
    if (won) events.push({ type: "won", seat });

    const next: GameState = {
        ...state,
        version: state.version + 1,
        total,
        winner: won ? seat : null,
        activeIndex: won ? state.activeIndex : (state.activeIndex + 1) % state.turnOrder.length
    };
    return { state: next, events };
}

export function getLegalMoves(state: GameState, seat: Seat): Move[] {
    const candidates: Move[] = [1, 2, 3].map((n) => ({ t: "add", n }));
    return candidates.filter((m) => validateMove(state, seat, m) === null);
}