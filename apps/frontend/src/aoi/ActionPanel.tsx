import type { GameState, Seat } from "@aoi/engine/aoi";
import type { ReachableHex } from "./mapView.ts";

/** 主行动：每个回合做一个。顺序和规则书第 II 阶段一致 */
const MAIN_ACTIONS = ["改造并建造", "升级建筑", "推进航行或改造", "派遣学者", "研发创新", "结束本轮"];
/** 随时可做、不占主行动 */
const FREE_ACTIONS = ["转换资源", "牺牲能量"];

const PREVIEW_HINT = "预览模式，还不能操作";

interface Props {
    state: GameState;
    mySeat: Seat;
    viewed: Seat;
    name: (seat: Seat) => string;
    reach: ReachableHex[];
    onBack: () => void;
}

/** 玩家板右边的行动区。看自己时是操作按钮，看别人时是只读的"TA 能做什么" */
export function ActionPanel({ state, mySeat, viewed, name, reach, onBack }: Props) {
    const direct = reach.filter((r) => r.spades === 0).length;

    if (viewed !== mySeat) {
        return (
            <section className="act act-readonly" aria-label="对手视角">
                <p className="act-title">正在查看{name(viewed)}（只读）</p>
                <p className="act-line">
                    地图上的虚线框是 TA 现在能到达的空格，共 <span className="num">{reach.length}</span> 个，
                    其中 <span className="num">{direct}</span> 个是 TA 的家园地形，不用改造就能建。
                </p>
                <p className="act-later">TA 这回合具体能做哪些行动，要等引擎能列出"合法行动"（M1-4）后显示在这里。</p>
                <button type="button" className="act-back" onClick={onBack}>回到我的玩家板</button>
            </section>
        );
    }

    const myTurn = state.turn?.seat === mySeat;
    const blocked = state.pending.some((d) => d.seat === mySeat);
    return (
        <section className="act" aria-label="我的行动">
            <p className="act-title">
                {!myTurn ? `等 ${name(state.turn?.seat ?? 0)} 行动` : blocked ? "轮到你了，先处理地图上方的选择" : "轮到你了"}
            </p>
            <ul className="act-buttons">
                {MAIN_ACTIONS.map((a) => (
                    <li key={a}><button type="button" disabled title={PREVIEW_HINT}>{a}</button></li>
                ))}
            </ul>
            <ul className="act-buttons act-free">
                {FREE_ACTIONS.map((a) => (
                    <li key={a}><button type="button" disabled title={PREVIEW_HINT}>{a}</button></li>
                ))}
            </ul>
            <p className="act-line">你能到达 <span className="num">{reach.length}</span> 个空格，其中 <span className="num">{direct}</span> 个不用改造。</p>
        </section>
    );
}
