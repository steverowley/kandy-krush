import { describe, expect, it, beforeEach } from "vitest";
import { clear, emit, recent, setEnabled, subscribe, _resetCache } from "../telemetry/bus";

describe("telemetry bus", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetCache();
    setEnabled(true);
  });

  it("appends events into the ring buffer", () => {
    emit("app_open", { v: 1 });
    emit("mode_start", { mode: "free" });
    const events = recent();
    expect(events).toHaveLength(2);
    expect(events[0]!.name).toBe("app_open");
    expect(events[1]!.name).toBe("mode_start");
    expect(events[1]!.data?.mode).toBe("free");
  });

  it("includes timestamps", () => {
    const before = Date.now();
    emit("swap_made");
    const after = Date.now();
    const ev = recent()[0]!;
    expect(ev.at).toBeGreaterThanOrEqual(before);
    expect(ev.at).toBeLessThanOrEqual(after);
  });

  it("caps the ring at 200 entries", () => {
    for (let i = 0; i < 250; i++) emit("swap_made", { i });
    const all = recent(500);
    expect(all.length).toBe(200);
    // The oldest 50 should have been evicted.
    expect(all[0]!.data?.i).toBe(50);
    expect(all[199]!.data?.i).toBe(249);
  });

  it("no-ops when disabled", () => {
    setEnabled(false);
    emit("app_open");
    expect(recent()).toHaveLength(0);
  });

  it("persists across reloads via localStorage", () => {
    emit("mode_won", { mode: "spread", score: 1500 });
    _resetCache();
    const reloaded = recent();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]!.name).toBe("mode_won");
    expect(reloaded[0]!.data?.score).toBe(1500);
  });

  it("clear() empties the buffer + storage", () => {
    emit("swap_made");
    emit("swap_made");
    clear();
    expect(recent()).toHaveLength(0);
    expect(localStorage.getItem("arcana.telemetry.v1")).toBeNull();
  });

  it("notifies subscribers on emit", () => {
    let seen: number[] = [];
    const unsub = subscribe((events) => {
      seen.push(events.length);
    });
    emit("app_open");
    emit("swap_made");
    unsub();
    emit("swap_made");
    expect(seen).toEqual([1, 2]);
  });

  it("recent(limit) returns the tail only", () => {
    for (let i = 0; i < 10; i++) emit("swap_made", { i });
    const last3 = recent(3);
    expect(last3).toHaveLength(3);
    expect(last3.map((e) => e.data?.i)).toEqual([7, 8, 9]);
  });
});
