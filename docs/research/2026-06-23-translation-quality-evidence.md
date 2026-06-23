---
target: translation-quality
date: 2026-06-23
author: "研究员 + agent"
status: active
summary: "Evidence backing the three translation-quality changes shipped on 2026-06-23: transcreation persona, reply-to context, low temperature."
---

# Translation Quality — Evidence Packet

Decision this informs: how to improve `TranslationService` output quality for the
i18n_me userbot (casual, spoken-style chat; ZH↔ multi; single short utterances;
edit-in-place). Model is fixed to `deepseek-v4-flash` per maintainer — no
model-swap lever.

Method note: self-built eval had noise > signal (temp=1.0 made the same input
score ±30 on an LLM judge), so the decision rests on peer-reviewed + production
evidence, not on that eval. See memory `translation-eval-noise`.

## Changes shipped

1. **Transcreation persona** — system prompt: "you ARE the speaker, not a
   translator; rewrite if it sounds translated" (`translation.service.ts:buildSystemPrompt`).
2. **Conversation context** — `tl` feeds the recent ~7 messages plus the
   highlighted reply-to message as disambiguation context
   (`index.ts:buildConversationContext`). Unified model: reply-to is the
   highlighted member of the recent window, not a separate path. Window kept
   small (7) to limit the risk a non-chat-finetuned model uses context poorly.
3. **Temperature 1.0 → 0.3** — faithful, lower-variance rendering.

## Evidence table

| Source | Type | Claim supported | Strength | Decision impact |
|--------|------|-----------------|----------|-----------------|
| Li et al., **Lost in Literalism: How Supervised Training Shapes Translationese in LLMs**, ACL 2025 (`2025.acl-long.630`) | Peer-reviewed + human eval | LLMs over-produce translationese (overly literal, unnatural); reducing literalism raises naturalness | Strong | Core justification for transcreation persona + "rewrite if it sounds translated" |
| Silva et al. (Unbabel), **Cultural Transcreation with LLMs as a new product**, EAMT 2024 (`2024.eamt-2.29`); **Cultural Transcreation in Asian Languages with Prompt-Based LLMs**, MT Summit 2025 (`2025.mtsummit-2.5`) | Production pilot (industry T1) | Prompt-based transcreation beats hyper-literal MT for high-context languages (ZH/JA/KO) in real customer-support deployment | Strong (our exact languages) | Validates transcreation for casual ZH/JA chat; "dynamic equivalence" (Nida) over word-for-word |
| Pombal/Agrawal/Martins, **Improving Context Usage for Translating Bilingual Customer Support Chat (TowerChat)**, WMT24 (`2024.wmt-1.100`) | WMT shared task, human eval winner | Conversational context resolves pronouns/register/consistency; +4 CHRF en-xx | Strong | Justifies reply-to context injection |
| Sung et al., **Context-Aware LLM Translation via Conversation Summarization & Dialogue History**, WMT24 (`2024.wmt-1.102`) | WMT shared task | Recent dialogue turns + summary significantly improve chat translation | Strong | Confirms "minimal relevant context" approach (we use reply-to as the minimal unit) |
| Agrawal et al., **Assessing the Role of Context in Chat Translation Evaluation (Context-MQM)**, TACL 2024 | Peer-reviewed | Context helps most on *imperfect* translations; improves error detection | Medium-strong | Context targets exactly the ambiguous cases |
| Peng et al., **Towards Making the Most of ChatGPT for MT**, arxiv `2303.13780` | Empirical, multi-lang | Lower temperature → higher COMET/BLEU; T 0→1 costs −4.3 COMET for **Chinese**; low temp reduces hallucinations | Strong (our source lang) | Justifies lowering temperature from 1.0 |
| **Exploring the Impact of Temperature on LLMs: Hot or Cold?**, arxiv `2506.07295` | Empirical, FLORES-101 | MT optimal temp ≈ 0+ε; higher temp most detrimental to MT; large models more resilient | Strong | Supports low temp; flags 0.3 may be slightly warm |
| Vilar et al., **Prompting PaLM for Translation**, ACL 2023 (`2023.acl-long.859`); **Decoding Methods in the Era of LLMs**, EMNLP 2024 (`2024.emnlp-main.489`) | Peer-reviewed | Non-zero sampling temp degrades MT; closed-ended tasks favor low temp (0.1–0.2)/deterministic | Strong | Corroborates faithfulness-favors-low-temp |

## Contradictions / strongest opposition (preserved, not dismissed)

- **Freedom can increase unfaithfulness.** Yao et al., *Benchmarking LLM-based MT
  on Cultural Awareness* (arxiv `2305.14328`): substitution/description beat
  literal for understandability of culture-specific items, BUT "increased
  diversity comes at the cost of reduced stability... more inaccurate
  translations." → Mitigation already in the prompt: explicit "do not add or drop
  meaning" guardrail + low temperature. Transcreation is bounded, not free
  rewriting.
- **Temperature evidence arguably favors even lower than 0.3.** Peng et al. /
  PaLM adopt T≈0. We keep 0.3 as a deliberate middle: casual chat wants a little
  natural variety, and faithfulness is guarded by the prompt. If faithfulness
  regressions appear in real use, drop toward 0.1.
- **Local fit caveat from TowerChat itself:** an LLM *not* fine-tuned for chat
  "struggles to leverage context... often worse than without context." We use a
  general API model, so we inject only the **minimal** relevant context
  (reply-to), not a large window — limiting the risk surface.

## Not adopted (with reason)

- **Reflect→refine / multi-agent (DUAL-REFLECT `2406.07232`, TASTE
  `2024.acl-long.333`):** real gains but latency doubles; the active interaction
  model (`docs/greenfield/2026-06-22-interaction-model.md` §1) explicitly rejects
  multi-step reflection for one-line chat utterances.
- **Model swap:** maintainer fixed `deepseek-v4-flash`.

(Adopted after initial scoping: the N-message history window — N=7 — once the
active interaction model was updated, §1a. aimoda uses 10; we use 7.)

@see https://github.com/aimoda/telegram-auto-translate — same-class production userbot whose transcreation + context design this borrows from
