import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type Tab = "players" | "log";

const TABS: { id: Tab; label: string }[] = [
    { id: "players", label: "玩家" },
    { id: "log", label: "日志" },
];

interface Props {
    players: ReactNode;
    /** 日志；只读预览没有日志，这时不显示页签，只有玩家卡片 */
    log: ReactNode | null;
    /** 日志一共几步，用来算"有几步新的还没看" */
    logCount: number;
}

/**
 * 最右一列：玩家 / 日志两个页签，一次只看一个，各自占满这一列的高度。
 * 停在"玩家"时有人走了新的一步，"日志"页签上显示新增了几步
 */
export function FeedTabs({ players, log, logCount }: Props) {
    const [tab, setTab] = useState<Tab>("players");
    // 上次看日志时有几步。撤销、重新开局后日志变短了，也跟着变小
    const [seen, setSeen] = useState(logCount);
    useEffect(() => {
        if (tab === "log" || logCount < seen) setSeen(logCount);
    }, [tab, logCount, seen]);
    const unread = logCount - seen;
    const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ players: null, log: null });

    if (log === null) return <div className="feed-panel">{players}</div>;

    // 页签的键盘操作：左右方向键在两个页签之间切换（页签只有当前这个能用 Tab 键停留）
    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const next: Tab = tab === "players" ? "log" : "players";
        setTab(next);
        tabRefs.current[next]?.focus();
    };

    return (
        <>
            <div className="feed-tabs" role="tablist" aria-label="玩家和日志" onKeyDown={onKeyDown}>
                {TABS.map(({ id, label }) => (
                    <button
                        key={id}
                        ref={(el) => { tabRefs.current[id] = el; }}
                        type="button"
                        role="tab"
                        id={`feed-tab-${id}`}
                        aria-selected={tab === id}
                        aria-controls={`feed-panel-${id}`}
                        tabIndex={tab === id ? 0 : -1}
                        className={tab === id ? "feed-tab feed-tab-on" : "feed-tab"}
                        onClick={() => setTab(id)}
                    >
                        {label}
                        {id === "log" && tab !== "log" && unread > 0 && (
                            <span className="feed-tab-new num" title={`有 ${unread} 步新的记录`}>+{unread}</span>
                        )}
                    </button>
                ))}
            </div>
            {/* 两页都画出来，没选中的藏起来：切回日志时还停在原来滚到的地方 */}
            <div className="feed-panel" role="tabpanel" id="feed-panel-players" aria-labelledby="feed-tab-players" hidden={tab !== "players"}>
                {players}
            </div>
            <div className="feed-panel feed-panel-log" role="tabpanel" id="feed-panel-log" aria-labelledby="feed-tab-log" hidden={tab !== "log"}>
                {log}
            </div>
        </>
    );
}
