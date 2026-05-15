# CLAUDE.md — CronLens

Instructions for Claude Code (and any AI assistant) working in this repo.

---

## What this is

A standalone Vue 3 + TypeScript app that visualises `django-celery-beat` periodic
tasks as an interactive timeline and weekly calendar. It fetches data from a Django
REST API and renders it without any server-side rendering.

---

## Stack

| Layer     | Choice                                                                      |
|-----------|-----------------------------------------------------------------------------|
| Framework | Vue 3 (Composition API, `<script setup>`)                                   |
| Language  | TypeScript (strict)                                                         |
| Build     | Vite 8                                                                      |
| State     | Pinia (`useCronLensStore`)                                                  |
| Routing   | Vue Router 5 (single route `/`)                                             |
| Styling   | Scoped `<style>` blocks + CSS custom properties. No Tailwind, no CSS-in-JS. |
| Tests     | None yet — add Vitest if needed                                             |

---

## Project structure

```
src/
  types/index.ts              — all shared TypeScript interfaces
  composables/
    useSchedule.ts            — cron parsing, API fetch, demo data
  stores/
    scheduleStore.ts          — Pinia store: groups, filters, UI state
  components/schedule/
    TimelineView.vue          — 24h horizontal timeline
    TimelineRow.vue           — single task row inside TimelineView
    CalendarView.vue          — Mon–Sun week calendar
    TaskTooltip.vue           — floating hover tooltip (Teleport to body)
    GroupEditor.vue           — modal for managing custom groups
  views/
    CronLensView.vue          — main page, owns toolbar + stats + view switching
  assets/main.css             — global CSS variables (light + dark)
  router/index.ts             — single route
  main.ts                     — app entry point
```

---

## Commands

```bash
yarn dev           # Vite dev server on :5173 (proxies /api to :8000)
yarn build         # type-check + build to dist/
yarn preview       # preview the production build
yarn lint          # oxlint + eslint
```

---

## API

The app expects two endpoints from Django. Full contract is in `API_CONTRACT.md`.

| Method     | Endpoint                    | Description                                  |
|------------|-----------------------------|----------------------------------------------|
| GET        | `/api/schedule/events/`     | All periodic events/tasks with schedule info |
| GET/POST   | `/api/schedule/groups/`     | Custom display groups                        |
| PUT/DELETE | `/api/schedule/groups/:id/` | Update / delete a group                      |

In development the Vite proxy forwards `/api/*` to `http://localhost:8000`.
If the API is unreachable, `useSchedule.ts` falls back to hardcoded demo data
(only in `import.meta.env.DEV`).

---

## CSS variables

All components use CSS custom properties defined in `src/assets/main.css`.
Never hardcode colours. The full set:

```
--bs-bg             page background
--bs-surface        slightly off-white / off-black surface
--bs-text           primary text
--bs-text-muted     secondary text
--bs-text-faint     hint / placeholder text
--bs-border         default border (translucent)
--bs-border-faint   very subtle divider
--bs-border-strong  emphasis border
--bs-accent         interactive blue (#378ADD)
--bs-success        green (#1D9E75)
--bs-danger         red (#E24B4A)
```

Dark mode is handled automatically via `prefers-color-scheme: dark` in `main.css`.
If the parent app manages dark mode via a class, override the variables there.

---

## Key design decisions

### Frequency tiers
Tasks are split into three bands based on fires-per-day (computed from crontab):
- **very-high** ≥ rendered as a solid colour band (e.g. `*/2` runs 720×/day)
- **high** ≥ day — individual tick marks per fire
- **specific** < 4/day — individual ticks, shown with fire times in calendar

### One-off tasks
Tasks with `one_off = true` or `schedule.type === 'clocked'` are plotted only at
their `last_run_at` datetime. If `last_run_at` is null they show as "never ran".

### Groups
Groups map task *function names* (the `task` field, e.g. `analyze_images`) to a
display name and colour. They are stored in:
1. **localStorage** (`cronlens_groups_v1`) — written on every change, read
   first for instant load
2. **Django API** (`/api/schedule/groups/`) — fetched after localStorage is
   shown; response overwrites localStorage

All group mutations are optimistic: the UI updates immediately, then the API call
happens in the background.

### Timezone
The `useLocalTime` toggle (in Pinia store) converts all displayed minute-of-day
values by adding `localOffsetMins()` = `-new Date().getTimezoneOffset()`.
UTC datetime strings from the API are always parsed with `new Date(isoString)` which
is always UTC-correct regardless of the toggle.

---

## Adding features — guidelines

### Adding a new view
1. Create `src/components/schedule/MyView.vue`
2. Add `'myview'` to the `ViewMode` union in `src/types/index.ts`
3. Add a button in `CronLensView.vue` toolbar and a `v-if` block in the template

### Adding a new filter
1. Add a `ref` to `scheduleStore.ts`
2. Add filter logic inside `filteredEvents()` in the store
3. Add the control to the toolbar in `CronLensView.vue`

### Changing default groups
Edit the `DEFAULT_GROUPS` array in `src/stores/scheduleStore.ts`.
The `kinds` values must match the `kind` field in the API response exactly.

### Modifying the API shape
Update `src/types/index.ts` first, then update `useSchedule.ts`, then update
`API_CONTRACT.md` so the Django side stays in sync.

---

## What NOT to do

- Do not add a CSS framework (Tailwind, Bootstrap, etc.) — styling is intentionally
  minimal and uses CSS custom properties throughout
- Do not use `any` in TypeScript — fix the type properly
- Do not fetch inside components — all API calls go through `useSchedule.ts` or the
  Pinia store
- Do not use `localStorage` outside of `scheduleStore.ts`
- Do not use `position: fixed` inside scoped component styles — it breaks Teleport
  stacking. Use `Teleport to="body"` for overlays
- Do not add dependencies without a clear reason — current zero-dependency approach
  (besides Vue/Pinia/Router) is intentional

---

## Django backend

Built separately. See `API_CONTRACT.md` for the full spec.

Quick model reference:
```python
class ScheduleGroup(models.Model):
    name        = models.CharField(max_length=100)
    color       = models.CharField(max_length=7)   # hex, e.g. "#378ADD"
    kinds  = models.JSONField(default=list)    # list of event kind values
    description = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
```

The tasks endpoint joins `PeriodicTask` with `CrontabSchedule`, `IntervalSchedule`,
and `ClockedSchedule`. All datetimes must be UTC ISO 8601 with `Z` suffix.
