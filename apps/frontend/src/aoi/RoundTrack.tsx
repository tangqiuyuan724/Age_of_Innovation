import type { CSSProperties } from "react";
import type { GameState } from "@aoi/engine/aoi";
import { FINAL_ROUND_LABEL, PHASE_NAME, ROUND_SCORE_LABEL } from "./labels.ts";
import { Art } from "./pieces.tsx";

/**
 * 回合板块的格子在回合轨图（416 × 1865 像素）上的位置，单位是百分比。
 * 从上往下是第 6 轮到第 1 轮，每格高 211.5 像素；第 6 轮那格从 y = 586 开始
 */
function slotStyle(round: number, half = false): CSSProperties {
    const top = 586 + (6 - round) * 211.5;
    return {
        top: `${(top / 1865) * 100}%`,
        // 终局板块只盖住右半边
        left: half ? "50.2%" : "5.6%",
        width: half ? "44.4%" : "88.8%",
    };
}

/** 左边一条回合轨：第 1~6 轮的回合计分板块，最上面是终局计分的说明；现在是第几轮就亮哪一格 */
export function RoundTrack({ state }: { state: GameState }) {
    const finalId = state.board.finalRoundScore;
    return (
        <aside className="roundtrack" aria-label="回合轨">
            <p className="roundtrack-now">
                {state.round === 0 ? (
                    <span className="roundtrack-round">开局</span>
                ) : (
                    <>
                        <span className="roundtrack-round">第 {state.round} 轮</span>
                        <span>{PHASE_NAME[state.phase]}</span>
                    </>
                )}
            </p>
            <div className="roundtrack-board">
                <Art kind="board" id="roundTrack" alt="回合轨：上面是终局计分（区域 18/12/6 分，学科 8/4/2 分，5 金币换 1 分）" />
                {state.board.roundScores.map((id, i) => {
                    const round = i + 1;
                    const label = ROUND_SCORE_LABEL[id];
                    const text = label ? `第 ${round} 轮：${label.action}；轮末 ${label.science}` : `第 ${round} 轮的回合计分板块（引擎还没有正式数据）`;
                    const cls = "roundtile" + (round === state.round ? " roundtile-now" : round < state.round ? " roundtile-past" : "");
                    return (
                        <div key={round} className={cls} style={slotStyle(round)}>
                            <Art kind="roundScore" id={label ? id : "back"} alt={text} />
                        </div>
                    );
                })}
                <div className="roundtile roundtile-final" style={slotStyle(6, true)}>
                    <Art kind="finalRound" id={finalId} alt={FINAL_ROUND_LABEL[finalId]} />
                </div>
            </div>
        </aside>
    );
}
