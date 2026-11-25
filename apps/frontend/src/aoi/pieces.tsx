// 桌面上的"实物"：扫描图（Art）和木头棋子（建筑、学科标记、学者、桥）。
// 棋子没有扫描图，用 SVG 画：正面是玩家色，后面错开一点画一层深色当作木头的厚度，下面一片影子。
import type { StructureType } from "@aoi/engine/aoi";
import { NEUTRAL_WOOD, shade } from "./colors.ts";
import { assetUrl, reportMissing, type AssetKind } from "./assets.ts";

interface ArtProps {
    kind: AssetKind;
    id: string | number;
    /** 图片的文字说明：读屏软件读这个，鼠标悬停也显示 */
    alt: string;
    className?: string;
}

/** 一张扫描图。找不到时记下来，Table 顶上会提示运行生成素材的脚本 */
export function Art({ kind, id, alt, className }: ArtProps) {
    const url = assetUrl(kind, id);
    return (
        <img
            className={className ? `art ${className}` : "art"}
            src={url} alt={alt} title={alt} draggable={false}
            onError={() => reportMissing(url)}
        />
    );
}

/**
 * 建筑的正面轮廓。坐标以棋子中心为原点，大约占 26 × 24 个单位，底边在 y = 9。
 * 形状照实物：工坊是小房子，行会是带厢房的房子，学校是拱顶，大学是带灯笼的圆顶，宫殿是城堡
 */
const OUTLINE: Record<StructureType, string> = {
    workshop: "M-8 9V-1L0-9L8-1V9Z",
    guild: "M-12 9V-2L-5-9L2-2V9ZM2 9V-3H11V9Z",
    school: "M-9 9V-1A9 8.5 0 0 1 9-1V9Z",
    university: "M-12 9V1A12 11 0 0 1 12 1V9ZM-2.2-10V-14.5H2.2V-10Z",
    palace: "M-13 9V-4H-10V-7H-7V-4H-3V-12H3V-4H7V-7H10V-4H13V9Z",
    tower: "M-5.5 9V-6L0-14L5.5-6V9Z",
    monument: "M-6.5 9L-4-8L0-13.5L4-8L6.5 9Z",
};

interface PieceProps {
    type: StructureType;
    /** 玩家色；中立建筑不传 */
    color?: string;
    x: number;
    y: number;
    /** 1 = 原始大小 */
    scale?: number;
}

/** 地图上的一座建筑 */
export function Piece({ type, color, x, y, scale = 1 }: PieceProps) {
    const base = color ?? NEUTRAL_WOOD;
    const d = OUTLINE[type];
    return (
        <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale})`} className="piece">
            <ellipse cx={1.5} cy={9.5} rx={14} ry={3.6} fill="rgba(10,14,20,.45)" />
            {/* 木头的厚度：同一个形状往右上错开，颜色更深 */}
            <path d={d} transform="translate(3 -2.2)" fill={shade(base, 0.42)} stroke="rgba(0,0,0,.6)" strokeWidth={0.8} strokeLinejoin="round" />
            <path d={d} fill={base} stroke="rgba(0,0,0,.62)" strokeWidth={0.9} strokeLinejoin="round" />
            {/* 左上方来的光：正面左边一道亮边 */}
            <path d={d} fill="none" stroke={shade(base, -0.45)} strokeWidth={0.8} opacity={0.55} transform="translate(-0.6 -0.6) scale(.94)" />
        </g>
    );
}

/** 学科轨上的圆柱形标记：用在 SVG 里 */
export function Disc({ color, x, y, r }: { color: string; x: number; y: number; r: number }) {
    return (
        <g className="disc">
            <ellipse cx={x + r * 0.15} cy={y + r * 0.55} rx={r} ry={r * 0.62} fill="rgba(0,0,0,.45)" />
            <ellipse cx={x} cy={y + r * 0.28} rx={r} ry={r * 0.62} fill={shade(color, 0.4)} stroke="rgba(0,0,0,.6)" strokeWidth={r * 0.08} />
            <ellipse cx={x} cy={y} rx={r} ry={r * 0.62} fill={color} stroke="rgba(0,0,0,.55)" strokeWidth={r * 0.08} />
            <ellipse cx={x - r * 0.25} cy={y - r * 0.15} rx={r * 0.45} ry={r * 0.22} fill={shade(color, -0.5)} opacity={0.45} />
        </g>
    );
}

/** 学者：小木人。用在 SVG 里，(x, y) 是底边中点 */
export function Scholar({ color, x, y, h }: { color: string; x: number; y: number; h: number }) {
    const s = h / 20;
    return (
        <g transform={`translate(${x} ${y}) scale(${s})`} className="scholar">
            <ellipse cx={1} cy={0} rx={7} ry={2.2} fill="rgba(0,0,0,.45)" />
            <path d="M-5.6 0C-5.6-7-3-10.5 0-10.5S5.6-7 5.6 0Z" fill={color} stroke="rgba(0,0,0,.6)" strokeWidth={0.8} />
            <circle cx={0} cy={-14} r={4} fill={color} stroke="rgba(0,0,0,.6)" strokeWidth={0.8} />
            <circle cx={-1.3} cy={-15.2} r={1.4} fill={shade(color, -0.5)} opacity={0.5} />
        </g>
    );
}

/** 不在 SVG 里、单独摆在页面上的小棋子（玩家列表、玩家板上用） */
export function PieceIcon({ type, color, size = 22 }: { type: StructureType; color?: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="-15 -16 31 29" aria-hidden className="piece-icon">
            <Piece type={type} color={color} x={0} y={0} />
        </svg>
    );
}

export function ScholarIcon({ color, size = 18 }: { color: string; size?: number }) {
    return (
        <svg width={size * 0.7} height={size} viewBox="-8 -20 16 23" aria-hidden className="piece-icon">
            <Scholar color={color} x={0} y={1} h={20} />
        </svg>
    );
}

/**
 * 派系头像：从派系板的图（520 × 352）中间裁出人物，放进一个圆片里。
 * 图放大到圆片宽度的 2.3 倍，再挪到人物（大约在图的 52%、50% 处）正好在圆心
 */
export function FactionToken({ faction, name, color, size = 28 }: { faction: string; name: string; color: string; size?: number }) {
    const url = assetUrl("faction", faction);
    return (
        <span className="ftoken" style={{ width: size, height: size, ["--seat" as string]: color }} title={name}>
            <img src={url} alt={name} draggable={false} onError={() => reportMissing(url)} />
        </span>
    );
}

/** 木头方块：回合奖励板块上标记"这块是谁的" */
export function CubeIcon({ color, size = 20 }: { color: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden className="piece-icon">
            <path d="M10 2.5l7 3.6v8.2l-7 3.6-7-3.6V6.1z" fill="rgba(0,0,0,.3)" transform="translate(.8 1)" />
            <path d="M10 2.5l7 3.6-7 3.6-7-3.6z" fill={shade(color, -0.25)} stroke="rgba(0,0,0,.6)" strokeWidth=".8" strokeLinejoin="round" />
            <path d="M3 6.1l7 3.6v8.2l-7-3.6z" fill={color} stroke="rgba(0,0,0,.6)" strokeWidth=".8" strokeLinejoin="round" />
            <path d="M17 6.1l-7 3.6v8.2l7-3.6z" fill={shade(color, 0.3)} stroke="rgba(0,0,0,.6)" strokeWidth=".8" strokeLinejoin="round" />
        </svg>
    );
}

/** 桥：一根木条 */
export function BridgeIcon({ color, size = 40 }: { color: string; size?: number }) {
    return (
        <svg width={size} height={size * 0.45} viewBox="0 0 40 18" aria-hidden className="piece-icon">
            <path d="M3 11l30-6 5 3-30 6z" fill="rgba(0,0,0,.3)" transform="translate(1 2)" />
            <path d="M2 8l30-6 5 3-30 6z" fill={shade(color, -0.25)} stroke="rgba(0,0,0,.6)" strokeWidth=".8" strokeLinejoin="round" />
            <path d="M2 8l5 3v4l-5-3z" fill={shade(color, 0.3)} stroke="rgba(0,0,0,.6)" strokeWidth=".8" strokeLinejoin="round" />
            <path d="M7 11l30-6v4L7 15z" fill={color} stroke="rgba(0,0,0,.6)" strokeWidth=".8" strokeLinejoin="round" />
        </svg>
    );
}
