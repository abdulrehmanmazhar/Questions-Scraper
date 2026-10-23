export type Status = "idle" | "processing" | "started" | "completed" | "failed";

export type Msg =
  | { type: "SERVER_PUSH"; payload: unknown }
  | { type: "OPEN_TAB"; url: string }
  | { type: "UPDATE_URL"; url: string }
  | { type: "GET_STATUS" }
  | { type: "STATUS_UPDATE"; status: Status }
  | { type: "SET_STATUS"; status: Status }
  | { type: "START_SCRAPING" }
  | { type: "SET_QUESTIONS"; questions: Record<string, boolean> }
  | { type: "GET_QUESTIONS" };

export type Reply<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };
