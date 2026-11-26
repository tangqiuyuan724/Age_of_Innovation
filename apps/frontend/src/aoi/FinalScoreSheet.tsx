import { useEffect, useRef } from "react";
import {
    DISCIPLINES, SCIENCE_SCORE_POINTS, largestArea, rankPoints, resourceValue,
    type FinalScore, type GameState, type Seat,
} from "@aoi/engine/aoi";
import { TERRAIN_COLOR } from "./colors.ts";
import { DISCIPLINE_NAME, factionName } from "./labels.ts";
import { FactionToken } from "./pieces.tsx";

/** 计分表上的一行：引擎算好的终局分，加上名次 */
interface Row {
    score: FinalScore;
    /** 名次从 1 开始；总分一样的名次一样 */
    rank: number;
}

/** 按总分从高到低排，算出名次 */
export function rankFinalScores(scores: FinalScore[]): Row[] {
    return [...scores]
        .sort((a, b) => b.total - a.total)
        .map((score) => ({ score, rank: 1 + scores.filter((s) => s.total > score.total).length }));
}

/** 一句话说谁赢了："小明 获胜，92 分"或"小明、小红 并列第一，92 分" */
export function winnerText(scores: FinalScore[], name: (seat: Seat) => string): string {
    const top = rankFinalScores(scores).filter((r) => r.rank === 1);
    if (top.length === 0) return "";
    const names = top.map((r) => name(r.score.seat)).join("、");
    return `${names} ${top.length > 1 ? "并列第一" : "获胜"}，${top[0].score.total} 分`;
}

interface Props {
    state: GameState;
    name: (seat: Seat) => string;
    onClose: () => void;
}

/**
 * 终局计分表：游戏结束时盖在桌面上。分数都是引擎算好的（state.finalScores）；
 * 每格下面的小字（最大一片几座、哪几门学科得分、资源值几金币）是用引擎导出的函数现算的，方便对账。
 * 用浏览器自带的 <dialog>：按 Esc 能关，打开时键盘焦点在表里
 */
export function FinalScoreSheet({ state, name, onClose }: Props) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current;
        if (dialog && !dialog.open) dialog.showModal();
    }, []);

    const scores = state.finalScores ?? [];
    const rows = rankFinalScores(scores);
    // 每门学科的名次分，下标 = 座位号。和引擎 finalScores 里的算法一样
    const sciencePoints = Object.fromEntries(
        DISCIPLINES.map((d) => [d, rankPoints(state.players.map((p) => p.science[d]), SCIENCE_SCORE_POINTS)]),
    );

    return (
        <dialog ref={ref} className="finalsheet" aria-labelledby="finalsheet-title" onClose={onClose}>
            <header className="finalsheet-head">
                <h2 id="finalsheet-title">终局计分</h2>
                <p className="finalsheet-winner">{winnerText(scores, name)}</p>
            </header>

            <table className="finalsheet-table">
                <thead>
                    <tr>
                        <th scope="col" className="finalsheet-rank">名次</th>
                        <th scope="col" className="finalsheet-who">玩家</th>
                        <th scope="col">游戏中</th>
                        <th scope="col">最大区域</th>
                        <th scope="col">学科</th>
                        <th scope="col">剩余资源</th>
                        <th scope="col">总分</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ score, rank }) => {
                        const p = state.players[score.seat];
                        const color = TERRAIN_COLOR[p.homeTerrain];
                        const part = (key: string) => score.breakdown[key] ?? 0;
                        const scored = DISCIPLINES.filter((d) => sciencePoints[d][p.seat] > 0);
                        return (
                            <tr key={score.seat} className={rank === 1 ? "finalsheet-top" : undefined} style={{ ["--seat" as string]: color }}>
                                <td className="finalsheet-rank num">{rank}</td>
                                <th scope="row" className="finalsheet-who">
                                    <span className="finalsheet-player">
                                        <FactionToken faction={p.faction} name={factionName(p.faction)} color={color} size={34} />
                                        <span>
                                            <b>{name(p.seat)}</b>
                                            <small>{factionName(p.faction)}</small>
                                        </span>
                                    </span>
                                </th>
                                <td><Points n={part("game")} /></td>
                                <td><Points n={part("area")} plus detail={`最大一片 ${largestArea(state, p.seat)} 座`} /></td>
                                <td>
                                    <Points
                                        n={part("science")} plus
                                        detail={scored.length === 0 ? "没有学科得分" : scored.map((d) => `${DISCIPLINE_NAME[d]} ${p.science[d]} 级 +${sciencePoints[d][p.seat]}`).join("，")}
                                    />
                                </td>
                                <td><Points n={part("resources")} plus detail={`折合 ${resourceValue(p)} 金币`} /></td>
                                <td className="finalsheet-total num">{score.total}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <footer className="finalsheet-foot">
                <p>
                    最大区域：自己互相够得着的建筑连成一片，按最大那片的座数排名，18 / 12 / 6 分。
                    学科：每门按等级排名，8 / 4 / 2 分，0 级不算。并列的平分，向下取整。
                    剩余资源：金币、工具、书、学者、碗 III 的能量各算 1 金币，5 金币 1 分。
                </p>
                <button type="button" className="btn btn-primary" onClick={() => ref.current?.close()}>收起，看版图</button>
            </footer>
        </dialog>
    );
}

/** 一格分数：大字是分，下面一行小字说明怎么来的。终局加的分前面带"+" */
function Points({ n, plus = false, detail }: { n: number; plus?: boolean; detail?: string }) {
    return (
        <span className={n === 0 ? "finalsheet-pts finalsheet-zero" : "finalsheet-pts"}>
            <b className="num">{plus && n > 0 ? `+${n}` : n}</b>
            {detail && <small>{detail}</small>}
        </span>
    );
}
