import type { GameState } from "@aoi/engine/aoi";
import { FINAL_ROUND_LABEL, PHASE_NAME, ROUND_SCORE_LABEL } from "./labels.ts";
import { boardBox } from "./mapView.ts";
import { Art } from "./pieces.tsx";

/**
 * 回合轨上 6 个格子在底图上的位置（底图像素）：从上往下是第 6 轮到第 1 轮，
 * 每格 157.5 × 82.5，上下相邻两格隔 93.7。终局回合计分板块盖住第 6 轮那格的右半边（从 x = 92 开始）
 */
function slotBox(round: number, finalHalf = false) {
    const top = 297.5 + (6 - round) * 93.7;
    return finalHalf ? boardBox(92, top, 79, 82.5) : boardBox(13.5, top, 157.5, 82.5);
}

/**
 * 回合轨：底图左边那一条。最上面的终局计分说明是图上画好的；
 * 6 个格子里摆上这一局的回合计分板块（每局随机，盖住图上原来的），现在是第几轮就亮哪一格。
 * 整个叠在地图上（Table 里放在 .map-wrap 里面）
 */
export function RoundTrack({ state }: { state: GameState }) {
    const finalId = state.board.finalRoundScore;
    return (
        <div className="roundtrack" aria-label="回合轨">
            <p className="roundtrack-now" style={boardBox(6, 2, 172, 34)}>
                {state.round === 0 ? (
                    <span className="roundtrack-round">开局</span>
                ) : (
                    <>
                        <span className="roundtrack-round">第 {state.round} 轮</span>
                        <span>{PHASE_NAME[state.phase]}</span>
                    </>
                )}
            </p>
            {state.board.roundScores.map((id, i) => {
                const round = i + 1;
                const label = ROUND_SCORE_LABEL[id];
                const text = label ? `第 ${round} 轮：${label.action}；轮末 ${label.science}` : `第 ${round} 轮的回合计分板块`;
                const cls = "roundtile" + (round === state.round ? " roundtile-now" : round < state.round ? " roundtile-past" : "");
                return (
                    <div key={round} className={cls} style={slotBox(round)} title={text}>
                        <Art kind="roundScore" id={label ? id : "back"} alt={text} />
                    </div>
                );
            })}
            <div className="roundtile roundtile-final" style={slotBox(6, true)} title={FINAL_ROUND_LABEL[finalId]}>
                <Art kind="finalRound" id={finalId} alt={FINAL_ROUND_LABEL[finalId]} />
            </div>
        </div>
    );
}
