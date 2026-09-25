import { describe, expect, it } from "vitest";
import { MockState, statusFor } from "../src/store.ts";

const msg = (id: string) => ({ id, role: "user" as const, text: "q", createdAt: "2026-09-25T00:00:00Z" });

describe("MockState", () => {
  it("allows one active turn per user", () => {
    const s = new MockState();
    expect(s.tryBeginTurn("u1")).toBe(true);
    expect(s.tryBeginTurn("u1")).toBe(false);
    expect(s.tryBeginTurn("u2")).toBe(true);
    s.endTurn("u1");
    expect(s.tryBeginTurn("u1")).toBe(true);
  });

  it("keeps conversations private to their owner", () => {
    const s = new MockState();
    s.append("c-1", "u1", msg("m-1"));
    expect(s.read("c-1", "u1")?.messages).toHaveLength(1);
    expect(s.read("c-1", "u2")).toBeUndefined();
    expect(s.canWrite("c-1", "u2")).toBe(false);
    expect(s.canWrite("c-new", "u2")).toBe(true);
    expect(() => s.append("c-1", "u2", msg("m-2"))).toThrow();
  });

  it("finds a message by id across conversations", () => {
    const s = new MockState();
    s.append("c-1", "u1", msg("m-1"));
    expect(s.findMessage("m-1")?.text).toBe("q");
    expect(s.findMessage("m-x")).toBeUndefined();
  });

  it("reset clears everything", () => {
    const s = new MockState();
    s.append("c-1", "u1", msg("m-1"));
    s.tryBeginTurn("u1");
    s.killSwitch = true;
    s.reset();
    expect(s.conversations.size).toBe(0);
    expect(s.activeTurns.size).toBe(0);
    expect(s.killSwitch).toBe(false);
  });
});

describe("statusFor", () => {
  it.each([
    [{ outcome: "aborted", text: "", emitted: ["status"] }, "aborted"],
    [{ outcome: "completed", text: "a", emitted: ["status", "token", "error"] }, "errored"],
    [{ outcome: "completed", text: "", emitted: ["status", "refusal", "done"] }, "refused"],
    [{ outcome: "completed", text: "a", emitted: ["status", "token", "warning", "done"] }, "completed_unverified"],
    [{ outcome: "completed", text: "a", emitted: ["status", "token", "done"] }, "completed"],
  ] as const)("maps %j to %s", (result, expected) => {
    expect(statusFor({ ...result, emitted: [...result.emitted] })).toBe(expected);
  });
});
