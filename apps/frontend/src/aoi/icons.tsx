// 资源小图标。全部是手画的简单 SVG，不依赖任何图标库或网络。
// 等真实素材到位后，可以在这里换成图片，调用的地方不用改。

const BOX = { width: 18, height: 18, viewBox: "0 0 18 18", "aria-hidden": true } as const;

export function CoinIcon() {
    return (
        <svg {...BOX} className="icon">
            <circle cx="9" cy="9" r="7.5" fill="#D9A93A" stroke="#93701F" strokeWidth="1.2" />
            <circle cx="9" cy="9" r="4.2" fill="none" stroke="#93701F" strokeWidth="1" />
        </svg>
    );
}

export function ToolIcon() {
    return (
        <svg {...BOX} className="icon">
            <rect x="7.6" y="6" width="2.8" height="10.5" rx="1" fill="#8A6A48" />
            <rect x="3" y="2.2" width="12" height="5" rx="1.2" fill="#6E7B80" />
        </svg>
    );
}

export function ScholarIcon() {
    return (
        <svg {...BOX} className="icon">
            <circle cx="9" cy="5.6" r="3.4" fill="var(--ink)" />
            <path d="M2.8 16.5c0-3.8 2.8-6.2 6.2-6.2s6.2 2.4 6.2 6.2z" fill="var(--ink)" />
        </svg>
    );
}

export function BookIcon({ color }: { color: string }) {
    return (
        <svg {...BOX} className="icon">
            <rect x="3" y="2" width="12" height="14" rx="1.2" fill={color} />
            <rect x="5.2" y="2" width="1.4" height="14" fill="rgba(255,255,255,0.55)" />
        </svg>
    );
}

export function KeyIcon() {
    return (
        <svg {...BOX} className="icon">
            <circle cx="5.5" cy="9" r="3.6" fill="none" stroke="var(--ink)" strokeWidth="2" />
            <path d="M9 9h7.5M13.5 9v3M15.8 9v2.2" stroke="var(--ink)" strokeWidth="2" fill="none" />
        </svg>
    );
}
