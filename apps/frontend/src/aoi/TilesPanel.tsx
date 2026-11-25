import {
    COMPETENCY_ROW_REWARD, DISCIPLINES,
    type CompetencyId, type GameState, type Move, type Seat,
} from "@aoi/engine/aoi";
import { DISCIPLINE_COLOR, TERRAIN_COLOR } from "./colors.ts";
import { BONUS_TILE_LABEL, COMPETENCY_LABEL, DISCIPLINE_NAME } from "./labels.ts";
import { CoinIcon } from "./icons.tsx";
import { PalaceChip } from "./SetupPanel.tsx";
import { TileImage } from "./TileImage.tsx";

interface Props {
    state: GameState;
    actor: Seat | null;
    name: (seat: Seat) => string;
    send?: (move: Move) => void;
}

/** 右侧"板块"一栏：能力板块展示区、宫殿板块、回合奖励板块 */
export function TilesPanel({ state, actor, name, send }: Props) {
    const { board, players } = state;
    const d = state.pending[0];
    const deciding = d !== undefined && d.seat === actor && send !== undefined;
    const competencyOptions = deciding && d.kind === "competency" ? d.options : [];
    const palaceOptions = deciding && d.kind === "palaceTile" ? d.options : [];
    const color = (seat: Seat) => TERRAIN_COLOR[players[seat].homeTerrain];
    const owners = (tile: CompetencyId) => players.filter((p) => p.competencies.includes(tile));

    return (
        <div className="tiles-panel">
            <section>
                <h3>能力板块</h3>
                <p className="shared-note">升级成学校、大学时拿一张。拿哪一列就是哪门学科，第几行决定前进几级、拿几本书。</p>
                <div className="comp-grid">
                    <span />
                    {DISCIPLINES.map((x) => (
                        <span key={x} className="comp-head" style={{ color: DISCIPLINE_COLOR[x] }}>{DISCIPLINE_NAME[x]}</span>
                    ))}
                    {COMPETENCY_ROW_REWARD.map((reward, row) => (
                        <div key={row} className="comp-row">
                            <span className="comp-reward">
                                +{reward.levels} 级{reward.books > 0 && <><br />+{reward.books} 书</>}
                            </span>
                            {DISCIPLINES.map((x) => {
                                const tile = board.competencyGrid[x][row];
                                const left = board.competenciesLeft[tile];
                                const can = competencyOptions.includes(tile);
                                return (
                                    <button
                                        key={x}
                                        type="button"
                                        className={"comp-cell" + (can ? " comp-can" : "") + (left === 0 ? " comp-empty" : "")}
                                        disabled={!can}
                                        title={`${COMPETENCY_LABEL[tile].text}。还剩 ${left} 张`}
                                        onClick={() => send!({ t: "decide", id: d.id, choice: { kind: "competency", tile } })}
                                    >
                                        <TileImage
                                            kind="competency" id={tile} alt={COMPETENCY_LABEL[tile].text}
                                            fallback={<span className="flat-comp">{COMPETENCY_LABEL[tile].short}</span>}
                                        />
                                        <span className="comp-left num" aria-label={`还剩 ${left} 张`}>{left}</span>
                                        <span className="comp-owners">
                                            {owners(tile).map((p) => (
                                                <span key={p.seat} className="marker" style={{ background: color(p.seat) }} title={`${name(p.seat)}有这张`} />
                                            ))}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <h3>宫殿板块</h3>
                {board.palaceTilesAvailable.length === 0 ? (
                    <p className="shared-note">轮抽开局时宫殿板块一开始就分好了，见下面各人手上的。</p>
                ) : (
                    <ul className="palace-list">
                        {board.palaceTilesAvailable.map((tile) => (
                            <li key={tile}>
                                <button
                                    type="button"
                                    className={palaceOptions.includes(tile) ? "palace-can" : ""}
                                    disabled={!palaceOptions.includes(tile)}
                                    onClick={() => send!({ t: "decide", id: d.id, choice: { kind: "palaceTile", tile } })}
                                >
                                    <PalaceChip id={tile} />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <ul className="held">
                    {players.filter((p) => p.palaceTile !== null).map((p) => (
                        <li key={p.seat}><span className="marker" style={{ background: color(p.seat) }} />{name(p.seat)}：#{p.palaceTile}</li>
                    ))}
                </ul>
            </section>

            <section>
                <h3>回合奖励板块</h3>
                <ul className="bonus-list">
                    {board.bonusTiles.map((t) => (
                        <li key={t.id} title={BONUS_TILE_LABEL[t.id].text}>
                            <TileImage
                                kind="bonus" id={t.id} alt={BONUS_TILE_LABEL[t.id].text} className="img-bonus"
                                fallback={<span className="flat-bonus">{BONUS_TILE_LABEL[t.id].text}</span>}
                            />
                            {t.coins > 0 && (
                                <span className="bonus-coins" title={`上面有 ${t.coins} 金币`}>
                                    {Array.from({ length: t.coins }, (_, i) => <CoinIcon key={i} />)}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
                <ul className="held">
                    {players.filter((p) => p.bonusTile !== null).map((p) => (
                        <li key={p.seat} title={BONUS_TILE_LABEL[p.bonusTile!].text}>
                            <span className="marker" style={{ background: color(p.seat) }} />{name(p.seat)}：{BONUS_TILE_LABEL[p.bonusTile!].short}
                        </li>
                    ))}
                </ul>
            </section>

            <section>
                <h3>还没有的</h3>
                <p className="shared-note">创新板块（M3）、城市板块和回合计分板块（M1-7）的数据引擎里还没有，等那几课做完再显示。</p>
            </section>
        </div>
    );
}
