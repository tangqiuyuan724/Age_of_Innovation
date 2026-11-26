import "./aoi.css";
import { useState } from "react";
import { MAPS, type Seat, type SetupMode } from "@aoi/engine/aoi";
import {
    clearNotice, hasSavedGame, quitLocalGame, resumeSavedGame, sendLocal, startAuto, startFromMock, startLocalGame, stopAuto,
    undoLocal, useLocalGame, type AutoGoal,
} from "./localGame.ts";
import { actingSeat } from "./options.ts";
import { Table } from "./Table.tsx";

/** 本地试玩：一台电脑，大家轮流操作，每一步都由你写的引擎判断和执行 */
export function LocalPlay() {
    const state = useLocalGame((s) => s.state);
    const names = useLocalGame((s) => s.names);
    const steps = useLocalGame((s) => s.steps);
    const notice = useLocalGame((s) => s.notice);
    const auto = useLocalGame((s) => s.auto);

    if (state === null) return <StartScreen notice={notice} />;

    const name = (seat: Seat) => names[seat] || `玩家${seat + 1}`;
    // 该谁操作就以谁的身份操作。正常不会出现"没有人该操作"，万一出现就停在行动顺序第一个人
    const me = actingSeat(state) ?? state.turnOrder[0];

    return (
        <Table
            state={state}
            name={name}
            me={me}
            send={sendLocal}
            log={steps}
            notice={notice}
            onCloseNotice={clearNotice}
            tools={
                <>
                    <AutoPlay ended={state.phase === "ended"} />
                    <button type="button" className="btn btn-quiet" disabled={steps.length === 0 || auto !== null} onClick={undoLocal}>撤销一步</button>
                    <button type="button" className="btn btn-quiet" onClick={quitLocalGame}>结束试玩</button>
                </>
            }
        />
    );
}

const AUTO_GOALS: { goal: AutoGoal; label: string }[] = [
    { goal: "step", label: "走一步" },
    { goal: "round", label: "走到下一轮" },
    { goal: "end", label: "走到游戏结束" },
];

/**
 * 随机走：电脑替该操作的人挑一条引擎说能走的指令（getLegalMoves），用来快速走到想看的局面。
 * 走的每一步和手动走的一样记进日志、能撤销、会存档。正在走的时候按钮变成"停下"
 */
function AutoPlay({ ended }: { ended: boolean }) {
    const auto = useLocalGame((s) => s.auto);
    const [open, setOpen] = useState(false);

    if (auto !== null) {
        return (
            <button type="button" className="btn btn-quiet autoplay-running" onClick={stopAuto}>
                停下<small className="num">已走 {auto.done} 步</small>
            </button>
        );
    }
    return (
        <span className="autoplay">
            <button
                type="button" className="btn btn-quiet" disabled={ended} aria-expanded={open}
                title="电脑替大家随机走，用来快速走到想看的局面" onClick={() => setOpen(!open)}
            >
                随机走…
            </button>
            {open && (
                <span className="popover autoplay-panel" role="menu" aria-label="随机走到哪里">
                    {AUTO_GOALS.map(({ goal, label }) => (
                        <button key={goal} type="button" role="menuitem" className="btn" onClick={() => { setOpen(false); startAuto(goal); }}>
                            {label}
                        </button>
                    ))}
                </span>
            )}
        </span>
    );
}

/** 新开一局之前的设置 */
function StartScreen({ notice }: { notice: string | null }) {
    const [playerCount, setPlayerCount] = useState(3);
    const [mode, setMode] = useState<SetupMode["kind"]>("sets");
    // 种子决定这一局的随机结果（派系、板块怎么摆）。同一个种子开出来的局一模一样，方便重现问题
    const [seed, setSeed] = useState(() => `试玩-${Math.floor(Math.random() * 100000)}`);
    const [names, setNames] = useState(["", "", "", "", ""]);
    const mapId = Object.keys(MAPS)[0];
    const saved = hasSavedGame();

    const start = () => {
        const setupMode: SetupMode = mode === "sets" ? { kind: "sets" } : { kind: "draft", order: "snake" };
        const finalNames = names.slice(0, playerCount).map((n, i) => n.trim() || `玩家${i + 1}`);
        startLocalGame({ kind: "new", options: { playerCount, mapId, setupMode }, seed }, finalNames);
    };

    return (
        <div className="aoi-root start-root">
            <main className="start">
                <h1>本地试玩</h1>
                <p className="start-intro">
                    不连服务器，一台电脑上轮流操作。每一步都交给你写的引擎：<code>validateMove</code> 说可以才 <code>applyMove</code>。
                    引擎还没实现的行动会显示"引擎还没实现"。
                </p>
                {notice && <p className="notice" role="alert">{notice}</p>}

                <fieldset>
                    <legend>人数</legend>
                    {[2, 3, 4, 5].map((n) => (
                        <label key={n} className="radio">
                            <input type="radio" name="count" checked={playerCount === n} onChange={() => setPlayerCount(n)} /> {n} 人
                        </label>
                    ))}
                </fieldset>

                <fieldset>
                    <legend>开局方式</legend>
                    <label className="radio">
                        <input type="radio" name="mode" checked={mode === "sets"} onChange={() => setMode("sets")} />
                        固定组合：7 组"规划板 + 派系 + 回合奖励板块"，每人选一组
                    </label>
                    <label className="radio">
                        <input type="radio" name="mode" checked={mode === "draft"} onChange={() => setMode("draft")} />
                        轮抽：4 类东西分开摆，蛇形顺序轮流拿
                    </label>
                </fieldset>

                <fieldset>
                    <legend>名字（按座位号，不填就叫"玩家 N"）</legend>
                    <div className="start-names">
                        {names.slice(0, playerCount).map((n, i) => (
                            <input
                                key={i} value={n} maxLength={8} placeholder={`玩家${i + 1}`} aria-label={`座位 ${i} 的名字`}
                                onChange={(e) => setNames(names.map((x, k) => (k === i ? e.target.value : x)))}
                            />
                        ))}
                    </div>
                </fieldset>

                <label className="start-seed">
                    随机种子 <input value={seed} onChange={(e) => setSeed(e.target.value)} />
                    <small>同一个种子开出来的局一模一样</small>
                </label>

                <p className="start-buttons">
                    <button type="button" className="primary" onClick={start}>开始</button>
                    {saved && <button type="button" onClick={resumeSavedGame}>继续上次的试玩</button>}
                    <button type="button" onClick={startFromMock}>从预览页的示例局面开始</button>
                    <a href="#">回大厅</a>
                </p>
                <p className="start-note">
                    每一步都存在这个浏览器里（只存开局设置和指令，读档时用引擎从头重放）。
                    你改了引擎以后点"继续上次的试玩"，看到的就是新引擎算出来的结果。
                </p>
            </main>
        </div>
    );
}
