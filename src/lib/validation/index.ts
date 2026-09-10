import { z } from "zod";

export const StageKeySchema = z.enum(["topic", "gaps", "literature", "validate", "build", "write", "publish"]);

export const STAGE_KEY_TO_ID = {
  topic: "F1",
  gaps: "F2",
  literature: "F3",
  validate: "F4",
  build: "F5",
  write: "F6",
  publish: "F7",
} as const;

export const STAGE_ORDER = ["F1", "F2", "F3", "F4", "F5", "F6", "F7"] as const;

export type StageId = (typeof STAGE_ORDER)[number];
export type StageKey = z.infer<typeof StageKeySchema>;

export function stageIdFromKey(key: StageKey): StageId {
  return STAGE_KEY_TO_ID[key];
}

export const CandidateTopicSchema = z.object({
  id: z.string(),
  title: z.string(),
  scope: z.string(),
  novelty: z.string(),
  fitNote: z.string(),
  risks: z.array(z.string()),
});

export const TopicBriefSchema = z.object({
  title: z.string(),
  problem: z.string(),
  researchQuestions: z.array(z.string()),
  scopeBoundaries: z.array(z.string()),
  successCriteria: z.array(z.string()),
  estimatedDifficulty: z.enum(["BTECH", "MASTERS", "PHD", "RD"]),
});

export const ChatBodySchema = z.object({ message: z.string().min(1).max(8000) });

export const TopicActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("propose") }),
  z.object({ action: z.literal("lock"), candidateId: z.string() }),
  z.object({ action: z.literal("complete") }),
]);

export const CreateProjectSchema = z.object({
  title: z.string().optional(),
  domain: z.string().min(2).max(300),
  background: z.string().max(2000).optional().default(""),
  level: z.enum(["BTECH", "MASTERS", "PHD", "LECTURER", "RD"]).default("MASTERS"),
});

export type CandidateTopic = z.infer<typeof CandidateTopicSchema>;
export type TopicBrief = z.infer<typeof TopicBriefSchema>;

export const ValidateActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("analyze") }),
  z.object({ action: z.literal("complete") }),
]);

export const ValidationReportSchema = z.object({
  novelty: z.object({
    score: z.enum(["high", "medium", "low"]),
    closestPriorWork: z.string(),
    differentiation: z.string(),
  }),
  feasibility: z.object({
    score: z.enum(["high", "medium", "low"]),
    concerns: z.array(z.string()),
    missing: z.array(z.string()),
  }),
  logic: z.object({
    gaps: z.array(z.string()),
    unaddressedQuestions: z.array(z.string()),
  }),
  scope: z.string(),
  evaluation: z.string(),
  redFlags: z.array(z.string()),
  verdict: z.enum(["proceed", "refine", "pivot"]),
  suggestions: z.array(z.string()),
});
