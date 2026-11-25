import "./aoi.css";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { GameState, HexId, Move, Seat } from "@aoi/engine/aoi";
import { ActionRow } from "./ActionRow.tsx";
import { useMissingAssets } from "./assets.ts";
import type { Namer } from "./describe.ts";
import { DisplayBoard } from "./DisplayBoard.tsx";
import { GameLog, type LogEntry } from "./GameLog.tsx";
import { HexPanel } from "./HexPanel.tsx";
import { MapBoard } from "./MapBoard.tsx";
import { boardLabels, mapGeometry, reachableEmpty } from "./mapView.ts";
import { decisionTargets, passChoices } from "./options.ts";
import { PlayerBoard } from "./PlayerBoard.tsx";
import { PlayerList } from "./PlayerList.tsx";
import { PromptBar } from "./PromptBar.tsx";
import { RoundTrack } from "./RoundTrack.tsx";
import { ScienceBoard } from "./ScienceBoard.tsx";
import { SetupPanel } from "./SetupPanel.tsx";
import { BonusTiles, CityAndPalaceTiles } from "./SupplyTiles.tsx";

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
    /** 提示（比如引擎拒绝了一条指令） */
    notice?: string | null;
    onCloseNotice?: () => void;
    /** 提示条右边的按钮 */
    tools?: ReactNode;
}

/**
 * 整张桌面，照实物摆：
 *   上：提示条（轮到谁、做什么）
 *   左：回合轨　中：地图和行动格　右：学科板、能力板块、回合奖励板块、城市和宫殿板块　最右：玩家和日志
 *   地图下面：正在查看的那位玩家的玩家板（开局时是选组合 / 轮抽）
 * 预览页和本地试玩共用这一个组件，区别只在有没有 send。M2 接上服务器后，send 换成"发给服务器"
 */
export function Table({ state, name, me, send, log, notice, onCloseNotice, tools }: Props) {
    const geo = mapGeometry(state.options.mapId);
    const labels = useMemo(() => boardLabels(geo), [geo]);
    const namer: Namer = { name, hex: (id) => labels[id] ?? id };
    const missing = useMissingAssets((s) => s.urls);

    // 正在查看谁的玩家板。默认看操作的人；点右边的玩家卡片切换
    const [viewed, setViewed] = useState<Seat>(me);
    const [selected, setSelected] = useState<HexId | null>(null);
    // pass 的时候先进入"选回合奖励板块"
    const [passing, setPassing] = useState(false);

    // 换人操作了（本地试玩时轮到下一个人），就切到这个人的玩家板
    useEffect(() => {
        setViewed(me);
        setSelected(null);
    }, [me]);
    // 每执行一步（version 变了），关掉格子卡片和 pass 选择，免得上面的选项已经过时
    useEffect(() => {
        setSelected(null);
        setPassing(false);
    }, [state.version]);

    const actor = send ? me : null;
    const d = state.pending[0];
    const myDecision = d !== undefined && actor !== null && d.seat === actor ? d : null;
    // 能做主行动：轮到操作的人、还没做主行动、没有人在等决定、不在选 pass 板块
    const canAct = actor !== null && state.turn?.seat === actor && !state.turn.mainActionDone && state.pending.length === 0;

    const reach = useMemo(() => reachableEmpty(geo, state, viewed), [geo, state, viewed]);
    const targets = useMemo(() => (actor !== null ? decisionTargets(state, geo, actor) : new Set<HexId>()), [actor, state, geo]);
    // 放初始工坊、用免费铲子时，地图上只画能点的格子，不画可达范围，免得太乱
    const showReach = targets.size === 0 && state.phase !== "setup";
    const viewedPlayer = state.players[viewed];
    const choosingSetup = d !== undefined && (d.kind === "pickSet" || d.kind === "draftPick");

    return (
        <div className="aoi-root table">
            <PromptBar
                state={state} actor={actor} name={name} hexName={namer.hex} send={send}
                passing={passing && canAct} onPassing={setPassing} tools={tools}
            />

            {(notice || missing.length > 0) && (
                <div className="toasts">
                    {notice && (
                        <p className="toast" role="alert">
                            {notice}
                            {onCloseNotice && <button type="button" onClick={onCloseNotice} aria-label="关闭提示">×</button>}
                        </p>
                    )}
                    {missing.length > 0 && (
                        <p className="toast toast-assets" role="alert">
                            缺少 {missing.length} 张素材图（比如 {missing[0]}）。在仓库根目录运行
                            <code>python3 tools/assets/make_game_assets.py</code>，然后刷新页面。
                        </p>
                    )}
                </div>
            )}

            <RoundTrack state={state} />

            <main className="table-map">
                <div className="map-wrap">
                    <MapBoard
                        geo={geo} state={state} name={name}
                        reach={showReach ? reach : []}
                        targets={targets}
                        selected={selected}
                        onHexClick={(id) => setSelected(id === selected ? null : id)}
                    />
                    {selected !== null && (
                        <HexPanel
                            geo={geo} state={state} hex={selected} name={name}
                            viewed={viewedPlayer ? viewed : me}
                            actor={actor} send={send}
                            onClose={() => setSelected(null)}
                        />
                    )}
                </div>
                <ActionRow state={state} actor={canAct && !passing ? actor : null} hexName={namer.hex} send={send} />
                {showReach && viewedPlayer && (
                    <p className="map-legend">虚线框：{name(viewed)}能到达的空格和改造要几铲。点任意格子看详情{send ? "、在那里行动" : ""}</p>
                )}
            </main>

            <aside className="table-side" aria-label="公共版图">
                <ScienceBoard
                    state={state} name={name}
                    actor={canAct && !passing ? actor : null}
                    choosingLevels={myDecision?.kind === "scienceLevels" ? { seat: myDecision.seat, id: myDecision.id } : null}
                    send={send}
                />
                <DisplayBoard
                    state={state} name={name}
                    choosing={myDecision?.kind === "competency" ? { seat: myDecision.seat, id: myDecision.id, options: myDecision.options } : null}
                    send={send}
                />
                <BonusTiles state={state} name={name} passing={passing && canAct ? passChoices(state, actor!) : null} send={send} />
                <CityAndPalaceTiles
                    state={state}
                    choosingCity={myDecision?.kind === "cityTile" ? { id: myDecision.id, options: myDecision.options } : null}
                    choosingPalace={myDecision?.kind === "palaceTile" ? { id: myDecision.id, options: myDecision.options } : null}
                    send={send}
                />
            </aside>

            <aside className="table-feed" aria-label="玩家和日志">
                <PlayerList state={state} name={name} me={me} meLabel={send ? "操作中" : "你"} viewed={viewed} onView={setViewed} />
                {log && (
                    <section className="feed-log" aria-label="日志">
                        <h3 className="supply-title">日志</h3>
                        <GameLog entries={log} state={state} namer={namer} />
                    </section>
                )}
            </aside>

            <section className="table-boards">
                {choosingSetup || viewedPlayer === undefined
                    ? <SetupPanel state={state} actor={actor} name={name} send={send} />
                    : <PlayerBoard p={viewedPlayer} name={name(viewed)} isMe={viewed === me} />}
            </section>
        </div>
    );
}
