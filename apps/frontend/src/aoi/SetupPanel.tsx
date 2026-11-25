import type { ReactNode } from "react";
import {
    DRAFT_CATEGORIES, PALACE_TILE_INCOME,
    type BonusTileId, type DraftItem, type FactionId, type GameState, type Move, type PalaceTileId, type Seat,
    type Terrain,
} from "@aoi/engine/aoi";
import { TERRAIN_COLOR } from "./colors.ts";
import { describeBundle } from "./describe.ts";
import { BONUS_TILE_LABEL, DRAFT_CATEGORY_NAME, TERRAIN_NAME, factionName } from "./labels.ts";
import { Art } from "./pieces.tsx";

interface Props {
    state: GameState;
    /** 现在由谁操作；只读预览时为 null */
    actor: Seat | null;
    name: (seat: Seat) => string;
    send?: (move: Move) => void;
}

/**
 * 开局选择：放在底栏（这时还没有玩家板可以显示）。
 * 固定组合开局显示 7 组；轮抽开局显示 4 类东西和每人已经拿到的。
 */
export function SetupPanel({ state, actor, name, send }: Props) {
    const d = state.pending[0];
    const myDecision = d !== undefined && d.seat === actor && send !== undefined;

    if (state.options.setupMode.kind === "sets") {
        const options = myDecision && d.kind === "pickSet" ? d.options : [];
        return (
            <section className="setup" aria-label="选开局组合">
                <p className="setup-title">
                    {d?.kind === "pickSet" ? `${name(d.seat)}选一组：规划板 + 派系 + 回合奖励板块` : "开局组合"}
                </p>
                <ul className="setup-sets">
                    {state.board.setupSets.map((set) => {
                        const can = options.includes(set.id);
                        return (
                            <li key={set.id}>
                                <button
                                    type="button"
                                    className={"setup-card" + (set.takenBy !== null ? " setup-taken" : "")}
                                    disabled={!can}
                                    onClick={() => send!({ t: "decide", id: d.id, choice: { kind: "pickSet", set: set.id } })}
                                    style={{ ["--seat-color" as string]: TERRAIN_COLOR[set.planning] }}
                                >
                                    <FactionCard id={set.faction} />
                                    <PlanningChip terrain={set.planning} />
                                    <BonusChip id={set.bonusTile} />
                                    {set.takenBy !== null && <span className="setup-stamp">{name(set.takenBy)}选了</span>}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </section>
        );
    }

    const pool = state.board.draft!;
    const options = myDecision && d.kind === "draftPick" ? d.options : [];
    const can = (item: DraftItem) => options.some((o) => o.category === item.category && o.id === item.id);
    const pick = (item: DraftItem) => send!({ t: "decide", id: d.id, choice: { kind: "draftPick", item } });

    return (
        <section className="setup" aria-label="轮抽">
            <p className="setup-title">
                {d?.kind === "draftPick" ? `${name(d.seat)}拿一样（每类只能拿一个）` : "轮抽"}
            </p>
            <div className="draft">
                <DraftColumn category="planning">
                    {pool.planning.map((id) => (
                        <ItemButton key={id} item={{ category: "planning", id }} can={can} pick={pick}><PlanningChip terrain={id} /></ItemButton>
                    ))}
                </DraftColumn>
                <DraftColumn category="faction">
                    {pool.faction.map((id) => (
                        <ItemButton key={id} item={{ category: "faction", id }} can={can} pick={pick}><FactionCard id={id} /></ItemButton>
                    ))}
                </DraftColumn>
                <DraftColumn category="bonusTile">
                    {pool.bonusTile.map((id) => (
                        <ItemButton key={id} item={{ category: "bonusTile", id }} can={can} pick={pick}><BonusChip id={id} bare /></ItemButton>
                    ))}
                </DraftColumn>
                <DraftColumn category="palaceTile">
                    {pool.palaceTile.map((id) => (
                        <ItemButton key={id} item={{ category: "palaceTile", id }} can={can} pick={pick}><PalaceChip id={id} /></ItemButton>
                    ))}
                </DraftColumn>
            </div>
            <table className="draft-picks">
                <caption>已经拿到的</caption>
                <thead>
                    <tr><th scope="col">玩家</th>{DRAFT_CATEGORIES.map((c) => <th key={c} scope="col">{DRAFT_CATEGORY_NAME[c]}</th>)}</tr>
                </thead>
                <tbody>
                    {state.turnOrder.map((seat) => {
                        const p = pool.picks[seat];
                        return (
                            <tr key={seat}>
                                <th scope="row">{name(seat)}</th>
                                <td>{p.planning ? TERRAIN_NAME[p.planning] : "—"}</td>
                                <td>{p.faction ? factionName(p.faction) : "—"}</td>
                                <td>{p.bonusTile ? BONUS_TILE_LABEL[p.bonusTile].short : "—"}</td>
                                <td>{p.palaceTile ? `#${p.palaceTile}` : "—"}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </section>
    );
}

function DraftColumn({ category, children }: { category: DraftItem["category"]; children: ReactNode }) {
    return (
        <div className="draft-col">
            <h3>{DRAFT_CATEGORY_NAME[category]}</h3>
            <ul>{children}</ul>
        </div>
    );
}

interface ItemButtonProps {
    item: DraftItem;
    can: (item: DraftItem) => boolean;
    pick: (item: DraftItem) => void;
    children: ReactNode;
}

function ItemButton({ item, can, pick, children }: ItemButtonProps) {
    return (
        <li>
            <button type="button" className="draft-item" disabled={!can(item)} onClick={() => pick(item)}>{children}</button>
        </li>
    );
}

// ---------- 小卡片：有实物图就用图，没有就用扁平样式 ----------

export function FactionCard({ id }: { id: FactionId }) {
    return <Art kind="faction" id={id} alt={`派系：${factionName(id)}`} className="setup-faction" />;
}

export function PlanningChip({ terrain }: { terrain: Terrain }) {
    return <Art kind="planning" id={terrain} alt={`${TERRAIN_NAME[terrain]}规划板`} className="setup-planning" />;
}

/** bare：放在"回合奖励板块"那一栏里时，鼠标悬停不用再写"回合奖励："几个字 */
export function BonusChip({ id, bare = false }: { id: BonusTileId; bare?: boolean }) {
    return <Art kind="bonus" id={id} alt={`${bare ? "" : "回合奖励："}${BONUS_TILE_LABEL[id].text}`} className="setup-bonus" />;
}

export function PalaceChip({ id }: { id: PalaceTileId }) {
    return <Art kind="palace" id={id} alt={`宫殿板块 #${id}，收入 ${describeBundle(PALACE_TILE_INCOME[id])}`} className="setup-palace" />;
}
