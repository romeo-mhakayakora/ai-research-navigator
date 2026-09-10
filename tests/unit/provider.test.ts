import { describe, it, expect } from "vitest";
import { chatComplete } from "@/lib/harness/provider/llm";

describe("mock provider", () => {
  it("asks clarifying questions on first turn", async () => {
    process.env.LLM_PROVIDER = "mock";
    const out = await chatComplete([{ role: "user", content: "Domain: federated learning" }]);
    expect(out).toMatch(/tell me/i);
  });
  it("returns candidates in json mode", async () => {
    const out = await chatComplete([{ role: "user", content: "go" }], { jsonMode: true, fixture: "candidates" });
    expect(JSON.parse(out).candidates.length).toBeGreaterThanOrEqual(3);
  });
});
