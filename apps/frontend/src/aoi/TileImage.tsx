// 实物图片：由 tools/assets/make_game_assets.py 从 Images 文件夹生成到 public/game-assets/。
// 这些图只在你自己电脑上有（不提交、不发布）。找不到图片、或者关掉了"实物图"开关时，
// 显示调用的地方给的扁平样式（fallback），所以没有素材也能正常用。
import { useState, type ReactNode } from "react";
import { create } from "zustand";

export type AssetKind = "faction" | "planning" | "competency" | "palace" | "bonus" | "bookAction";

/** public 文件夹里的文件，网页上从根路径 / 开始就能访问到 */
export function assetUrl(kind: AssetKind, id: string | number): string {
    return `/game-assets/${kind}/${id}.webp`;
}

/** 加载失败过的图片地址。记下来，下次直接用扁平样式，不再白白请求一次 */
const failed = new Set<string>();

// ---------- "实物图"开关：记在浏览器的 localStorage 里，刷新后还在 ----------

const PREF_KEY = "aoi-show-images";

function readPref(): boolean {
    try {
        return localStorage.getItem(PREF_KEY) !== "off";
    } catch {
        return true;   // 有的浏览器设置不允许用 localStorage，那就用默认值
    }
}

interface ViewPrefs {
    images: boolean;
    toggleImages: () => void;
}

export const useViewPrefs = create<ViewPrefs>((set, get) => ({
    images: readPref(),
    toggleImages: () => {
        const images = !get().images;
        try {
            localStorage.setItem(PREF_KEY, images ? "on" : "off");
        } catch {
            // 存不了就算了，只是刷新后会回到默认值
        }
        set({ images });
    },
}));

// ---------- 图片组件 ----------

interface Props {
    kind: AssetKind;
    id: string | number;
    /** 图片的文字说明（读屏软件读这个，鼠标悬停也显示） */
    alt: string;
    /** 没有图片时显示的东西 */
    fallback: ReactNode;
    className?: string;
}

export function TileImage({ kind, id, alt, fallback, className }: Props) {
    const images = useViewPrefs((s) => s.images);
    const url = assetUrl(kind, id);
    // 记住"哪个地址"失败了，而不是一个 true/false：同一个组件换成别的板块时，新地址还要再试一次
    const [brokenUrl, setBrokenUrl] = useState<string | null>(null);

    if (!images || failed.has(url) || brokenUrl === url) return <>{fallback}</>;
    return (
        <img
            className={className ? `tile-img ${className}` : "tile-img"}
            src={url}
            alt={alt}
            title={alt}
            loading="lazy"
            onError={() => {
                failed.add(url);
                setBrokenUrl(url);
            }}
        />
    );
}
