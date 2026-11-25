// 实物图片：由 tools/assets/make_game_assets.py 从 Images 文件夹生成到 public/game-assets/。
// 这些图只在你自己电脑上有（不提交、不发布）。整个桌面都靠它们画，
// 某张图加载失败时，Table 顶上会出现"缺少素材"的提示，告诉你运行哪个脚本。
import { create } from "zustand";

export type AssetKind =
    | "faction" | "planning" | "competency" | "palace" | "bonus" | "bookAction"
    | "roundScore" | "finalRound" | "marker" | "book" | "board" | "terrain" | "powerAction" | "cityTile";

/** public 文件夹里的文件，网页上从根路径 / 开始就能访问到 */
export function assetUrl(kind: AssetKind, id: string | number): string {
    return `/game-assets/${kind}/${id}.webp`;
}

/** 加载失败的图片地址。有一个就在页面顶上提示一次 */
export const useMissingAssets = create<{ urls: string[] }>(() => ({ urls: [] }));

export function reportMissing(url: string) {
    const { urls } = useMissingAssets.getState();
    if (!urls.includes(url)) useMissingAssets.setState({ urls: [...urls, url] });
}
