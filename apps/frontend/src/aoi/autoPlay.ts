// 随机走：本地试玩时让电脑替大家走几步，用来快速走到想看的局面（比如终局）。
// 能走哪些由引擎的 getLegalMoves 说了算，这里只负责"挑哪一条"。挑法和引擎测试 random.test.ts 里的机器人一样。
import type { GameState, Move } from "@aoi/engine/aoi";

const FREE: Move["t"][] = ["convert", "sacrificePower"];

/**
 * 从能走的指令里挑一条：
 *  - 在做决定：随便挑
 *  - 主行动做完了：结束回合
 *  - 还没做主行动：能建造、升级时多半去建造、升级（地图上东西多，城市、吸能都会出现）；
 *    否则偶尔 pass，别的时候从主行动里随便挑。不做自由行动，免得来回转换
 */
export function pickRandomMove(state: GameState, moves: Move[], random: () => number = Math.random): Move {
    const any = (list: Move[]) => list[Math.floor(random() * list.length)];
    if (state.pending.length > 0) return any(moves);
    const end = moves.find((m) => m.t === "endTurn");
    if (end) return end;
    const passes = moves.filter((m) => m.t === "pass");
    const main = moves.filter((m) => m.t !== "pass" && m.t !== "endTurn" && !FREE.includes(m.t));
    const builds = main.filter((m) => (m.t === "terraformAndBuild" && m.build) || m.t === "upgrade");
    if (builds.length > 0 && random() < 0.7) return any(builds);
    if (main.length === 0 || (passes.length > 0 && random() < 0.15)) return any(passes.length > 0 ? passes : moves);
    return any(main);
}
