export type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: string };
export type ProviderOpts = {
  jsonMode?: boolean;
  fixture?: string;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
};

export class ProviderError extends Error {
  code: "NO_KEY" | "BAD_REQUEST" | "RATE_LIMITED" | "UPSTREAM_ERROR" | "TIMEOUT" | "AGENT_OUTPUT_INVALID";
  status?: number;
  constructor(code: ProviderError["code"], message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function isMock() {
  return process.env.LLM_PROVIDER === "mock" || !process.env.LLM_BASE_URL;
}

function baseUrl() {
  return (process.env.LLM_BASE_URL ?? "").replace(/\/$/, "");
}

function apiKey() {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new ProviderError("NO_KEY", "LLM_API_KEY is not configured");
  return key;
}

function model() {
  return process.env.LLM_MODEL || (process.env.LLM_PROVIDER === "openrouter" ? "meta-llama/llama-3.1-8b-instruct" : "gpt-4o");
}

function withTimeout(ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

async function postChatCompletions(body: Record<string, unknown>, timeoutMs: number): Promise<Response> {
  const { signal, done } = withTimeout(timeoutMs);
  try {
    return await fetch(`${baseUrl()}/chat/completions`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
      body: JSON.stringify(body),
    });
  } finally {
    done();
  }
}

function mapStatus(res: Response): ProviderError {
  if (res.status === 400) return new ProviderError("BAD_REQUEST", "LLM rejected the request (400)", 400);
  if (res.status === 401 || res.status === 403)
    return new ProviderError("NO_KEY", "LLM key rejected — check LLM_API_KEY (401/403)", res.status);
  if (res.status === 429) return new ProviderError("RATE_LIMITED", "LLM rate limited (429)", 429);
  return new ProviderError("UPSTREAM_ERROR", `LLM upstream error ${res.status}`, res.status);
}

function isRetryable(e: unknown) {
  return (
    e instanceof ProviderError &&
    (e.code === "RATE_LIMITED" || e.code === "UPSTREAM_ERROR" || e.code === "TIMEOUT")
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const MOCK_CANDIDATES = [
  {
    id: "c1",
    title: "Lightweight federated learning for edge devices",
    scope: "Design and evaluate a communication-efficient federated training scheme for constrained edge hardware.",
    novelty: "Addresses the gap between full-scale federated methods and tiny-device constraints.",
    fitNote: "Scoped for a Master's project with Python and basic ML background.",
    risks: ["Limited device access for real tests", "Benchmark comparability"],
  },
  {
    id: "c2",
    title: "Benchmarking TinyML inference across microcontrollers",
    scope: "Systematic latency/energy benchmark of TinyML models on two MCU families.",
    novelty: "Few reproducible head-to-head numbers exist for current toolchains.",
    fitNote: "Hands-on and realistic with embedded coursework background.",
    risks: ["Hardware procurement delays"],
  },
  {
    id: "c3",
    title: "Privacy leakage audit of split learning in healthcare",
    scope: "Empirical audit of information leakage in split-learning setups on a public medical dataset.",
    novelty: "Recent interest in split learning safety has outpaced practical audits.",
    fitNote: "Analytical focus suits a theory-leaning background.",
    risks: ["Dataset licensing checks needed"],
  },
];

export const MOCK_BRIEF = {
  title: "Lightweight federated learning for edge devices",
  problem:
    "Edge devices cannot run full-scale federated learning, yet on-device training demand keeps growing. This project designs a communication-efficient scheme and evaluates it on realistic benchmarks.",
  researchQuestions: [
    "Which compression scheme preserves accuracy best under tight uplink budgets?",
    "How does device heterogeneity affect convergence?",
  ],
  scopeBoundaries: ["IN: simulation + 2-device testbed", "OUT: custom silicon, production deployment"],
  successCriteria: ["Reproducible benchmark results", "Comparison against two baselines"],
  estimatedDifficulty: "MASTERS",
};

export const MOCK_QUESTIONS = {
  questions: [
    { id: "q1", type: "text", question: "Describe your experience training or fine-tuning language models. What have you done hands-on?" },
    { id: "q2", type: "multi", question: "Which of these model-training concepts are you comfortable with?", options: ["Loss functions and optimizers", "Learning-rate scheduling", "Gradient accumulation", "Mixed-precision training", "Distributed training", "None of these"] },
    { id: "q3", type: "multi", question: "Which evaluation methods have you used?", options: ["Held-out test sets", "Cross-validation", "Benchmark suites (e.g. GLUE, GSM8K)", "Human evaluation", "Ablation studies", "None of these"] },
    { id: "q4", type: "text", question: "What mathematics (linear algebra, calculus, probability) do you use confidently? Give examples." },
    { id: "q5", type: "text", question: "Which papers or courses on this topic have you read or completed? List them." },
  ],
};

export const MOCK_VALIDATION = {
  novelty: {
    score: "medium",
    closestPriorWork: "Catastrophic forgetting in neural networks (McCloskey & Cohen, 1989); survey of continual learning for LLMs (2023).",
    differentiation: "Focus on catastrophic forgetting specifically in small language models under constrained compute, with a reproducible evaluation harness.",
  },
  feasibility: {
    score: "high",
    concerns: [],
    missing: ["Access to 1-2 consumer GPUs for repeated fine-tuning runs", "A small curated model (e.g. GPT-2-class or a 1B-parameter model)"],
  },
  logic: {
    gaps: ["The proposed method does not specify how base performance on Task A is preserved while learning Task B — need a clear forgetting metric.", "No mention of task ordering or how catastrophic forgetting is measured across sequential tasks."],
    unaddressedQuestions: ["Will the evaluation use permuted datasets, new tasks, or both?", "How many fine-tuning runs are planned, and is there a control condition?"],
  },
  scope: "Just right for a Master's project — narrow enough to finish, broad enough to matter.",
  evaluation: "Track accuracy on old tasks after learning new ones; report forgetting as accuracy drop vs. single-task baseline. Use a small fixed model so results are reproducible.",
  redFlags: ["Without a clear forgetting metric, novelty is hard to defend.", "If compute is unavailable, the empirical part may stall — consider a simulation-based fallback."],
  verdict: "refine",
  suggestions: ["Define a single forgetting metric upfront (e.g. accuracy drop on Task A after Task B).", "Scope to 2-3 sequential tasks on one small model.", "Add a baseline that retrains from scratch on each task for comparison."],
};

export const MOCK_GAPS = {
  knownAreas: ["Python and PyTorch basics", "Transformer architecture fundamentals"],
  gaps: [
    {
      concept: "Catastrophic forgetting in small language models",
      whyItMatters: "It is the core phenomenon the locked topic investigates.",
      currentUnderstanding: "User has not worked with continual learning.",
      searchQuery: "catastrophic forgetting language models",
    },
    {
      concept: "LoRA fine-tuning",
      whyItMatters: "Needed for parameter-efficient experiments on small models.",
      currentUnderstanding: "User has never used LoRA.",
      searchQuery: "low-rank adaptation language models",
    },
    {
      concept: "Continual learning evaluation protocols",
      whyItMatters: "Required to measure forgetting rigorously.",
      currentUnderstanding: "Unknown to the user.",
      searchQuery: "continual learning evaluation language models",
    },
  ],
};

// F5 Build Coach — mock fixtures for experiment advising
export const MOCK_F5_CHAT = `Good question — let's think this through. What have you tried so far, and what did you expect to happen vs what actually happened? Based on the literature, here are 3 approaches worth considering:
1. Start with a simpler baseline to isolate the issue (pro: easier to debug; con: less novel).
2. Use a parameter-efficient method like LoRA to reduce compute (pro: fits your hardware; con: may limit expressiveness).
3. Run a small-scale ablation first, then scale up (pro: de-risks the full experiment; con: takes longer).
Pick one and let's design the experiment around it.`;

export const MOCK_F5_PLAN = JSON.stringify({
  experiment: {
    title: "LoRA vs full fine-tuning for catastrophic forgetting in small LMs",
    hypothesis: "LoRA-based fine-tuning retains baseline task accuracy better than full fine-tuning when learning sequential tasks.",
    metrics: ["Accuracy on Task A after Task B", "Training time per task", "GPU memory peak"],
    controlCondition: "Full fine-tuning on the same task sequence",
    sampleSize: "3 task pairs, 5 runs each",
    "pitfalls": [
      "Task order effects — randomize ordering across runs",
      "Learning rate sensitivity — sweep LR before the main experiment",
      "For metric drift — recompute baseline accuracy before each measurement",
    ],
  },
});

export async function chatComplete(messages: ChatMessage[], opts: ProviderOpts = {}): Promise<string> {
  if (isMock()) {
    if (opts.jsonMode && opts.fixture === "brief") return JSON.stringify(MOCK_BRIEF);
    if (opts.jsonMode && opts.fixture === "candidates") return JSON.stringify({ candidates: MOCK_CANDIDATES });
    if (opts.jsonMode && opts.fixture === "gaps") return JSON.stringify(MOCK_GAPS);
    if (opts.jsonMode && opts.fixture === "validation") return JSON.stringify(MOCK_VALIDATION);
    if (opts.jsonMode && opts.fixture === "questions") return JSON.stringify(MOCK_QUESTIONS);
    if (opts.jsonMode && opts.fixture === "f5-plan") return MOCK_F5_PLAN;
    if (opts.jsonMode) return JSON.stringify({ candidates: MOCK_CANDIDATES });
    if (opts.fixture === "f5-chat") return MOCK_F5_CHAT;
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    // First turn: ask clarifying questions, not a topic dump.
    if (/domain:/i.test(lastUser)) {
      return (
        "Thanks — to narrow this down, could you tell me: " +
        "(1) which sub-area interests you most, (2) what data or hardware you can access, " +
        "and (3) how ambitious you want the project to be?"
      );
    }
    return "Got it. Tell me a bit more, or ask me to propose candidate topics when you are ready.";
  }
  // Non-streaming completions: kimi-k3 is a slow reasoning model — cap output
  // and strip reasoning params your snippet doesn't need.
  const body: Record<string, unknown> = {
    model: model(),
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 1024,
    ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
  };
  const envTimeout = Number(process.env.LLM_TIMEOUT_MS ?? "");
  const timeoutMs = opts.timeoutMs ?? (Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : 300000);
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await postChatCompletions(body, timeoutMs);
      if (!res.ok) throw mapStatus(res);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.length > 0) return content;
      // Some reasoning models return content in other shapes — fall back gracefully.
      if (Array.isArray(content)) {
        const text = content
          .map((p: { type?: string; text?: string }) => (typeof p?.text === "string" ? p.text : ""))
          .join("");
        if (text) return text;
      }
      throw new ProviderError("UPSTREAM_ERROR", "LLM returned an empty response");
    } catch (e) {
      lastErr = e;
      if (e instanceof ProviderError && e.code === "AGENT_OUTPUT_INVALID") throw e;
      if (!isRetryable(e) || attempt === 2) break;
      await sleep(1000 * 2 ** attempt);
    }
  }
  if (lastErr instanceof ProviderError) throw lastErr;
  throw new ProviderError("TIMEOUT", "LLM request failed after retries");
}

export async function* streamChat(messages: ChatMessage[], opts: ProviderOpts = {}): AsyncGenerator<string> {
  if (isMock()) {
    const full = await chatComplete(messages, opts);
    const words = full.split(/(?<=\s)/);
    let buf = "";
    for (const w of words) {
      buf += w;
      if (buf.length > 24) {
        yield buf;
        buf = "";
      }
    }
    if (buf) yield buf;
    return;
  }
  // Live SSE passthrough from the OpenAI-compatible endpoint (e.g. NVIDIA NIM).
  // kimi-k3 streams reasoning first: also surface reasoning_content deltas so
  // the user sees progress instead of a long silence, and cap output.
  const body: Record<string, unknown> = {
    model: model(),
    messages,
    stream: true,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 1024,
  };
  const envTimeout2 = Number(process.env.LLM_TIMEOUT_MS ?? "");
  const timeoutMs = opts.timeoutMs ?? (Number.isFinite(envTimeout2) && envTimeout2 > 0 ? envTimeout2 : 300000);
  let res: Response | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await postChatCompletions(body, timeoutMs);
      if (!res.ok) throw mapStatus(res);
      break;
    } catch (e) {
      lastErr = e;
      if (!isRetryable(e) || attempt === 2) throw e;
      await sleep(1000 * 2 ** attempt);
    }
  }
  if (!res || !res.body) {
    if (lastErr instanceof ProviderError) throw lastErr;
    throw new ProviderError("UPSTREAM_ERROR", "LLM stream unavailable");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta;
          const text =
            (typeof delta?.content === "string" && delta.content) ||
            (typeof delta?.reasoning_content === "string" ? `💭 ${delta.reasoning_content}` : "");
          if (text.length > 0) yield text;
        } catch {
          // ignore keep-alives / partial frames
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
