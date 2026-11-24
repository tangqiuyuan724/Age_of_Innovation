// 颜色：玩家的颜色就是他家园地形的颜色；能量专用紫色。
import type { Discipline, Terrain } from "@aoi/engine/aoi";

export const TERRAIN_COLOR: Record<Terrain, string> = {
    desert: "#E2BF55",
    plains: "#9A6B3F",
    swamp: "#3A3935",
    lake: "#4C8DC3",
    forest: "#3E7A45",
    mountain: "#9AA0A3",
    wasteland: "#B4463A",
};

/** 河流：比湖泊浅得多，一眼能分开"河"和"湖泊地形" */
export const WATER_COLOR = "#CFE0E6";

/** 深色地形上的文字要用浅色 */
export function inkOn(t: Terrain): string {
    return t === "swamp" || t === "forest" || t === "wasteland" || t === "plains" ? "#F6F7F3" : "#1F2F38";
}

export const DISCIPLINE_COLOR: Record<Discipline, string> = {
    banking: "#B8862B",
    law: "#3D6FA6",
    engineering: "#7A6A58",
    medicine: "#3E8A62",
};
