// src/composables/useSchedule.ts
import { ref, computed } from "vue"
import type { ScheduledEvent, FrequencyTier, EventAttribute } from "@/types"

const API_BASE = import.meta.env.VITE_API_BASE ?? ""

// ── Frequency tier ────────────────────────────────────────────────────────────
// Derived entirely from fires_utc.length — no schedule-type knowledge needed.

export function frequencyTier(event: ScheduledEvent): FrequencyTier {
  const n = event.fires_utc.length
  if (n >= 60) return "very-high"
  if (n >= 4) return "high"
  return "specific"
}

// ── Timezone helpers ──────────────────────────────────────────────────────────

export function localOffsetMins(): number {
  return -new Date().getTimezoneOffset()
}

/** Convert a UTC minute-of-day to display minute (UTC or browser-local). */
export function toDisplayMinute(utcMinute: number, useLocal: boolean): number {
  if (!useLocal) return ((utcMinute % 1440) + 1440) % 1440
  return (((utcMinute + localOffsetMins()) % 1440) + 1440) % 1440
}

export function fmtMinute(m: number): string {
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

/** Convert a fires_utc array to display minutes (applying tz offset if needed). */
export function displayFires(
  event: ScheduledEvent,
  useLocal: boolean,
): number[] {
  return event.fires_utc.map((m) => toDisplayMinute(m, useLocal))
}

// ── Attribute helpers ─────────────────────────────────────────────────────────

/** All attributes marked filterable across a list of events, deduplicated by key. */
export function filterableAttributes(events: ScheduledEvent[]): string[] {
  const keys = new Set<string>()
  for (const e of events)
    for (const a of e.attributes) if (a.filterable) keys.add(a.key)
  return [...keys].sort()
}

/** Find a specific attribute value on an event, or undefined. */
export function getAttribute(
  event: ScheduledEvent,
  key: string,
): EventAttribute | undefined {
  return event.attributes.find((a) => a.key === key)
}

// ── Day-of-week check ─────────────────────────────────────────────────────────

/** Returns true if the event fires on the given JS day-of-week (0=Sun). */
export function firesOnDay(event: ScheduledEvent, dayOfWeek: number): boolean {
  if (!event.fires_utc.length) return false // one_off / clocked — handled separately
  if (event.fires_on_days === null) return true // fires every day
  return event.fires_on_days.includes(dayOfWeek)
}

// ── Demo data ─────────────────────────────────────────────────────────────────
// Used as DEV fallback when the API is unreachable.
// Mirrors realistic beat data but expressed in the generalised contract.

const DEMO_EVENTS: ScheduledEvent[] = [
  {
    id: 1947489,
    name: "Analyze stock Images",
    kind: "analyze_image",
    enabled: true,
    recurrence: "recurring",
    fires_utc: Array.from({ length: 288 }, (_, i) => i * 5), // every 5 min = 288/day
    fires_on_days: null,
    last_run_at: "2026-05-05T14:00:00Z",
    total_run_count: 1200,
    schedule_display: "every 5 minutes",
    attributes: [],
  },
  {
    id: 29616,
    name: "Generate images",
    kind: "run_image_generation",
    enabled: true,
    recurrence: "recurring",
    fires_utc: [360], // 06:00 UTC
    fires_on_days: null,
    last_run_at: "2026-05-05T06:00:00Z",
    total_run_count: 30,
    schedule_display: "daily at 06:00",
    attributes: [],
  },
  {
    id: 268349,
    name: "Increase quality of low res image",
    kind: "increase_image_quality",
    enabled: true,
    recurrence: "one_off",
    fires_utc: [],
    fires_on_days: null,
    last_run_at: "2025-11-03T09:00:00Z",
    total_run_count: 1,
    schedule_display: "once — ran 2025-11-03 09:00",
    attributes: [
      { key: "res_min_dpi", value: "100", filterable: false },
      { key: "res_ax_dpi", value: "200", filterable: false },
      { key: "full_ai_mode", value: "1", filterable: false },
    ],
  },
  {
    id: 1736228,
    name: "Monitor public images social media",
    kind: "monitor_images_socials",
    enabled: true,
    recurrence: "recurring",
    fires_utc: [0, 240, 480, 720, 960, 1200], // every 4h
    fires_on_days: null,
    last_run_at: "2026-05-05T08:00:00Z",
    total_run_count: 200,
    schedule_display: "every 4 hours",
    attributes: [{ key: "person_id", value: "967", filterable: true }],
  },
  {
    id: 966454,
    name: "Text marking",
    kind: "mark_text",
    enabled: true,
    recurrence: "recurring",
    fires_utc: Array.from({ length: 24 }, (_, i) => i * 60),
    fires_on_days: null,
    last_run_at: "2026-05-05T13:00:00Z",
    total_run_count: 500,
    schedule_display: "every hour at :00",
    attributes: [
      { key: "max_markers", value: "10", filterable: false },
      { key: "marker_ids", value: "1337, 37, 73", filterable: true },
    ],
  },
  {
    id: 496266,
    name: "Convert pdfs to txt",
    kind: "convert_pdf_to_txt",
    enabled: true,
    recurrence: "recurring",
    fires_utc: [330], // 05:30
    fires_on_days: null,
    last_run_at: "2026-05-05T05:30:00Z",
    total_run_count: 90,
    schedule_display: "daily at 05:30",
    attributes: [],
  },
  {
    id: 496265,
    name: "Convert pngs to svg",
    kind: "convert_png_to_svg",
    enabled: true,
    recurrence: "recurring",
    fires_utc: [180], // 03:00
    fires_on_days: null,
    last_run_at: "2026-05-05T03:00:00Z",
    total_run_count: 90,
    schedule_display: "daily at 03:00",
    attributes: [],
  },
  {
    id: 29785,
    name: "General image processor Alice",
    kind: "run_image_processor",
    enabled: true,
    recurrence: "recurring",
    fires_utc: [60], // 01:00
    fires_on_days: null,
    last_run_at: "2026-05-05T01:00:00Z",
    total_run_count: 60,
    schedule_display: "daily at 01:00",
    attributes: [{ key: "image_pool_id", value: "329", filterable: true }],
  },
  {
    id: 29786,
    name: "General image processor Bob",
    kind: "run_image_processor",
    enabled: true,
    recurrence: "recurring",
    fires_utc: [75], // 01:15
    fires_on_days: null,
    last_run_at: "2026-05-05T01:15:00Z",
    total_run_count: 60,
    schedule_display: "daily at 01:15",
    attributes: [{ key: "image_pool_id", value: "292", filterable: true }],
  },
  {
    id: 30264,
    name: "Spelling improver",
    kind: "improve_spelling",
    enabled: true,
    recurrence: "recurring",
    fires_utc: [240], // 04:00
    fires_on_days: null,
    last_run_at: "2026-05-05T04:00:00Z",
    total_run_count: 12,
    schedule_display: "daily at 04:00",
    attributes: [],
  },
  {
    id: 1504295,
    name: "Analyze text",
    kind: "analyze_text",
    enabled: true,
    recurrence: "recurring",
    fires_utc: [120], // 02:00
    fires_on_days: null,
    last_run_at: "2026-05-05T02:00:00Z",
    total_run_count: 365,
    schedule_display: "daily at 02:00",
    attributes: [],
  },
  {
    id: 93738,
    name: "Texts by Chris",
    kind: "run_linking_algorithm",
    enabled: true,
    recurrence: "recurring",
    fires_utc: Array.from({ length: 144 }, (_, i) => i * 10),
    fires_on_days: null,
    last_run_at: "2026-05-05T13:50:00Z",
    total_run_count: 5000,
    schedule_display: "every 10 minutes",
    attributes: [{ key: "person_id", value: "957", filterable: true }],
  },
  {
    id: 93747,
    name: "Texts by Daphne",
    kind: "run_linking_algorithm",
    enabled: true,
    recurrence: "recurring",
    fires_utc: Array.from({ length: 144 }, (_, i) => i * 10),
    fires_on_days: null,
    last_run_at: "2026-05-05T13:50:00Z",
    total_run_count: 5000,
    schedule_display: "every 10 minutes",
    attributes: [{ key: "person_id", value: "966", filterable: true }],
  },
  {
    id: 30684,
    name: "Texts by Eddy",
    kind: "run_linking_algorithm",
    enabled: true,
    recurrence: "recurring",
    fires_utc: Array.from({ length: 720 }, (_, i) => i * 2),
    fires_on_days: null,
    last_run_at: "2026-05-05T13:58:00Z",
    total_run_count: 25000,
    schedule_display: "every 2 minutes",
    attributes: [{ key: "person_id", value: "809", filterable: true }],
  },
  {
    id: 22321,
    name: "Handwriting recognition Fiona",
    kind: "run_handwriting_algorithm",
    enabled: true,
    recurrence: "recurring",
    fires_utc: [420], // 07:00
    fires_on_days: null,
    last_run_at: null,
    total_run_count: 0,
    schedule_display: "daily at 07:00",
    attributes: [{ key: "person_id", value: "14", filterable: true }],
  },
  {
    id: 1386814,
    name: "Face extractor Fiona",
    kind: "extract_faces",
    enabled: false,
    recurrence: "clocked",
    fires_utc: [],
    fires_on_days: null,
    last_run_at: "2026-03-26T12:00:00Z",
    total_run_count: 1,
    schedule_display: "once at 2026-03-26 12:00",
    attributes: [
      { key: "person_id", value: "14", filterable: true },
      { key: "handwriting_profile_id", value: "105", filterable: false },
    ],
  },
  // Social identifiers tasks
  ...(
    [
      "Alice",
      "Bob",
      "Chris",
      "Daphne",
      "Eddy",
      "Fiona",
      "Gerald",
      "Henry",
      "Iris",
      "Jeanine",
      "Kal",
      "Lenny",
      "Moana",
      "Neo",
    ] as const
  ).map((name, i) => ({
    id: 10000 + i,
    name: `${name} — SOCIAL`,
    kind: "run_socials_identifier" as string,
    enabled: true,
    recurrence: "recurring" as const,
    fires_utc: Array.from(
      { length: 24 },
      (_, h) => h * 60 + ((i * 3 + 2) % 60),
    ),
    fires_on_days: null,
    last_run_at: "2026-05-05T13:00:00Z",
    total_run_count: 24,
    schedule_display: `every hour at :${String((i * 3 + 2) % 60).padStart(2, "0")}`,
    attributes: [] as EventAttribute[],
  })),
]

// ── Composable ────────────────────────────────────────────────────────────────

export function useSchedule() {
  const events = ref<ScheduledEvent[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchEvents() {
    loading.value = true
    error.value = null
    try {
      const r = await fetch(`${API_BASE}/api/schedule/events/`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      events.value = data.events
    } catch (e) {
      error.value = (e as Error).message
      if (import.meta.env.DEV) events.value = DEMO_EVENTS
    } finally {
      loading.value = false
    }
  }

  const filterableKeys = computed(() => filterableAttributes(events.value))

  return {
    events: computed(() => events.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    filterableKeys,
    fetchEvents,
  }
}
