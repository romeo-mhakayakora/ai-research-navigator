# Euler — Technical Overview

> A high-level technical summary for presenters and stakeholders. Explains what the system is, how it is built, and why — without diving into code.

---

## 1. Project Overview

Euler is an AI-powered research topic navigator that guides students and early-career researchers through a structured, seven-stage workflow — from a broad interest to a validated, defensible research plan. The system combines a conversational AI agent with real literature search (arXiv), adversarial idea validation, and experiment coaching. A stage-gated architecture ensures thinking happens in the right order: each stage must be completed before the next one opens.

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 14 (App Router) | Full-stack React framework with file-based routing, server components, and API routes in one project |
| Frontend | React 18 + Tailwind CSS + Radix UI | Component-based styling, accessible UI primitives, fast iteration |
| Validation | Zod | Runtime schema validation for all API inputs and agent outputs |
| ORM | Prisma 5 | Type-safe database access with auto-generated client and migrations |
| Database | SQLite | Zero-config local database — no external service needed for development or demo |
| Testing | Vitest | Fast unit and contract tests with native TypeScript support |
| AI | OpenAI-compatible API (or mock) | Provider-agnostic LLM integration — works with OpenRouter, NVIDIA NIM, or any OpenAI-compatible endpoint |

---

## 3. System Architecture

The system follows a layered architecture:

- **Browser (React)** — Stage pages, chat UI with SSE streaming, workspace sidebar showing progress and gating states
- **Next.js API Routes** — Three endpoint patterns per stage: data (GET), action (POST), chat (SSE stream)
- **Agent Layer** — System prompts per stage, context builder that pulls prior stage data, tool registry (arXiv search)
- **LLM Provider Abstraction** — Single interface with two implementations: mock (deterministic fixtures) and real (OpenAI-compatible with retries and error mapping)
- **Database (SQLite)** — Six core tables: Project, StageState, Message, Artifact, PaperRef, ExperimentLog

Data flows top-to-bottom: the browser calls API routes, which dispatch to agents, which call the LLM provider, which returns responses that get persisted to the database.

---

## 4. Database Schema

The data model is built around a **Project** and its progression through seven stages:

| Table | Purpose |
|-------|---------|
| Project | Top-level container — holds the research domain, user level, and metadata |
| StageState | One row per stage per project (F1–F7). Tracks status (LOCKED to ACTIVE to COMPLETE) and stores stage-specific JSON data |
| Message | Chat history — each conversation turn is persisted with its role (user/assistant/system) and stage |
| Artifact | Generated documents — validation reports, paper drafts, implementation plans. Versioned and unique per (project, stage, kind) |
| PaperRef | Real papers fetched from arXiv — title, authors, year, abstract, URL. Deduplicated per project |
| ExperimentLog | F5 experiment tracker — name, hypothesis, result, learning. Owned by the Build Coach stage |

**Key design decisions:**
- SQLite for zero-setup local development and demo
- JSON blobs in StageState.data and Artifact.content for flexible, stage-specific payloads without schema migrations
- Cascade deletes — removing a project cleans up all related data

---

## 5. Stage-Gated Workflow

F1 leads to F2 leads to F3 leads to F4 leads to F5 leads to F6 leads to F7

| Stage | Name | What happens | Output |
|-------|------|--------------|--------|
| F1 | Topic Selection | Agent asks clarifying questions, proposes scoped candidate topics | 3–5 candidate topics |
| F2 | Gap Identification | Maps concepts the topic depends on, identifies knowledge gaps | Known areas + gaps list |
| F3 | Literature Search | Searches arXiv for real papers, returns structured results | Relevant papers with metadata |
| F4 | Idea Validation | Adversarial review of the proposed methodology | Structured verdict (proceed/refine/pivot) |
| F5 | Build Coach | Advises on implementation, helps design experiments | Experiment logs + coaching chat |
| F6 | Paper Writing | Helps draft sections, identifies references from text | Paper draft artifact |
| F7 | Publish | Recommends venues, tracks submission checklist | Venue selection + checklist |

**Gating logic:** Each stage checks that the previous stage is COMPLETE before allowing access. Enforced at the API level (returns 403 STAGE_LOCKED if bypassed) and reflected in the UI sidebar.

---

## 6. Agent System

Each stage has a dedicated **system prompt** that defines:
- The agent role and personality
- Behavioral rules (what to do, what never to do)
- Output format (structured JSON, free text, etc.)
- Context injection points

**Context building:** Before calling the LLM, the agent assembles context from prior stages. For example, F4 validation prompt receives the F2 gaps and F3 papers. This ensures advice is grounded in the user actual project state, not generic.

**Provider abstraction:** A single chatComplete() / streamChat() interface works in two modes:
- Mock mode: returns deterministic JSON fixtures (no API key needed). Used for demos and contract tests.
- Live mode: calls a real OpenAI-compatible endpoint with retries, timeout handling, and error mapping.

Switching between modes is a single environment variable (LLM_PROVIDER=mock).

---

## 7. API Structure

All stage APIs follow a consistent pattern:

- /api/projects/[id]/stages/[stage]/data — GET (load page state)
- /api/projects/[id]/stages/[stage]/action — POST (run an action)
- /api/projects/[id]/stages/[stage]/chat — POST (SSE streaming chat)

**Actions** are dispatched by an action field in the POST body — e.g., logExperiment, updateExperiment, complete. This keeps the API extensible without new endpoints.

**Chat streaming** uses Server-Sent Events (SSE) — tokens are streamed from the LLM to the browser in real time, with chat history persisted after each turn.

---

## 8. Testing Strategy

| Layer | What it covers | How |
|-------|----------------|-----|
| Contract tests | Mock fixtures produce correctly-shaped output; arXiv returns real papers | Vitest — runs offline except for intentional arXiv call |
| Type safety | All TypeScript compiles with strict mode | tsc --noEmit |
| Mock mode | Full workflow demonstrable without API key | Deterministic fixtures per stage |
| Validation | All API inputs validated against Zod schemas | Runtime checks at route entry |

The contract tests are the proof signal for the demo — they assert that every stage output shape is correct and that arXiv returns real (non-hallucinated) papers.

---

## 9. Development and Deployment

Setup: npm install, npx prisma db push, cp .env.example .env
Development: npm run dev (localhost:3000)
Quality: npm run typecheck, npm run test:contract, npm run build

**Environment variables:**
- LLM_PROVIDER=mock — use deterministic fixtures (default when no key is set)
- LLM_BASE_URL, LLM_API_KEY, LLM_MODEL — configure a real LLM provider
- TEST_UNLOCK_STAGES=1 — bypass gating in test/E2E mode

---

## 10. Team and Contributions

| Role | Contribution |
|------|--------------|
| Product and Architecture | Stage-gated workflow design, agent prompt engineering, system architecture |
| Full-Stack Development | Next.js app, API routes, Prisma schema, agent harness, LLM provider layer |
| AI and Agent Engineering | System prompts for all 7 stages, context building, mock fixture design |
| Testing and Quality | Contract tests, type safety, mock mode for deterministic demos |
| Documentation | README, technical specs, this overview |

Built as a hackathon project to demonstrate a stage-gated AI research workflow that runs entirely locally with no external dependencies in mock mode.
