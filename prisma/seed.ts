import { prisma } from "@/lib/db";

const DEMO_TITLE = "Federated learning for edge devices";
const DEMO_DOMAIN = "federated learning for edge devices";
const DEMO_LEVEL = "MASTERS";

const F2_QUESTIONS = [
  { id: "q1", type: "text", question: "What is the main challenge of training ML models across distributed devices?" },
  { id: "q2", type: "text", question: "Can you explain how FedAvg (Federated Averaging) works?" },
  { id: "q3", type: "text", question: "What is gradient quantization, and why is it useful in federated learning?" },
  { id: "q4", type: "text", question: "Why is communication often the bottleneck in federated learning?" },
  { id: "q5", type: "text", question: "What is catastrophic forgetting in neural networks?" },
  { id: "q6", type: "text", question: "How does LoRA (Low-Rank Adaptation) help with fine-tuning?" },
  { id: "q7", type: "text", question: "What is the difference between FedAvg and FedProx?" },
  { id: "q8", type: "text", question: "What evaluation metrics would you use to assess a federated learning system?" },
];
const F2_ANSWERS = [
  { id: "q1", values: ["Devices have different data distributions (non-IID)."] },
  { id: "q2", values: ["It collects model weights from all devices, averages them, sends the update back."] },
  { id: "q3", values: ["It is about making gradients smaller to save memory on device."] },
  { id: "q4", values: ["Because devices are slow with weak processors."] },
  { id: "q5", values: ["Model forgets old tasks while learning new ones."] },
  { id: "q6", values: ["Freezes most weights, trains small adapter layers."] },
  { id: "q7", values: ["FedProx adds a proximal term for heterogeneous devices."] },
  { id: "q8", values: ["Accuracy and loss, same as regular ML."] },
];
const F2_REPORT = {
  knownAreas: ["Python/PyTorch", "Transformers", "FL basics (FedAvg, FedProx)"],
  gaps: [
    { concept: "Communication-efficient FL", whyItMatters: "Core technique the project depends on - quantization and sync reduce bandwidth.", currentUnderstanding: "Knows FedAvg exists; confuses quantization purpose.", searchQuery: "communication efficient federated learning" },
    { concept: "Gradient quantization (QSGD)", whyItMatters: "The proposed methodology uses 2-bit stochastic quantization.", currentUnderstanding: "Partial - thinks it saves memory, not bandwidth.", searchQuery: "gradient quantization QSGD" },
    { concept: "Non-IID data and convergence", whyItMatters: "Edge devices have heterogeneous data; must evaluate on non-IID splits.", currentUnderstanding: "Aware of non-IID concept; no experience constructing splits.", searchQuery: "non-IID federated learning convergence" },
    { concept: "FL evaluation metrics", whyItMatters: "Must measure communication cost and convergence rounds, not just accuracy.", currentUnderstanding: "Only knows accuracy and loss from standard ML.", searchQuery: "federated learning evaluation metrics" },
  ],
  papers: [
    { title: "Communication-Efficient Learning of Deep Networks", authors: ["H. Brendan McMahan", "Eider Moore", "Daniel Ramage", "Seth Hampson", "Blaise Aguera y Arcas"], year: 2017, url: "https://arxiv.org/abs/1602.05629", extId: "1602.05629", abstract: "Practical method for federated learning of deep networks from decentralized data (FedAvg).", reason: "Communication-efficient FL" },
    { title: "QSGD: Communication-Efficient SGD via Gradient Quantization and Encoding", authors: ["Dan Alistarh", "Demjan Grubic", "Jerry Li", "Ryota Tomioka", "Milan Vojnovic"], year: 2017, url: "https://arxiv.org/abs/1610.02132", extId: "1610.02132", abstract: "Gradient quantization schemes with convergence guarantees for distributed training.", reason: "Gradient quantization (QSGD)" },
    { title: "Federated Optimization in Heterogeneous Networks", authors: ["Tian Li", "Anit Kumar Sahu", "Manzil Zaheer", "Virginia Smith"], year: 2020, url: "https://arxiv.org/abs/1812.06127", extId: "1812.06127", abstract: "FedProx with proximal term for statistical heterogeneity across devices.", reason: "Non-IID data and convergence" },
  ],
};
const F3_SOLUTIONS = [
  { name: "Quantized gradient aggregation", description: "Compress gradient updates via quantization (QSGD-style) before upload.", howItAddresses: "Directly reduces uplink bandwidth, the core bottleneck for edge FL.", paperExtIds: ["1602.05629", "1610.02132"] },
  { name: "Heterogeneity-aware optimization", description: "Handle non-IID data with proximal terms (FedProx) and adaptive sync.", howItAddresses: "Keeps convergence stable across diverse edge devices.", paperExtIds: ["2007.07481", "1610.02527"] },
  { name: "Edge systems and surveys", description: "System-level view of FL on resource-constrained edge hardware.", howItAddresses: "Background for testbed design on Raspberry Pi class devices.", paperExtIds: ["2003.03063"] },
];
const F5_CHAT = [
  { role: "user", content: "How do I set up the federated learning simulation?" },
  { role: "assistant", content: "Two main options: (1) Flower framework - handles federated orchestration, good docs. (2) Custom multiprocessing on your Raspberry Pi. Given your timeline, I recommend Flower. What does your PyTorch setup look like?" },
  { role: "user", content: "I have PyTorch working. How do I implement the quantization?" },
  { role: "assistant", content: "3 approaches: (1) Brevitas library - well-tested but less flexible. (2) Custom stochastic rounding - full control but bug-prone. (3) Start deterministic then add stochasticity - easier to debug. I recommend option 3." },
  { role: "user", content: "My model is not converging after adding quantization. Any ideas?" },
  { role: "assistant", content: "Common pitfalls: (1) learning rate too high - try LR=0.001 or lower. (2) Sync period too long - try every 3 rounds. (3) Non-IID splits too extreme - Dirichlet alpha=0.5 is moderate. Run a small ablation first." },
];
const F4_A1 = { novelty: { score: "medium", closestPriorWork: "QSGD (2017); FedAvg (2017).", differentiation: "Combines known techniques but unclear what is new." }, feasibility: { score: "high", concerns: ["Pi 4 testbed is realistic."], missing: ["Non-IID split construction not specified."] }, logic: { gaps: ["How are non-IID splits constructed?", "What is the convergence metric?", "Where is the baseline comparison?"], unaddressedQuestions: ["Which baselines?", "Which metrics beyond accuracy?"] }, scope: "Right size for Masters.", evaluation: "Needs a defined convergence metric.", redFlags: ["No convergence metric.", "Baseline comparison missing."], verdict: "refine", suggestions: ["Specify Dirichlet alpha for splits.", "Define convergence metric.", "Add FedAvg and FedProx baselines."] };
const F4_A2 = { novelty: { score: "medium", closestPriorWork: "QSGD (2017); FedAvg (2017).", differentiation: "Edge-focused benchmark with practical constraints is a solid contribution." }, feasibility: { score: "high", concerns: [], missing: [] }, logic: { gaps: [], unaddressedQuestions: [] }, scope: "Right size for Masters.", evaluation: "Accuracy, communication cost, convergence rounds vs FedAvg and FedProx.", redFlags: [], verdict: "proceed", suggestions: ["Proceed to implementation."] };
const F4_METHOD_1 = "I want to use 2-bit stochastic gradient quantization with full-weight synchronization every 5 rounds. I will evaluate on Raspberry Pi 4 devices with a small transformer model.";
const F4_METHOD_2 = "I will use 2-bit stochastic gradient quantization with full-weight synchronization every 5 rounds on Raspberry Pi 4";
const F4_ITERATIONS = [
  { methodology: F4_METHOD_1, attack: F4_A1, at: "2025-01-12T10:00:00Z" },
  { methodology: F4_METHOD_2 + " devices with a small transformer model. Non-IID splits via Dirichlet distribution (alpha=0.5). Convergence metric: accuracy drop vs single-task baseline. Baselines: FedAvg and FedProx. Metrics: accuracy, communication cost (bytes uploaded), convergence rounds.", attack: F4_A2, at: "2025-01-12T11:00:00Z" },
];
const F4_FINAL = "2-bit stochastic gradient quantization with full-weight synchronization every 5 rounds on Raspberry Pi 4 devices with a small transformer model. Non-IID splits via Dirichlet distribution (alpha=0.5). Baselines: FedAvg [McMahan et al., 2017] and FedProx [Wang et al., 2020]. Metrics: accuracy, communication cost (bytes uploaded), convergence rounds.";

async function main() {
  console.log("Cleaning existing data...");
  await prisma.experimentLog.deleteMany();
  await prisma.paperRef.deleteMany();
  await prisma.artifact.deleteMany();
  await prisma.message.deleteMany();
  await prisma.stageState.deleteMany();
  await prisma.project.deleteMany();
  await prisma.paperSession.deleteMany();
  console.log("All existing projects removed.");

  const demo = await prisma.project.create({
    data: {
      title: DEMO_TITLE,
      domain: DEMO_DOMAIN,
      userLevel: DEMO_LEVEL,
      isDemo: true,
      stages: {
        create: [
          { stage: "F1", status: "COMPLETE", data: JSON.stringify({ intake: { domain: DEMO_DOMAIN, background: "CS masters student", level: DEMO_LEVEL }, clarQuestionCount: 3, selectedTopic: { id: "c1", title: "Lightweight federated learning for edge devices", scope: "Edge devices cannot run full-scale FL.", novelty: "Addresses the gap.", fitNote: "Scoped for Master.", risks: ["Limited device access"] } }) },
          { stage: "F2", status: "COMPLETE", data: JSON.stringify({ topic: { title: "Lightweight federated learning for edge devices", problem: "Edge devices cannot run full-scale FL." }, questions: F2_QUESTIONS, answers: F2_ANSWERS, report: F2_REPORT }) },
          { stage: "F3", status: "COMPLETE", data: JSON.stringify({ topic: { title: "Lightweight federated learning for edge devices" }, gaps: ["Communication-efficient FL"], searchQuery: "communication efficient federated learning edge", solutions: F3_SOLUTIONS }) },
          { stage: "F4", status: "COMPLETE", data: JSON.stringify({ iterations: F4_ITERATIONS, finalizedMethodology: F4_FINAL }) },
          { stage: "F5", status: "COMPLETE", data: JSON.stringify({ chat: F5_CHAT, plan: { version: 2, notes: "2-bit stochastic quantization." } }) },
          { stage: "F6", status: "COMPLETE", data: JSON.stringify({ sections: [{ id: "title", title: "Lightweight FL for Edge" }, { id: "abstract", title: "Abstract" }] }) },
          { stage: "F7", status: "COMPLETE", data: JSON.stringify({ venues: [{ name: "ACM SenSys", fit: "Premier edge computing conference." }], selectedVenue: "ACM SenSys", checklist: [{ item: "Finalize paper", done: true }], submitted: false }) },
        ],
      },
    },
  });

  await prisma.paperRef.createMany({
    data: [
      { projectId: demo.id, stage: "F3", title: "Communication-Efficient Learning of Deep Networks", authors: "H. Brendan McMahan et al.", year: 2017, venue: "AISTATS", abstract: "Practical method for federated learning.", url: "https://arxiv.org/abs/1602.05629", source: "arxiv", extId: "1602.05629", score: 0.95, reason: "Foundational FL paper", solutionTag: "baseline" },
      { projectId: demo.id, stage: "F3", title: "Federated Optimization for On-Device Intelligence", authors: "Jakub Konecny et al.", year: 2016, venue: "arXiv", abstract: "Introduces FedAvg.", url: "https://arxiv.org/abs/1610.02527", source: "arxiv", extId: "1610.02527", score: 0.92, reason: "Core baseline", solutionTag: "baseline" },
      { projectId: demo.id, stage: "F3", title: "FedProx: Heterogeneous Federated Optimization", authors: "Jianyu Wang et al.", year: 2020, venue: "NeurIPS", abstract: "Proximal term for heterogeneity.", url: "https://arxiv.org/abs/2007.07481", source: "arxiv", extId: "2007.07481", score: 0.88, reason: "Heterogeneous baseline", solutionTag: "baseline" },
      { projectId: demo.id, stage: "F3", title: "QSGD: Communication-Efficient SGD", authors: "Dan Alistarh et al.", year: 2017, venue: "NeurIPS", abstract: "Gradient quantization schemes.", url: "https://arxiv.org/abs/1610.02132", source: "arxiv", extId: "1610.02132", score: 0.85, reason: "Relevant technique", solutionTag: "technique" },
      { projectId: demo.id, stage: "F3", title: "FL on Edge Devices: A Survey", authors: "Wei Yang Bryan Lim et al.", year: 2020, venue: "IEEE Comms Surveys", abstract: "Edge FL survey.", url: "https://arxiv.org/abs/2003.03063", source: "arxiv", extId: "2003.03063", score: 0.82, reason: "Background", solutionTag: "background" },
    ],
  });

  await prisma.artifact.createMany({
    data: [
      { projectId: demo.id, stage: "F1", kind: "TOPIC_BRIEF", title: "Lightweight federated learning for edge devices", content: JSON.stringify({ title: "Lightweight federated learning for edge devices", problem: "Edge devices cannot run full-scale FL.", researchQuestions: ["How much can quantization reduce communication?"], scopeBoundaries: ["Focus on communication", "Edge devices only"], successCriteria: ["80% reduction vs FedAvg"], estimatedDifficulty: "MASTERS" }), version: 1 },
      { projectId: demo.id, stage: "F2", kind: "GAP_REPORT", title: "Gap report", content: JSON.stringify(F2_REPORT), version: 1 },
      { projectId: demo.id, stage: "F4", kind: "VALIDATION_REPORT", title: "Validation report", content: JSON.stringify({ finalizedMethodology: F4_FINAL, iterations: F4_ITERATIONS, topic: "Lightweight federated learning for edge devices", completedAt: "2025-01-12T12:00:00Z" }), version: 2 },
      { projectId: demo.id, stage: "F6", kind: "PAPER_DRAFT", title: "Paper draft", content: JSON.stringify({ sections: [{ id: "title", title: "Lightweight FL" }], wordCount: 4200, status: "draft" }), version: 1 },
    ],
  });

  await prisma.experimentLog.createMany({
    data: [
      { projectId: demo.id, name: "Quantization bit-width sweep", hypothesis: "2-bit is best.", result: "1-bit loses 4% accuracy. 2-bit loses 1.5%.", learning: "Stochastic rounding is essential." },
      { projectId: demo.id, name: "Sync period sweep", hypothesis: "Every 5 rounds is optimal.", result: "5 rounds: 80% reduction.", learning: "Heterogeneity matters." },
      { projectId: demo.id, name: "Non-IID evaluation", hypothesis: "Handles non-IID like FedProx.", result: "Matches FedProx on mild non-IID.", learning: "Proximal term helps." },
    ],
  });

  const messages = [
    { stage: "F1", role: "USER", content: "Hi! I'm Sarah, a second-year Master's student in Computer Science. I've taken courses in machine learning and distributed systems, and done personal projects with Python and PyTorch. I'm looking for a final year research topic." },
    { stage: "F1", role: "ASSISTANT", content: "Hi Sarah! Great to meet you — your background in ML and distributed systems gives us a lot to work with. To narrow this down, could you tell me: (1) which sub-area excites you most right now, (2) what kind of hardware or data you can actually access for experiments, and (3) how ambitious you want the project to be?" },
    { stage: "F1", role: "USER", content: "I'm really interested in AI that works on small devices like phones or sensors rather than big cloud servers. I have a Raspberry Pi 4 at home and access to a few old Android phones. I want something challenging but achievable in 6-8 months." },
    { stage: "F1", role: "ASSISTANT", content: "That's a great niche — edge AI is hot and your hardware access is perfect for it. A couple more questions: (1) are you more drawn to the systems side (making things run efficiently) or the model side (designing better algorithms)? (2) have you heard of federated learning — training models across devices without centralizing data?" },
    { stage: "F1", role: "USER", content: "I like both, but I think I'm more interested in the systems side — making things run efficiently on constrained hardware. I've heard of federated learning but never worked with it. The privacy aspect sounds interesting too." },
    { stage: "F1", role: "ASSISTANT", content: "Perfect — federated learning on edge devices is a great fit for your skills and hardware. Here are 3 scoped candidates based on our conversation:" },
    { stage: "F1", role: "ASSISTANT", content: "1. **Lightweight Federated Learning for Edge Devices** — Design a communication-efficient federated training scheme for constrained edge hardware like Raspberry Pi. You'd combine gradient quantization with periodic sync to reduce bandwidth by ~80% while maintaining convergence.\n\n2. **Benchmarking TinyML Inference Across Microcontrollers** — Systematic latency/energy benchmark of TinyML models on two MCU families. Very hands-on, uses your Raspberry Pi.\n\n3. **Privacy Leakage Audit of Split Learning in Healthcare** — Empirical audit of information leakage in split-learning setups on a public medical dataset. More analytical/theory-leaning.\n\nWhich one appeals to you most?" },
    { stage: "F1", role: "USER", content: "The first one — Lightweight Federated Learning for Edge Devices — sounds perfect! It matches my interest in systems and efficiency, and I can use my Raspberry Pi for the experiments." },
    { stage: "F1", role: "ASSISTANT", content: "Excellent choice! I've locked in 'Lightweight Federated Learning for Edge Devices' as your topic. Here's your topic brief with research questions, scope boundaries, and success criteria." },
    { stage: "F2", role: "ASSISTANT", content: "Now I'll interview you about concepts related to federated learning. Answer what you can — I'll mark your answers and explain. This helps identify what you already know and what you'll need to learn." },
    { stage: "F2", role: "ASSISTANT", content: "**Q1:** What is the main challenge of training ML models across distributed devices?" },
    { stage: "F2", role: "USER", content: "I think it's that devices have different amounts and types of data — some might have lots of examples, others very few." },
    { stage: "F2", role: "ASSISTANT", content: "✓ **Correct!** The core challenge is **non-IID data** — devices have different data distributions. This makes simple averaging less effective because each device's local optimum differs from the global one." },
    { stage: "F2", role: "ASSISTANT", content: "**Q2:** Can you explain how FedAvg (Federated Averaging) works?" },
    { stage: "F2", role: "USER", content: "It collects model weights from all devices, averages them, and sends the updated model back. This happens once at the end." },
    { stage: "F2", role: "ASSISTANT", content: "~ **Partially correct.** FedAvg does average model weights, but it happens **iteratively** — devices train locally for several rounds, then send updates. This repeats many times. The key insight is that multiple local steps reduce communication rounds." },
    { stage: "F2", role: "ASSISTANT", content: "**Q3:** What is gradient quantization, and why is it useful in federated learning?" },
    { stage: "F2", role: "USER", content: "It's about making the gradients smaller so they take up less memory on the device." },
    { stage: "F2", role: "ASSISTANT", content: "~ **Close, but not quite.** Gradient quantization reduces the **precision** of gradients (e.g., from 32-bit to 2-bit) to save **bandwidth** during upload, not memory. The trade-off is some accuracy loss for big communication savings." },
    { stage: "F2", role: "ASSISTANT", content: "**Q4:** Why is communication often the bottleneck in federated learning?" },
    { stage: "F2", role: "USER", content: "Because devices are usually slow and have weak processors, so training takes forever." },
    { stage: "F2", role: "ASSISTANT", content: "✗ **Incorrect.** The bottleneck isn't compute speed — it's **wireless bandwidth**. Uploading large model updates (millions of parameters) over 4G/WiFi is slow and expensive. That's why techniques like gradient quantization matter — they shrink what gets uploaded." },
    { stage: "F2", role: "ASSISTANT", content: "**Q5:** What is catastrophic forgetting in neural networks?" },
    { stage: "F2", role: "USER", content: "It's when a model forgets how to do old tasks while learning new ones. Like if you train on task A then task B, it gets worse at A." },
    { stage: "F2", role: "ASSISTANT", content: "✓ **Correct!** Catastrophic forgetting is a key concern in continual learning — and relevant to federated learning where devices may learn tasks sequentially." },
    { stage: "F2", role: "ASSISTANT", content: "**Q6:** How does LoRA (Low-Rank Adaptation) help with fine-tuning?" },
    { stage: "F2", role: "USER", content: "It freezes most of the model weights and only trains small adapter layers. This makes fine-tuning much cheaper." },
    { stage: "F2", role: "ASSISTANT", content: "✓ **Correct!** LoRA freezes pretrained weights and injects trainable low-rank matrices. For your project, this means you could fine-tune on edge devices with far less compute." },
    { stage: "F2", role: "ASSISTANT", content: "**Q7:** What's the difference between FedAvg and FedProx?" },
    { stage: "F2", role: "USER", content: "FedProx adds a proximal term to handle heterogeneous devices — it keeps local updates closer to the global model so they don't drift too far." },
    { stage: "F2", role: "ASSISTANT", content: "✓ **Correct!** FedProx modifies the local objective with a proximal term, making it more robust to non-IID data. This is a key baseline for your experiments." },
    { stage: "F2", role: "ASSISTANT", content: "**Q8:** What evaluation metrics would you use to assess a federated learning system?" },
    { stage: "F2", role: "USER", content: "I'd look at accuracy and loss — same as regular ML." },
    { stage: "F2", role: "ASSISTANT", content: "~ **Partial answer.** Accuracy and loss matter, but FL needs additional metrics: (1) **communication cost** (total bytes uploaded), (2) **convergence speed** (rounds to target accuracy), (3) **fairness** (variance across devices). These capture the trade-offs your project explores." },
    { stage: "F2", role: "ASSISTANT", content: "**Interview complete!** Here's your gap report — what you know and what you'll need to learn:" },
    { stage: "F3", role: "ASSISTANT", content: "I'll search arXiv for papers related to your knowledge gaps. This uses the real arXiv API — these are actual published papers, not invented citations." },
    { stage: "F3", role: "ASSISTANT", content: "**Search results for 'communication efficient federated learning edge devices':**\n\n1. **Communication-Efficient Learning of Deep Networks** — McMahan et al. (2017), AISTATS — *The foundational FedAvg paper. Shows iterative averaging reduces communication rounds.* [arXiv:1602.05629]\n\n2. **Federated Optimization for On-Device Intelligence** — Konečný et al. (2016) — *Introduces FedAvg, robust to non-IID data.* [arXiv:1610.02527]\n\n3. **FedProx: Heterogeneous Federated Optimization** — Wang et al. (2020), NeurIPS — *Adds proximal term for statistical heterogeneity.* [arXiv:2007.07481]\n\n4. **QSGD: Communication-Efficient SGD via Gradient Quantization** — Alistarh et al. (2017), NeurIPS — *Gradient quantization schemes with convergence guarantees.* [arXiv:1610.02132]\n\n5. **Federated Learning on Edge Devices: A Survey** — Lim et al. (2020), IEEE Comms Surveys — *Comprehensive overview of edge FL challenges.* [arXiv:2003.03063]\n\nWhich papers are most relevant to your project?" },
    { stage: "F3", role: "USER", content: "The first four are perfect — FedAvg and FedProx are my baselines, and QSGD is directly relevant to the quantization approach. The survey is good background reading." },
    { stage: "F3", role: "ASSISTANT", content: "Excellent choices. I've saved these as your reference list, tagged as baselines (FedAvg, FedProx), technique (QSGD), and background (survey). You'll cite these in your paper draft." },
    { stage: "F4", role: "ASSISTANT", content: "Describe your proposed methodology. I'll stress-test it for novelty, feasibility, and logic. Don't worry if it's rough — we'll iterate." },
    { stage: "F4", role: "USER", content: "I want to use 2-bit stochastic gradient quantization with full-weight synchronization every 5 rounds. I'll evaluate on Raspberry Pi 4 devices with a small transformer model." },
    { stage: "F4", role: "ASSISTANT", content: "**Validation Report — Iteration 1**\n\n**Novelty: MEDIUM** — Combines known techniques (quantization + sync) but doesn't clearly state what's new.\n\n**Feasibility: HIGH** — Raspberry Pi 4 is realistic for your setup.\n\n**Logic: GAPS FOUND** — (1) How will you construct non-IID data splits? (2) What's your convergence metric? (3) Where's the baseline comparison?\n\n**Verdict: REFINE** — Please address these gaps." },
    { stage: "F4", role: "USER", content: "I'll use Dirichlet distribution (alpha=0.5) to create non-IID splits. My convergence metric is accuracy drop vs single-task baseline. I'll compare against FedAvg and FedProx as baselines." },
    { stage: "F4", role: "ASSISTANT", content: "**Validation Report — Iteration 2**\n\n**Novelty: MEDIUM** — Edge-focused benchmark with practical constraints is a solid contribution.\n\n**Feasibility: HIGH** — All components are achievable with your hardware.\n\n**Logic: SOUND** — Clear methodology, proper baselines, defined metrics.\n\n**Verdict: PROCEED** — Your methodology is ready. Here's the finalized validation report for your records." },
    { stage: "F5", role: "USER", content: "How do I set up the federated learning simulation?" },
    { stage: "F5", role: "ASSISTANT", content: "Two main options:\n\n1. **Flower framework** — handles federated orchestration, good docs, supports custom client logic. Pro: production-ready. Con: some learning curve.\n\n2. **Custom multiprocessing** — you simulate clients as processes on your Raspberry Pi. Pro: full control. Con: you handle all the networking logic.\n\nGiven your timeline, I'd recommend Flower. What does your current PyTorch setup look like?" },
    { stage: "F5", role: "USER", content: "I have PyTorch working. How do I implement the quantization?" },
    { stage: "F5", role: "ASSISTANT", content: "3 approaches worth considering:\n\n1. **Brevitas library** — has built-in quantized layers. Pro: well-tested. Con: less flexible for custom schemes.\n\n2. **Custom stochastic rounding** — you implement the quantization yourself. Pro: full control. Con: easy to introduce bugs.\n\n3. **Start deterministic, then add stochasticity** — get 2-bit deterministic working first, then upgrade. Pro: easier to debug. Con: two-step process.\n\nI'd recommend option 3. Pick one and let's design the experiment around it." },
    { stage: "F5", role: "USER", content: "My model isn't converging after adding quantization. Any ideas?" },
    { stage: "F5", role: "ASSISTANT", content: "Common pitfalls with quantized FL:\n\n1. **Learning rate too high** — quantized gradients are noisier; try LR=0.001 or lower.\n2. **Sync period too long** — try every 3 rounds instead of 5.\n3. **Non-IID splits too extreme** — Dirichlet alpha=0.5 is moderate; alpha=0.1 is very heterogeneous.\n\n**Suggested experiment:** Run a small-scale ablation — 3 values of each variable, 5 runs each. Start with the easiest factor (sync period) and work up. This is your first experiment log entry." },
    { stage: "F6", role: "USER", content: "Help me write the introduction" },
    { stage: "F6", role: "ASSISTANT", content: "**Introduction Draft:**\n\nEdge devices generate vast amounts of data that could improve machine learning models, but privacy concerns and bandwidth limitations prevent centralizing this data. Federated learning (FL) addresses this by training models locally and sharing only model updates [McMahan et al., 2017]. However, standard FL algorithms assume participants have compute resources comparable to servers, which is not true for edge devices with limited memory, processing power, and network bandwidth.\n\nThis work addresses the challenge of making federated learning practical for resource-constrained edge devices. Our key contribution is a communication-efficient scheme that combines 2-bit stochastic gradient quantization [Alistarh et al., 2017] with periodic full-weight synchronization, reducing uplink communication by 80% while maintaining convergence on non-IID data distributions.\n\nWant me to adjust the tone or add more motivation?" },
    { stage: "F6", role: "USER", content: "That's good. Now the methodology section." },
    { stage: "F6", role: "ASSISTANT", content: "**Methodology Draft:**\n\nOur approach combines two techniques: (1) 2-bit stochastic gradient quantization to reduce update size, and (2) periodic full-weight synchronization every 5 rounds to prevent quantization error accumulation.\n\nWe implement this using the Flower federated learning framework with PyTorch. The quantization uses stochastic rounding: for each gradient value g, we map it to one of two levels with probability proportional to g. Non-IID data splits are generated using Dirichlet distribution (alpha=0.5).\n\nEvaluation uses a custom benchmark on Raspberry Pi 4 devices with a small transformer model. Baselines: FedAvg [McMahan et al., 2017] and FedProx [Wang et al., 2020]. Metrics: accuracy, communication cost (bytes uploaded), convergence rounds.\n\nI've referenced your F4 validation report for the convergence metric. Ready for the results section when you are." },
    { stage: "F6", role: "ASSISTANT", content: "Let's draft your paper section by section. I'll help structure each section and identify where to cite your references." },
    { stage: "F7", role: "USER", content: "ACM SenSys sounds perfect — it's exactly the right audience for edge computing research." },
    { stage: "F7", role: "ASSISTANT", content: "Great choice. ACM SenSys is highly respected in the edge computing community. Here's your submission checklist:" },
    { stage: "F7", role: "ASSISTANT", content: "Based on your title and abstract, here are 3 venue recommendations:\n\n1. **ACM SenSys** — Premier conference on networked sensing systems and edge computing. Strong match for your application domain. Deadline: May 2025.\n\n2. **IEEE IoT Journal** — Well-established journal covering IoT and edge computing. Good for a comprehensive evaluation. Deadline: Rolling.\n\n3. **ACM EdgeSys** — Workshop co-located with EuroSys, focused specifically on edge systems. Good for initial feedback. Deadline: January 2025." },
    { stage: "F7", role: "USER", content: "Thanks Euler! This has been really helpful." },
    { stage: "F7", role: "ASSISTANT", content: "**Submission Checklist:**\n\n✓ Finalize paper draft\n✓ Internal review by advisor\n✓ Format for ACM template\n⬜ Submit to ACM SenSys (deadline: May 2025)\n⬜ Prepare camera-ready (if accepted)\n\nI'll track your progress. Good luck with the submission!" },
  ];

  const base = new Date("2025-01-10T09:00:00Z").getTime();
  let seq = 0;
  for (const msg of messages) {
    const createdAt = new Date(base + seq * 60_000);
    seq += 1;
    await prisma.message.create({ data: { projectId: demo.id, stage: msg.stage, role: msg.role, content: msg.content, createdAt } });
  }

  console.log("Demo project created:", demo.id);
  console.log("Messages added:", messages.length);

  // Demo Paper Lab session (undeletable) — same FedAvg paper referenced in the research demo
  const LAB_SECTIONS = [
    { index: 0, heading: "Abstract", text: "Federated learning allows edge devices to collectively learn a shared prediction model while keeping training data local. We propose FedAvg, a practical method for the federated learning of deep networks from decentralized data. The federated averaging algorithm reduces required communication rounds by 10-100x compared to naive synchronization. Experiments on CIFAR-10, Shakespeare, and sentiment datasets show robustness to unbalanced and non-IID data distributions." },
    { index: 1, heading: "Introduction", text: "Phones and tablets are increasingly used for sensing and computation, but the rich data they generate is sensitive. The standard approach — logging data to a datacenter — is no longer acceptable due to privacy concerns. We advocate an alternative: federated learning, where the training data stays on the device and only model updates are shared. Challenges: (1) intermittent connectivity, (2) availability, (3) statistical heterogeneity across devices." },
    { index: 2, heading: "The Federated Averaging Algorithm", text: "FedAvg works as follows: the server samples a fraction C of clients each round. Each selected client runs local SGD for E epochs on its local data. The server then performs a weighted average of the client updates, weighted by the number of training samples n_k on each client. The key insight is that averaging many locally-trained models can work well, dramatically reducing total communication compared to sending one gradient step per round." },
    { index: 3, heading: "Experiments", text: "We evaluate on three model architectures: a multi-layer perceptron on MNIST (2.25% test error with FedSGD baseline, 0.5% with FedAvg), a CNN on CIFAR-10, and a character-LSTM on the Shakespeare dataset. Communication cost is reduced by 10-100x: with E=5 local epochs, FedAvg reaches target accuracy in 20 rounds vs 1,600+ rounds for FedSGD. Robustness to non-IID partitions: FedAvg degrades gracefully, unlike naive averaging." },
    { index: 4, heading: "Conclusion & Relevance", text: "FedAvg demonstrates that federated learning is practical: communication costs drop by orders of magnitude while remaining robust to unbalanced, non-IID data. Limitation: no differential privacy or secure aggregation — follow-up work addresses these. Relevance to our project: FedAvg is our baseline; our 2-bit quantization + periodic sync aims to cut its uplink cost by a further ~80% on edge hardware." },
  ];
  const LAB_QUIZZES = [
    { scope: "full", date: "2025-01-13T14:30:00Z", score: 4, maxScore: 5, questions: [
      { question: "What is the main communication bottleneck FedAvg addresses?", answer: "Each FedSGD round requires a global synchronization step; FedAvg amortizes communication over multiple local epochs.", explanation: "Correct — the cost of many synchronization rounds is the bottleneck." },
      { question: "How are client updates weighted in the server average?", answer: "By the number of training samples n_k on each client.", explanation: "Correct — weighting by dataset size is key to FedAvg's convergence." },
      { question: "What happens when E (local epochs) is set too high?", answer: "Clients overfit to their local data and the averaged model diverges or converges slowly.", explanation: "Correct — too many local steps causes client drift on non-IID data." },
      { question: "Which datasets were used in the evaluation?", answer: "MNIST, CIFAR-10, and Shakespeare.", explanation: "Correct — three model families across vision and language." },
      { question: "Does FedAvg provide differential privacy guarantees?", answer: "Yes, through secure aggregation.", explanation: "Incorrect — FedAvg alone provides neither DP nor secure aggregation; follow-up work added these." },
    ] },
  ];
  await prisma.paperSession.create({
    data: {
      title: "Communication-Efficient Learning of Deep Networks (FedAvg)",
      isDemo: true,
      meta: JSON.stringify({ authors: "H. Brendan McMahan, Eider Moore, Daniel Ramage, Seth Hampson, Blaise Aguera y Arcas", year: 2017, url: "https://arxiv.org/abs/1602.05629", source: "text" }),
      fullText: "Federated learning allows edge devices to collectively learn a shared prediction model while keeping training data local. This is the full text of the FedAvg paper (abridged for the demo). " + LAB_SECTIONS.map((s) => s.text).join(" ").slice(0, 15000),
      sections: JSON.stringify(LAB_SECTIONS),
      quizzes: JSON.stringify(LAB_QUIZZES),
    },
  });
  console.log("Demo Paper Lab session created.");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
