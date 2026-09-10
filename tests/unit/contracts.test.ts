import { describe, it, expect } from "vitest";
import { STAGE_KEY_TO_ID, TopicBriefSchema } from "@/lib/validation";

describe("frozen contracts", () => {
  it("maps stage keys to IDs", () => {
    expect(STAGE_KEY_TO_ID.topic).toBe("F1");
    expect(STAGE_KEY_TO_ID.publish).toBe("F7");
  });
  it("validates a topic brief", () => {
    const r = TopicBriefSchema.safeParse({
      title: "t",
      problem: "p",
      researchQuestions: ["q"],
      scopeBoundaries: ["s"],
      successCriteria: ["c"],
      estimatedDifficulty: "MASTERS",
    });
    expect(r.success).toBe(true);
  });
});
