---
title: Founding Member badge – 10+ successful referrals
labels: backend, frontend, viral, afk
blocked_by: 015, 006
---

## What to build

Implement Founding Member badge (REQ-FUNC-055):

- **Backend** (`sb-viral`):
  - Track `completed_referrals` count per user (where referred user completed 5+ hands).
  - When count reaches 10, automatically award badge: insert into `user_badges` table (user_id, badge_type, awarded_at).
  - Badge types: 'founding_member', 'founder_club' (separate).
  - Existing users with 10+ referrals get badge via backfill script (run once).
- **Frontend** (Agent 2):
  - Profile page displays badge with tooltip: "Referred 10 friends who played 5+ hands".
  - Badge also visible on leaderboard (small icon next to name) and table seating (optional setting).
  - Use `PlatformAPI` to share badge unlock moment.

## Acceptance criteria

- [ ] User with 9 referrals: no badge. 10th referral completes 5 hands → badge appears within 5 minutes (via push or next fetch).
- [ ] Badge visible on profile, leaderboard, and (if toggled) on table seat.
- [ ] Backfill script correctly badges existing qualifying users.
- [ ] Badge persists across seasons and account merges.

## Blocked by

#015 (referral system exists), #006 (frontend profile page)
