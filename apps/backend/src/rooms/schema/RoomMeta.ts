import { schema, SchemaType, t } from "@colyseus/schema";

export const PlayerMeta = schema({
    nickname: t.string().default(""),
    seat: t.uint8().default(0),
    connected: t.boolean().default(true),
});

export type PlayerMeta = SchemaType<typeof PlayerMeta>;

export const RoomMeta = schema({
    players: t.map(PlayerMeta),  // key = sessionId
    phase: t.string().default("waiting"),    // "waiting" | "playing" | "ended"
    hostSessionId: t.string().default(""),
    activeSeat: t.int8().default(-1),    // -1 = 没人在行动
    version: t.uint32().default(0),
});

export type RoomMeta = SchemaType<typeof RoomMeta>;
