// 重放：从开局设置、种子和每一步指令，用引擎把局面重新算出来。
// 引擎是纯函数，同样的开局、同样的种子、同样的指令，算出来的局面一模一样。
import { applyMove, createGame, validateMove, type GameState } from "@aoi/engine/aoi";
import type { LoggedStep } from "./GameRoom.js";
import type { SavedGame } from "./store.js";

/**
 * 把存档重放成现在的局面和每一步的日志。
 * 某一步引擎不认了（比如改了规则以后读旧存档），抛错，说明是第几步
 */
export function replay(saved: SavedGame): { state: GameState; steps: LoggedStep[] } {
    let state = createGame(saved.options, saved.seed);
    const steps: LoggedStep[] = [];
    saved.moves.forEach(({ seat, move }, i) => {
        const error = validateMove(state, seat, move);
        if (error !== null) throw new Error(`存档 ${saved.code} 第 ${i + 1} 步重放失败：${error}`);
        const { state: next, events } = applyMove(state, seat, move);
        steps.push({ seat, move, events });
        state = next;
    });
    return { state, steps };
}