// src/stores/scheduleStore.ts
import { defineStore } from "pinia"
import { ref, computed } from "vue"
import type {
  ScheduleGroup,
  ScheduledEvent,
  FrequencyTier,
  ViewMode,
} from "@/types"
import { getAttribute } from "@/composables/useSchedule"

const API_BASE = import.meta.env.VITE_API_BASE ?? ""
const LS_KEY = "cronlens_groups_v1"

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
  const searchQuery = ref("")
  const activeGroupIds = ref<Set<string>>(new Set())
  const attrFilterKey = ref<string | null>(null)
  const attrFilterVal = ref("")
  const timelineDayOffset = ref(0)

  function toggleGroupId(id: string) {
    if (activeGroupIds.value.has(id)) {
      activeGroupIds.value.delete(id)
    } else {
      activeGroupIds.value.add(id)
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

  function frequencyTierOf(event: ScheduledEvent): FrequencyTier {
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

    if (attrFilterKey.value && attrFilterVal.value.trim()) {
      const key = attrFilterKey.value
      const val = attrFilterVal.value.trim().toLowerCase()
      list = list.filter((e) => {
        const attr = getAttribute(e, key)
        return attr ? attr.value.toLowerCase().includes(val) : false
      })
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
    searchQuery,
    activeGroupIds,
    toggleGroupId,
    attrFilterKey,
    attrFilterVal,
    timelineDayOffset,
    filteredEvents,
  }
})
