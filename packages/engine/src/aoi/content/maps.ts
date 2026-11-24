// 地图数据。每个字符是一格：D 沙漠、P 平原、S 沼泽、L 湖泊、F 森林、M 山脉、W 荒地，~ 是河流。
// 来源：tools/maps/aoi-base.json（M1-2 录入），搬进引擎后服务端和前端都从这里拿。
import type { MapDef } from "../types.ts";

export const MAPS: Record<string, MapDef> = {
    "aoi-base": {
        id: "aoi-base",
        name: "大创造时代版图",
        rows: [
            "F~LSPWM~LSPD~",
            "M~~FLFD~FML~S",
            "WLS~MPS~~W~~W",
            "DMW~DW~S~~PMF",
            "PFPD~~~FMLWDP",
            "S~~~LM~DP~SLW",
            "L~PS~FP~~~~~~",
            "~DL~WSDWSLFS~",
            "FMW~DMPLFMWDP",
        ],
    },
};