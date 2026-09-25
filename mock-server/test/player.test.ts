import { describe, expect, it } from "vitest";
import { play, sleep, type Step } from "../src/player.ts";

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2, cacheReadInputTokens: 0, cacheWriteInputTokens: 0, latencyMs: 40 };
const steps: Step[] = [
  { delayMs: 10, event: "status", data: { phase: "routing", text: "…" } },
  { delayMs: 10, event: "token", data: { text: "Hello " } },
  { delayMs: 10, event: "token", data: { text: "world" } },
  { delayMs: 10, event: "done", data: { messageId: "m-1", usage } },
];

describe("play", () => {
  it("writes every step in order and returns the token text", async () => {
    const frames: string[] = [];
    const result = await play(steps, (f) => frames.push(f), { scale: 0, signal: new AbortController().signal });
    expect(result).toEqual({ outcome: "completed", text: "Hello world", emitted: ["status", "token", "token", "done"] });
    expect(frames.map((f) => f.split("\n")[0])).toEqual(["event: status", "event: token", "event: token", "event: done"]);
  });

  it("waits delayMs × scale before each step", async () => {
    const start = performance.now();
    await play(steps, () => {}, { scale: 2, signal: new AbortController().signal });
    expect(performance.now() - start).toBeGreaterThanOrEqual(75);
  });

  it("stops writing as soon as the signal aborts and keeps the partial text", async () => {
    const ac = new AbortController();
    const frames: string[] = [];
    const result = await play(
      steps,
      (f) => {
        frames.push(f);
        if (frames.length === 2) ac.abort();
      },
      { scale: 1, signal: ac.signal },
    );
    expect(result).toEqual({ outcome: "aborted", text: "Hello ", emitted: ["status", "token"] });
    expect(frames).toHaveLength(2);
  });

  it("writes nothing when the signal is already aborted, even at scale 0", async () => {
    const ac = new AbortController();
    ac.abort();
    const frames: string[] = [];
    const result = await play(steps, (f) => frames.push(f), { scale: 0, signal: ac.signal });
    expect(result.outcome).toBe("aborted");
    expect(frames).toEqual([]);
  });
});

describe("sleep", () => {
  it("rejects when aborted", async () => {
    const ac = new AbortController();
    const pending = sleep(1000, ac.signal);
    ac.abort();
    await expect(pending).rejects.toThrow();
  });
});
