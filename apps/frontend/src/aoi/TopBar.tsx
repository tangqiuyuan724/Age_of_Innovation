import type { ReactNode } from "react";
import type { GameState, Seat } from "@aoi/engine/aoi";
import { TERRAIN_COLOR } from "./colors.ts";
import { PHASE_NAME, TERRAIN_NAME, factionName } from "./labels.ts";
import { useViewPrefs } from "./TileImage.tsx";

interface Props {
    state: GameState;
    /** 现在由谁操作（卡片上标"操作中"）；只读预览时是"我"的座位 */
    me: Seat | null;
    viewed: Seat;
    onView: (seat: Seat) => void;
    name: (seat: Seat) => string;
    /** "me"那位玩家卡片上的小标签：预览时是"你"，本地试玩时是"操作中" */
    meLabel?: string;
    /** 顶栏右边放的按钮（本地试玩：撤销、重新开始） */
    tools?: ReactNode;
}

/** 顶栏：第几轮、哪个阶段，以及按本轮行动顺序排好的玩家卡片。点卡片切换"正在查看谁" */
export function TopBar({ state, me, viewed, onView, name, meLabel = "你", tools }: Props) {
    const images = useViewPrefs((s) => s.images);
    const toggleImages = useViewPrefs((s) => s.toggleImages);

    return (
        <header className="topbar">
            <div className="round">
                <span className="round-num">{state.round === 0 ? "开局" : `第 ${state.round} 轮`}</span>
                <span className="round-sub">{PHASE_NAME[state.phase]}</span>
            </div>

            <ol className="rounds" aria-label="六轮的计分板块">
                {state.board.roundScores.map((id, i) => {
                    const r = i + 1;
                    const cls = r === state.round ? "rounds-now" : r < state.round ? "rounds-past" : "";
                    return (
                        <li key={id} className={cls} title={`第 ${r} 轮计分：${id}`}>
                            <span className="num">{r}</span>
                            <span className="rounds-tile">{id}</span>
                        </li>
                    );
                })}
                <li className="rounds-final" title={`终局计分：${state.board.finalRoundScore}`}>
                    <span>终局</span>
                    <span className="rounds-tile">{state.board.finalRoundScore}</span>
                </li>
            </ol>

            <ol className="seats" aria-label="本轮行动顺序，点一位玩家查看 TA 的玩家板">
                {state.turnOrder.map((seat, i) => {
                    // 开局还没选完时，玩家还不存在（players 是空数组）
                    const p = state.players[seat];
                    const active = state.turn?.seat === seat;
                    const deciding = state.pending.some((d) => d.seat === seat);
                    const status = p?.passed ? "已结束本轮" : active ? "正在行动" : deciding ? "等 TA 决定" : "";
                    return (
                        <li key={seat}>
                            <button
                                type="button"
                                className={"seat" + (seat === viewed ? " seat-viewed" : "") + (p?.passed ? " seat-passed" : "")}
                                aria-pressed={seat === viewed}
                                onClick={() => onView(seat)}
                                style={{ ["--seat-color" as string]: p ? TERRAIN_COLOR[p.homeTerrain] : "var(--rule)" }}
                            >
                                <span className="seat-order num" aria-label={`第 ${i + 1} 个行动`}>{i + 1}</span>
                                <span className="seat-name">
                                    {name(seat)}
                                    {seat === me && <span className="seat-me">{meLabel}</span>}
                                    {status && <span className={active ? "seat-status seat-status-active" : "seat-status"}>{status}</span>}
                                </span>
                                <span className="seat-faction">{p ? `${factionName(p.faction)}，${TERRAIN_NAME[p.homeTerrain]}` : "还没选派系"}</span>
                                <span className="seat-vp"><span className="num">{p ? p.vp : "—"}</span>{p && "分"}</span>
                            </button>
                        </li>
                    );
                })}
            </ol>

            <div className="topbar-tools">
                <button type="button" className="tool" aria-pressed={images} onClick={toggleImages} title="板块用实物图片还是扁平样式（实物图要先运行 tools/assets 里的脚本）">
                    {images ? "实物图：开" : "实物图：关"}
                </button>
                {tools}
                <a className="topbar-back" href="#">回大厅</a>
            </div>
        </header>
    );
}
