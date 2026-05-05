// src/types/index.ts

// ── Core event model ──────────────────────────────────────────────────────────
//
// A ScheduledEvent is the canonical unit the UI works with.
// Backends (beat, cron, APScheduler, whatever) map their native model to this.

export interface ScheduledEvent {
  // Identity
  id: string | number // unique within the response; opaque to the UI
  name: string // human display name
  kind: string // opaque string used for group matching, e.g. "analyze_images"
  // for beat this is the task function name; for other backends
  // it's whatever logical category the backend assigns

  // State
  enabled: boolean
  recurrence: "recurring" | "one_off" | "clocked"
  // recurring  — fires on a repeating schedule (cron, interval, solar…)
  // one_off    — ran once, not scheduled again; plot at last_run_at only
  // clocked    — scheduled for a single future/past datetime

  // Timing — all times are UTC minutes-of-day (0–1439)
  // The backend does all schedule expansion; the frontend only renders numbers.
  fires_utc: number[] // sorted, deduplicated minute-of-day values for a 24h window
  // empty for one_off / clocked events
  fires_on_days: number[] | null // which days-of-week fire: [0=Sun … 6=Sat], null = every day
  // null when fires_utc is empty

  // Run history
  last_run_at: string | null // ISO 8601 UTC, or null if never run
  total_run_count: number

  // Display
  schedule_display: string // human-readable schedule description, e.g.
  // "every 5 minutes", "daily at 03:00", "once at 2026-03-26 12:00"
  // shown as-is in tooltip; backend controls the wording

  // Filterable metadata — backend decides what to expose and which fields are filterable
  attributes: EventAttribute[]
}

export interface EventAttribute {
  key: string // e.g. "asset_id", "metering_point_id", "portfolio"
  value: string // always a string; backend serialises non-strings
  filterable: boolean // if true, this attribute appears in the filter dropdown
  label?: string // optional human label; falls back to key if absent
}

// ── Groups ────────────────────────────────────────────────────────────────────
//
// Groups map event `kind` values to a display name + colour.
// A single group can cover multiple kind values.

export interface ScheduleGroup {
  id: string
  name: string
  color: string // hex, e.g. "#378ADD"
  kinds: string[] // list of `kind` values that belong to this group
  // (for beat: task function names)
  description: string
}

// ── API response envelopes ────────────────────────────────────────────────────

export interface EventsResponse {
  events: ScheduledEvent[]
  meta?: ResponseMeta // optional; enriches the UI but not required
}

export interface ResponseMeta {
  source?: string // e.g. "django-celery-beat", "apscheduler", "custom"
  source_url?: string // link to the source system's admin UI (if any)
  generated_at?: string // ISO 8601 UTC — when this snapshot was produced
  timezone?: string // the "native" timezone of the source system, e.g. "Europe/Amsterdam"
  // shown in the UI as context; does NOT affect time display
  // (the UTC/local toggle controls that)
}

export interface GroupsResponse {
  groups: ScheduleGroup[]
}

// ── UI types ──────────────────────────────────────────────────────────────────

export type FrequencyTier = "very-high" | "high" | "specific"
export type ViewMode = "timeline" | "calendar"
