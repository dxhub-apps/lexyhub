import { describe, expect, it } from "vitest";

import { buildIntentGraphLayout } from "../intents/layout";

describe("buildIntentGraphLayout", () => {
  it("produces positioned nodes and edges", () => {
    const layout = buildIntentGraphLayout([
      { id: "1", term: "handmade jewelry", intent: "purchase", persona: "trendsetter", purchaseStage: "purchase", score: 0.7 },
      { id: "2", term: "eco candles", intent: "consideration", persona: "eco", purchaseStage: "consideration", score: 0.6 },
      { id: "3", term: "minimalist art", intent: "discovery", persona: "home", purchaseStage: "awareness", score: 0.5 },
    ]);

    expect(layout.nodes.length).toBe(3);
    layout.nodes.forEach((node) => {
      expect(node.x).toBeGreaterThanOrEqual(-1);
      expect(node.x).toBeLessThanOrEqual(1);
      expect(node.y).toBeGreaterThanOrEqual(-1);
      expect(node.y).toBeLessThanOrEqual(1);
      expect(node.color).toBeTruthy();
    });

    expect(layout.legend.length).toBeGreaterThan(0);
  });
});
