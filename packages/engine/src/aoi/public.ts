// 发给客户端的状态：去掉玩家不该知道的信息。
// 现在只有随机数生成器的内部状态：知道它就能算出以后洗牌、抽板块的结果。
// 双人局背面朝上的区域计分板块、创新板块的牌堆顺序在 M3 加。
import type { GameState } from "./types.js";

export function toPublicState(state: GameState): GameState {
    return { ...state, rng: 0 };
}