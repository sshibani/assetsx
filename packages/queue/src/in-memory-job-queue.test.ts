import { describe, it, expect } from "vitest";
import { InMemoryJobQueue } from "./in-memory-job-queue.js";

describe("InMemoryJobQueue", () => {
  it("records enqueued jobs per queue", async () => {
    const queue = new InMemoryJobQueue();

    await queue.enqueue("assets", { type: "process-asset", assetId: "a1" });
    await queue.enqueue("publishing", {
      type: "publish-asset",
      assetId: "a1",
      channelId: "webhook",
    });

    expect(queue.jobs("assets")).toEqual([
      { type: "process-asset", assetId: "a1" },
    ]);
    expect(queue.jobs("publishing")).toEqual([
      { type: "publish-asset", assetId: "a1", channelId: "webhook" },
    ]);
  });

  it("preserves enqueue order", async () => {
    const queue = new InMemoryJobQueue();
    await queue.enqueue("assets", { type: "process-asset", assetId: "1" });
    await queue.enqueue("assets", { type: "process-asset", assetId: "2" });

    expect(queue.jobs("assets").map((j) => j.assetId)).toEqual(["1", "2"]);
  });

  it("clear() empties recorded jobs", async () => {
    const queue = new InMemoryJobQueue();
    await queue.enqueue("assets", { type: "process-asset", assetId: "x" });
    queue.clear();
    expect(queue.jobs("assets")).toEqual([]);
  });
});
