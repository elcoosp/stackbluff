# StackBluff Cosmetic Deck System: Monetization & Viral Growth Blueprint

---

## 0. The Core Insight — Why Decks Are Your Best Viral Product

In poker, **card backs are the only cosmetic every player sees on every other player, every single hand.** Unlike Fortnite skins (visible only to nearby enemies) or Among Us hats (small, low-detail), a card back occupies prime visual real estate for the entire duration of a session. This creates a **Table Billboard Effect** — every premium deck skin at a table is a live advertisement for the cosmetic shop, visible to 2–8 other players, for 15–90 minutes per session.

Combined with the **Replay Card** mechanic (already in your spec), every dramatic hand becomes a **cosmetic advertisement shared off-platform.** A Royal Flush screenshot with the "Haunted Court" deck skin generates more desire for that skin than any paid ad could.

**The flywheel:**

```
See deck at table → Want deck → Buy/earn deck → Show deck at table → Others see it → Share replay card featuring deck → Off-platform viewers see deck → Download app → See more decks → …
```

---

## 1. Cosmetic Item Taxonomy — What You're Selling

### Tier 1: High Visibility (Core Revenue Drivers)

| Item | Visibility | Production Cost | Viral Potential | Price Range |
|------|-----------|----------------|-----------------|-------------|
| **Card Back** | Seen by ALL players EVERY hand | Low (1 design) | ★★★★★ | 1.99–9.99€ |
| **Card Face Skin** (full 52-card set) | Revealed at showdown + in replay cards | Medium (20 unique art pieces) | ★★★★☆ | 4.99–12.99€ |
| **Win Animation** | Plays when you win a pot | Low-Medium (3-5 sec animation) | ★★★★☆ | 2.99–7.99€ |
| **Replay Card Theme** | Every shared replay card off-platform | Low (1 template) | ★★★★★ | 1.99–4.99€ |

### Tier 2: Social Flex (Status Signals)

| Item | Visibility | Production Cost | Viral Potential | Price Range |
|------|-----------|----------------|-----------------|-------------|
| **Table Felt** | All players at your table | Low (1 texture) | ★★★☆☆ | 1.99–3.99€ |
| **Chip Skin** | Your chip stack, visible always | Low (1 design) | ★★★☆☆ | 1.99–3.99€ |
| **Avatar Frame** | Profile, leaderboard, club | Low (1 frame) | ★★★☆☆ | 0.99–2.99€ |
| **Deal Animation** | Cards fly to you | Low-Medium | ★★☆☆☆ | 1.99–4.99€ |

### Tier 3: Bundles (Revenue Maximizers)

| Bundle | Contents | Price | Discount vs Individual |
|--------|---------|-------|----------------------|
| **Deck Drop Bundle** | Card back + card face + chip skin | 9.99–14.99€ | ~30% off |
| **Season Pass** | Full themed bundle + table felt + replay theme + exclusive animation | 5.99€/season | ~60% off |
| **Club Pack** | Card back + table felt + chip skin (club-branded) | 14.99€ (Club Pro) | Included in subscription |
| **Legend Pack** | Everything from the season + "Legend" animated card back | Earned (top rank) | Cannot buy |

---

## 2. AI Production Pipeline — From Concept to Store in 48 Hours

### 2.1 The "Design System" Approach (Critical for Cohesion)

**Do NOT generate 52 random images.** A deck must read as a unified design. Use this structure:

```
Every card = TEMPLATE LAYER (crisp pips, numbers, suits) + ART LAYER (AI-generated)
```

- **The pips (♠♥♦♣) and numbers are NEVER AI-generated.** They use a fixed vector font for instant readability at game resolution. This is non-negotiable — players must distinguish a 7 from a 1 at a glance.
- **The art lives in defined zones:** center illustration area, border/frame, card back full surface.
- **This means you only need ~20 unique AI art pieces per deck:**
  - 1 card back (most important)
  - 4 Ace illustrations (one per suit — prestige cards)
  - 12 face card illustrations (J/Q/K × 4 suits — hero cards)
  - 1 number card pattern/template (reused for 2–10 with suit color variations)
  - 2 Joker illustrations
  - = **20 pieces total**

### 2.2 Tool Stack

| Stage | Tool | Purpose |
|-------|------|---------|
| Concept | Figma/Pinterest mood board | Visual direction |
| Generation | **Flux Pro 1.1** or **Midjourney v7** | High-quality, style-consistent art |
| Consistency | **IP-Adapter + ControlNet** | Same face card composition across suits |
| Refinement | **Photoshop** or **Photopea** (free) | Inpainting, pip placement, border cleanup |
| Layout | **Custom Node.js script** | Batch-composite art onto card template |
| Export | **TexturePacker** or custom script | Sprite sheet generation |
| Animation | **Rive** or **Lottie** | Animated card backs and win animations |
| QA | **Custom visual diff script** | Detect readability issues, color clashes |

### 2.3 Step-by-Step Pipeline

**Day 1: Concept + Generation (8 hours)**

```
Hour 1-2: CONCEPT BRIEF
├── Write theme document: name, story, color palette (3-5 colors), art style keyword
├── Gather 10-15 reference images (Pinterest, ArtStation, existing card games)
├── Define the "hero moment" — what one card will be the marketing hero?
└── Example: "NEON RONIN — Cyberpunk samurai aesthetic. Neon purple/cyan palette. 
    Hero card: Ace of Spades as a glowing katana. Art style: ink wash meets neon glow."

Hour 3-4: PROMPT ENGINEERING
├── Create MASTER PROMPT defining the visual language:
│   "A playing card illustration in [style], [color palette], [mood], 
│    clean border area, centered composition on dark background, 
│    digital art, high detail, playing card design"
├── Create SUIT-SPECIFIC variations (spades=dark/striking, hearts=warm/elegant, 
│   diamonds=bright/luxurious, clubs=organic/mysterious)
├── Generate 5 test images to validate style lock
└── Iterate prompt until 4/5 test images are usable

Hour 5-7: BATCH GENERATION
├── Card Back: Generate 20 variants → select best 1
├── Aces: Generate 10 per suit → select best 1 each (4 total)
├── Face cards: Generate 5 per card → select best 1 each (12 total)
├── Number template: Generate 10 patterns → select best 1
├── Jokers: Generate 10 → select best 2
└── TOTAL: ~150 generations, ~20 final selections

Hour 8: CURATION PASS
├── Review all 20 selected pieces as a group
├── Check visual cohesion — do they look like the SAME deck?
├── Replace any outliers (re-generate specific cards)
└── Flag any cards that need manual refinement
```

**Day 2: Integration + Store + Marketing (8 hours)**

```
Hour 1-2: REFINEMENT
├── Inpaint any AI artifacts (extra fingers on face cards, unreadable areas)
├── Apply consistent border/frame treatment across all cards
├── Dark mode contrast check — all art must read on StackBluff's dark UI
└── Readability check — can you identify rank and suit in <1 second?

Hour 3-4: TECHNICAL INTEGRATION
├── Composite art onto card template (pips, numbers, suit symbols)
├── Export game-resolution assets (200×300px game, 800×1200px marketing)
├── Generate sprite sheet for lazy-loaded cosmetics chunk
├── Upload to Cloudflare R2 CDN
├── Create database entry in cosmetic_items table
├── Configure store metadata (price, rarity, availability window)
└── Test in staging: equip deck → sit at table → verify rendering

Hour 5-6: MARKETING ASSETS
├── Generate "hero spread" image (all face cards + aces fanned out)
├── Create 3-5 teaser images (cropped, blurred, partial reveals)
├── Generate animated reveal GIF/video (template-driven, 10 sec)
├── Write Telegram announcement copy (French + English)
├── Create dedicated Replay Card template for this deck
└── Schedule social posts (Telegram channel, Twitter/X)

Hour 7-8: LAUNCH CONFIGURATION
├── Schedule shop appearance (available_from timestamp)
├── Set up "first equip" achievement/badge
├── Configure "win with this deck" mission for the release week
├── Test purchase flow end-to-end (Stars + Stripe)
└── Final QA: full purchase → equip → play → share → verify deck appears in replay card
```

**Total: 16 hours / 2 working days per deck.**

With this pipeline, one person (or one AI agent) can maintain a buffer of 4-6 completed decks ready for scheduled release.

---

## 3. Year-Round Release Calendar — Engineering Viral Spikes

### 3.1 The "Deck Drop" Model

Each Deck Drop is a **2-week event** that creates a predictable viral spike:

```
WEEK 1: HYPE PHASE
├── Day 1-2: "Something is coming" — post 1 blurred teaser image
├── Day 3-4: "Guess the theme" — reveal 20% of card back art, open community guessing
├── Day 5:   "2 days left" — reveal card back silhouette + color palette
├── Day 6:   FULL REVEAL — animated trailer, all cards shown, pre-order opens
└── Day 7:   DECK GOES LIVE — available in shop

WEEK 2: VIRAL PHASE  
├── Day 8-9:  "Show it off" mission — earn 2× chips for winning with the new deck equipped
├── Day 10-11: Creator showcase — streamers/featured players use the deck
├── Day 12:   "Last chance" reminder (if limited edition)
├── Day 13:   24-hour countdown — FOMO intensification
└── Day 14:   Deck leaves shop OR moves to permanent catalog
```

**The key insight:** The teaser phase costs zero ad spend. The community does the marketing by guessing, discussing, and sharing the teasers. This is how streetwear drops work (Supreme, Nike SNKRS) — and it works even better in digital goods because the product is instantly deliverable.

### 3.2 Full Year Calendar (6 Seasons × 8 Weeks)

**Season 1 (Weeks 1–8): "Founding Season"**

| Week | Drop | Type | Viral Hook |
|------|------|------|-----------|
| W1 | **Classic / Midnight / Neon** | 3 free defaults | Baseline variety — no one has an ugly default |
| W2 | **Founder's Deck** | Limited, exclusive to first 1,000 registrants | Creates URGENT FOMO — "you missed it forever" |
| W4 | **First Blood Deck** | Earnable (win 1st tournament) | Achievement flex, not purchasable |
| W7 | **Season 1 Pass Deck: "Arctic Crown"** | Season Pass exclusive | Season pass value proposition |
| W8 | **Legend Deck** | Earned (top 100 rank) | Ultimate status flex |

**Season 2 (Weeks 9–16): "Neon Renaissance"**

| Week | Drop | Type | Viral Hook |
|------|------|------|-----------|
| W9 | **Season 2 Pass Deck: "Cyber Samurai"** | Season Pass | Anime/cyberpunk aesthetic = high share appeal |
| W11 | **Community Choice Deck** | Voted by players | Community ownership = organic advocacy |
| W14 | **Bastille Royale** | Limited (2 weeks) | French national pride — extremely shareable in FR market |
| W16 | **Legend Deck** | Earned | Season 2 prestige |

**Season 3 (Weeks 17–24): "Haunted Court"**

| Week | Drop | Type | Viral Hook |
|------|------|------|-----------|
| W17 | **Season 3 Pass Deck: "Gothic Royale"** | Season Pass | Dark, moody = streaming-friendly aesthetic |
| W20 | **Halloween Limited: "Cursed Deck"** | Limited (2 weeks, Oct only) | Seasonal FOMO — the Halloween social media wave |
| W22 | **Streamer Collab Deck** | Partner collaboration | Streamer's audience becomes our audience |
| W24 | **Legend Deck** | Earned | Season 3 prestige |

**Season 4 (Weeks 25–32): "Golden Empire"**

| Week | Drop | Type | Viral Hook |
|------|------|------|-----------|
| W25 | **Season 4 Pass Deck: "Egyptian Gold"** | Season Pass | Luxury aesthetic = aspiration |
| W28 | **Holiday Special: "Frost Gala"** | Limited (3 weeks, Dec) | Christmas sharing season = massive reach |
| W30 | **Community Choice Deck #2** | Voted | Repeat proven mechanic |
| W32 | **Legend Deck** | Earned | Season 4 prestige |

**Season 5 (Weeks 33–40): "Sakura Garden"**

| Week | Drop | Type | Viral Hook |
|------|------|------|-----------|
| W33 | **Season 5 Pass Deck: "Ink & Petal"** | Season Pass | Japanese aesthetic = globally popular, highly visual |
| W36 | **Meme Deck: "Copium"** | Limited, intentionally meme-y | Designed to go viral on Twitter/Telegram |
| W38 | **Artist Collab Deck** | Partner with a known digital artist | Artist's audience = new user pool |
| W40 | **Legend Deck** | Earned | Season 5 prestige |

**Season 6 (Weeks 41–48): "Shadow Play"**

| Week | Drop | Type | Viral Hook |
|------|------|------|-----------|
| W41 | **Season 6 Pass Deck: "Film Noir"** | Season Pass | Cinematic, sophisticated |
| W44 | **Anniversary Deck** | Limited (1-week only, anniversary) | "1 year only" = maximum FOMO |
| W46 | **Community Choice Deck #3** | Voted | Institutionalized community participation |
| W48 | **Legend Deck** | Earned | Season 6 prestige |

**Total annual deck production: 6 season pass + 6 legend + 6 limited + 3 community + 3 collab + 3 earnable + 3 defaults = ~30 deck releases per year**

At 2 days of production each = ~60 production days = ~2.5 months of work spread across the year. Extremely manageable with AI.

---

## 4. Monetization Architecture — Pricing, Scarcity, FOMO

### 4.1 Rarity & Pricing Tiers

| Rarity | Visual Indicator | Price | Availability | Examples |
|--------|-----------------|-------|-------------|---------|
| **Common** | Gray border | Free / 1,000 chips | Always | Default decks, basic earns |
| **Rare** | Blue glow | 1.99€ | Always in shop | Seasonal variety |
| **Epic** | Purple glow + subtle animation | 4.99€ | Seasonal rotation | Themed decks |
| **Legendary** | Gold glow + full animation | 9.99€ | Limited time only | Holiday specials, collabs |
| **Mythic** | Rainbow shimmer + unique SFX | 14.99€ | One-time drops, <24h window | Anniversary, Founder's |
| **Earned** | Cyan border + trophy icon | Cannot buy | Gameplay achievement only | Legend, First Blood, Founder |

**Critical design rule: Earned decks are the MOST prestigious.** The Legend Deck cannot be bought at any price. This protects the "no pay-to-win" brand promise and creates aspiration that drives engagement (not just spending).

### 4.2 Bundle Economics

| Product | Individual Price | Bundle Price | Perceived Savings | Margin Impact |
|---------|-----------------|-------------|-------------------|--------------|
| Card Back alone | 1.99€ | — | — | High margin (1 art piece) |
| Card Back + Face Skin | 1.99 + 4.99 = 6.98€ | 5.99€ | 14% | Good margin |
| Full Deck Drop Bundle (back + face + chips + felt) | 12.96€ | 9.99€ | 23% | Volume play |
| Season Pass (full bundle + exclusive animation + bonus chips) | ~20€ value | 5.99€ | 70% | Loss leader → retention |

**The Season Pass is deliberately underpriced.** Its job is not deck revenue — it's **conversion pipeline entry.** A player who buys the Season Pass is 4× more likely to buy a limited deck drop than a free player (Fortnite data). The Pass pays for itself in downstream purchases.

### 4.3 The "Never Returning" Mechanic

For 2-3 decks per year, use **permanent scarcity:**

> ⚠️ **"The Founder's Deck will NEVER be available again. Only 1,000 accounts will ever hold it."**

This creates:
- **Immediate urgency** at launch (drives the first 1,000 registrations)
- **Permanent envy** at tables (anyone seeing a Founder's card back knows that player was there from the beginning)
- **Social media posts** forever ("look what I have that you can't get")

**Legal note:** Per BR-003 (no P2P trading), these decks CANNOT be transferred. This prevents a secondary market and keeps them as pure status symbols, not investments. This is legally safer (ANJ) and avoids gambling classification.

### 4.4 Dynamic Pricing Experimentation

Starting Month 3, run A/B tests:

| Test | Hypothesis | Measurement |
|------|-----------|-------------|
| Price anchor: show "was 9.99€" before discount | Anchoring increases perceived value | Conversion rate at 5.99€ |
| Limited-time badge vs no badge | Scarcity framing drives urgency | Purchase velocity in first 48h |
| Bundle default vs item default | Bundles increase ARPPU | Average basket size |
| Chip price vs Euro price | Different user segments respond to different currencies | Conversion by user segment |

---

## 5. Viral Mechanics Engine — How Each Deck Drop Creates Sharing

### 5.1 The Seven Viral Triggers Per Deck Release

**Trigger 1: Table Billboard (Passive, Always-On)**
Every player at a table with someone wearing a new deck sees it. Zero effort. Estimated impressions: if 10% of DAU buy a new deck in its first week, and the average table has 5 players, that's 50,000 passive impressions per day at 10K DAU.

**Trigger 2: "First Equip" Share Card (Active, One-Time)**
When a player equips a new deck for the first time, the system generates a shareable card:
> *"Alice just unlocked the CYBER SAMURAI deck ⚔️🃏"*
> [Deck art showcase] [Play StackBluff CTA with invite link]

This goes to their Telegram story / social feed. **One tap to share.**

**Trigger 3: Replay Card Cosmetic Integration (Active, Ongoing)**
Every Replay Card (already in spec, REQ-FUNC-050) now renders using the winner's deck skin. A Royal Flush replay with the "Gothic Royale" deck is inherently more shareable than one with the default deck. The deck skin IS the visual hook.

**Trigger 4: "Show It Off" Mission (Active, Release Week)**
Release-week exclusive mission: *"Win 3 hands with the [DECK NAME] equipped → earn 5,000 bonus chips."*
This incentivizes purchasers to PLAY with the deck (maximizing table billboard impressions) rather than just buying and forgetting.

**Trigger 5: Teaser Community Engagement (Active, Pre-Release)**
The 7-day teaser phase generates organic discussion:
- Telegram group polls: "What do you think the next deck theme is?"
- Community debates = free reach in group chats
- Players tag friends: "bet you can't guess this one"

**Trigger 6: Vote Ownership (Active, Monthly)**
Community Choice decks create **invested advocates.** If you voted for "Cyber Samurai" and it won, you feel ownership. You share it. You tell friends to get it. The act of voting is a viral moment:
> *"I just voted for the next StackBluff deck! Cast your vote: [link]"*

**Trigger 7: FOMO Countdown (Active, Last 48 Hours)**
For limited decks, the final 48 hours trigger:
- Push notification: *"⏰ 48h left — Cursed Deck disappears Friday"*
- In-game banner with countdown timer
- Telegram group post with "last chance" messaging
- Players who were on the fence convert now
- Purchasers post: *"Just got it before it's gone!"*

### 5.2 Amplification Through Existing Spec Mechanics

Every deck release **supercharges** every viral mechanic already in your spec:

| Existing Mechanic | Without Deck Cosmetics | With Deck Cosmetics |
|---|---|---|
| **Replay Card (REQ-FUNC-050)** | Generic card image — shareable but same every time | Branded with winner's deck art — unique, collectible feel |
| **Season End Card (REQ-FUNC-073)** | Shows rank + stats | Shows rank + stats + full season deck collection showcase |
| **Telegram /poker result (REQ-FUNC-032)** | Text-based result | Result image features winner's card back |
| **Club tournament result (REQ-FUNC-035)** | Text summary | Tournament replay card using club's official deck |
| **Daily Hand Puzzle (REQ-FUNC-054)** | Generic card imagery | Features the currently-promoted deck |
| **Referral link (REQ-FUNC-052)** | Plain invite URL | Invite page showcases the referrer's favorite deck |

### 5.3 The "Deck Flex" Social Loop

```
Player buys new deck
    → Equips it
    → Plays at table (others see it)
    → Wins a big hand
    → Replay Card generated (featuring the deck art)
    → Shares to Telegram/Twitter
    → Friends see the deck in the replay card
    → Friends click invite link
    → Friends join
    → Friends see MORE premium decks at tables
    → Friends want their own deck
    → Friends buy/earn decks
    → They show off at THEIR tables
    → THEIR friends see it...
```

This is the **K-factor amplification engine.** Each deck purchase creates N impressions, each impression creates M desires, each desire creates P purchases. If the cycle works, K > 1.3 is achievable through deck cosmetics alone.

---

## 6. Community-Driven Production — Players As Creators

### 6.1 The "Deck Forge" — Monthly Design Contest

**How it works:**

1. **Week 1: Submission Phase**
   - Players submit a deck theme via a simple form: "Theme name, 3 descriptive words, color palette, reference image URL"
   - No art skills required — just concepts
   - Limit: 1 submission per player per month

2. **Week 2: Voting Phase**
   - Top 20 submissions (by community upvotes) enter a bracket vote
   - All players get 1 vote per day for 7 days (daily login incentive)
   - Voting generates shareable cards: *"I just voted for 'NEON RONIN' in the Deck Forge! [vote link]"*

3. **Week 3: Production Phase**
   - Winning theme enters the AI production pipeline (Section 2)
   - The submitter is credited as "Concept by [username]" on the deck in the shop
   - Submitter receives the deck free + 50,000 bonus chips

4. **Week 4: Release Phase**
   - "Community Choice" deck drops as a limited edition
   - Everyone who voted gets a 20% discount coupon
   - Special badge for voters: "I shaped the meta"

**Why this works for virality:**
- The submitter becomes an advocate (they WILL share "their" deck)
- Voters feel ownership (they WILL share what they helped create)
- The contest itself generates daily engagement (voting = login reason)
- It costs almost nothing (one AI production cycle, already budgeted)

### 6.2 "Deck Blueprint" — Future AI-Assisted Player Creation (Month 6+)

For advanced users, offer an in-app deck customizer:

1. Player selects a base style (5 presets)
2. Player enters a text prompt describing their deck
3. AI generates 3 card back options
4. Player selects one and customizes colors
5. Player pays a creation fee (5,000 chips or 1.99€)
6. Deck is reviewed for content policy compliance
7. Deck appears in player's inventory within 24 hours

**Revenue model:** Creation fee + if the deck gets 100+ "likes" from table-mates, it enters the Community Shop with 30% chip revenue share to the creator (chips only, never cash — BR-001 compliant).

**Legal safeguard:** All player-created decks are owned by StackBluff. The creator license is non-exclusive. No cash payouts. This avoids the UGC legal minefield.

---

## 7. Technical Implementation — Database, API, Frontend

### 7.1 Database Schema Additions

```sql
-- Cosmetic item catalog
CREATE TABLE cosmetic_items (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK(type IN ('deck_back','deck_face','table_felt','chip_skin',
                                      'avatar_frame','deal_animation','win_animation',
                                      'replay_theme','bundle')),
    rarity TEXT NOT NULL CHECK(rarity IN ('common','rare','epic','legendary','mythic','earned')),
    season_id INT REFERENCES seasons(id),
    
    -- Pricing (at least one must be non-null)
    price_eur_cents INTEGER,          -- Stripe price
    price_stars INTEGER,              -- Telegram Stars price  
    price_chips INTEGER,              -- Earnable with chips
    earn_condition TEXT,              -- NULL for purchasable, or condition like 'legend_rank'
    
    -- Availability
    available_from TIMESTAMP NOT NULL,
    available_until TIMESTAMP,        -- NULL = permanent
    is_limited BOOLEAN DEFAULT FALSE,
    max_owners INTEGER,               -- NULL = unlimited, or e.g. 1000 for Founder's Deck
    current_owners INTEGER DEFAULT 0,
    
    -- Assets
    art_assets_base_url TEXT NOT NULL, -- R2 base path: /cosmetics/{id}/
    preview_image_url TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- User inventory
CREATE TABLE user_cosmetics (
    user_id UUID REFERENCES users(id),
    cosmetic_id UUID REFERENCES cosmetic_items(id),
    acquired_at TIMESTAMP DEFAULT NOW(),
    acquisition_method TEXT CHECK(acquisition_method IN ('purchase','earn','season_pass','gift','contest')),
    PRIMARY KEY (user_id, cosmetic_id)
);

-- Equipped slots
CREATE TABLE user_equipped_slots (
    user_id UUID REFERENCES users(id),
    slot TEXT NOT NULL CHECK(slot IN ('deck_back','deck_face','table_felt','chip_skin',
                                       'avatar_frame','deal_animation','win_animation',
                                       'replay_theme')),
    cosmetic_id UUID REFERENCES cosmetic_items(id),
    equipped_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, slot)
);

-- Deck Forge contest submissions
CREATE TABLE deck_forge_submissions (
    id UUID PRIMARY KEY,
    submitter_id UUID REFERENCES users(id),
    theme_name TEXT NOT NULL,
    description TEXT,
    color_palette TEXT,              -- JSON array of hex colors
    reference_url TEXT,
    vote_count INTEGER DEFAULT 0,
    contest_month DATE NOT NULL,     -- e.g. 2026-07-01
    is_winner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Cosmetic interaction tracking (for viral metrics)
CREATE TABLE cosmetic_events (
    id UUID PRIMARY KEY,
    event_type TEXT NOT NULL CHECK(event_type IN ('seen_at_table','purchased','equipped',
                                                    'shared','liked','voted')),
    user_id UUID REFERENCES users(id),
    cosmetic_id UUID REFERENCES cosmetic_items(id),
    table_id UUID,                   -- NULL if not table-related
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 7.2 New REST Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /cosmetics/shop` | Current shop inventory (filtered by availability, rotation) |
| `GET /cosmetics/inventory` | User's owned cosmetics |
| `POST /cosmetics/equip` | Equip a cosmetic to a slot |
| `POST /cosmetics/purchase` | Purchase a cosmetic (Stars or Stripe) |
| `POST /cosmetics/forge/submit` | Submit Deck Forge entry |
| `POST /cosmetics/forge/vote` | Vote on a Deck Forge entry |
| `GET /cosmetics/forge/leaderboard` | Current voting standings |
| `GET /cosmetics/{id}/preview` | Full art preview for a cosmetic |

### 7.3 Frontend Lazy Loading Integration

Per the architecture spec's chunk strategy, cosmetics load on demand:

```typescript
// Cosmetics chunk (< 1 MB per skin from CDN)
// Loaded when player opens shop or equips a skin

interface CosmeticAssets {
  deckBack: string;      // URL to card back image on R2 CDN
  deckFaces: string;     // URL to sprite sheet of all 52 card faces
  chipSkin: string;      // URL to chip texture
  winAnimation: string;  // URL to Rive/Lottie animation
  previewImage: string;  // URL to showcase image
}

// Asset loading strategy:
// 1. Only load assets for cosmetics currently equipped at the table (2-9 players)
// 2. Shop previews use low-res thumbnails (< 50 KB each)
// 3. Full-res assets loaded on purchase/equip
// 4. Cached in IndexedDB after first load
```

### 7.4 WebSocket Protocol Addition

New message type for real-time cosmetic visibility:

```json
{
  "type": "table.cosmetics",
  "payload": {
    "players": {
      "seat_1": { "deck_back_id": "uuid-neon-ronin", "chip_skin_id": null },
      "seat_2": { "deck_back_id": "uuid-founders", "chip_skin_id": "uuid-gold" },
      "seat_3": { "deck_back_id": null, "chip_skin_id": null }
    }
  }
}
```

This is sent once on table join and updated when a player equips a new cosmetic mid-session.

---

## 8. Metrics & KPIs — Measuring the Viral Engine

### 8.1 Per-Deck Release Metrics

| Metric | Formula | Target | Viral Indicator |
|--------|---------|--------|-----------------|
| **Deck Purchase Rate** | Deck purchases / DAU during release week | ≥ 3% | Direct monetization |
| **Table Impression Rate** | Premium deck sightings / total table-seconds | ≥ 15% | Billboard effect |
| **Deck-Driven Shop Visit** | Shop visits within 24h of seeing premium deck | ≥ 8% | Desire conversion |
| **First Equip Share Rate** | "First equip" cards shared / new deck owners | ≥ 25% | Active virality |
| **Replay Card Deck Share** | Replay cards shared featuring the deck / total shares | Track trend | Passive virality |
| **FOMO Conversion** | Purchases in last 48h / total deck purchases | ≥ 35% | Scarcity works |
| **Forge Participation** | Unique voters / MAU | ≥ 10% | Community health |

### 8.2 Cumulative Business Metrics

| Metric | Month 3 | Month 6 | Month 12 |
|--------|---------|---------|----------|
| **Cosmetic Revenue as % of Total** | 20% | 35% | 45% |
| **ARPPU (cosmetics only)** | 4€ | 6€ | 8€ |
| **Paid Conversion via Cosmetics** | 2% | 4% | 5% |
| **Viral K from Cosmetic Shares** | 0.2 | 0.4 | 0.6 |
| **Total Deck Skins in Catalog** | 8 | 18 | 30+ |

### 8.3 A/B Testing Framework

Every deck release is a natural experiment. Track:

- **Teaser length:** 3 days vs 7 days → which drives more pre-release engagement?
- **Price point:** 4.99€ vs 7.99€ for Epic tier → which has higher revenue (price × volume)?
- **Limited duration:** 1 week vs 2 weeks vs 4 weeks → optimal FOMO window
- **Bundle vs item:** default to bundle vs default to item → which increases ARPPU?
- **Earn vs buy:** an earnable variant of the same theme → does it drive more engagement than the paid version?

---

## 9. Legal Compliance Guardrails

### 9.1 ANJ (French Gambling Regulator) Considerations

| Risk | Guardrail |
|------|----------|
| **Cosmetics classified as gambling** | NO random-reward mechanics. Every purchase shows exactly what you get before payment. No "mystery box" or "deck case opening." |
| **Secondary market for cosmetics** | P2P trading and gifting of cosmetics is disabled (BR-003). Decks are account-bound. |
| **Deceptive scarcity** | If a deck is labeled "limited," it must genuinely never return. Documented in the database with `available_until` timestamp. |
| **Price transparency** | All prices shown in real currency (€ or Stars), never in a confusing intermediate currency. Chip prices for earnables shown alongside. |
| **Minor protection** | No "countdown timer" pressure on free/chip-priced items. Time-limited offers only on paid items, with clear end-time displayed. |

### 9.2 GDPR Considerations

| Data Point | Legal Basis | Retention |
|-----------|-------------|-----------|
| Cosmetic purchase history | Contract performance | Duration of account + 30 days |
| Deck Forge submissions | Consent (separate checkbox) | Deletable on request |
| Cosmetic preference tracking (for shop rotation) | Legitimate interest | Anonymized after 90 days |
| "Seen at table" events | Legitimate interest | 30 days, aggregated only |

### 9.3 Content Policy for AI-Generated Art

All AI-generated deck art must pass a moderation checklist before entering the shop:

- [ ] No copyrighted character likenesses
- [ ] No religious symbols used disrespectfully
- [ ] No depictions of real firearms, drugs, or alcohol
- [ ] No political imagery or national flags (cultural themes yes, flags no)
- [ ] No sexualized content (card art has a history of this — strictly avoid)
- [ ] AI generation metadata retained for provenance tracking

---

## 10. The 90-Day Launch Plan — From Zero to First Deck Drop

### Week 1–2: Foundation

- [ ] Ship game with 3 default decks (Classic, Midnight, Neon)
- [ ] Implement cosmetic_items, user_cosmetics, user_equipped_slots tables
- [ ] Build `/cosmetics/shop`, `/cosmetics/equip` endpoints
- [ ] Build shop UI in frontend (lazy-loaded cosmetics chunk)
- [ ] Implement card back rendering in game table UI
- [ ] Implement cosmetic data in WebSocket `table.cosmetics` message

### Week 3: Founder's Deck

- [ ] Produce Founder's Deck via AI pipeline (cyberpunk/gold aesthetic)
- [ ] Configure as Mythic rarity, max_owners = 1000
- [ ] Launch with registration: "First 1,000 players get the exclusive Founder's Deck FREE"
- [ ] Every new registration during this window auto-credits the deck
- [ ] Monitor: registration velocity, social sharing of "I got the Founder's Deck!" posts

### Week 4: Season 1 Pass Launch

- [ ] Produce "Arctic Crown" deck via AI pipeline
- [ ] Launch Season 1 Pass (5.99€) with Arctic Crown as the flagship item
- [ ] First Deck Drop teaser cycle begins
- [ ] Implement "First Equip" share card generation
- [ ] Integrate deck art into Replay Card rendering

### Week 5–6: First Deck Drop Event

- [ ] Run full Deck Drop cycle (7-day teaser + 7-day viral phase)
- [ ] Launch "Show it Off" mission
- [ ] Track all KPIs from Section 8
- [ ] Iterate on pricing, FOMO timing, bundle composition based on data

### Week 7–8: Community Infrastructure

- [ ] Build Deck Forge submission/voting UI
- [ ] Launch first Community Choice vote
- [ ] Implement cosmetic_events tracking table
- [ ] Set up A/B testing framework for shop pricing
- [ ] Produce buffer of 2-3 future decks

### Week 9+: Cadence

- [ ] Maintain 1 Deck Drop every 3-4 weeks
- [ ] 1 Community Choice deck per season
- [ ] Season Pass deck every 8 weeks
- [ ] Continuous AI production pipeline running 2 weeks ahead of schedule
- [ ] Monthly review of metrics → adjust pricing, cadence, rarity mix

---

## 11. Competitive Landscape — Why This Wins

| Competitor | Cosmetic Model | Gap StackBluff Exploits |
|-----------|---------------|------------------------|
| **Zynga Poker** | Limited, static, expensive "charms" | Our decks are visually central to gameplay; Zynga's are peripheral |
| **WSOP App** | Basic card backs, no face customization | Full deck skins (52 cards) = 10× the visual impact |
| **PokerStars Play** | Minimal cosmetics, no seasonal model | Our seasonal cadence creates FOMO; theirs is static |
| **Balatro** (single-player) | Amazing deck designs, no multiplayer | Our decks are SEEN by others — social visibility multiplies desire |
| **Fortnite** | Gold standard of cosmetic monetization | We apply the same season/drop/scarcity model to a new vertical (poker) |

**The key differentiation:** In every other poker app, cosmetics are afterthoughts. In StackBluff, **the deck IS the product experience.** Cards are the center of every screenshot, every replay, every shared moment. By making decks beautiful, seasonal, and scarce, you turn the game's core visual element into the primary monetization and viral engine.

---

## Summary: The Viral Monetization Flywheel

```
AI produces new deck (2 days)
    → Teaser campaign (7 days, zero cost, community amplifies)
    → Deck Drop event (7 days, FOMO + missions drive purchases and play)
    → Premium decks appear at tables (passive billboard to 100% of players)
    → Replay Cards feature deck art (shared off-platform with invite links)
    → New users arrive from shares (K-factor contribution)
    → Some new users buy decks (revenue)
    → Some new users vote in Deck Forge (engagement)
    → Community submits next deck concepts (free ideation pipeline)
    → AI produces next deck from winning concept (2 days)
    → REPEAT
```

**Each cycle produces:**
- A viral spike (7 days of elevated sharing)
- A revenue spike (7 days of concentrated purchases)
- A retention spike (missions, FOMO, community voting)
- A catalog expansion (permanent value in the shop)
- A data point (what themes sell, at what price, with what FOMO window)

**After 12 months:** 30+ decks in catalog, 6+ seasons of data, a self-sustaining community creation engine, and a cosmetic revenue stream contributing 40%+ of total MRR — all on a production budget of ~2 days of AI-assisted work per deck.
