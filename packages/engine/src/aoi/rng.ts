// 带种子的随机数。同一个种子永远得到同一串随机数，所以整局游戏可以重放。
// 随机数的"状态"是一个整数，存在 GameState.rng 里；每用一次就换成新的状态。

/** 把任意字符串变成种子（FNV-1a 哈希） */
export function seedFromString(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** 下一个 [0, 1) 之间的随机数。返回 [随机数, 新状态]。算法：mulberry32 */
export function nextRandom(rng: number): [number, number] {
    const next = (rng + 0x6d2b79f5) >>> 0;
    let t = next;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** 0 ~ n-1 之间的随机整数。返回 [整数, 新状态] */
export function randomInt(rng: number, n: number): [number, number] {
    const [r, next] = nextRandom(rng);
    return [Math.floor(r * n), next];
}

/** 洗牌（Fisher-Yates 算法）。不修改原数组，返回 [新数组, 新状态] */
export function shuffle<T>(items: readonly T[], rng: number): [T[], number] {
    const result = [...items];
    let state = rng;
    for (let i = result.length - 1; i > 0; i--) {
        let j: number;
        [j, state] = randomInt(state, i + 1);
        [result[i], result[j]] = [result[j], result[i]];
    }
    return [result, state];
}