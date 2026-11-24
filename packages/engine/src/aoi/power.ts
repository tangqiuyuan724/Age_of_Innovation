import type { PowerBowls } from "./types.js";

/** 最多还能获得多少能量：碗 I 每个指示物能走 2 步，碗 II 每个能走 1 步 */
export function powerCapacity(bowls: PowerBowls): number {
    return bowls[0] * 2 + bowls[1];
}

/** 获得 n 点能量：先把碗 I 移到碗 II；碗 I 空了再把碗 II 移到碗 III */
export function gainPower(bowls: PowerBowls, n: number): { bowls: PowerBowls; gained: number } {
    let [b1, b2, b3] = bowls;
    let gained = 0;
    while (gained < n) {
        if (b1 > 0) { b1--; b2++; }
        else if (b2 > 0) { b2--; b3++; }
        else break;
        gained++;
    }
    return { bowls: [b1, b2, b3], gained };
}

/** 花费 n 点能量：只能从碗 III 花，花掉的回到碗 I。不够时返回 null */
export function spendPower(bowls: PowerBowls, n: number): PowerBowls | null {
    const [b1, b2, b3] = bowls;
    if (b3 < n) return null;
    return [b1 + n, b2, b3 - n];
}

/** 牺牲能量 times 次：每次碗 II 里 1 个移出游戏、1 个移到碗 III。碗 II 不够时返回 null */
export function sacrificePower(bowls: PowerBowls, times: number): PowerBowls | null {
    const [b1, b2, b3] = bowls;
    if (b2 < times * 2) return null;
    return [b1, b2 - times * 2, b3 + times];
}

/**
 * 吸能：邻居建造时，你相邻建筑的能量值合计为 offered。
 * 规则：要么全拿要么不拿，拿 N 点付 N-1 分；
 *  a. 碗不够装时，能拿多少拿多少，按实际拿到的付分；
 *  b. 分数不够付时，分数扣到 0 为止，拿到的能量 = 扣掉的分 + 1。
 * 一点能量都拿不到时返回 null（不发起吸能）。
 */
export function leechOffer(
    offered: number,
    bowls: PowerBowls,
    vp: number,
): { power: number; vpCost: number } | null {
    let power = Math.min(offered, powerCapacity(bowls)); // 例外 a
    if (power <= 0) return null;
    let vpCost = power - 1;
    if (vpCost > vp) {                                    // 例外 b
        vpCost = vp;
        power = vp + 1;
    }
    return { power, vpCost };
}