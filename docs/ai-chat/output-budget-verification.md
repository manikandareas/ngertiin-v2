# Chat output budget — 2026-09-14

The reported deep-learning follow-up stopped at exactly 2,048 output tokens with `OUTPUT_LIMIT` after 18 seconds. This was the configured output ceiling, rather than a run timeout.

- Default and local output budget: 8,192 tokens per run, shared by agent and visual-review calls. Each provider call receives the remaining allowance as `maxTokens`, which the installed Responses adapter maps to `max_output_tokens`.
- Provider timeout: 180 seconds. Total run timeout: 240 seconds. Schema defaults, `.env.example`, production Compose defaults and the ignored local API environment are aligned.
- Main model calls also receive a system instruction with their remaining allowance and a roughly 70% length target for headroom. That instruction is included in prompt-token accounting and preserved on attachment fallback. Short questions should still receive short answers. These instructions reduce truncation risk; they cannot guarantee exact model token planning.
- Visual-review calls retain their separate 400-token cap within the shared run budget.

Verification: API/contracts typechecks, API build, scoped Biome and diff checks passed. A disposable budget check confirmed provider/instruction limits of 8,192 then 8,092 after 100 spent tokens, with the review cap unchanged.

A live full-agent streaming check repeated the deep-learning follow-up “jelaskan secara mendalam”: 2,747 output tokens, 25.2 seconds, one model call, no tool call, and a complete closing summary without `OUTPUT_LIMIT`. The check used the configured provider but did not create a new database conversation or run an authenticated browser flow. The disposable harness was removed. Previously truncated messages are unchanged; these settings apply to new runs.


Cleanup consolidated remaining-token calculation without changing its arithmetic or model instructions. A disposable post-cleanup check verified the 8,192-token initial allowance, a 400-token review reservation, and a 7,692-token next-call allowance after 100 known tokens plus the unknown review reservation. Provider generation was not rerun for this refactor.
