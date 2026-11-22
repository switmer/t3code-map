export type AcStatusTone = "running" | "waiting" | "failed" | "done" | "idle" | "ready";

export type AcRole = "lead" | "coordinator" | "worker" | "none";

export type AcCardVariant = "interactive" | "preview" | "chip";

export type AcCardState = "default" | "focused" | "selected" | "failed" | "attention" | "running";

export type AcToolKind = "read" | "edit" | "test" | "terminal" | "search";

export type AcToolRowState = "running" | "success" | "fail";

export type AcMessageRole = "user" | "assistant" | "system";

export type AcEdgeKind = "idle" | "active" | "broadcast" | "dependency";

export type AcStickyColor = "yellow" | "blue" | "green" | "pink" | "neutral";
