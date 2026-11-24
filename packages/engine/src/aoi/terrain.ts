import { TERRAIN_WHEEL } from "./constants.js";
import type { Terrain } from "./types.js";

function wheelIndex(t: Terrain): number {
    return TERRAIN_WHEEL.indexOf(t);
}

/** 两种地形在地形轮上的最短距离 = 改造需要的铲子数（0~3） */
export function terrainDistance(a: Terrain, b: Terrain): number {
    const n = TERRAIN_WHEEL.length;
    const d = Math.abs(wheelIndex(a) - wheelIndex(b));
    return Math.min(d, n - d);
}

/** 从 from 出发，沿最短方向朝 home 改造 spades 步，最多改到 home 为止 */
export function terraformToward(from: Terrain, home: Terrain, spades: number): Terrain {
    const n = TERRAIN_WHEEL.length;
    const i = wheelIndex(from);
    const forward = (wheelIndex(home) - i + n) % n;   // 顺着轮子走要几步
    const dir = forward <= n - forward ? 1 : -1;  // 哪个方向更近
    const steps = Math.min(spades, terrainDistance(from, home));
    return TERRAIN_WHEEL[(((i + dir * steps) % n) + n) % n];
}