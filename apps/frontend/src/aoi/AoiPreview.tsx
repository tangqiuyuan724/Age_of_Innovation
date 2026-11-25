import type { Seat } from "@aoi/engine/aoi";
import { MOCK_MY_SEAT, MOCK_NAMES, MOCK_STATE } from "./mock.ts";
import { startFromMock } from "./localGame.ts";
import { Table } from "./Table.tsx";

/** 大创造时代的界面预览：用假数据把整张桌面摆出来，只能看不能操作 */
export function AoiPreview() {
    const name = (seat: Seat) => MOCK_NAMES[seat] ?? `座位 ${seat}`;
    return (
        <Table
            state={MOCK_STATE}
            name={name}
            me={MOCK_MY_SEAT}
            footnote="预览：假数据"
            tools={
                <button
                    type="button"
                    className="tool"
                    onClick={() => {
                        startFromMock();
                        window.location.hash = "#aoi-local";
                    }}
                >
                    用这个局面试玩
                </button>
            }
        />
    );
}
