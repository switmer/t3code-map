import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";

import { threadNeedsAttention } from "./agentCanvas.logic";

const SOUND_KEY = "t3code:agent-canvas:attention-sound";
const VIEWED_KEY = "t3code:agent-canvas:attention-viewed";

export function readAttentionSoundEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeAttentionSoundEnabled(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SOUND_KEY, enabled ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}

export function readViewedAttentionKeys(): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(VIEWED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((v) => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export function writeViewedAttentionKeys(keys: ReadonlySet<string>): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...keys]));
  } catch {
    // ignore
  }
}

export function attentionQueue(
  threads: ReadonlyArray<EnvironmentThreadShell>,
  threadKeyOf: (thread: EnvironmentThreadShell) => string,
  viewed: ReadonlySet<string>,
): string[] {
  return threads
    .filter((thread) => threadNeedsAttention(thread) && !viewed.has(threadKeyOf(thread)))
    .map(threadKeyOf);
}

/** Soft click — only when the user has enabled canvas attention sound. */
export function playAttentionChime(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.stop(ctx.currentTime + 0.2);
    void ctx.resume().finally(() => {
      window.setTimeout(() => void ctx.close(), 250);
    });
  } catch {
    // Audio blocked or unavailable
  }
}
