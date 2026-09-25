import { describe, expect, it } from "vitest";
import { EVENT_NAMES } from "../src/contract.ts";
import { formatSseEvent } from "../src/sse.ts";

describe("formatSseEvent", () => {
  it("writes one event frame terminated by a blank line", () => {
    expect(formatSseEvent("status", { phase: "routing", text: "Analyse…" })).toBe(
      'event: status\ndata: {"phase":"routing","text":"Analyse…"}\n\n',
    );
  });

  it("keeps multi-line text on a single data line", () => {
    const frame = formatSseEvent("token", { text: "a\nb" });
    expect(frame.split("\n\n")).toEqual([expect.any(String), ""]);
    expect(frame).toContain('"a\\nb"');
  });

  it("serialises array payloads such as citation as-is", () => {
    expect(formatSseEvent("citation", [{ n: 1 }])).toBe('event: citation\ndata: [{"n":1}]\n\n');
  });
});

describe("contract", () => {
  it("declares exactly the 11 events of the contract", () => {
    expect(EVENT_NAMES).toHaveLength(11);
  });
});
