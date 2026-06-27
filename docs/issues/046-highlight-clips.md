## Auto‑generated highlight clips – epic hand videos

**Title:** Auto‑generated highlight clips – epic hand videos  
**Labels:** `backend, viral, afk`  
**Blocked by:** #015 (replay card infrastructure), #044 (OBS overlay – for video composition)

---

### 📌 Summary

Implement automatic highlight clip generation (SN-017) – Agent 4. The system detects "epic hands" (Royal Flush, Four‑of‑a‑kind, bad beats, all‑ins >100BB, tournament final table eliminations) and generates a short video clip (5–10 seconds) showing the hand evolution. **The clip is rendered using the existing React app** – we reuse the same components that power the replay card (#015) and the OBS overlay (#044). No separate HTML/CSS templates are created; the backend triggers a headless browser to load a dedicated replay page from the React app, captures frames, and composes the video.

The clip is uploaded to Cloudflare R2, and the user receives a shareable link via `NotificationService`. Clips are stored in the user’s profile gallery.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Hand history entity | `backend/crates/sb-db-entities/src/hand_history.rs` – add `clip_url` column. |
| Replay card triggers | `backend/crates/sb-viral/src/lib.rs` – `on_significant_hand` is called for significant hands. |
| Replay page (React) | Create a new route `/replay/:handId` that renders the hand replay using existing components. |
| Notification service | `backend/crates/sb-contracts/src/notification_api.rs` – send notification with clip link. |
| R2 storage | `backend/crates/sb-server/src/hand_archive.rs` – reuse `RealR2` for uploading clips. |
| Headless browser capture | Use `headless_chrome` crate or a separate Node.js microservice that uses Puppeteer/Playwright. |
| Frontend profile | `frontend/apps/pwa/src/pages/ProfilePage.tsx` – add "My Highlights" tab. |

---

### 🔧 What to build

#### 1. Database changes

- Add `clip_url` (TEXT, nullable) to `hand_history` table.
- Create `user_highlights` table:
  ```sql
  CREATE TABLE user_highlights (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hand_history_id UUID NOT NULL REFERENCES hand_history(id) ON DELETE CASCADE,
      clip_url TEXT NOT NULL,
      generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      viewed_at TIMESTAMP NULL,
      UNIQUE(user_id, hand_history_id)
  );
  ```
- Add index on `(user_id, generated_at DESC)` for paginated queries.

#### 2. React replay page (`/replay/:handId`)

- Create a new route in the React app that renders a **full‑screen replay** of a hand.
- Reuse existing components:
  - `TableFelt`, `SeatGrid`, `CommunityCards`, `PotBadge`, `PlayerSpot` (with hole cards revealed).
  - Add a timeline/progress bar and a “Play” button (but the page will auto‑play when loaded in headless mode).
- The page should accept a `?autoplay=true` query parameter to start the replay immediately.
- The replay should show the hand evolution (cards dealt, actions, showdown) over a short duration (5–10 seconds).
- The page should be **lightweight** (no header, no navigation) – a stripped‑down version of the table page.

#### 3. Backend – clip generation trigger

- In `ViralServiceImpl::on_significant_hand`, spawn a background task to generate the clip (if not already generated for that hand).
- The background task:
  - Launches a headless browser (using `headless_chrome` crate) or calls a separate Node.js service that uses Puppeteer.
  - Loads `http://localhost:5173/replay/{hand_id}?autoplay=true` (or the production URL).
  - Captures a continuous stream of frames (or uses the browser’s `MediaRecorder` API to record the page as a video).
  - Saves the video (MP4, H.264, 720p, < 2MB).
  - Uploads the MP4 to R2 (key: `highlights/{hand_id}.mp4`).
  - Stores the URL in `hand_history.clip_url` and inserts a record into `user_highlights`.
  - Sends a notification to the user (via `NotificationService`) with the clip link.

#### 4. Backend – clip serving and gallery

- Expose endpoint: `GET /user/highlights?page=1&limit=20` – returns paginated list of user’s clips (with hand metadata: date, hand rank, pot, etc.).
- Use `user_highlights` joined with `hand_history` to fetch the data.

#### 5. Frontend – profile gallery

- In the user profile page (`/profile`), add a new tab: **"My Highlights"**.
- Display a grid of thumbnail images (or video players) for each clip.
- Clicking on a clip opens a modal or overlay to play the video (with controls).
- Pagination using `useInfiniteQuery`.

#### 6. Frontend – shareable link

- The notification (Telegram/Web Push) includes a link to the clip: `https://stackbluff.com/highlight/{clip_id}`.
- The highlight page shows the video with a share button (reuse `PlatformAPI.shareContent` from #006).

#### 7. Headless browser setup (either option)

- **Option A (Rust)**: Use `headless_chrome` crate to connect to a Chromium instance. Capture frames via `Page::screenshot` and encode using `ffmpeg` (via `std::process`).
- **Option B (Node.js microservice)**: Create a small Node.js service that uses Puppeteer and `fluent-ffmpeg` to record the page. The backend sends a request to this service with the hand ID and receives the video URL.
- **Recommended**: Option A for simplicity (no extra service), but Option B is more robust for complex encoding. For MVP, we can use Option A with `ffmpeg` to combine frames into MP4.

---

### ✅ Acceptance Criteria

- [ ] **Backend:**
  - [ ] Significant hands (Royal Flush, 4‑of‑a‑kind, bad beats, all‑in >100BB, final table eliminations) trigger a background clip generation job.
  - [ ] The job loads the React replay page in a headless browser, captures frames, and encodes an MP4 (H.264, 720p, < 2MB) within 30 seconds.
  - [ ] The clip is uploaded to R2 and stored in the database.
  - [ ] The user receives a notification (Telegram/Web Push) with a shareable link.
  - [ ] `GET /user/highlights` returns paginated clips with metadata.

- [ ] **Frontend:**
  - [ ] The replay page (`/replay/:handId`) renders the hand using the same components as the game table (no extra templates).
  - [ ] The replay page auto‑plays when loaded with `?autoplay=true`.
  - [ ] The profile page has a "My Highlights" tab showing clips in a grid.
  - [ ] Each clip can be played and shared via `PlatformAPI.shareContent`.
  - [ ] The gallery supports infinite scroll or pagination.
  - [ ] The shareable link opens a page with the video and share button.

---

### 🔗 Blocked By

- **#015** – Replay card infrastructure (trigger logic) – we reuse the same detection logic.
- **#044** – OBS overlay (provides the rendering approach and component reuse pattern).

---

### 🧪 Testing Notes

- **Unit tests** for the trigger logic and database updates.
- **Integration tests** simulating a significant hand and verifying that a clip is generated and stored.
- **Performance tests**: clip generation should not block the main server and should complete within 30 seconds.
- **Manual QA**:
  - Play a hand that qualifies (e.g., Royal Flush) and verify the clip appears in the user's highlights.
  - Check the notification is received.
  - Open the shareable link and verify the video plays.

---

### 📝 Implementation Hints

- **Reuse React components**: The replay page will use the exact same components as the live game, ensuring visual consistency and zero maintenance overhead.
- **Headless browser**: The `headless_chrome` crate is a good fit; it can control Chrome and take screenshots. Use `tokio` to spawn the browser and capture frames at a fixed interval (e.g., 30 fps).
- **FFmpeg**: Use `ffmpeg` to combine frames into an MP4. The backend can call `ffmpeg` via `std::process::Command` – this is simple and reliable.
- **R2 upload**: Use the existing `RealR2` implementation – it already handles S3‑compatible uploads.
- **Background queue**: Use a `tokio` channel to queue generation tasks and process them sequentially to avoid overloading the server.
- **Notification**: Use `NotificationService` with a new event type `ClipReady { clip_url, hand_id }`.
