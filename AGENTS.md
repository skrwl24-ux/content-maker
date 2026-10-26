# Codex project instructions — 집값쓱 apartment research

Existing production pipeline: lib/apartment-server.ts calls the data.go.kr MOLIT apartment SALE transaction API, normalizes records and writes to Supabase. The API credential is a server-only environment variable named DATA_GO_KR_SERVICE_KEY.

For Codex read-only official sale research, use:

    node scripts/molit-trades.mjs --region 41111 --month 202610 --name '화서역파크푸르지오' --area 59.78

The Codex execution environment MUST have DATA_GO_KR_SERVICE_KEY configured as a secret environment variable by the operator. Vercel Production secrets are not automatically available to Codex. Never hard-code, commit, display or request API keys, service-role keys, .env files, or URLs containing secrets. If no key or network permission is available, say needs_check; never fabricate data.

Check exact complex identifiers (aptSeq when available, legal dong, lot), exclusive area, contract date, floor, amount (the script outputs 만원) and cancellation fields. Exclude cancelled contracts from valid-price comparisons. Keep MOLIT sales separate from rentals, live listing asking prices, and entrance-to-entrance walking times. This script does not retrieve those other datasets.

The app/apartment-workplace/page.tsx workplace comparison studio currently generates research prompts: its checkboxes are user attestations, not server-confirmed validation. Never claim API verification from a checkbox alone.

Run node --test tests/molit-trades.test.mjs before modifying this CLI, and run relevant existing apartment tests before shipping. Do not deploy, rotate keys or modify production databases without explicit authorization. See docs/codex-molit-api.md.
