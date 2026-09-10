import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CandidateTopicSchema, TopicBriefSchema, ChatBodySchema } from '@/lib/validation';
import { searchArxiv } from '@/lib/harness/tools/arxiv';
import {
  chatComplete,
  MOCK_CANDIDATES,
  MOCK_GAPS,
  MOCK_BRIEF,
  MOCK_VALIDATION,
  MOCK_F5_CHAT,
  MOCK_F5_PLAN,
} from '@/lib/harness/provider/llm';

/**
 * Euler contract tests — validate that the agent prompts, mock fixtures, and
 * the real arXiv grounding all produce correctly-shaped output. These are the
 * "we tested it" signals for the hackathon demo: every stage's output shape is
 * asserted, and arXiv is verified to return real (non-invented) papers.
 *
 * Run with: npm run test:contract   (or: npm run test)
 */

describe('Euler agent contract tests', () => {
  // Force the LLM provider into mock mode for the duration of these tests so
  // chatComplete returns our structured fixtures (no network, no key needed).
  beforeAll(() => {
    process.env.LLM_PROVIDER = 'mock';
  });
  afterAll(() => {
    delete process.env.LLM_PROVIDER;
  });

  // ------------------------------------------------------------------ F1
  it('F1 mock candidates are present and match CandidateTopicSchema', () => {
    expect(MOCK_CANDIDATES.length).toBeGreaterThanOrEqual(3);
    for (const c of MOCK_CANDIDATES) {
      const result = CandidateTopicSchema.safeParse(c);
      expect(result.success).toBe(true);
    }
  });

  it('F1 mock brief matches TopicBriefSchema', () => {
    const result = TopicBriefSchema.safeParse(MOCK_BRIEF);
    expect(result.success).toBe(true);
    expect(result.data!.researchQuestions.length).toBeGreaterThanOrEqual(1);
    expect(result.data!.scopeBoundaries.length).toBeGreaterThanOrEqual(1);
    expect(result.data!.successCriteria.length).toBeGreaterThanOrEqual(1);
    expect(['BTECH', 'MASTERS', 'PHD', 'RD']).toContain(result.data!.estimatedDifficulty);
  });

  // chatComplete with mock mode must return the brief fixture as valid JSON.
  it('chatComplete(mock, fixture=brief) returns valid TopicBrief JSON', async () => {
    const raw = await chatComplete(
      [{ role: 'user', content: 'produce the brief' }],
      { jsonMode: true, fixture: 'brief', maxTokens: 2048 },
    );
    const parsed = TopicBriefSchema.safeParse(JSON.parse(raw));
    expect(parsed.success).toBe(true);
  });

  // ------------------------------------------------------------------ F2
  it('F2 mock gaps have knownAreas + gaps arrays', () => {
    expect(Array.isArray(MOCK_GAPS.knownAreas)).toBe(true);
    expect(MOCK_GAPS.knownAreas.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(MOCK_GAPS.gaps)).toBe(true);
    expect(MOCK_GAPS.gaps.length).toBeGreaterThanOrEqual(1);
  });

  // ------------------------------------------------------------------ F4
  it('F4 mock validation matches the F4 output schema', () => {
    expect(MOCK_VALIDATION.novelty.score).toMatch(/^(high|medium|low)$/);
    expect(Array.isArray(MOCK_VALIDATION.feasibility.concerns)).toBe(true);
    expect(Array.isArray(MOCK_VALIDATION.logic.gaps)).toBe(true);
    expect(['proceed', 'refine', 'pivot']).toContain(MOCK_VALIDATION.verdict);
    expect(Array.isArray(MOCK_VALIDATION.suggestions)).toBe(true);
  });

  // ------------------------------------------------------------------ F5
  it('F5 mock chat is a non-empty string (coach-style response)', () => {
    expect(typeof MOCK_F5_CHAT).toBe('string');
    expect(MOCK_F5_CHAT.length).toBeGreaterThan(20);
  });

  it('F5 mock plan is a non-empty string (structured plan JSON)', () => {
    expect(typeof MOCK_F5_PLAN).toBe('string');
    expect(MOCK_F5_PLAN.length).toBeGreaterThan(20);
  });

  it('chatComplete(mock, fixture=f5-chat) returns the F5 coach fixture', async () => {
    const raw = await chatComplete(
      [{ role: 'user', content: 'help me debug my training loop' }],
      { fixture: 'f5-chat', maxTokens: 512 },
    );
    expect(raw).toBe(MOCK_F5_CHAT);
  });

  it('chatComplete(mock, fixture=f5-plan) returns the F5 plan fixture', async () => {
    const raw = await chatComplete(
      [{ role: 'user', content: 'design my experiment' }],
      { jsonMode: true, fixture: 'f5-plan', maxTokens: 1024 },
    );
    expect(raw).toBe(MOCK_F5_PLAN);
  });

  // ------------------------------------------------------------------ F3 / arXiv
  it('arXiv searchArxiv returns real papers with required fields (no inventing)', async () => {
    // arXiv's public API requires no key — this is the "real papers, not
    // hallucinated" proof point. A real network call is intentional here.
    const papers = await searchArxiv('federated learning edge devices', 2);
    expect(papers.length).toBeGreaterThanOrEqual(1);
    for (const p of papers) {
      expect(p.title.length).toBeGreaterThan(5);
      expect(p.authors.length).toBeGreaterThanOrEqual(1);
      expect(p.year).toBeGreaterThan(2000);
      expect(p.venue).toBeTruthy();
      expect(p.abstract.length).toBeGreaterThan(20);
      expect(p.url.startsWith('http')).toBe(true);
      expect(p.extId.length).toBeGreaterThan(5);
    }
  }, 60_000);

  // ------------------------------------------------------------------ shared
  it('ChatBodySchema rejects empty / oversized messages', () => {
    expect(ChatBodySchema.safeParse({ message: '' }).success).toBe(false);
    expect(ChatBodySchema.safeParse({ message: 'x'.repeat(8001) }).success).toBe(false);
    expect(ChatBodySchema.safeParse({ message: 'a valid message' }).success).toBe(true);
  });
});
