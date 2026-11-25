// 资源的小图标。书用扫描图（Art kind="book"）；金币、工具、钥匙、能量在 Images 里没有单独的图，
// 照实物画成 SVG：金币是金色圆片，工具是白色小方块，钥匙是金色的，能量是紫色圆片。
import type { Discipline } from "@aoi/engine/aoi";
import { BOOK_NAME } from "./labels.ts";
import { Art } from "./pieces.tsx";

const BOX = { width: 18, height: 18, viewBox: "0 0 18 18", "aria-hidden": true } as const;

export function CoinIcon({ size = 18 }: { size?: number }) {
    return (
        <svg {...BOX} width={size} height={size} className="icon">
            <circle cx="9.6" cy="9.8" r="7.6" fill="rgba(0,0,0,.35)" />
            <circle cx="9" cy="9" r="7.6" fill="#D7A538" stroke="#7A5512" strokeWidth="1" />
            <circle cx="9" cy="9" r="5" fill="#E9C25A" stroke="#9C7420" strokeWidth=".8" />
            <path d="M6.2 6.8a4 4 0 0 1 4.6-1.6" stroke="#FFF1C2" strokeWidth="1" fill="none" strokeLinecap="round" />
        </svg>
    );
}

export function ToolIcon({ size = 18 }: { size?: number }) {
    return (
        <svg {...BOX} width={size} height={size} className="icon">
            <path d="M9 2.2l6 3.2v7.2l-6 3.2-6-3.2V5.4z" fill="rgba(0,0,0,.3)" transform="translate(.6 .8)" />
            <path d="M9 2.2l6 3.2-6 3.2-6-3.2z" fill="#FBFAF6" stroke="#6E6A60" strokeWidth=".8" strokeLinejoin="round" />
            <path d="M3 5.4l6 3.2v7.2l-6-3.2z" fill="#D9D5CA" stroke="#6E6A60" strokeWidth=".8" strokeLinejoin="round" />
            <path d="M15 5.4l-6 3.2v7.2l6-3.2z" fill="#BDB8AB" stroke="#6E6A60" strokeWidth=".8" strokeLinejoin="round" />
        </svg>
    );
}

export function KeyIcon({ size = 18 }: { size?: number }) {
    return (
        <svg {...BOX} width={size} height={size} className="icon">
            <circle cx="5.4" cy="9" r="3.5" fill="none" stroke="#7A5512" strokeWidth="3" />
            <circle cx="5.4" cy="9" r="3.5" fill="none" stroke="#E2B84C" strokeWidth="1.6" />
            <path d="M8.8 9h7.4M13.4 9v3.2M15.6 9v2.4" stroke="#7A5512" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M8.8 9h7.4M13.4 9v3.2M15.6 9v2.4" stroke="#E2B84C" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>
    );
}

export function PowerIcon({ size = 18 }: { size?: number }) {
    return (
        <svg {...BOX} width={size} height={size} className="icon">
            <ellipse cx="9.4" cy="11" rx="6.6" ry="4.6" fill="rgba(0,0,0,.35)" />
            <ellipse cx="9" cy="10.2" rx="6.6" ry="4.6" fill="#4B2A72" stroke="#21102F" strokeWidth=".8" />
            <ellipse cx="9" cy="8.6" rx="6.6" ry="4.6" fill="#7B4DB0" stroke="#21102F" strokeWidth=".8" />
            <ellipse cx="7.4" cy="7.6" rx="2.6" ry="1.2" fill="#C9A9EC" opacity=".55" />
        </svg>
    );
}

/** 一本书（扫描图） */
export function BookIcon({ color }: { color: Discipline }) {
    return <Art kind="book" id={color} alt={`${BOOK_NAME[color]}书`} className="icon icon-book" />;
}
