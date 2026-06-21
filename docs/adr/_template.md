<!-- ADR-TEMPLATE-SCAFFOLD: header

HOW TO USE THIS FILE
====================
These `<!-- ADR-TEMPLATE-SCAFFOLD: ... -->` blocks are author guidance. They
must be deleted when this template is copied into a real ADR. A finished ADR
reads as prose, not as a commented skeleton.

The sentinel string `ADR-TEMPLATE-SCAFFOLD` is enforced by `adr-lint.py` rule
R6: any ADR file other than `_template.md` that contains the sentinel fails
lint. Delete every scaffold block before committing a real ADR. The literal
phrase `ADR-TEMPLATE-SCAFFOLD` appearing in lint code or in prose discussing
this rule does not trigger R6, because lint scans ADR files only.

For a finished ADR in this voice with all scaffold removed, see
`adr-example.md` in the same directory. Treat that file as the prose model;
treat this file as the structural checklist while drafting.
-->

<!-- ADR-TEMPLATE-SCAFFOLD: rationale

WHY THIS SHAPE
==============
Imagine a teammate one year from now reading this ADR to verify that the
system still upholds the decision. Test names have drifted, the original
author has left, the code path has been refactored twice. They need to know
which invariants this ADR locked in, and they need to recognize each one
independently.

This template solves that by composing the body from Flags. A Flag is a
discrete end-state declaration — one piece of system state that must hold for
this ADR to be considered delivered. Flags form a DAG. Edges are real data
dependencies (Flag B reads Flag A's output), not procedural guesses ("Wave 1
then Wave 2 because that's the order I planned").

The shape draws on cross-genre research into how mature "explain situation +
solve problem" documents organize themselves. ICPC problem statements, US
military OPORD/SMEAC orders, IETF RFCs, grant proposals, engineering rubrics,
TLA+ specifications, and Specification by Example all converge on four field
roles: setting, target, verification, reference. Classic ADR templates carry
setting and target but lack a dedicated verification slot. Flags add that slot,
one per invariant. See
`~/.claude/skills/skill-curator/references/adr-cross-genre.md` for the full
comparison.
-->

<!-- ADR-TEMPLATE-SCAFFOLD: writing-rules

WRITING RULES (read before drafting)
====================================
LABEL: 期望值估算 (paper argument). These rules come from Williams
(character-action), Pinker (curse of knowledge, classic style), and Horn
(information mapping / chunking), plus cross-genre analogy. They are not
verified by measured outcomes in this repository. Treat them as defaults to
follow until a real ADR demonstrates a case where the rule should be relaxed.

1. ONE IDEA PER SENTENCE. If a sentence needs a comma or semicolon to join
   two independent claims, split it.

2. CHARACTER + ACTION IN THE FIRST 7 WORDS. The subject is a concrete thing
   (a customer, a request, an HTTP response, `/v1/charges`). The verb is a
   concrete action (return, read, write, fail, drop). Avoid abstractions
   like "is responsible for", "constitutes", "represents the authority of".

3. POINT AT A CONCRETE SCENE BEFORE STATING THE INVARIANT. A customer
   presses "Pay $50" and the request reaches the server with an idempotency
   key. The server processes it and returns 201 Created. The customer's
   network drops and the SDK retries.

   Now state what the system must guarantee about that scene — for example,
   that the second request returns the original 201 response, not a new
   charge. Abstract-first writing assumes the reader already shares your
   mental model; classic style points at things the reader can see.

4. NO PARAGRAPH OVER 5 SENTENCES. A longer paragraph is two paragraphs glued
   together. Start a new paragraph with a clear topic sentence.

5. DEFINE PROJECT JARGON ON FIRST USE IN-PLACE. If a term takes more than a
   parenthetical phrase to define, the Flag is too dense — split it.

6. PREFER POSITIVE STATEMENTS WHEN THE INVARIANT FITS THAT FORM. Write what
   the system must do when a positive sentence is the natural expression.
   Safety properties — what the system must never do (no double charge, no
   fallback past a capacity boundary, no silent skip on missing pricing) —
   are inherently negation-shaped and should stay that way. The litmus test:
   if you rewrite the negative invariant positively, is the result still
   recognizably the same property? If yes, use positive. If no, the negation
   carries safety semantics that a positive rephrase would dilute.

7. COMMANDS ARE CITATIONS, NOT THE INTENT. A test name will be renamed. A
   doctor check will move. State the invariant in plain language first, then
   cite the current implementation as evidence. The prose must survive
   command rot.
-->

<!-- ADR-TEMPLATE-SCAFFOLD: anti-patterns

ANTI-PATTERNS (skill-curator will flag these)
=============================================
- Wave / Phase decomposition in the Implementation Plan. Use Flags instead.
- Verification field expressed only as `go test ./xyz/...` with no prose
  describing what the test asserts.
- Copying a global rule like "Pricing must not silent-skip" into a Flag,
  instead of citing AGENTS.md.
- Abstract nominalizations as main verbs: 解耦, 承担, 构成, "is responsible
  for", "constitutes the authority of".
- A single Flag whose Expectation runs five claims joined by commas.
-->

<!-- ADR-TEMPLATE-SCAFFOLD: scope

CHOOSING WHAT TO INCLUDE
========================
This template is a menu, not a checklist. A small reversible decision needs
Context + Flags + References — nothing more. Skip Problem Classification,
Considered Alternatives, and Preflight unless they change the reader's
judgment.

Use the heavier sections only when the decision touches money, security,
external contracts, data authority, or long-lived structure. Citation density
does not substitute for risk assessment.
-->

---
id: ADR-NNN
title: Title
status: Proposed  # Proposed | Accepted | In Progress | Implemented | Superseded
date: YYYY-MM-DD
author: Author name
supersedes: []         # Old ADR numbers this one replaces, e.g. [12, 18]
superseded_by: null    # New ADR number that replaces this one
prds: []               # Upstream PRD slug(s); corresponds to docs/prd/<slug>.md. Empty when no PRD corpus or this is a tooling/governance ADR
summary: One-line summary for ACTIVE.md
---

# ADR-NNN: Title

> **Status**: see frontmatter.status (single source of truth). History of
> status changes lives in `## Implementation Log` and `git log`.

## Context

<!-- ADR-TEMPLATE-SCAFFOLD: context

Write as narrative prose, not a bullet list.

What problem prompts this ADR? What is the current system state? What changed
to make this decision necessary now? Three to six sentences is enough. Cite a
specific code path or user report if it triggered the work — concrete anchors
help future readers reconstruct the moment.

Do not restate the decision here. The decision lives in the Flags below.
Context explains the world that made the decision necessary.
-->

## Flags

<!-- ADR-TEMPLATE-SCAFFOLD: flags-overview

Each Flag is one end-state the system must hold for this ADR to be considered
delivered. Aim for 3–6 Flags. If you have ≥8, the ADR is probably trying to
be two ADRs.

Sub-headers (### Flag 1, ### Flag 2, ...) carry a short declarative title that
states the end-state in one line. The title is durable — it should still
describe the right thing after a refactor.

Each Flag has three required fields (期望 / 验证 / 参考) and one optional
field (说明). Fields are prose paragraphs, not bullet snippets.

Group Flags with capital letters (### A. Read-path Flags / ### B. Failure
paths) only when the ADR carries ≥5 Flags spanning multiple concerns. Flat
beats grouped for small ADRs.
-->

### Flag 1: One-line end-state declaration

**Expectation.**

<!-- ADR-TEMPLATE-SCAFFOLD: expectation

Write 2–5 sentences in prose. Lead with a concrete scenario the reader can
visualize. Then state the invariant. Then state one consequence that explains
why the invariant matters.

EXAMPLE (do not copy verbatim — synthetic payment idempotency case):

A customer presses "Pay $50" and the request reaches the server with
`Idempotency-Key: 7f2a-...`. The server records the response and returns
`201 Created`. The customer's network drops, the SDK retries the exact same
request. The server does not create a second charge — it looks up the stored
response for `7f2a-...` and returns it byte-for-byte.

This is the user-facing meaning of idempotency. Two visible attempts collapse
into one invisible one.
-->

**Verification.**

<!-- ADR-TEMPLATE-SCAFFOLD: verification

Describe IN PROSE which behavior is asserted and what kind of check guards
it. Cite the current test/probe/script as the implementation pointer, but the
prose must stand alone if every name in this section is later renamed.

EXAMPLE shape:

The contract is asserted at two layers. The handler layer ensures that when
the same key arrives twice, the second call short-circuits before any
database write — currently asserted by `TestIdempotencyReplayReturnsCachedResponse`
in `internal/handlers/payments`. The integration layer drives a real HTTP
client against a real database and confirms two consecutive `POST /v1/charges`
calls with the same key produce exactly one row — currently driven by the
doctor probe `payments-idempotency-replay`.

Test names may drift; the invariant does not.
-->

**Reference.**

<!-- ADR-TEMPLATE-SCAFFOLD: reference

Pure pointers, one per line. Each line is a path or link with a 4-10 word
suffix describing the role of the reference. Do not write long explanatory
prose here.

Categorize implicitly by what appears:
  - PRD / spec lines anchor WHAT the invariant declares
  - Project reference files (docs/reference/<oss>) anchor cross-implementation
    expectations
  - Related ADRs anchor adjacent decisions
  - External authority (provider docs, RFC) anchors immutable contracts
-->

- [path/to/spec.md](path/to/spec.md) §relevant-section — what role this plays
- [ADR-XXX](./XXX-title.md) — adjacent decision

**Notes.**  <!-- ADR-TEMPLATE-SCAFFOLD: notes — OPTIONAL. Use only if the Expectation
alone leaves a real ambiguity (historical reason, scope edge, deliberate
exclusion). If you cannot write a one-sentence reason for the Notes block
to exist, delete it. Notes must not carry future plans, open questions, or
risk lists — those have their own homes. -->

### Flag 2: ...

<!-- ADR-TEMPLATE-SCAFFOLD: flag-2 — same structure as Flag 1. -->

## Problem Classification

<!-- ADR-TEMPLATE-SCAFFOLD: problem-classification

OPTIONAL. Include only when the decision is conceptually novel and a reader
would benefit from seeing the data-shape question explicitly. Skip for small
or routine decisions.

@see skill `problem-framing` and `data-centered-design` for the question set.
-->

## Considered Alternatives

<!-- ADR-TEMPLATE-SCAFFOLD: alternatives

OPTIONAL. Include when the chosen path could reasonably have gone another way
and the reader will ask "why not X?". Two-line entries — do not write essays
about rejected paths.
-->

| Option | Why rejected |
|---|---|
| Do nothing | One-line reason |
| Alternative A | One-line reason |

## Preflight

<!-- ADR-TEMPLATE-SCAFFOLD: preflight

REQUIRED when this ADR introduces new enforcement, boundary check, silent
skip, early return, cap, quota, fallback, retry, or any protective/control
mechanism in an existing system. Skip for brand-new code with no prior
upstream concept, single-line fixes, or test-only changes.

@see skill `preflight`. Every field must carry evidence a reviewer can re-grep.
-->

### 1. Triggering symptom (one sentence)

### 2. Core concept being enforced

### 3. Authority points — current owners (must grep, give `file:line`)

- `<concept>`: `path/to/file.ext:LINE` — `<function name>` — one-line job

### 4. Call chain to the proposed change locus (≥3 hops, each hop read)

`<entry caller>` → `<middle hop>` → `<where I plan to edit>`

### 5. Proposed change locus and relation to authority

- `file:line` of planned edit:
- Relation to authority point in §3: ☐ upstream  ☐ same layer  ☐ downstream

### 6. Root-cause hypothesis with falsification attempt

- Hypothesis:
- I tried to falsify it by:
- If hypothesis were wrong, I would observe:

## Implementation Log

<!-- ADR-TEMPLATE-SCAFFOLD: implementation-log

Reverse chronological. Newest entry first.

This log carries two kinds of entries, distinguished by entry title:

  (a) Execution — a Flag became green, a PR merged, a probe came online.
      Title: `### YYYY-MM-DD <short description>`.
  (b) Amendment — a Flag was added, removed, or had its Expectation
      tightened. Title: `### YYYY-MM-DD Amendment: <short reason>`.

A separate "Change Log" section would create a parallel source of truth.
Keep both kinds merged here, distinguished by entry titles.
-->

### YYYY-MM-DD Initial Proposal

**Executor**: ...

**Scope**:
- Flags declared:
- Flags deferred (with trigger):

**Evidence**:
```bash
# verification commands run for this entry
```

## References

- Related ADRs: [ADR-XXX](./XXX-title.md)
- Upstream PRD: [docs/prd/<slug>.md](../prd/<slug>.md)
- Related code: `path/to/code`
- External: ...
