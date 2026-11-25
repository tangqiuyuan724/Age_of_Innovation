// 颜色：玩家的颜色就是他家园地形的颜色（木头棋子也是这个颜色）。
import type { Terrain } from "@aoi/engine/aoi";

export const TERRAIN_COLOR: Record<Terrain, string> = {
    desert: "#E2BF55",
    plains: "#9A6B3F",
    swamp: "#3A3935",
    lake: "#4C8DC3",
    forest: "#3E7A45",
    mountain: "#9AA0A3",
    wasteland: "#B4463A",
};

/** 把颜色调深（amount > 0）或调浅（amount < 0），amount 是 -1 ~ 1。木头棋子的侧面、高光用 */
export function shade(hex: string, amount: number): string {
    const n = parseInt(hex.slice(1), 16);
    const target = amount > 0 ? 0 : 255;
    const t = Math.abs(amount);
    const mix = (c: number) => Math.round(c + (target - c) * t);
    const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** 中立建筑（不属于任何人）用的浅色木头 */
export const NEUTRAL_WOOD = "#D9CFBA";
