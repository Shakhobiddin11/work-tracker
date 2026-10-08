# Work Tracker

A local single-user MVP using React, JavaScript, Vite, npm, and plain CSS. No backend or login. Projects manages work, Work Timer records sessions, and Income tracks payments actually received. Dashboard and Goals remain placeholders.

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
- src/features/projects/: project page, form, decimal rate parsing, immutable operations, and focused checks.
- src/features/timer/: timestamp-based timer, immutable start/stop operations, recent sessions, styles, and focused checks.
- src/features/income/: received payments, local-date form, explicit removal confirmation, exact totals, validation, styles, and focused checks.
- src/lib/: versioned persistence and validation.
- src/styles/: theme variables and shared CSS.

Navigation uses URL hashes (`#dashboard`, `#timer`, `#projects`, `#income`, `#goals`). Refresh and bookmarks reopen the current section, and browser Back/Forward changes sections. An empty or unknown hash safely shows Dashboard. Navigation buttons expose the active page. Visible keyboard focus, a skip link, and wrapping mobile navigation support accessibility. The skip link focuses content without changing the section hash or browser history.

Context starts with settings: { currency: "USD" }, empty projects, sessions, incomeEntries, and goals arrays, and activeTimer: null. Consumers receive data, setData, and a storage notice.

## Data decisions

- Money uses integer cents.
- IDs are stable strings; timestamps use ISO strings.
- Timer elapsed time is calculated from timestamps rather than interval ticks.
- Recorded payments drive financial goal progress.
- The MVP is a local single-user application without backend or login.

## Storage

The localStorage key is work-tracker:v1. Loading safely parses JSON and validates every required field below, currency format, and duplicate IDs within each collection. Empty initial arrays are valid. `activeTimer` accepts `null` (including existing saved data) or a validated timer record.

### Foundation record schemas

All records require a stable, nonempty string `id`. Required descriptive strings must contain non-whitespace text except `description` on projects and `notes` on sessions, which may be empty. Monetary values and durations must be finite safe integers (at most `Number.MAX_SAFE_INTEGER`). No coercion is performed.

| Collection | Fields |
| --- | --- |
| projects | `name`, `description`, optional string `clientName`, `status` (`active` or `archived`), `hourlyRateCents` (zero or greater), `createdAt`, `updatedAt` |
| sessions | `startedAt`, `endedAt`, `durationSeconds` (zero or greater), `notes`, optional `projectId` |
| incomeEntries | New entries: `amountCents` (strictly positive safe integer), `receivedAt` (ISO timestamp), `receivedDate` (selected calendar date), `notes` (may be empty), `createdAt`, `updatedAt`, optional `projectId`. Legacy entries without `receivedAt`: `description` (nonempty), `paidDate`, `amountCents`, `createdAt`, optional `projectId`. |
| goals | `title`, `targetCents` (strictly positive), `status` (`active`, `completed`, or `archived`), optional `deadline`, `createdAt`, `updatedAt` |
| activeTimer | `null` or an object with stable nonempty string `id`, required nonempty `projectId`, and canonical ISO `startedAt`. Its ID must not already exist in sessions. |

Timestamps use canonical UTC ISO strings as returned by `Date.toISOString()` (`YYYY-MM-DDTHH:mm:ss.sssZ`). Date-only fields (`paidDate`, `deadline`) use real calendar dates in `YYYY-MM-DD` format. Invalid dates and rolled-over dates are rejected. `updatedAt` cannot precede `createdAt`, and session `endedAt` cannot precede `startedAt`. Duration is stored as nonnegative integer seconds, calculated by flooring the difference between stop and start timestamps. Existing sessions with optional project references remain valid; newly recorded timer sessions always have a project ID.

Optional project IDs may be omitted, `null`, or nonempty strings; empty strings are invalid. Validation checks their shape, not whether a referenced project currently exists, so historical records can survive project removal. Optional deadlines may be omitted or `null`. Unknown extra fields do not replace required fields and are preserved for forward-compatible metadata.

The provider uses a shared snapshot store with `useSyncExternalStore`. `setData` accepts a replacement or a pure functional update. Consecutive updates receive the latest snapshot even before a React render. Snapshots are deeply frozen and accepted replacements are cloned, preventing mutation through updater arguments or caller-owned objects. Invalid replacements return `false` without changing state or storage. Updates must return new data rather than mutate it.

Invalid saved data remains untouched, with persistence disabled for that session and a visible notice. Nothing is written on startup. Subsequent state changes are saved when loading was successful. Storage access, serialization, and write failures are caught and displayed without crashing. Browser data is specific to the browser and origin; there is no backup or cross-device sync. Future schema changes require a migration or new versioned key.

## Git

This folder has a separate repository on main. Dependencies, build output, logs, credentials, and .env files are ignored. Feature changes should remain uncommitted until reviewed.

## Projects

Names are required and trimmed; optional client names are trimmed. Older projects without `clientName` remain valid. Hourly rates use nonnegative USD decimals with at most two decimal places (no exponents, separators, or signs). Blank rates default to zero cents. Decimal strings are converted directly to integer cents without floating-point rounding. IDs use `crypto.randomUUID()` and remain unchanged on edit, archive, or restore. Edits preserve descriptions and other metadata. ISO `updatedAt` timestamps are refreshed on changes, without moving backward if the clock changes.

Archived projects are retained and can still be edited. Archiving never removes sessions, payments, or their references. All operations go through the existing provider; storage warnings stay visible and invalid saved data is never overwritten. Successful updates in memory do not imply persistence when storage is unavailable.

## Work Timer

Choose an active project to start one timer. The active timer is saved immediately through the provider. The display uses `floor((Date.now() - startedAt) / 1000)` and formats hours, minutes, and seconds; hours can exceed 24. A refresh or background delay does not reset elapsed time. Intervals only refresh the display, and focus/visibility events refresh it when returning to the tab. Navigating to another section leaves the timer running.

For a valid elapsed time of at least one second, Stop records one WorkSession and clears the matching active timer in a single provider update and storage write. The timer ID becomes the session ID. Repeated Stop calls and stale handlers cannot duplicate sessions or stop a newer timer. No-op updates do not trigger storage writes. The optional note is trimmed and stored in the existing `notes` field as an empty string when omitted. Note drafts are local to the Timer page and are lost on navigation or reload until Stop saves them.

Archived projects cannot start another timer, but an already-running timer can finish after its project is archived. Project IDs remain attached to sessions. If a project is unavailable, the timer and history show its ID rather than discarding the reference. Recent sessions show the ten latest starts, local dates/times, duration, and notes.

Malformed saved timestamps follow the existing invalid-data path: saved content remains untouched, persistence is disabled, and the storage notice is displayed. Structurally valid future start timestamps remain loaded. Stop always clears a matching active timer immediately: if less than one second has elapsed, or timestamps are invalid or in the future, it saves no session. The cleared timer is persisted through the provider, and an accessible status message explains why no session was saved. At or after one full second, Stop records exactly one session. Repeated Stop performs no additional storage write and cannot create duplicates. Existing v1 zero-duration sessions remain valid and are preserved; new timer sessions require at least one second. Storage failures still leave in-memory changes available and display the existing warning.

Limitations: use a single Work Tracker tab; separate tabs do not synchronize or merge state and can overwrite each other's changes. Timing uses the device wall clock, so clock corrections can affect elapsed time; there is no server clock, pause, or manual time correction. If storage fails, timers and sessions remain in memory, the warning stays visible, and reloading may lose unsaved changes or restore an older persisted timer. Browser storage is not a backup. There is no automatic stopping when the browser closes.

## Income

Income records only payments actually received. Amounts are USD only, regardless of the general currency setting; there is no currency conversion. Required amounts accept positive decimal strings with at most two decimal places and convert directly to safe integer cents without floating-point rounding. Blank, zero, negative, exponent, separator, and unsafe amounts are rejected. The recorded total sums only `incomeEntries`, using BigInt so multiple large valid payments cannot lose precision; totals are displayed as exact USD decimals. Sessions and project hourly rates never count as payments.

Received date defaults to today's local calendar date using local date components, not UTC slicing. New records store that day as `receivedDate` and an ISO `receivedAt` representing local noon on that day. Noon avoids typical DST transitions; a skipped calendar day is rejected. Since the user supplies a date, the timestamp does not claim an exact payment time. Date input, display, and sorting use the stored calendar day so changing time zones does not move the recorded day. Records appear newest received day first, then newest creation timestamp for ties.

Payments may reference active or archived projects, or have no project. Archived names remain visible, and unavailable historical references are retained on edit unless explicitly changed. Optional notes are trimmed. Editing preserves stable IDs, creation timestamps, and metadata; `updatedAt` is refreshed. Cancel only discards the form draft. Remove requires an explicit confirmation; Cancel leaves data and storage unchanged. Confirming removal updates the recorded total and cannot be undone.

Existing v1 `paidDate`/`description` entries remain valid and are displayed without a startup migration. Editing an old entry adds the new fields while retaining metadata; `receivedDate` and `notes` then drive its display. All changes use the existing provider and persistence flow. Invalid saved data remains untouched, and unavailable storage displays the existing warning. Draft forms are not persisted and are lost on navigation or reload.

## Focused checks

Run `node src/lib/storage.test.js` to check record validation, saved-data preservation, storage failures, and immutable consecutive provider-store updates.
Run `node src/features/projects/projectModel.test.js` for rate boundaries, project lifecycle, reload persistence, and storage warning preservation.
Run `node src/features/timer/timerModel.test.js` for elapsed time after refresh/background delays, start/stop persistence, duplicate Stop protection, archived projects, timestamp validation, and storage failures.
Run `node src/app/navigation.test.js` for hash sections, initial/reload snapshots, history changes, unknown-hash fallback, and subscription cleanup.
Run `node src/features/income/incomeModel.test.js` for amount limits, dates, project references, create/edit/remove, exact totals, legacy compatibility, persistence, and failure notices. Date checks can also run with different process `TZ` values, such as America/Los_Angeles, Europe/Warsaw, and Pacific/Kiritimati.
