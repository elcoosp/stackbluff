## TON blockchain cosmetic NFT layer – optional deferred feature

**Title:** TON blockchain cosmetic NFT layer – optional deferred feature  
**Labels:** `backend, blockchain, afk`  
**Blocked by:** #033 (shop UI), #039 (customisation system)

---

### 📌 Summary

Implement an **optional TON blockchain integration** for cosmetic NFTs (TBD-006). This is a Month 5 feature (deferred, but we need to spec it now). Users can connect their TON wallets (via TonConnect) and equip NFTs that they own on the TON blockchain. Equipped NFTs override the default table skin (and club‑pro skin) with a custom design (felt, card backs, or avatar border). No gameplay advantage – purely cosmetic.

The integration is lightweight: we only verify ownership via TON RPC (or wallet signature) and cache results. The frontend uses the standard TonConnect UI for wallet connection.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Payment service (extension) | `backend/crates/sb-payment/src/service.rs` – add TON verification logic. |
| User entity | `backend/crates/sb-db-entities/src/user.rs` – add `ton_wallet_address` (nullable). |
| NFT storage | New table `user_equipped_nfts` (user_id, nft_address, collection, equipped_at). |
| Customisation system | `backend/crates/sb-club/src/service.rs` – NFT skin override logic. |
| Frontend settings | `frontend/apps/pwa/src/pages/SettingsPage.tsx` – add TON wallet connection. |
| Frontend inventory | New component: `frontend/apps/pwa/src/components/NFTInventory.tsx`. |
| Table rendering | `frontend/apps/pwa/src/components/game/TableFelt.tsx`, `Card.tsx` – apply NFT skin if equipped. |

---

### 🔧 What to build

#### 1. Database changes

- Add `ton_wallet_address` (TEXT, nullable) to `users` table.
- Create `user_equipped_nfts`:
  ```sql
  CREATE TABLE user_equipped_nfts (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nft_address TEXT NOT NULL,   -- contract address + token ID (e.g., "EQ...")
      collection TEXT NOT NULL,    -- collection name or address
      equipped_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, nft_address)
  );
  ```

#### 2. Backend – TON wallet connection

- Add endpoint: `POST /ton/connect` – returns a TonConnect manifest (URL, name, icon, etc.) for the wallet to display.
- After the user connects via TonConnect, the frontend sends the wallet address and a signed message (or just the address) to the backend. The backend verifies the signature (or uses the address directly) and stores `ton_wallet_address` for the user.

#### 3. Backend – NFT ownership verification

- Add endpoint: `GET /nft/inventory` – returns a list of NFTs owned by the user (fetched from TON RPC, cached with TTL, e.g., 1 hour).
- Verification:
  - Use TON RPC (e.g., `get_nft_items` via a TON API provider like Toncenter or a local node) to fetch NFTs owned by the wallet address.
  - Cache the list in memory (or Redis) with a TTL to avoid excessive RPC calls.
- Store only the `nft_address` and `collection` for each NFT.

#### 4. Backend – equip/unequip NFT

- Add endpoints:
  - `POST /nft/equip` – request body: `{ nft_address: string }`. Verifies ownership (via cache or RPC) and inserts into `user_equipped_nfts`.
  - `DELETE /nft/equip/{nft_address}` – removes the NFT from the equipped list.
- Only one NFT can be equipped at a time (or multiple? For simplicity, start with one). If a new one is equipped, the previous one is unequipped automatically.

#### 5. Backend – skin override logic

- When a table is rendered (or when the user joins a table), the backend (or frontend via API) determines the active skin:
  1. Default skin
  2. Club Pro skin (if club and owner has Pro)
  3. Founder Club skin (if club is founder club)
  4. **Equipped NFT skin** (if user has an equipped NFT)
- The equipped NFT skin **overrides** all other skins for that user.
- Store the skin selection in the `game_state` or in the user’s session so the frontend can apply it.

#### 6. Frontend – TON wallet connection

- In the user settings page, add a “Connect TON Wallet” button.
- Use the **TonConnect UI** library (`@tonconnect/ui-react`) to handle the connection flow (modal, wallet selection, etc.).
- After successful connection, store the wallet address in the backend (call `POST /ton/connect` with the address).
- Show the connected wallet address and a “Disconnect” button.

#### 7. Frontend – NFT inventory

- Add a new section in the profile/settings page: **“My NFTs”**.
- Fetch the user’s NFT inventory via `GET /nft/inventory` and display them as a grid of cards.
- Each NFT card shows a preview (if we have an image URL from the collection) and an “Equip”/“Unequip” button (depending on current state).
- The equipped NFT is highlighted.

#### 8. Frontend – table skin application

- When rendering a table, check if the user has an equipped NFT.
- If yes, apply the NFT’s visual theme:
  - **Felt colour**: defined per NFT (or derived from the NFT metadata). For MVP, we can map NFT collections to a fixed set of skins (e.g., "Cyberpunk felt", "Gold card backs").
  - **Card backs**: use a custom card back image/colour.
  - **Avatar border**: optional.
- The skin should be applied consistently across all tables the user joins (until unequipped).

---

### ✅ Acceptance Criteria

- [ ] **Backend:**
  - [ ] `POST /ton/connect` stores the user’s TON wallet address.
  - [ ] `GET /nft/inventory` returns the list of NFTs owned by the user (cached, with TTL).
  - [ ] `POST /nft/equip` verifies ownership and equips the NFT; only one NFT can be equipped at a time.
  - [ ] `DELETE /nft/equip/{nft_address}` unequips the NFT.
  - [ ] The skin override logic correctly applies the equipped NFT skin over club/Pro/founder skins.

- [ ] **Frontend:**
  - [ ] The “Connect TON Wallet” button in settings opens the TonConnect modal; after connection, the wallet address is stored.
  - [ ] The NFT inventory grid loads and displays owned NFTs with equip/unequip controls.
  - [ ] Equipping an NFT updates the user’s skin preference in the backend.
  - [ ] On the table view, the equipped NFT skin is applied (felt colour, card backs) and overrides other skins.
  - [ ] The UI gracefully handles the case where the user has no NFTs or the wallet is disconnected.

- [ ] **General:**
  - [ ] NFT skins are purely cosmetic and provide no gameplay advantage.
  - [ ] The system works on testnet (TON testnet) for development; mainnet support can be added later.
  - [ ] The frontend does not block if the NFT service is slow or unavailable (fallback to default skin).

---

### 🔗 Blocked By

- **#033** – Shop UI (wallet connection is typically placed in settings, which builds on the shop UI).
- **#039** – Customisation system (the skin override logic needs the existing club/Pro skin system to be in place).

---

### 🧪 Testing Notes

- **Unit tests** for ownership verification and caching.
- **Integration tests** using a mock TON RPC (or a real testnet wallet) to verify the full flow.
- **E2E tests** (Playwright) for wallet connection and NFT equipping (requires a test wallet with NFTs).
- **Manual tests** with a TON testnet wallet that owns a test NFT.

---

### 📝 Implementation Hints

- **TON RPC**: Use `@ton/ton` (Node.js) or the Rust `ton-lib` to interact with the TON blockchain. For simplicity in Rust, use a REST API like Toncenter (`https://toncenter.com/api/v2/`).
- **Caching**: Use `moka` cache (already available) to store NFT lists per wallet address with a TTL of 1 hour.
- **TonConnect**: The frontend can use the `@tonconnect/ui-react` package. In the Mini App, the wallet modal will be a popup; in PWA, it’s a redirect.
- **Skin mapping**: Define a mapping from NFT collection address (or a pattern) to skin configurations (CSS variables). This can be hardcoded initially and later moved to a backend config.
- **Equip state**: The frontend should fetch the equipped NFT on page load (via `GET /user/me` or a dedicated endpoint) and apply it to the table.
