import "./aoi.css";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { GameState, HexId, Move, Seat } from "@aoi/engine/aoi";
import { ActionPanel } from "./ActionPanel.tsx";
import { TERRAIN_COLOR } from "./colors.ts";
import type { Namer } from "./describe.ts";
import type { LogEntry } from "./GameLog.tsx";
import { HexMap } from "./HexMap.tsx";
import { HexPanel } from "./HexPanel.tsx";
import { boardLabels, mapGeometry, reachableEmpty } from "./mapView.ts";
import { decisionTargets } from "./options.ts";
import { PendingBar } from "./PendingBar.tsx";
import { PlayerSheet } from "./PlayerSheet.tsx";
import { SetupPanel } from "./SetupPanel.tsx";
import { SharedBoard } from "./SharedBoard.tsx";
import { TopBar } from "./TopBar.tsx";

interface Props {
    state: GameState;
    name: (seat: Seat) => string;
    /**
     * 现在由谁操作。本地试玩时是"该行动的那个人"（大家轮流坐到电脑前）；
     * 只读预览时是"我"的座位
     */
    me: Seat;
    /** 发指令。不传就是只读预览：能看、能点格子看信息，但没有操作按钮 */
    send?: (move: Move) => void;
    log?: LogEntry[];
    /** 地图上方的提示（比如引擎拒绝了一条指令） */
    notice?: string | null;
    onCloseNotice?: () => void;
    /** 顶栏右边的按钮 */
    tools?: ReactNode;
    /** 地图左下角说明文字后面加的一句 */
    footnote?: string;
}

/**
 * 整张桌面（B 桌面式布局）。预览页和本地试玩共用这一个组件，区别只在有没有 send：
 * 有 send 就显示操作按钮，点了就调用 send(指令)；没有就只读。
 * M2 接上服务器后，send 换成"发给服务器"，这个组件不用改。
 */
export function Table({ state, name, me, send, log, notice, onCloseNotice, tools, footnote }: Props) {
    const geo = mapGeometry(state.options.mapId);
    const labels = useMemo(() => boardLabels(geo), [geo]);
    const namer: Namer = { name, hex: (id) => labels[id] ?? id };

    // 正在查看谁的玩家板。默认看操作的人；点顶栏的玩家卡片切换
    const [viewed, setViewed] = useState<Seat>(me);
    // 地图上选中的格子
    const [selected, setSelected] = useState<HexId | null>(null);

    // 换人操作了（本地试玩时轮到下一个人），就切到这个人的玩家板，并取消选中的格子
    useEffect(() => {
        setViewed(me);
        setSelected(null);
    }, [me]);
    // 每执行一步（version 变了），关掉格子面板，免得面板上显示的选项已经过时
    useEffect(() => setSelected(null), [state.version]);

    const reach = useMemo(() => reachableEmpty(geo, state, viewed), [geo, state, viewed]);
    const targets = useMemo(
        () => (send ? decisionTargets(state, geo, me) : new Set<HexId>()),
        [send, state, geo, me],
    );
    const viewedPlayer = state.players[viewed];
    const d = state.pending[0];
    const choosingSetup = d !== undefined && (d.kind === "pickSet" || d.kind === "draftPick");
    // 放初始工坊、用免费铲子时，地图上只画能点的格子，不画可达范围的虚线框，免得太乱
    const showReach = targets.size === 0 && state.phase !== "setup";

    return (
        <div className={viewed === me ? "aoi-root" : "aoi-root aoi-viewing-other"}>
            <TopBar state={state} me={me} viewed={viewed} onView={setViewed} name={name} meLabel={send ? "操作中" : "你"} tools={tools} />

            <main className="map-area">
                {notice && (
                    <p className="notice" role="alert">
                        {notice}
                        {onCloseNotice && <button type="button" onClick={onCloseNotice} aria-label="关闭提示">×</button>}
                    </p>
                )}
                <PendingBar state={state} actor={send ? me : null} name={name} send={send} />
                <div className="map-frame">
                    <HexMap
                        geo={geo} state={state} name={name}
                        reach={showReach ? reach : []}
                        targets={targets}
                        selected={selected}
                        onHexClick={(id) => setSelected(id === selected ? null : id)}
                    />
                </div>
                {selected !== null && (
                    <HexPanel
                        geo={geo} state={state} hex={selected} name={name}
                        viewed={viewedPlayer ? viewed : me}
                        actor={send ? me : null}
                        send={send}
                        onClose={() => setSelected(null)}
                    />
                )}
                <p className="map-legend">
                    {showReach && viewedPlayer && (
                        <>
                            <span className="legend-dash" aria-hidden />
                            {name(viewed)}能到达的空格，数字是改造成家园地形要几铲
                        </>
                    )}
                    {targets.size > 0 && <>实线框：现在可以点的格子</>}
                    <span className="legend-sep">点任意格子看详情{send ? "、在那里行动" : ""}</span>
                    {footnote && <span className="legend-sep">{footnote}</span>}
                </p>
            </main>

            <SharedBoard state={state} namer={namer} actor={send ? me : null} send={send} log={log} />

            <div className="bottom" style={{ ["--seat-color" as string]: viewedPlayer ? TERRAIN_COLOR[viewedPlayer.homeTerrain] : "var(--rule)" }}>
                {choosingSetup || viewedPlayer === undefined ? (
                    <SetupPanel state={state} actor={send ? me : null} name={name} send={send} />
                ) : (
                    <>
                        <PlayerSheet p={viewedPlayer} name={name(viewed)} isMe={!send && viewed === me} />
                        <ActionPanel
                            state={state} geo={geo} me={me} viewed={viewed} name={name} reach={reach}
                            send={send} onBack={() => setViewed(me)}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
