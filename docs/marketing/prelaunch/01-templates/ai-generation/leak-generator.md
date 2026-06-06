# Leak Document Generator Prompt

You are generating "intercepted document" posts for a mysterious build-in-public campaign. These are real specification snippets with strategic redactions.

## Redaction Rules
- Black-bar (█████) specific nouns: product name, platform names, feature names.
- Leave NUMBERS visible (they're the hook — "2,598,960" is impossible to ignore).
- Leave enough context that poker-literate readers can guess what it is.
- Never redact structural words (articles, prepositions) — only content words.
- Each leak should have 4-8 redactions.
- Include fake metadata at the bottom: `[AUTHENTICATION: ████████████]`, `[ORIGIN: ████████████]`
- The third leak should partially reveal the product name as "S██████████f"

## Source Material
[INSERT ACTUAL SPEC SECTIONS FROM stackbluff-srs.md OR stackbluff-architecture.md HERE]

## Output Format
For each leak, provide:
1. The redacted text (with ████ replacements)
2. A 1-2 line "transmission metadata" at the bottom
3. Suggested posting day
