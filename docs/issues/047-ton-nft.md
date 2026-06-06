---
title: TON blockchain cosmetic NFT layer – optional deferred feature
labels: backend, blockchain, afk
blocked_by: 033, 039
---

## What to build

Implement optional TON blockchain integration for cosmetic NFTs (TBD-006 – keep as Month 5 option):

- **Backend** (`sb-payment` extension):
  - Add TON wallet connection endpoint: `POST /ton/connect` that returns a tonconnect manifest.
  - Verify NFT ownership via TON blockchain RPC (or wallet signature). For each equipped NFT, check that user still owns it (cache with TTL).
  - Store equipped NFTs in `user_equipped_nfts` (user_id, nft_address, collection).
- **Frontend** (Agent 2):
  - TON wallet connection button (using TonConnect UI) in settings.
  - After connecting, fetch owned NFTs from backend and display in inventory.
  - Equip/unequip UI.
  - Table rendering uses NFT skin if equipped (override default and club skin).
- **No gameplay advantage** – purely cosmetic.

## Acceptance criteria

- [ ] User connects TON wallet via Telegram Mini App (wallet modal).
- [ ] Minted NFT (testnet) appears in inventory within 1 minute.
- [ ] Equipped NFT shows unique felt or card back on table.
- [ ] Non‑NFT owners cannot see or equip these cosmetics.

## Blocked by

#033 (shop UI), #039 (customisation system)
