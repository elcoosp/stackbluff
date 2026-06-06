---
title: Founding Member badge – 10+ successful referrals
labels: backend, frontend, viral, afk
blocked_by: 015, 006
---

## What to build

Implement Founding Member badge (REQ-FUNC-055):

- Track `referrals_completed` count per user (where referred user completed 5+ hands).
- When count reaches 10, automatically award a permanent "Founding Member" badge.
- Badge stored in `users.badges` JSON array (or separate `user_badges` table).
- Profile page displays badge with tooltip: "Referred 10 friends who played 5+ hands".
- Badge also visible on leaderboard (small icon next to name) and table seating (optional).
- Existing users who already have 10+ referrals get badge retroactively (backfill job).

## Acceptance criteria

- [ ] User with 9 referrals: no badge. 10th referral completes 5 hands → badge appears within 5 minutes.
- [ ] Badge visible on profile, leaderboard, and (if toggled) on table seat.
- [ ] Backfill job correctly badges existing qualifying users.
- [ ] Badge persists across seasons and account merges.

## Blocked by

#015 (referral system exists), #006 (frontend profile page)
