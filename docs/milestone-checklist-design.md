# Milestone Checklist Design

**Prototype:** SmartReview-ProtoC2  
**Source:** CPA review phases (Client Setup → Final Check)  
**Return:** Jessica Drake · 1040 with schedules

---

## Purpose

Replace the flat reviewer checklist with a **milestone-based checklist** aligned to real CPA review workflow. Milestones support both **single-person** and **dual-person** review without changing the underlying data model.

---

## Single vs dual person flow

### Scenario A — One person (single-person mode)

One CPA completes import accuracy, AI diagnostics, output attestation, **and** the full milestone checklist before sign-off.

- Milestones accumulate under one actor — attribution shows first name only (e.g. **Jordan · Jul 29**).
- No Pass 1 / Pass 2 split in the conversational brief.
- Declaration milestones can be completed whenever the actor is eligible (`any` or their role).
- Linked/auto milestones still derive from underlying field, doc, and diagnostic state.

### Scenario B — Two people (dual-person mode, default demo)

| Pass | Actor | Milestone work |
|------|-------|----------------|
| Pass 1 | Sara Chen (preparer) | Doc tie-outs, import flags, preparer-eligible declarations |
| Handoff | — | Activity log + partial milestone progress transfers |
| Pass 2 | Jordan Lee (reviewer) | Rev confirmations, form sign-offs, reviewer declarations, sign-off |

- Each completed milestone records **who** and **when**: **SC · Jul 29** or **Jordan · Jul 29**.
- Brief bullets split by role: *"Sara completed 8 milestones in Pass 1"* / *"Jordan completed 4 milestones in Pass 2"*.
- Reviewer sees remaining milestones; can complete any still-open `any` items.

---

## Completion types

| Type | Behavior | UI icon |
|------|----------|---------|
| **auto** | System detects completion (e.g. all AI diagnostics cleared) | Sparkle |
| **linked** | Tied to doc verify, Rev column, form sign-off, or flag state | Link |
| **declaration** | Manual "I confirm X" checkbox — stored in `completedMilestones` | Check |

Linked and auto milestones are **locked** (not manually toggled). Declaration milestones use the same checkmark-button pattern as output-form attest columns.

---

## Data model

```typescript
// Static catalog — src/data/reviewMilestones.ts
interface ReviewMilestone {
  id: string
  phase: 1 | 2 | 3 | 4 | 5
  title: string
  completionType: 'auto' | 'linked' | 'declaration'
  eligibleActor: 'any' | 'preparer' | 'reviewer'
  linkedKey?: string
  required: boolean
}

// Session state — useSyncedReviewState
completedMilestones: Record<milestoneId, { by, at, name }>
```

`deriveMilestoneState()` merges catalog + live review state into resolved milestones with completion attribution.

---

## Sign-off gate

Sign-off requires:

1. All **required** milestones complete
2. Zero outstanding open items (notes, flags, etc.)

Progress surfaces as *"12 of 20 required milestones complete"* in the executive brief and Phase 2 banner.

---

## Deferred (future prototype)

- Phase 2–5 MD items not in Jessica Drake return (K-1s, Form 8867, 1095-A, business entities)
- Per-milestone jump from brief to exact field (partial — jump targets on subset only)
- Configurable milestone sets by return type (1040 vs 1120-S)
- Single-person mode without role switch (today: dual-person demo with Sara/Jordan names)

---

*See also: [review-journey-map.md](./review-journey-map.md)*
