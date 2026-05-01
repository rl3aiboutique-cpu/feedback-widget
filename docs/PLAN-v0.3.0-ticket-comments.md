# Plan: v0.3.0 — ticket preview + chat-style comments

## Context

v0.2.0 dropped the magic-link accept/reject email flow because it added
schema weight (acceptance_token, parent_feedback_id, cascade logic) for
a binary ack the user almost always pressed "accept" on. The richer
replacement: an in-app **chat thread** on every ticket, where:

- Submitter can see their ticket's current state at any time (already
  partially shipped via `MyTicketsPanel`).
- When admin transitions to DONE / WONT_FIX, the user gets an email
  *and* a thread comment from the admin explaining what changed.
- The user replies in-thread with "yes confirmed" or "still broken,
  here's a follow-up" — same widget panel, no magic links, no
  separate routes.
- Both sides see the same history.

This restores the original feedback loop value but in a richer,
storage-cheap way (one new table, no token cleanup, no parent cascade).

## Wire shape

### New table `feedback_comment`

```
id              UUID PK
feedback_id     UUID FK -> feedback.id ON DELETE CASCADE  (indexed)
tenant_id       UUID  (mirrored from parent for RLS)      (indexed)
author_user_id  UUID
author_role     ENUM('submitter', 'admin')
body            TEXT  (markdown, redacted server-side)
attachments     JSONB  (optional list of {filename, byte_size, ...} —
                       reuses feedback_attachment kind=comment_attachment)
created_at      TIMESTAMP TZ
edited_at       TIMESTAMP TZ NULLABLE
deleted_at      TIMESTAMP TZ NULLABLE  (soft delete; admin can hide
                                        moderated rows without breaking
                                        the thread)
```

`feedback_attachment.kind` enum gains `comment_attachment` so a comment
can carry up to 3 files (smaller cap than the original ticket — chat
replies are usually quick clarifications).

### New endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/feedback/{id}/comments` | submitter (own ticket) or MASTER_ADMIN | List comments newest-last. |
| `POST` | `/feedback/{id}/comments` | same | Add a comment. Multipart for optional file attachments. |
| `PATCH` | `/feedback/{id}/comments/{comment_id}` | author within 5 min OR MASTER_ADMIN | Edit a comment (sets `edited_at`). |
| `DELETE` | `/feedback/{id}/comments/{comment_id}` | author within 5 min OR MASTER_ADMIN | Soft-delete (sets `deleted_at`). |

Auth: extend the widget's existing user/admin gates. The submitter
gate only allows access if the comment's parent feedback row's
`user_id == current_user.user_id`. Tenant scope applies as elsewhere.

### Status transition triggers

When admin sets `status` to DONE or WONT_FIX:
- Server auto-creates a comment with `author_role='admin'` and
  `body = update.triage_note`.
- Email is sent to the submitter (already exists in v0.2.0) with a
  deep-link to the panel showing the new comment.

User-side:
- After a DONE auto-comment, the next user-side comment is treated as
  the resolution ack. If body says `/accept` (or just any reply), the
  ticket can transition automatically — but no destructive cascade.
- WONT_FIX behaves the same minus the auto-transition.

## UI

### Submitter panel — `MyTicketsPanel` extends to detail drawer

Click on a row in "My tickets" tab → opens a drawer:

```
┌─ FB-2026-0042  · DONE ───────────────────┐
│  "Login fails on Safari"                  │
│                                           │
│  Type: bug · Submitted 2026-04-30 · ··· │
│                                           │
│  ── Description ──                         │
│  > What's happening: …                     │
│  > How should it work: …                   │
│  [screenshot] [attachments]                │
│                                           │
│  ── Conversation ──                        │
│  💬 admin (2026-05-02)                    │
│     Fixed in v2.4.1, redeploying now.     │
│     [attachment.png]                      │
│                                           │
│  💬 you (2026-05-02)                      │
│     Confirmed working. Thanks!            │
│                                           │
│  ┌─ Reply ─────────────────────────┐     │
│  │ Type your reply…                │     │
│  │ [📎 add files]                  │     │
│  └─────────────────────────────────┘     │
│            [Cancel]  [Send reply]         │
└───────────────────────────────────────────┘
```

### Admin triage — `FeedbackTriagePage` detail drawer extends

Same conversation block appears below the existing description /
expected_outcome / screenshot sections. Admin can post comments without
changing status, or as part of a status transition (the existing
"Save status" flow is augmented to optionally post the triage_note as
a comment too).

## Files

### Backend
- `packages/feedback-backend/src/feedback_widget/models.py` — new
  `FeedbackComment` SQLModel + enum extension on
  `FeedbackAttachmentKind`.
- `packages/feedback-backend/src/feedback_widget/schemas.py` —
  `FeedbackCommentRead`, `FeedbackCommentCreatePayload`,
  `FeedbackCommentListResponse`.
- `packages/feedback-backend/src/feedback_widget/service.py` —
  `list_comments`, `create_comment`, `edit_comment`, `delete_comment`
  with auth + redaction.
- `packages/feedback-backend/src/feedback_widget/router.py` — four new
  routes (see table above).
- `packages/feedback-backend/src/feedback_widget/alembic/versions/0004_ticket_comments.py`
  — new file: create `feedback_comment` table, indexes, RLS policy
  (mirrors `feedback`), extend `feedback_attachment_kind` enum.
- `packages/feedback-backend/src/feedback_widget/email/render.py` —
  status-transition email body grows a "view conversation" link.

### Frontend
- `packages/feedback-frontend/src/comments/CommentThread.tsx` (new) —
  the conversation block + reply composer.
- `packages/feedback-frontend/src/comments/useComments.ts` (new) —
  React Query hooks (list, post, edit, delete) wired through the
  adapter.
- `packages/feedback-frontend/src/MyTicketsPanel.tsx` — add detail
  drawer that mounts `CommentThread`.
- `packages/feedback-frontend/src/admin/FeedbackTriagePage.tsx` — add
  `CommentThread` below description in `DetailBody`.
- `packages/feedback-frontend/src/adapter.ts` — extend
  `FeedbackAdapter` with comment methods.

## Compatibility

v0.2.0 → v0.3.0 is **additive**: no columns dropped, no enums
renamed. v0.2.0 clients keep working; comment endpoints just don't
exist for them. Hosts upgrade by bumping the pin and running
`feedback-widget migrate`.

This is the first migration after the v0.2.0 schema-freeze rule. From
here on, every release is additive and reversible.

## Out of scope

- @-mentions (cross-tenant identity is messy).
- Read receipts / typing indicators.
- Realtime push (poll on a 30 s interval; admin can hit refresh).
- Voice / video reply (attachment-only).
