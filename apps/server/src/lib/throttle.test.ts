import { afterEach, describe, expect, it, vi } from "vitest";
import { runThrottled } from "./throttle";

describe("runThrottled", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("executes tasks sequentially in order", async () => {
    const order: string[] = [];

    const results = await runThrottled(
      [
        async () => {
          order.push("first:start");
          order.push("first:end");
          return 1;
        },
        async () => {
          order.push("second:start");
          order.push("second:end");
          return 2;
        },
      ],
      10,
    );

    expect(results).toEqual([1, 2]);
    expect(order).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
  });

  it("waits between tasks according to the configured rate", async () => {
    vi.useFakeTimers();
    const task = vi.fn(async () => "done");

    const promise = runThrottled([task, task, task], 2);

    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(499);
    expect(task).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(500);
    expect(task).toHaveBeenCalledTimes(3);

    await expect(promise).resolves.toEqual(["done", "done", "done"]);
  });

  it("skips missing task entries without crashing", async () => {
    const task = vi.fn(async () => "ok");

    const results = await runThrottled(
      [task, undefined as unknown as () => Promise<string>, task],
      5,
    );

    expect(task).toHaveBeenCalledTimes(2);
    expect(results).toEqual(["ok", "ok"]);
  });
});
