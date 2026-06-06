---
title: TON blockchain cosmetic NFT layer – optional deferred feature
labels: backend, blockchain, afk
blocked_by: 033, 039
---

## What to build

Implement optional TON blockchain integration for cosmetic NFTs (TBD-006 – keep as Month 5 option):

- Users can mint / buy limited‑edition table skins, card backs, or avatar frames as TON NFTs.
- Backend verifies NFT ownership via TON blockchain RPC (or wallet signature).
- If user owns an NFT, they can equip it in the shop.
- Equipped NFT reflects in game (same as Club Pro customisation but with blockchain provenance).
- No gameplay advantage – purely cosmetic.
- Requires TON wallet connection (Telegram native wallet support via TON Connect 2.0).

## Acceptance criteria

- [ ] User connects TON wallet via Telegram Mini App.
- [ ] Minted NFT appears in inventory within 1 minute.
- [ ] Equipped NFT shows unique felt or card back.
- [ ] Non‑NFT owners cannot access these cosmetics.

## Blocked by

#033 (shop UI), #039 (customisation system)
