import { DISCIPLINES, TOOLS_PER_SPADE, incomeOf, type GameState, type PlayerState, type Seat } from "@aoi/engine/aoi";
import { TERRAIN_COLOR } from "./colors.ts";
import { BookIcon, CoinIcon, KeyIcon, PowerIcon, ToolIcon } from "./icons.tsx";
import { BOOK_NAME, CITY_TILE_LABEL, DISCIPLINE_NAME, TERRAIN_NAME, factionName } from "./labels.ts";
import { Art, BridgeIcon, FactionToken, ScholarIcon } from "./pieces.tsx";

interface Props {
    state: GameState;
    name: (seat: Seat) => string;
    /** 现在由谁操作（卡片上标出来）；只读预览时是"我"的座位 */
    me: Seat;
    meLabel: string;
    /** 联机时掉线了的座位 */
    offline?: readonly Seat[];
    viewed: Seat;
    onView: (seat: Seat) => void;
}

/**
 * 右边一列的玩家卡片，按本轮行动顺序排。这位玩家手上的所有资源都在卡片上：
 * 能量碗、钥匙、工具、金币、学者、桥、四色书，每轮收入，航行、改造、学科等级，城市板块。
 * 点卡片在下面看 TA 的规划板
 */
export function PlayerList({ state, name, me, meLabel, offline = [], viewed, onView }: Props) {
    return (
        <ol className="players" aria-label="玩家（按本轮行动顺序），点一位看 TA 的规划板">
            {state.turnOrder.map((seat, i) => {
                const p = state.players[seat];
                const active = state.turn?.seat === seat;
                const deciding = state.pending[0]?.seat === seat;
                const status = p?.passed ? "已 pass" : active ? "正在行动" : deciding ? "在做决定" : "";
                const color = p ? TERRAIN_COLOR[p.homeTerrain] : "#7d7362";
                return (
                    <li key={seat}>
                        <button
                            type="button"
                            className={"pcard" + (seat === viewed ? " pcard-viewed" : "") + (active || deciding ? " pcard-active" : "") + (p?.passed ? " pcard-passed" : "")}
                            aria-pressed={seat === viewed}
                            onClick={() => onView(seat)}
                            style={{ ["--seat" as string]: color }}
                        >
                            <span className="pcard-head">
                                <span className="pcard-order num" aria-label={`第 ${i + 1} 个行动`}>{i + 1}</span>
                                <span className="pcard-name">
                                    {name(seat)}
                                    {seat === me && <em>{meLabel}</em>}
                                    {offline.includes(seat) && <em className="pcard-offline" title="掉线了，等 TA 回来">离线</em>}
                                </span>
                                <span className="pcard-vp" aria-label={`${p ? p.vp : 0} 分`}><span className="num">{p ? p.vp : "—"}</span></span>
                            </span>
                            {p === undefined ? <span className="pcard-sub">还没选派系</span> : <Holdings p={p} color={color} status={status} on={active || deciding} />}
                        </button>
                    </li>
                );
            })}
        </ol>
    );
}

/** 一位玩家手上的东西 */
function Holdings({ p, color, status, on }: { p: PlayerState; color: string; status: string; on: boolean }) {
    const income = incomeOf(p);
    const incomeBooks = income.books ? Object.values(income.books).reduce((a, b) => a + (b ?? 0), 0) : 0;
    return (
        <>
            <span className="pcard-sub">
                <FactionToken faction={p.faction} name={factionName(p.faction)} color={color} size={26} />
                <span>{factionName(p.faction)}（{TERRAIN_NAME[p.homeTerrain]}）</span>
                {status && <span className={on ? "pcard-status pcard-status-on" : "pcard-status"}>{status}</span>}
            </span>

            <span className="pcard-grid">
                <span className="pcard-power" title={`能量碗 I / II / III：${p.power.join(" / ")}（碗 III 里的能量可以用）`}>
                    <PowerIcon size={16} />
                    <b className="num">{p.power[0]}</b><b className="num">{p.power[1]}</b><b className="num pcard-power-ready">{p.power[2]}</b>
                </span>
                <span title="钥匙"><KeyIcon size={16} /><b className="num">{p.keys}</b></span>
                <span title="工具"><ToolIcon size={16} /><b className="num">{p.tools}</b></span>
                <span title="金币"><CoinIcon size={16} /><b className="num">{p.coins}</b></span>
                <span title="手上的学者"><ScholarIcon color={color} size={16} /><b className="num">{p.scholars}</b></span>
                <span title="还没用的桥"><BridgeIcon color={color} size={22} /><b className="num">{p.bridges}</b></span>
            </span>

            <span className="pcard-books">
                {DISCIPLINES.map((d) => (
                    <span key={d} className={p.books[d] === 0 ? "pcard-book-none" : undefined} title={`${BOOK_NAME[d]}书`}>
                        <BookIcon color={d} /><b className="num">{p.books[d]}</b>
                    </span>
                ))}
            </span>

            <span className="pcard-income" title="每轮收入（收入阶段拿）">
                <span className="pcard-label">收入</span>
                <span title="工具"><ToolIcon size={14} />+{income.tools ?? 0}</span>
                <span title="金币"><CoinIcon size={14} />+{income.coins ?? 0}</span>
                <span title="学者"><ScholarIcon color={color} size={14} />+{income.scholars ?? 0}</span>
                <span title="能量"><PowerIcon size={14} />+{income.power ?? 0}</span>
                {incomeBooks > 0 && <span title="书">书 +{incomeBooks}</span>}
                {(income.vp ?? 0) > 0 && <span title="分数">分 +{income.vp}</span>}
            </span>

            <span className="pcard-extra">
                <span title="航行轨等级">航行 <b className="num">{p.sailing}</b></span>
                <span title={`改造轨 ${p.terraforming} 级：每铲 ${TOOLS_PER_SPADE[p.terraforming]} 个工具`}>每铲 <b className="num">{TOOLS_PER_SPADE[p.terraforming]}</b> 工具</span>
                <span title={DISCIPLINES.map((d) => `${DISCIPLINE_NAME[d]} ${p.science[d]} 级`).join("，")}>
                    学科 {DISCIPLINES.map((d) => p.science[d]).join(" / ")}
                </span>
                {p.cityTiles.length > 0 && (
                    <span className="pcard-cities" aria-label="城市板块">
                        {p.cityTiles.map((c, k) => <Art key={k} kind="cityTile" id={c} alt={`城市板块：${CITY_TILE_LABEL[c] ?? c}`} />)}
                    </span>
                )}
            </span>
        </>
    );
}
