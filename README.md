# Work Tracker

A local single-user MVP using React, JavaScript, Vite, npm, and plain CSS. No backend or login. Projects supports creation, editing, archiving, and restoring. Other features remain placeholders.

## Setup

Run from this dedicated directory:

```cmd
cd work-tracker
npm install
npm run dev
```

The existing dev server is at http://localhost:5173/. Use it without starting another server.

```cmd
npm run build
npm run lint
npm run preview
```

Build output is in dist; preview serves that production build locally.

## Architecture

- src/app/: composition, state navigation, Context, and provider.
- src/components/layout/: responsive navigation shell.
- src/components/ui/: shared presentation.
- src/features/projects/: project page, form, decimal rate parsing, immutable operations, and focused checks. Other feature folders contain placeholders.
- src/lib/: versioned persistence and validation.
- src/styles/: theme variables and shared CSS.

Navigation uses React state; reloading returns to Dashboard. Navigation buttons expose the active page. Visible keyboard focus, a skip link, and wrapping mobile navigation support accessibility.

Context starts with settings: { currency: "USD" }, empty projects, sessions, incomeEntries, and goals arrays, and activeTimer: null. Consumers receive data, setData, and a storage notice.

## Data decisions

- Money uses integer cents.
- IDs are stable strings; timestamps use ISO strings.
- Timer elapsed time will be calculated from timestamps rather than interval ticks.
- Recorded payments drive financial goal progress.
- The MVP is a local single-user application without backend or login.

## Storage

The localStorage key is work-tracker:v1. Loading safely parses JSON and validates every required field below, currency format, and duplicate IDs within each collection. Empty initial arrays are valid. `activeTimer` must remain `null`; timer persistence validation must be implemented with the timer feature.

### Foundation record schemas

All records require a stable, nonempty string `id`. Required descriptive strings must contain non-whitespace text except `description` on projects and `notes` on sessions, which may be empty. Monetary values and durations must be finite safe integers (at most `Number.MAX_SAFE_INTEGER`). No coercion is performed.

| Collection | Fields |
| --- | --- |
| projects | `name`, `description`, optional string `clientName`, `status` (`active` or `archived`), `hourlyRateCents` (zero or greater), `createdAt`, `updatedAt` |
| sessions | `startedAt`, `endedAt`, `durationSeconds` (zero or greater), `notes`, optional `projectId` |
| incomeEntries | `description`, `amountCents` (strictly positive recorded payment), `paidDate`, `createdAt`, optional `projectId` |
| goals | `title`, `targetCents` (strictly positive), `status` (`active`, `completed`, or `archived`), optional `deadline`, `createdAt`, `updatedAt` |

Timestamps use canonical UTC ISO strings as returned by `Date.toISOString()` (`YYYY-MM-DDTHH:mm:ss.sssZ`). Date-only fields (`paidDate`, `deadline`) use real calendar dates in `YYYY-MM-DD` format. Invalid dates and rolled-over dates are rejected. `updatedAt` cannot precede `createdAt`, and session `endedAt` cannot precede `startedAt`. Duration is stored as nonnegative integer seconds; timestamp-based elapsed-time reconciliation belongs to the timer feature.

Optional project IDs may be omitted, `null`, or nonempty strings; empty strings are invalid. Validation checks their shape, not whether a referenced project currently exists, so historical records can survive project removal. Optional deadlines may be omitted or `null`. Unknown extra fields do not replace required fields and are preserved for forward-compatible metadata.

The provider uses a shared snapshot store with `useSyncExternalStore`. `setData` accepts a replacement or a pure functional update. Consecutive updates receive the latest snapshot even before a React render. Snapshots are deeply frozen and accepted replacements are cloned, preventing mutation through updater arguments or caller-owned objects. Invalid replacements return `false` without changing state or storage. Updates must return new data rather than mutate it.

Invalid saved data remains untouched, with persistence disabled for that session and a visible notice. Nothing is written on startup. Subsequent state changes are saved when loading was successful. Storage access, serialization, and write failures are caught and displayed without crashing. Browser data is specific to the browser and origin; there is no backup or cross-device sync. Future schema changes require a migration or new versioned key.

## Git

This folder has a separate repository on main. Dependencies, build output, logs, credentials, and .env files are ignored. Feature changes should remain uncommitted until reviewed.

## Projects

Names are required and trimmed; optional client names are trimmed. Older projects without `clientName` remain valid. Hourly rates use nonnegative USD decimals with at most two decimal places (no exponents, separators, or signs). Blank rates default to zero cents. Decimal strings are converted directly to integer cents without floating-point rounding. IDs use `crypto.randomUUID()` and remain unchanged on edit, archive, or restore. Edits preserve descriptions and other metadata. ISO `updatedAt` timestamps are refreshed on changes, without moving backward if the clock changes.

Archived projects are retained and can still be edited. Archiving never removes sessions, payments, or their references. All operations go through the existing provider; storage warnings stay visible and invalid saved data is never overwritten. Successful updates in memory do not imply persistence when storage is unavailable.

## Focused checks

Run `node src/lib/storage.test.js` to check record validation, saved-data preservation, storage failures, and immutable consecutive provider-store updates.
Run `node src/features/projects/projectModel.test.js` for rate boundaries, project lifecycle, reload persistence, and storage warning preservation.
