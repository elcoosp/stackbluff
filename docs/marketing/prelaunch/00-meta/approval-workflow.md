# StackBluff — Content Approval Workflow

| Field | Value |
|-------|-------|
| Document | Content Production & Approval Process |
| Version | 1.0 |
| Purpose | Define the pipeline from idea to published post |

---

## 1. The Content Pipeline

```
IDEA ──► GENERATE ──► REVIEW ──► REVISE ──► APPROVE ──► SCHEDULE ──► PUBLISH
 │         │           │          │          │           │           │
 │         │           │          │          │           │           └─ Post goes live
 │         │           │          │          │           └─ Add to platform scheduler
 │         │           │          │          └─ Human founder signs off
 │         │           │          └─ Fix issues found in review
 │         │           └─ Check against Crew Bible, Glossary, Legal Checklist
 │         └─ AI generates draft using prompt templates + Crew Bible
 └─ From schedule.md or spontaneous event
```

## 2. Roles

| Role | Who | Responsibility |
|------|-----|----------------|
| **Generator** | AI (with human prompting) | Produce draft text and image prompts |
| **Image Producer** | Human (using AI image tools + Figma/Canva) | Create final visual assets |
| **Reviewer** | Human founder | Check all meta rules, legal, character consistency |
| **Approver** | Human founder ONLY | Final sign-off before anything is published |
| **Publisher** | Human founder | Post to Telegram, X/Twitter, Reddit, etc. |

## 3. Review Criteria (The "Gate")

Every piece of content must pass through this gate before scheduling:

### Character Gate
- [ ] Correct sound tag for the crew member?
- [ ] Correct symbol (♠ ♥ ♦ ♣ 🃏)?
- [ ] Voice matches the Crew Bible?
- [ ] No out-of-character behavior?

### Consistency Gate
- [ ] Matches the current phase's mystery level?
- [ ] Product name mentioned only if Phase 3+?
- [ ] Numbers consistent with previous posts?
- [ ] No contradictions with earlier content?

### Legal Gate
- [ ] Passes all items on legal-review-checklist.md?
- [ ] No PII in screenshots or text?
- [ ] No real-money gambling implications?

### Quality Gate
- [ ] Would I screenshot this at 2AM?
- [ ] Image is correct size and resolution?
- [ ] Text readable at mobile size?
- [ ] Clear emotional hook?

### Engagement Gate
- [ ] Invites response? (Question, debate, challenge)
- [ ] Reason to share?
- [ ] Advances the narrative?

## 4. Scheduling Rules

- **Never post more than once per day** per platform (exception: launch day Phase 6).
- **Optimal posting times** (CET): 08:00, 12:30, 18:00, 21:00. Test and adapt.
- **Pre-generated content** is scheduled at least 24 hours in advance.
- **Reactive content** (responding to community, bugs, events) can be posted same-day after approval.
- **Phase transitions** always post at 12:00 CET on the designated day.

## 5. Emergency Protocol

If a post receives negative attention, legal concern, or factual error after publishing:

1. **Do not delete immediately** (deletion creates screenshots and suspicion).
2. **Assess severity:** Is this a typo, a legal risk, or a community backlash?
3. **If typo:** Edit silently (Twitter) or repost (Telegram).
4. **If legal risk:** Delete immediately. Document why. Review all similar scheduled content.
5. **If community backlash:** Respond in character. Never break the narrative frame to apologize. The Human ([VOICE]) can step out of character if absolutely necessary.

## 6. Archival

- Every published post is logged in `10-production-pipeline/generation-log.md` with: date, platform, content file path, image file path, and any post-publish notes.
- Deleted posts are also logged with the reason for deletion.

---

*End of Document — Approval Workflow v1.0*
