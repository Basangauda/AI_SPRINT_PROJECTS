Date created: 2026-09-04
Date last modified: 2026-09-04

# MCQ CRUD - Technical PRD

## Overview/Problem

The Quiz Maker application already supports teacher registration, login, and logout, and routes authenticated users to a stub MCQ page at `/mcq`. Teachers still cannot create, view, edit, preview, or delete multiple-choice questions, which is the core purpose of the shared test bank. Without MCQ CRUD, the application cannot store questions, choices, or student/teacher practice attempts, blocking all quiz-building work beyond basic account access.

## Hypothesis

We believe that adding MCQ create/read/update/delete with choice validation, preview, and attempt recording will let teachers build and manage a shared multiple-choice test bank using the same architecture, UI patterns, and TDD workflow established in the auth sprint.

---

## Scope

### In Scope

- **Database migration** for three tables: `mcqs`, `mcq_choices`, and `mcq_attempts`
- **McqService** backed by D1 with create, read, update, delete, and attempt-recording methods
- **API endpoints**: `POST /api/mcq`, `GET /api/mcq`, `GET /api/mcq/[id]`, `PUT /api/mcq/[id]`, `DELETE /api/mcq/[id]`, `POST /api/mcq/[id]/attempts`
- **Zod validation** for MCQ payloads and attempt payloads (shared between API routes and client-side checks)
- **Replace the MCQ stub** at `/mcq` with a management table listing all MCQs
- **Create/Edit form** at `/mcq/new` and `/mcq/[id]/edit` (shared form component)
- **Preview flow** via actions menu — interactive preview with choice selection and attempt submission
- **Delete flow** with confirmation dialog
- **Client-side auth gate** using existing `sessionStorage` helpers (`getAuthUser`) — redirect unauthenticated users to `/login`
- **Vitest unit tests** following the existing Red → Green → Refactor TDD approach
- **shadcn/ui components** — reuse installed components; add `dropdown-menu`, `textarea`, and `radio-group` (and optionally `sonner` for toasts) via `npx shadcn@latest add`

### Out of Scope

- Per-user MCQ ownership or permissions (all authenticated teachers share one test bank)
- Server-side session middleware, cookies, or JWT validation
- Quiz assembly (grouping MCQs into quizzes)
- Import/export (CSV, QTI, etc.)
- Rich text or image attachments in questions
- Attempt history UI or analytics dashboard
- Rate limiting on attempt creation
- Soft delete for MCQs

### Cut

- **Separate McqRepository layer** — `McqService` talks to D1 directly via `getDb()`, matching `UserService`
- **Dedicated preview page route** — Preview opens in a `Dialog` from the management table to avoid extra routing and keep the flow minimal
- **Server-side route protection middleware** — Auth sprint intentionally has no sessions; client gates pages and attempt endpoints validate `userId` against the `users` table
- **Choice `sort_order` column** — Choices are returned ordered by `created_at ASC` (stable enough for 2–6 choices); add explicit ordering only if teachers report reordering issues
- **react-hook-form** — Forms use controlled state + `Field` components, matching existing auth forms

---

## Existing Functionality Being Reused

The MCQ feature builds on completed auth work documented in `ai-workspace/LOG_IN_LOG_OUT_PRD.md`:

| Area | Existing artifact | How MCQ reuses it |
|------|-------------------|-------------------|
| Database access | `src/lib/db.ts` | All `McqService` queries use `getDb()` with numbered placeholders (`?1`, `?2`) |
| ID generation | `users.id` pattern | `TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))` for all MCQ tables |
| Timestamps | `users.created_at` / `updated_at` | Same `DATETIME DEFAULT CURRENT_TIMESTAMP` conventions |
| Service layer | `src/lib/services/user-service.ts` | Same file layout, error classes (`NotFoundError`), row-to-domain mapping |
| Validation | `src/lib/validators/user.ts` | Zod schemas in `src/lib/validators/mcq.ts` |
| Types | `src/lib/types/user.ts` | Row types + public API types in `src/lib/types/mcq.ts` |
| API routes | `src/app/api/auth/*/route.ts` | Same handler pattern: parse JSON → Zod → service → map errors to HTTP status |
| Client auth display | `src/lib/auth-session.ts` | `getAuthUser()` / `saveAuthUser()` for page gating and attempt `userId` |
| UI layout | `Card`, `Button`, `Field`, `Input`, `Table`, `Dialog` | Management table, forms, delete confirmation, preview dialog |
| Testing | Vitest + Testing Library | Colocated `*.test.ts` / `*.test.tsx`; mock D1 and `fetch` |
| Post-auth landing | `/mcq` | Stub replaced; logout button retained on management page |

---

## Technical Requirements

### Database Schema

Database binding name: `DB`  
Database name (Wrangler): `quiz-maker-db`

```sql
-- Migration: 0002_create_mcq_tables.sql

CREATE TABLE mcqs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  question TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mcq_choices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL,
  choice TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mcq_id) REFERENCES mcqs (id) ON DELETE CASCADE
);

CREATE TABLE mcq_attempts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mcq_id) REFERENCES mcqs (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (choice_id) REFERENCES mcq_choices (id) ON DELETE CASCADE
);

CREATE INDEX idx_mcq_choices_mcq_id ON mcq_choices (mcq_id);
CREATE INDEX idx_mcq_attempts_mcq_id ON mcq_attempts (mcq_id);
CREATE INDEX idx_mcq_attempts_user_id ON mcq_attempts (user_id);
```

**Column notes**

| Table | Column | Type | Notes |
|-------|--------|------|-------|
| `mcqs` | `id` | TEXT PK | Opaque ID; same convention as `users.id` |
| `mcqs` | `name` | TEXT | Short label for the table listing |
| `mcqs` | `question` | TEXT | Full question text |
| `mcqs` | `created_at` / `updated_at` | DATETIME | Audit timestamps; `updated_at` set on MCQ update |
| `mcq_choices` | `mcq_id` | TEXT FK | Parent MCQ |
| `mcq_choices` | `choice` | TEXT | Choice label/text |
| `mcq_choices` | `is_correct` | INTEGER | `0` or `1` (SQLite boolean) |
| `mcq_attempts` | `user_id` | TEXT FK | References `users.id` |
| `mcq_attempts` | `choice_id` | TEXT FK | Selected choice |
| `mcq_attempts` | `is_correct` | INTEGER | **Computed by backend** from selected choice's `is_correct` flag |
| `mcq_attempts` | `created_at` | DATETIME | No `updated_at` (attempts are immutable) |

**Relationships**

```
users ──< mcq_attempts >── mcqs
                              │
                              └──< mcq_choices
```

Deleting an MCQ cascades to its choices and attempts.

### McqService

Location: `src/lib/services/mcq-service.ts`

| Method | Signature | Description |
|--------|-----------|-------------|
| `createMcq` | `(input: CreateMcqInput) => Promise<McqWithChoices>` | Insert MCQ + choices in a batch; return full object |
| `listMcqs` | `() => Promise<McqSummary[]>` | List all MCQs for table (no choices; includes timestamps) |
| `getMcqById` | `(id: string) => Promise<McqWithChoices \| null>` | Single MCQ with choices ordered by `created_at ASC` |
| `updateMcq` | `(id: string, input: UpdateMcqInput) => Promise<McqWithChoices>` | Update MCQ fields; replace choices atomically |
| `deleteMcq` | `(id: string) => Promise<void>` | Hard delete (cascades choices and attempts) |
| `createAttempt` | `(mcqId: string, input: CreateAttemptInput) => Promise<McqAttempt>` | Validate choice belongs to MCQ; set `is_correct` from choice row |

**Domain errors** (mirror `UserService`):

- `NotFoundError` — MCQ, choice, or user not found
- Reuse or throw generic `Error` for unexpected DB failures

**Attempt correctness rule:** The service loads the choice by `choice_id`, verifies `choice.mcq_id === mcqId`, then sets `is_correct` from `choice.is_correct`. The client must not send `isCorrect`.

### API Endpoints

All endpoints accept and return JSON unless noted.

#### POST /api/mcq

Creates a new MCQ with choices.

**Request Body:**
```json
{
  "name": "Photosynthesis basics",
  "question": "Which organelle carries out photosynthesis?",
  "choices": [
    { "choice": "Mitochondria", "isCorrect": false },
    { "choice": "Chloroplast", "isCorrect": true }
  ]
}
```

**Response:**
- Success (201): `{ "mcq": { "id", "name", "question", "choices": [...], "createdAt", "updatedAt" } }`
- Error (400): Validation error — `{ "error": "Validation failed", "details": [...] }`
- Error (500): Server error — `{ "error": "Internal server error" }`

#### GET /api/mcq

Returns all MCQs for the management table (summary only).

**Response:**
- Success (200): `{ "mcqs": [{ "id", "name", "question", "createdAt", "updatedAt" }] }`
- Error (500): Server error

#### GET /api/mcq/[id]

Returns a single MCQ with choices (for edit and preview).

**Response:**
- Success (200): `{ "mcq": { "id", "name", "question", "choices": [{ "id", "choice", "isCorrect" }], "createdAt", "updatedAt" } }`
- Error (404): `{ "error": "MCQ not found" }`
- Error (500): Server error

> **Preview note:** `isCorrect` is included in GET responses for edit mode. For preview-after-submit feedback, the attempt response reveals correctness; during preview-before-submit, `isCorrect` must not be shown in the UI (choices render without revealing the answer).

#### PUT /api/mcq/[id]

Updates an existing MCQ. Replaces all choices.

**Request Body:** Same shape as POST.

**Response:**
- Success (200): `{ "mcq": { ... } }`
- Error (400): Validation error
- Error (404): `{ "error": "MCQ not found" }`
- Error (500): Server error

#### DELETE /api/mcq/[id]

Deletes an MCQ and cascaded choices/attempts.

**Response:**
- Success (200): `{ "message": "MCQ deleted successfully" }`
- Error (404): `{ "error": "MCQ not found" }`
- Error (500): Server error

#### POST /api/mcq/[id]/attempts

Records a user's answer to a preview/practice attempt.

**Request Body:**
```json
{
  "userId": "abc123",
  "choiceId": "choice-uuid"
}
```

**Response:**
- Success (201): `{ "attempt": { "id", "mcqId", "userId", "choiceId", "isCorrect", "createdAt" } }`
- Error (400): Validation error or choice does not belong to MCQ
- Error (404): MCQ, choice, or user not found
- Error (500): Server error

**Server behavior:**
1. Validate input (Zod)
2. Verify `userId` exists in `users`
3. Verify MCQ exists
4. Verify `choiceId` belongs to the MCQ
5. Set `is_correct` from the choice row (never trust client)
6. Insert attempt row and return result

### Validation

Zod schemas in `src/lib/validators/mcq.ts`:

| Rule | Schema enforcement |
|------|-------------------|
| Name is required | `z.string().min(1).max(200)` |
| Question is required | `z.string().min(1).max(5000)` |
| Minimum 2 choices | `.min(2)` on choices array |
| Maximum 6 choices | `.max(6)` on choices array |
| Choice text is required | Each choice: `z.string().min(1).max(1000)` |
| Exactly one correct | `.refine()` — exactly one choice has `isCorrect: true` |

**Create/update choice input** (no `id` required on create; on update, choices are replaced entirely):

```typescript
const choiceInputSchema = z.object({
  choice: z.string().min(1).max(1000),
  isCorrect: z.boolean(),
});

const mcqInputSchema = z.object({
  name: z.string().min(1).max(200),
  question: z.string().min(1).max(5000),
  choices: z
    .array(choiceInputSchema)
    .min(2)
    .max(6)
    .refine((choices) => choices.filter((c) => c.isCorrect).length === 1, {
      message: "Exactly one choice must be marked as correct",
    }),
});
```

**Attempt input:**

```typescript
const createAttemptSchema = z.object({
  userId: z.string().min(1),
  choiceId: z.string().min(1),
});
```

### Authentication and Authorization

The auth sprint stores the logged-in user in `sessionStorage` only (`src/lib/auth-session.ts`). There is no server session.

| Layer | Behavior |
|-------|----------|
| **Client pages** | On mount, if `getAuthUser()` is null, redirect to `/login`. Applies to `/mcq`, `/mcq/new`, `/mcq/[id]/edit`. |
| **MCQ CRUD APIs** | No server auth check in this sprint (consistent with `/mcq` being publicly reachable today). Client gate is sufficient for the teaching scope. |
| **Attempt API** | Requires valid `userId` in body; service verifies user exists. Reject with 404 if user not found. |
| **Logout** | Existing logout button on management page; unchanged. |

> **Assumption:** A future session sprint will add server-side protection. MCQ APIs are designed so middleware can be added without changing response shapes.

### User Interface Requirements

Use shadcn/ui and Tailwind v4. Client components use `fetch` to API routes, matching auth forms.

#### shadcn Components

| Component | Status | MCQ usage |
|-----------|--------|-----------|
| `Table` | Installed | MCQ listing |
| `Button` | Installed | Create, Save, Cancel, Add choice, actions |
| `Dialog` | Installed | Delete confirmation, Preview |
| `Input` | Installed | Name field, choice text |
| `Textarea` | **Add via shadcn** | Question field |
| `Field`, `FieldLabel`, `FieldError`, `FieldGroup` | Installed | Form layout and errors |
| `Dropdown Menu` | **Add via shadcn** | Row actions (Edit, Preview, Delete) |
| `Radio Group` | **Add via shadcn** | Mark correct answer (create/edit); select answer (preview) |
| `Card` | Installed | Page layout wrapper (optional, matching auth pages) |
| Toast (`sonner`) | **Add via shadcn (optional)** | Success/error after save, delete, attempt |

Install commands (implementation phase):

```bash
npx shadcn@latest add @shadcn/dropdown-menu
npx shadcn@latest add @shadcn/textarea
npx shadcn@latest add @shadcn/radio-group
npx shadcn@latest add @shadcn/sonner   # optional, for notifications
```

#### MCQ Management Page (`/mcq`)

Replaces `McqStub`. Retains user info display and **Log out** button.

**Layout:**
- Page heading: "MCQ Test Bank"
- Subheading with signed-in user (from `sessionStorage`)
- **Create Question** button → navigates to `/mcq/new`
- Table with columns: **Name**, **Question** (truncate long text with ellipsis), **Created At**, **Updated At**, **Actions**
- Empty state when no MCQs: message + Create Question button

**Actions column** — three-vertical-dots (`MoreVertical` icon) dropdown:
- **Edit** → `/mcq/[id]/edit`
- **Preview** → opens Preview dialog
- **Delete** → opens Delete confirmation dialog

**Data loading:** `fetch('/api/mcq')` on mount; show loading state; display API errors inline.

**Timestamp display:** Format ISO strings for locale (e.g. `toLocaleString()`).

#### Create Page (`/mcq/new`)

Renders shared `McqForm` in create mode.

#### Edit Page (`/mcq/[id]/edit`)

Renders shared `McqForm` in edit mode. Loads MCQ via `GET /api/mcq/[id]` on mount.

#### Shared MCQ Form (`McqForm` component)

**Fields:**

| Field | Control | Notes |
|-------|---------|-------|
| Name | `Input` | Required |
| Question | `Textarea` | Required |
| Choices | Dynamic list | Default **2** empty choices on create |
| Correct answer | `RadioGroup` | Exactly one choice selected as correct |

**Choice row actions:**
- Text input for choice label
- Radio button to mark as correct (selecting one unmarks others)
- **Add choice** button (disabled at 6 choices)
- **Remove** button per row (disabled when only 2 choices remain)

**Form actions:**
- **Save** — `POST /api/mcq` (create) or `PUT /api/mcq/[id]` (edit); on success navigate to `/mcq`
- **Cancel** — navigate to `/mcq` without saving

**Client validation:** Run the same rules as Zod before submit; show `FieldError` messages.

#### Preview Flow (Dialog)

Opened from Actions → Preview on the management table.

1. Fetch `GET /api/mcq/[id]`
2. Display question text and choices as a `RadioGroup` (do **not** reveal which is correct)
3. **Submit answer** button — disabled until a choice is selected
4. `POST /api/mcq/[id]/attempts` with `{ userId: authUser.id, choiceId }`
5. On success, show feedback: "Correct!" or "Incorrect." (from `attempt.isCorrect`)
6. **Close** button dismisses dialog

#### Delete Flow (Dialog)

1. Actions → Delete opens confirmation dialog
2. Copy: "Delete [name]? This cannot be undone."
3. **Cancel** closes dialog
4. **Delete** calls `DELETE /api/mcq/[id]`; on success close dialog, refresh table, optional toast

#### UI Flow Summary

```
/mcq (table)
  ├─ Create Question → /mcq/new → Save → /mcq
  ├─ Edit → /mcq/[id]/edit → Save → /mcq
  ├─ Preview → Dialog → Submit attempt → show result
  └─ Delete → Confirm dialog → refresh table

Unauthenticated → redirect /login
```

---

## Test-Driven Development Approach

Follow the same Red → Green → Refactor workflow documented in `ai-workspace/LOG_IN_LOG_OUT_PRD.md` and `.cursor/skills/testing/SKILL.md`.

### TDD rules

| Rule | Detail |
|------|--------|
| Write tests first | Each phase begins with failing tests |
| Colocate tests | `mcq-service.ts` → `mcq-service.test.ts`, etc. |
| Mock boundaries | Mock `getDb`, D1 prepared statements, and `fetch` in component tests |
| Assert behavior | HTTP status/body, service return values, rendered text — not internals |
| Cover failure paths | Validation, not found, wrong choice/Mcq pairing, missing user |
| Phase gate | `npm run test` passes before moving to next phase |

### Test scenarios

#### Validator tests (`src/lib/validators/mcq.test.ts`)

| Scenario | Expected |
|----------|----------|
| Valid MCQ payload (2 choices, one correct) | Passes |
| Missing name | Fails |
| Missing question | Fails |
| Only 1 choice | Fails |
| 7 choices | Fails |
| Empty choice text | Fails |
| Zero correct choices | Fails |
| Two correct choices | Fails |
| Valid attempt payload | Passes |
| Missing userId or choiceId | Fails |

#### Service tests (`src/lib/services/mcq-service.test.ts`)

| Scenario | Expected |
|----------|----------|
| **MCQ creation** — valid input | Inserts MCQ + choices; returns `McqWithChoices` |
| **MCQ retrieval** — `getMcqById` | Returns MCQ with choices or `null` |
| **MCQ retrieval** — `listMcqs` | Returns summaries without choices |
| **MCQ update** — existing ID | Updates fields; replaces choices; bumps `updated_at` |
| **MCQ update** — unknown ID | Throws `NotFoundError` |
| **MCQ deletion** — existing ID | Deletes row |
| **MCQ deletion** — unknown ID | Throws `NotFoundError` |
| **Choice validation** — service rejects invalid data | Relies on caller/schema; service assumes validated input |
| **Attempt creation** — correct choice | `is_correct = 1` in inserted row |
| **Attempt creation** — incorrect choice | `is_correct = 0` |
| **Attempt creation** — choice from different MCQ | Throws / rejects |
| **Attempt creation** — unknown user | Throws `NotFoundError` |

#### API route tests

**`src/app/api/mcq/route.test.ts`**

| Scenario | Status |
|----------|--------|
| POST valid body | 201 + mcq object |
| POST invalid body | 400 |
| GET list | 200 + mcqs array |

**`src/app/api/mcq/[id]/route.test.ts`**

| Scenario | Status |
|----------|--------|
| GET existing MCQ | 200 |
| GET missing MCQ | 404 |
| PUT valid body | 200 |
| PUT missing MCQ | 404 |
| PUT invalid body | 400 |
| DELETE existing | 200 |
| DELETE missing | 404 |

**`src/app/api/mcq/[id]/attempts/route.test.ts`**

| Scenario | Status |
|----------|--------|
| POST valid attempt (correct) | 201; `isCorrect: true` |
| POST valid attempt (incorrect) | 201; `isCorrect: false` |
| POST choice not belonging to MCQ | 400 |
| POST unknown user | 404 |
| POST unknown MCQ | 404 |
| POST invalid body | 400 |

#### Schema migration test (`migrations/schema.test.ts`)

Extend existing file (or add `migrations/mcq-schema.test.ts`) to assert:

- `mcqs`, `mcq_choices`, `mcq_attempts` tables exist
- Required columns and foreign keys present
- Indexes on `mcq_id` and `user_id`

#### Frontend tests

**`src/components/mcq/mcq-form.test.tsx`**

| Scenario | Expected |
|----------|----------|
| Renders name, question, 2 default choices | Pass |
| Add choice up to 6 | Sixth add disabled |
| Remove choice below 2 prevented | Pass |
| Save create calls POST `/api/mcq` | Pass |
| Save edit calls PUT `/api/mcq/[id]` | Pass |
| Cancel navigates to `/mcq` | Pass |
| Client validation errors shown | Pass |
| Exactly one correct enforced | Pass |

**`src/components/mcq/mcq-management.test.tsx`**

| Scenario | Expected |
|----------|----------|
| Loads and displays MCQ table | Pass |
| Create Question navigates to `/mcq/new` | Pass |
| Edit navigates to `/mcq/[id]/edit` | Pass |
| Delete confirms and calls DELETE | Pass |
| Preview opens dialog and submits attempt | Pass |
| Redirects to `/login` when no auth user | Pass |
| Logout still works | Pass |

### Per-phase workflow

```
1. Read phase test plan
2. Write/update test files
3. Run: npm run test → expect NEW tests to FAIL (red)
4. Implement production code until tests pass (green)
5. Refactor; re-run npm run test
6. Check phase exit criteria
7. Update phase status in this PRD
```

---

## Implementation Phases

### Phase 1: Database Migration and Schema Tests - COMPLETED

**Objective:** MCQ tables exist locally; schema contract tests pass.

**Tasks:**
1. Write/update `migrations/schema.test.ts` for MCQ tables (RED)
2. Create migration: `npx wrangler d1 migrations create quiz-maker-db create_mcq_tables`
3. Add SQL from Database Schema section
4. Apply locally: `npx wrangler d1 migrations apply quiz-maker-db --local`
5. Run `npm run test` — schema tests green

**Deliverables:**
- `migrations/0002_create_mcq_tables.sql`
- Updated `migrations/schema.test.ts`

**Exit criteria:**
- [x] Migration applies locally without error
- [x] Schema tests pass

---

### Phase 2: Types, Validators, and McqService - COMPLETED

**Objective:** Core library layer with full unit test coverage.

**Tasks:**
1. Create `src/lib/types/mcq.ts`
2. Write `src/lib/validators/mcq.test.ts` then `src/lib/validators/mcq.ts`
3. Write `src/lib/services/mcq-service.test.ts` then `src/lib/services/mcq-service.ts`
4. Run `npm run test` — Phase 2 tests green

**Deliverables:**
- `src/lib/types/mcq.ts`
- `src/lib/validators/mcq.ts`, `mcq.test.ts`
- `src/lib/services/mcq-service.ts`, `mcq-service.test.ts`

**Exit criteria:**
- [x] All validator rules enforced
- [x] Service CRUD and attempt methods covered with mocked D1
- [x] `is_correct` on attempts set only by service from choice row

---

### Phase 3: API Routes - COMPLETED

**Objective:** All six MCQ endpoints implemented and route-tested.

**Tasks:**
1. Write route tests (RED) for all three route files
2. Implement `src/app/api/mcq/route.ts` (GET, POST)
3. Implement `src/app/api/mcq/[id]/route.ts` (GET, PUT, DELETE)
4. Implement `src/app/api/mcq/[id]/attempts/route.ts` (POST)
5. Map `NotFoundError` → 404, validation → 400
6. Run `npm run test` — Phases 1–3 green

**Deliverables:**
- `src/app/api/mcq/route.ts`, `route.test.ts`
- `src/app/api/mcq/[id]/route.ts`, `route.test.ts`
- `src/app/api/mcq/[id]/attempts/route.ts`, `route.test.ts`

**Exit criteria:**
- [x] Documented request/response shapes match implementation
- [x] All route failure paths tested

---

### Phase 4: UI Components and Pages - COMPLETED

**Objective:** Teachers can manage MCQs end-to-end from the browser.

**Tasks:**
1. Add shadcn components: `dropdown-menu`, `textarea`, `radio-group` (and optionally `sonner`)
2. Write component tests (RED)
3. Create `src/components/mcq/mcq-form.tsx`
4. Create `src/components/mcq/mcq-management.tsx`
5. Update `src/app/mcq/page.tsx` — render `McqManagement` instead of `McqStub`
6. Create `src/app/mcq/new/page.tsx`
7. Create `src/app/mcq/[id]/edit/page.tsx`
8. Update or replace `mcq-stub.test.tsx` coverage via `mcq-management.test.tsx`
9. Run `npm run test` — full suite green

**Deliverables:**
- `src/components/mcq/mcq-form.tsx`, `mcq-form.test.tsx`
- `src/components/mcq/mcq-management.tsx`, `mcq-management.test.tsx`
- `src/app/mcq/page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx`
- New shadcn UI files under `src/components/ui/`

**Exit criteria:**
- [x] Table, create, edit, preview, delete flows work
- [x] Auth redirect and logout preserved
- [x] Component tests pass

---

### Phase 5: Verification and Documentation - COMPLETED

**Objective:** Lint, build, preview smoke test, PRD status updated.

**Tasks:**
1. `npm run test` — entire suite green
2. `npm run lint` and `npm run build`
3. `npm run preview` — manual walkthrough: login → list → create → edit → preview attempt → delete → logout
4. Update Technical Implementation Details and Current Status in this PRD
5. Mark acceptance criteria complete

**Exit criteria:**
- [x] Full test suite, lint, and build pass
- [x] Manual walkthrough succeeds on local dev server
- [x] Production smoke test succeeds on deployed Worker

**Phase 5 verification results (2026-09-09):**

| Check | Command | Result |
|-------|---------|--------|
| Unit tests | `npm run test` | 105 passed, 18 files |
| Lint | `npm run lint` | Pass, no findings |
| Build | `npm run build` | Pass, TypeScript clean |
| Deploy | `npm run deploy` | Pass, version `da049671-043c-4401-8e1d-54b1e693ed6d` |

**Deployed URL:** https://ai_sprint_quiz_maker.basangauda-quizmaker.workers.dev

**Build output routes:** `/mcq`, `/mcq/new`, `/mcq/[id]/edit`, `/api/mcq`, `/api/mcq/[id]`,
`/api/mcq/[id]/attempts`, plus the unchanged auth routes.

**Local walkthrough (dev server, observed in request log):** register rejected two invalid
submissions with 400 then succeeded with 201; login rejected a bad password with 401; `/mcq`
loaded and fetched the list; two questions created via `/mcq/new` returning 201 with the table
refreshing after each; preview loaded a question by ID and recorded an attempt with 201.

**Production smoke test (remote D1):**

| Step | Endpoint | Result |
|------|----------|--------|
| List | `GET /api/mcq` | 200, empty list on fresh database |
| Create | `POST /api/mcq` | 201, MCQ returned with both choices |
| Read | `GET /api/mcq/{id}` | 200 |
| Delete | `DELETE /api/mcq/{id}` | 200, list empty again |

Test record was removed after the smoke test, leaving production data clean.

**Remote migration:** `0002_create_mcq_tables.sql` was applied to the remote database with
`npx wrangler d1 migrations apply quiz-maker-db --remote` (7 commands executed). Before this,
the deployed MCQ endpoints returned 500 because the tables did not exist in production. Deploying
this feature to a new environment requires applying the migration there as well.

**Known rough edge:** a malformed JSON request body to `POST /api/mcq` returns 500 rather than
400. Worth tightening if request-body validation is revisited.

---

## Technical Implementation Details

### Key Files (implemented)

| File | Purpose |
|------|---------|
| `migrations/0002_create_mcq_tables.sql` | MCQ schema migration |
| `migrations/schema.test.ts` | Contract tests for users + MCQ tables |
| `src/lib/types/mcq.ts` | TypeScript types for MCQ domain |
| `src/lib/validators/mcq.ts` | Zod schemas |
| `src/lib/validators/mcq.test.ts` | Validator unit tests |
| `src/lib/services/mcq-service.ts` | MCQ business logic |
| `src/lib/services/mcq-service.test.ts` | Service unit tests (mocked D1) |
| `src/app/api/mcq/route.ts` | List + create endpoints |
| `src/app/api/mcq/[id]/route.ts` | Get, update, delete endpoints |
| `src/app/api/mcq/[id]/attempts/route.ts` | Attempt creation endpoint |
| `src/components/mcq/mcq-management.tsx` | Table, actions, dialogs, logout |
| `src/components/mcq/mcq-form.tsx` | Shared create/edit form |
| `src/app/mcq/page.tsx` | Management page entry |
| `src/app/mcq/new/page.tsx` | Create page |
| `src/app/mcq/[id]/edit/page.tsx` | Edit page |

### Implementation Patterns

**Row mapping (snake_case DB → camelCase API):**
```typescript
function toMcqSummary(row: McqRow): McqSummary {
  return {
    id: row.id,
    name: row.name,
    question: row.question,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

**Create MCQ with choices (batch):**
```typescript
const statements = [
  db.prepare("INSERT INTO mcqs (name, question) VALUES (?1, ?2)").bind(name, question),
  ...choices.map((c) =>
    db.prepare(
      "INSERT INTO mcq_choices (mcq_id, choice, is_correct) VALUES (?1, ?2, ?3)"
    ).bind(mcqId, c.choice, c.isCorrect ? 1 : 0)
  ),
];
await db.batch(statements);
```

**Route handler pattern** (same as auth routes):
```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = mcqInputSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const mcq = await createMcq(parsed.data);
    return Response.json({ mcq }, { status: 201 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Preview: hide correct answer in UI** — Even though GET returns `isCorrect` for edit mode, the preview dialog renders choices without indicating which is correct until after attempt submission.

### Important Notes

- Use `npm run preview` to exercise D1 bindings; `npm run dev` may not reflect Workers behavior.
- Never apply migrations to remote D1 (`--remote`).
- Use `.all()` and `results[0]` instead of `.first()` for D1 consistency.
- On update, simplest approach: delete existing choices for MCQ and re-insert (within same logical operation).
- `McqStub` (`src/components/auth/mcq-stub.tsx`) can be removed or kept unused after `McqManagement` ships; prefer deleting dead code in Phase 4.
- No new runtime dependencies expected beyond shadcn component files (source copied into repo).

---

## Acceptance Criteria

- [x] `mcqs`, `mcq_choices`, and `mcq_attempts` tables exist in both local and remote D1
- [x] User can view a table of all MCQs at `/mcq` with Name, Question, Created At, Updated At, and Actions
- [x] **Create Question** opens `/mcq/new` with a form defaulting to 2 choices
- [x] User can add choices up to 6 and remove down to 2
- [x] User can mark exactly one choice as correct via radio selection
- [x] Save creates MCQ via API and returns to `/mcq`
- [x] Edit loads existing MCQ and saves via PUT
- [x] Cancel returns to `/mcq` without saving
- [x] Preview dialog allows choice selection and records an attempt
- [x] Attempt `isCorrect` is determined by the backend, not the client
- [x] Delete requires confirmation and removes the MCQ from the table
- [x] Validation rejects missing name/question, invalid choice counts, empty choice text, and wrong correct-answer count
- [x] Unauthenticated users are redirected to `/login`
- [x] Logout still works from the MCQ management page
- [x] `npm run test` passes (full Vitest suite)
- [x] `npm run lint` passes
- [x] `npm run build` passes
- [x] Deployed Worker serves MCQ create, read, list, and delete against remote D1

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Unit test suite | 100% pass before phase completion | `npm run test` at end of each phase |
| MCQ create flow | User reaches `/mcq` with new row visible | Component tests + manual preview |
| Attempt accuracy | Backend `isCorrect` matches choice row | Service + route tests |
| Build health | Lint, test, build pass | `npm run lint`, `npm run test`, `npm run build` |

---

## Dependencies

### External Dependencies

- **Cloudflare D1** — SQLite storage for MCQs, choices, attempts
- **zod** — Already installed; validation schemas
- **vitest**, **@testing-library/react**, **@testing-library/user-event**, **jsdom** — Already installed

### Internal Dependencies

- **`src/lib/db.ts`** — D1 accessor
- **`src/lib/auth-session.ts`** — Client auth gate and `userId` for attempts
- **`src/lib/services/user-service.ts`** — User existence check for attempts
- **shadcn/ui** — Table, Button, Dialog, Field, Input; add dropdown-menu, textarea, radio-group
- **Existing `users` table** — FK target for `mcq_attempts.user_id`

### New shadcn Components (implementation phase)

```bash
npx shadcn@latest add @shadcn/dropdown-menu
npx shadcn@latest add @shadcn/textarea
npx shadcn@latest add @shadcn/radio-group
```

### Environment Variables

None required beyond existing D1 binding in `wrangler.jsonc`.

---

## Assumptions

1. **Shared test bank** — All teachers see and manage the same MCQs; no `user_id` on `mcqs`.
2. **Client-side auth gate** — Same limitation as auth sprint; server does not enforce login on CRUD routes yet.
3. **Attempts are practice/preview only** — Stored for future analytics but not displayed in a history UI this sprint.
4. **Immutability** — Attempt rows are never updated after creation.
5. **Question display** — Long questions truncate in the table but show in full on edit/preview.
6. **No pagination** — Acceptable for teaching scope; all MCQs load in one request.

---

## Risks and Mitigation

### Technical Risks

- **Risk:** D1 batch partial failure when creating MCQ + choices  
  **Mitigation:** Use `db.batch()`; verify row counts in tests; handle errors with 500 response

- **Risk:** GET by ID exposes `isCorrect` to client during preview  
  **Mitigation:** Preview UI must not render correctness before submit; document clearly for implementers

- **Risk:** Hollow tests that pass before implementation  
  **Mitigation:** Confirm tests fail (red) before writing production code

- **Risk:** Missing shadcn components block UI work  
  **Mitigation:** Add dropdown-menu, textarea, radio-group in Phase 4 first step

### User Experience Risks

- **Risk:** Users expect MCQs to be private per teacher  
  **Mitigation:** Document shared bank assumption; per-user ownership is out of scope

- **Risk:** Refresh loses auth display state  
  **Mitigation:** Same as auth sprint — `sessionStorage` persists until tab close; redirect to login if missing

---

## Troubleshooting Guide

_(Populate during implementation.)_

### Migration apply fails

**Problem:** `wrangler d1 migrations apply` errors on FK creation  
**Cause:** Migration order or typo in table names  
**Solution:** Ensure `users` table exists from `0001`; verify SQL syntax

### Choice not found on attempt

**Problem:** 400 when submitting preview attempt  
**Cause:** `choiceId` from stale client state after MCQ edit  
**Solution:** Re-fetch MCQ when opening preview dialog

---

## Notes for AI Agents

When implementing from this PRD:

1. Read **Scope → Out of Scope** before adding sessions, ownership, or analytics UI.
2. Follow **Test-Driven Development Approach** — each phase starts with failing tests (red), then implementation (green).
3. Read `.cursor/skills/testing/SKILL.md` before writing tests.
4. Follow `.cursor/rules/d1.mdc` for migrations and queries.
5. Follow `.cursor/rules/nextjs.mdc` and `.cursor/rules/shadcn.mdc` for file layout and UI.
6. Do not modify Register/Login/Logout behavior.
7. Do not apply D1 migrations with `--remote` without explicit approval from the user.
8. Ask before adding npm dependencies; shadcn components are preferred over new packages.
9. Run `npm run lint`, `npm run test`, and `npm run build` before marking complete.
10. Update phase status markers and **Current Status** as work progresses.

---

## Current Status

**Last Updated:** 2026-09-09  
**Current Phase:** All five phases complete  
**Status:** COMPLETED — verified and live in production

All phases are implemented, tested, deployed, and smoke tested against the remote database.
The MCQ migration has been applied to both local and remote D1, and the deployed Worker serves
the full CRUD surface at https://ai_sprint_quiz_maker.basangauda-quizmaker.workers.dev

**Post-completion fix (2026-09-10) — correct-answer selection in the form:**

The radio button that marks a choice as correct was only labelled via `aria-label`, so it was
invisible to sighted users, and `correctIndex` defaulted to `"0"`. Together these meant Choice 1
was silently marked correct and a question could be saved with the wrong answer without the
author ever being asked. The form now shows an explicit instruction plus a "Correct" caption on
each radio, starts with no choice selected, and blocks save with "Select which choice is the
correct answer" until one is chosen. Removing the choice that was marked correct clears the
selection rather than falling back to Choice 1. Covered by four new tests in `mcq-form.test.tsx`
(109 tests total). Existing questions were audited and both had the intended answer marked.

**Outstanding items:**

- Phase 5 documentation changes to this file are not yet committed.
- `src/components/auth/mcq-stub.tsx` is now dead code and can be deleted.
- A malformed JSON body to `POST /api/mcq` returns 500 instead of 400.

**Possible next work:** items from **Out of Scope**, such as per-user MCQ ownership,
server-side sessions, or attempt history and scoring UI.
