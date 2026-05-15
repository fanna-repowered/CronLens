// src/stores/scheduleStore.ts
import { defineStore } from "pinia"
import { ref, computed, watch } from "vue"
import type {
  ScheduleGroup,
  ScheduledEvent,
  FrequencyTier,
  ViewMode,
} from "@/types"

const API_BASE = import.meta.env.VITE_API_BASE ?? ""
const LS_KEY = "cronlens_groups_v1"
const LS_SETTINGS_KEY = "cronlens_settings_v1"

// Default groups expressed in terms of `kind` values, not beat-specific names.
// When adapting to another backend, update `kinds` to match its kind strings.
const DEFAULT_GROUPS: ScheduleGroup[] = [
  {
    id: "default-images",
    name: "Images",
    color: "#378ADD",
    kinds: [
      "analyze_image",
      "increase_image_quality",
      "run_image_generation",
      "run_image_processor",
      "mark_images",
      "convert_png_to_svg",
    ],
    description: "Image processing tasks",
  },
  {
    id: "default-text",
    name: "Text",
    color: "#1D9E75",
    kinds: [
      "analyze_text",
      "improve_spelling",
      "run_text_generation",
      "run_text_processor",
      "mark_text",
      "convert_pdf_to_txt",
    ],
    description: "Text processing tasks",
  },
  {
    id: "default-linking",
    name: "Linker",
    color: "#BA7517",
    kinds: ["run_linking_algorithm", "run_handwriting_algorithm"],
    description: "Link related text and handwriting",
  },
  {
    id: "Identifier",
    name: "Socials / Faces",
    color: "#D4537E",
    kinds: [
      "run_socials_identifier",
      "monitor_images_socials",
      "extract_faces",
    ],
    description: "Check social media content and faces in images",
  },
]

function getCsrf(): string {
  return (
    document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("csrftoken="))
      ?.split("=")[1] ?? ""
  )
}

export const useCronLensStore = defineStore("schedule", () => {
  // ── Groups ──────────────────────────────────────────────────────────────────

  const groups = ref<ScheduleGroup[]>([])
  const syncing = ref(false)

  function loadLocal(): boolean {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        groups.value = JSON.parse(raw)
        return true
      }
    } catch {
      /* ignore */
    }
    return false
  }

  function persistLocal() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(groups.value))
    } catch {
      /* quota */
    }
  }

  async function fetchGroups() {
    const hadLocal = loadLocal()
    if (!hadLocal) groups.value = DEFAULT_GROUPS
    try {
      const r = await fetch(`${API_BASE}/api/schedule/groups/`)
      if (!r.ok) throw new Error()
      const data = await r.json()
      groups.value = data.groups
      persistLocal()
    } catch {
      if (!hadLocal) persistLocal()
    }
  }

  async function createGroup(payload: Omit<ScheduleGroup, "id">) {
    const optimistic: ScheduleGroup = { ...payload, id: `local-${Date.now()}` }
    groups.value.push(optimistic)
    persistLocal()
    try {
      syncing.value = true
      const r = await fetch(`${API_BASE}/api/schedule/groups/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrf(),
        },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error()
      const created: ScheduleGroup = await r.json()
      const idx = groups.value.findIndex((g) => g.id === optimistic.id)
      if (idx !== -1) groups.value[idx] = created
      persistLocal()
    } catch {
      /* keep optimistic */
    } finally {
      syncing.value = false
    }
  }

  async function updateGroup(id: string, payload: Partial<ScheduleGroup>) {
    const idx = groups.value.findIndex((g) => g.id === id)
    if (idx === -1) return
    groups.value[idx] = { ...groups.value[idx]!, ...payload }
    persistLocal()
    try {
      syncing.value = true
      await fetch(`${API_BASE}/api/schedule/groups/${id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrf(),
        },
        body: JSON.stringify(payload),
      })
    } catch {
      /* optimistic */
    } finally {
      syncing.value = false
    }
  }

  async function deleteGroup(id: string) {
    groups.value = groups.value.filter((g) => g.id !== id)
    persistLocal()
    try {
      await fetch(`${API_BASE}/api/schedule/groups/${id}/`, {
        method: "DELETE",
        headers: { "X-CSRFToken": getCsrf() },
      })
    } catch {
      /* optimistic */
    }
  }

  function resetToDefaults() {
    groups.value = DEFAULT_GROUPS
    persistLocal()
  }

  function groupForEvent(event: ScheduledEvent): ScheduleGroup | null {
    return groups.value.find((g) => g.kinds.includes(event.kind)) ?? null
  }

  function colorForEvent(event: ScheduledEvent): string {
    return groupForEvent(event)?.color ?? "#888780"
  }

  // ── UI state ────────────────────────────────────────────────────────────────

  const view = ref<ViewMode>("calendar")
  const useLocalTime = ref(true)
  const includeDisabled = ref(false)
  const searchQuery = ref("")
  const activeGroupIds = ref<Set<string>>(new Set())
  const excludedGroupIds = ref<Set<string>>(new Set())
  const attrFilterKey = ref("")
  const attrFilterVal = ref("")
  const timelineDayOffset = ref(0)
  const weekOffset = ref(0)

  const currentWeekRange = computed(() => {
    const base = new Date()
    if (view.value === "calendar") {
      base.setDate(base.getDate() + weekOffset.value * 7)
    } else {
      base.setDate(base.getDate() + timelineDayOffset.value)
    }
    const mon = new Date(base)
    mon.setDate(base.getDate() - ((base.getDay() + 6) % 7))
    mon.setHours(0, 0, 0, 0)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    return {
      from: mon.toLocaleDateString("sv"),
      to: sun.toLocaleDateString("sv"),
    }
  })

  function toggleGroupId(id: string) {
    excludedGroupIds.value.delete(id)
    if (activeGroupIds.value.has(id)) {
      activeGroupIds.value.delete(id)
    } else {
      activeGroupIds.value.add(id)
    }
  }

  function toggleExcludeGroupId(id: string) {
    activeGroupIds.value.delete(id)
    if (excludedGroupIds.value.has(id)) {
      excludedGroupIds.value.delete(id)
    } else {
      excludedGroupIds.value.add(id)
    }
  }

  // ── Settings persistence ─────────────────────────────────────────────────────

  function loadSettings() {
    try {
      const raw = localStorage.getItem(LS_SETTINGS_KEY)
      if (!raw) return
      const s = JSON.parse(raw)
      if (typeof s.veryHighThreshold === "number")
        veryHighThreshold.value = s.veryHighThreshold
      if (typeof s.highThreshold === "number")
        highThreshold.value = s.highThreshold
      if (typeof s.zoomSnapValue === "number")
        zoomSnapValue.value = s.zoomSnapValue
      if (s.zoomSnapUnit === "min" || s.zoomSnapUnit === "hour")
        zoomSnapUnit.value = s.zoomSnapUnit
      if (s.view) view.value = s.view
      if (typeof s.useLocalTime === "boolean")
        useLocalTime.value = s.useLocalTime
      if (typeof s.includeDisabled === "boolean")
        includeDisabled.value = s.includeDisabled
    } catch {
      /* ignore */
    }
  }

  function persistSettings() {
    try {
      localStorage.setItem(
        LS_SETTINGS_KEY,
        JSON.stringify({
          veryHighThreshold: veryHighThreshold.value,
          highThreshold: highThreshold.value,
          zoomSnapValue: zoomSnapValue.value,
          zoomSnapUnit: zoomSnapUnit.value,
          view: view.value,
          useLocalTime: useLocalTime.value,
          includeDisabled: includeDisabled.value,
        }),
      )
    } catch {
      /* quota */
    }
  }

  // ── Frequency tiers ──────────────────────────────────────────────────────────

  const veryHighThreshold = ref(60)
  const highThreshold = ref(4)

  // ── Zoom snap ────────────────────────────────────────────────────────────────

  const zoomSnapValue = ref(1)
  const zoomSnapUnit = ref<"min" | "hour">("hour")
  const zoomSnapMins = computed(() =>
    zoomSnapUnit.value === "hour"
      ? zoomSnapValue.value * 60
      : zoomSnapValue.value,
  )

  // ── Zoom range ───────────────────────────────────────────────────────────────

  const zoomStart = ref<number | null>(null)
  const zoomEnd = ref<number | null>(null)

  function resetZoom() {
    zoomStart.value = null
    zoomEnd.value = null
    zoomSnapValue.value = 1
    zoomSnapUnit.value = "hour"
  }

  loadSettings()
  watch(
    [
      veryHighThreshold,
      highThreshold,
      zoomSnapValue,
      zoomSnapUnit,
      view,
      useLocalTime,
      includeDisabled,
    ],
    persistSettings,
  )

  function frequencyTierOf(event: ScheduledEvent): FrequencyTier {
    if (!event.last_run_at) return "never-ran"
    const n = event.fires_utc.length
    if (n >= veryHighThreshold.value) return "very-high"
    if (n >= highThreshold.value) return "high"
    return "specific"
  }

  // ── Filtering ───────────────────────────────────────────────────────────────

  function filteredEvents(events: readonly ScheduledEvent[]): ScheduledEvent[] {
    let list: ScheduledEvent[] = [...events]

    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.kind.toLowerCase().includes(q) ||
          e.schedule_display.toLowerCase().includes(q),
      )
    }

    if (activeGroupIds.value.size > 0) {
      const selectedKinds = new Set(
        groups.value
          .filter((g) => activeGroupIds.value.has(g.id))
          .flatMap((g) => g.kinds),
      )
      list = list.filter((e) => selectedKinds.has(e.kind))
    }

    if (excludedGroupIds.value.size > 0) {
      const excludedKinds = new Set(
        groups.value
          .filter((g) => excludedGroupIds.value.has(g.id))
          .flatMap((g) => g.kinds),
      )
      list = list.filter((e) => !excludedKinds.has(e.kind))
    }

    return list
  }

  return {
    // groups
    groups,
    syncing,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    resetToDefaults,
    groupForEvent,
    colorForEvent,
    // frequency tiers
    veryHighThreshold,
    highThreshold,
    frequencyTierOf,
    zoomSnapValue,
    zoomSnapUnit,
    zoomSnapMins,
    zoomStart,
    zoomEnd,
    resetZoom,
    // ui state
    view,
    useLocalTime,
    includeDisabled,
    searchQuery,
    activeGroupIds,
    excludedGroupIds,
    toggleGroupId,
    toggleExcludeGroupId,
    attrFilterKey,
    attrFilterVal,
    timelineDayOffset,
    weekOffset,
    currentWeekRange,
    filteredEvents,
  }
})
