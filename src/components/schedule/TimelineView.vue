<template>
  <div class="timeline-wrap">
    <div class="tl-header">
      <div class="tl-label-col">
        <button class="day-nav" title="Previous day" @click="shiftDay(-1)">
          ‹
        </button>
        <button
          class="day-label"
          :class="{ today: isToday }"
          title="Jump to today"
          @click="store.timelineDayOffset = 0"
        >
          {{ dayLabel }}
        </button>
        <button class="day-nav" title="Next day" @click="shiftDay(1)">›</button>
        <button
          v-if="store.zoomStart !== null"
          class="day-nav zoom-reset"
          title="Reset to full day"
          @click="resetZoom"
        >
          24h
        </button>
      </div>
      <div
        class="hours-strip"
        @mousedown.prevent="onStripMousedown"
        @dblclick="resetZoom"
      >
        <div
          v-for="cell in stripCells"
          :key="cell.label"
          class="hour-cell"
          :class="{ major: cell.major, mid: cell.mid }"
        >
          {{ cell.label }}
        </div>
        <!-- drag selection overlay (shows snapped range) -->
        <template v-if="drag.active">
          <div
            class="zoom-select"
            :style="{
              left:
                Math.min(snapFrac(drag.startFrac), snapFrac(drag.endFrac)) *
                  100 +
                '%',
              width:
                Math.abs(snapFrac(drag.endFrac) - snapFrac(drag.startFrac)) *
                  100 +
                '%',
            }"
          />
          <span class="zoom-label">
            {{ fmtMinute(snapMin(Math.min(drag.startFrac, drag.endFrac))) }}–{{
              fmtMinute(snapMin(Math.max(drag.startFrac, drag.endFrac)))
            }}
          </span>
        </template>
      </div>
    </div>

    <div
      class="tl-body"
      :style="{ '--tl-grid-minor': gridMinorCount }"
      @mousemove="onBodyMousemove"
      @mouseleave="cursorMin = null"
    >
      <!-- overlays positioned relative to bars area only (left: 200px) -->
      <div class="bars-overlay">
        <div
          v-if="cursorMin !== null"
          class="cursor-line"
          :style="{ left: pct(cursorMin) }"
        >
          <span class="cursor-label">{{ fmtMinute(cursorMin) }}</span>
        </div>
        <div v-if="isToday" class="now-needle" :style="{ left: nowPct }" />
      </div>

      <template v-if="nonRecurring.length">
        <button class="tier-row tier-label" @click="oneOffOpen = !oneOffOpen">
          <svg
            class="chevron"
            :class="{ open: oneOffOpen }"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M2 3.5l3 3 3-3" />
          </svg>
          one-off (past runs)
        </button>
        <div v-show="oneOffOpen" class="tier-content">
          <div
            v-for="e in nonRecurring"
            :key="e.id"
            class="tl-row"
            @mouseenter="(ev) => onHover(ev, e)"
            @mousemove="(ev) => onHover(ev, e)"
            @mouseleave="onLeave"
          >
            <div class="tl-name" :title="e.name">
              <span class="dot" :class="{ off: !e.enabled }" />
              <span class="name-text">{{ e.name }}</span>
            </div>
            <div class="tl-bars">
              <div
                class="fire-tick"
                :style="{
                  left: oneOffPct(e),
                  background: colorForEvent(e),
                }"
                :title="e.last_run_at!"
              />
            </div>
          </div>
        </div>
      </template>

      <template v-if="specific.length">
        <button
          class="tier-row tier-label"
          @click="scheduledOpen = !scheduledOpen"
        >
          <svg
            class="chevron"
            :class="{ open: scheduledOpen }"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M2 3.5l3 3 3-3" />
          </svg>
          scheduled (&lt;{{ store.highThreshold }}/day)
        </button>
        <div v-show="scheduledOpen" class="config-content layered">
          <TimelineRow
            v-for="e in specific"
            :key="e.id"
            :event="e"
            :color="colorForEvent(e)"
            :use-local="useLocal"
            :display-start="displayStart"
            :display-end="displayEnd"
            @hover="onHover"
            @leave="onLeave"
          />
        </div>
      </template>

      <template v-if="high.length">
        <button
          class="tier-row tier-label"
          @click="frequentOpen = !frequentOpen"
        >
          <svg
            class="chevron"
            :class="{ open: frequentOpen }"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M2 3.5l3 3 3-3" />
          </svg>
          frequent ({{ store.highThreshold }}–{{ store.veryHighThreshold }}/day)
        </button>
        <div v-show="frequentOpen" class="tier-content">
          <TimelineRow
            v-for="e in high"
            :key="e.id"
            :event="e"
            :color="colorForEvent(e)"
            :use-local="useLocal"
            :display-start="displayStart"
            :display-end="displayEnd"
            @hover="onHover"
            @leave="onLeave"
          />
        </div>
      </template>

      <template v-if="veryHigh.length">
        <button class="tier-row tier-label" @click="bandOpen = !bandOpen">
          <svg
            class="chevron"
            :class="{ open: bandOpen }"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M2 3.5l3 3 3-3" />
          </svg>
          constant (&ge;{{ store.veryHighThreshold }}/day)
        </button>
        <div v-show="bandOpen" class="tier-content">
          <TimelineRow
            v-for="e in veryHigh"
            :key="e.id"
            :event="e"
            :color="colorForEvent(e)"
            :use-local="useLocal"
            :display-start="displayStart"
            :display-end="displayEnd"
            @hover="onHover"
            @leave="onLeave"
          />
        </div>
      </template>

      <template v-if="neverRan.length">
        <button
          class="tier-row tier-label"
          @click="neverRanOpen = !neverRanOpen"
        >
          <svg
            class="chevron"
            :class="{ open: neverRanOpen }"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M2 3.5l3 3 3-3" />
          </svg>
          never ran
        </button>
        <div v-show="neverRanOpen" class="tier-content">
          <div
            v-for="e in neverRan"
            :key="e.id"
            class="tl-row"
            @mouseenter="(ev) => onHover(ev, e)"
            @mousemove="(ev) => onHover(ev, e)"
            @mouseleave="onLeave"
          >
            <div class="tl-name" :title="e.name">
              <span class="dot off" />
              <span class="name-text">{{ e.name }}</span>
            </div>
            <div class="tl-bars">
              <span class="no-run">never ran</span>
            </div>
          </div>
        </div>
      </template>

      <div v-if="!events.length" class="empty-state">
        no events match the current filters
      </div>
    </div>

    <TaskTooltip
      :event="hovered.ev"
      :mouse-event="hovered.mouse"
      :use-local="useLocal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from "vue"
import type { ScheduledEvent } from "@/types"
import {
  firesOnDay,
  fmtMinute,
  toDisplayMinute,
} from "@/composables/useSchedule"
import { useCronLensStore } from "@/stores/scheduleStore"
import TimelineRow from "./TimelineRow.vue"
import TaskTooltip from "./TaskTooltip.vue"

const store = useCronLensStore()
const bandOpen = ref(true)
const oneOffOpen = ref(true)
const frequentOpen = ref(true)
const scheduledOpen = ref(true)
const neverRanOpen = ref(true)

const props = defineProps<{
  events: ScheduledEvent[]
  colorForEvent: (e: ScheduledEvent) => string
  useLocal: boolean
}>()

const hovered = reactive<{
  ev: ScheduledEvent | null
  mouse: MouseEvent | null
}>({
  ev: null,
  mouse: null,
})

function onHover(mouse: MouseEvent, ev: ScheduledEvent) {
  hovered.ev = ev
  hovered.mouse = mouse
}

function onLeave() {
  hovered.ev = null
  hovered.mouse = null
}

// Day picker — offset lives in store so CalendarView can set it
const selectedDate = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + store.timelineDayOffset)
  d.setHours(0, 0, 0, 0)
  return d
})

const isToday = computed(() => store.timelineDayOffset === 0)

const dayLabel = computed(() =>
  selectedDate.value.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }),
)

function shiftDay(n: number) {
  store.timelineDayOffset += n
}

// Zoom — state lives in store so settings panel can reset it
const drag = reactive({ active: false, startFrac: 0, endFrac: 0 })
const cursorMin = ref<number | null>(null)

const displayStart = computed(() => store.zoomStart ?? 0)
const displayEnd = computed(() => store.zoomEnd ?? 1440)

// Reset zoom when navigating to a different day
watch(
  () => store.timelineDayOffset,
  () => store.resetZoom(),
)

// Auto-set snap resolution when drag-zoom commits
watch([() => store.zoomStart, () => store.zoomEnd], ([start, end]) => {
  if (start === null || end === null) return
  const range = end - start
  const autoStep = range <= 60 ? 5 : range <= 240 ? 15 : range <= 720 ? 30 : 60
  if (autoStep >= 60) {
    store.zoomSnapValue = autoStep / 60
    store.zoomSnapUnit = "hour"
  } else {
    store.zoomSnapValue = autoStep
    store.zoomSnapUnit = "min"
  }
})

// Grid divisions driven by snap setting
const gridMinorCount = computed(() => {
  const range = displayEnd.value - displayStart.value
  return Math.max(1, Math.round(range / store.zoomSnapMins))
})

function snapToGrid(m: number): number {
  const snap = store.zoomSnapMins
  return Math.round(m / snap) * snap
}

function snapMin(frac: number): number {
  return snapToGrid(
    displayStart.value + frac * (displayEnd.value - displayStart.value),
  )
}

function snapFrac(frac: number): number {
  const m = snapMin(frac)
  return (m - displayStart.value) / (displayEnd.value - displayStart.value)
}

function pct(m: number): string {
  const frac =
    (m - displayStart.value) / (displayEnd.value - displayStart.value)
  return frac * 100 + "%"
}

const stripCells = computed(() => {
  const stepMins = store.zoomSnapMins
  const cells: { label: string; major: boolean; mid: boolean }[] = []
  const first = Math.ceil(displayStart.value / stepMins) * stepMins
  for (let m = first; m < displayEnd.value; m += stepMins) {
    const h = Math.floor(m / 60)
    const min = m % 60
    cells.push({
      label:
        min === 0
          ? String(h).padStart(2, "0")
          : `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
      major: min === 0,
      mid: min !== 0,
    })
  }
  return cells
})

let dragStripRect: DOMRect | null = null

function fracFromClientX(clientX: number): number {
  if (!dragStripRect) return 0
  return Math.max(
    0,
    Math.min(1, (clientX - dragStripRect.left) / dragStripRect.width),
  )
}

function onStripMousedown(e: MouseEvent) {
  dragStripRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  drag.startFrac = fracFromClientX(e.clientX)
  drag.endFrac = drag.startFrac
  drag.active = true
  window.addEventListener("mousemove", onWindowMousemove)
  window.addEventListener("mouseup", onWindowMouseup)
}

function onWindowMousemove(e: MouseEvent) {
  drag.endFrac = fracFromClientX(e.clientX)
}

function onWindowMouseup(e: MouseEvent) {
  window.removeEventListener("mousemove", onWindowMousemove)
  window.removeEventListener("mouseup", onWindowMouseup)
  if (!drag.active) return
  drag.endFrac = fracFromClientX(e.clientX)
  drag.active = false
  const lo = Math.min(drag.startFrac, drag.endFrac)
  const hi = Math.max(drag.startFrac, drag.endFrac)
  const startMin = snapToGrid(
    displayStart.value + lo * (displayEnd.value - displayStart.value),
  )
  const endMin = snapToGrid(
    displayStart.value + hi * (displayEnd.value - displayStart.value),
  )
  if (endMin > startMin) {
    store.zoomStart = Math.max(0, startMin)
    store.zoomEnd = Math.min(1440, endMin)
  }
}

function resetZoom() {
  store.resetZoom()
}

function onBodyMousemove(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const barsLeft = 200
  const x = e.clientX - rect.left - barsLeft
  const barsWidth = rect.width - barsLeft
  if (x < 0 || x > barsWidth) {
    cursorMin.value = null
    return
  }
  cursorMin.value = Math.round(
    displayStart.value +
      (x / barsWidth) * (displayEnd.value - displayStart.value),
  )
}

// Now needle
const nowMin = reactive({ value: getNow() })
let timer: ReturnType<typeof setInterval>

function getNow() {
  const n = new Date()
  return props.useLocal
    ? n.getHours() * 60 + n.getMinutes()
    : n.getUTCHours() * 60 + n.getUTCMinutes()
}

const nowPct = computed(() => pct(nowMin.value))
onMounted(() => {
  timer = setInterval(() => {
    nowMin.value = getNow()
  }, 30_000)
})
onUnmounted(() => {
  clearInterval(timer)
  window.removeEventListener("mousemove", onWindowMousemove)
  window.removeEventListener("mouseup", onWindowMouseup)
})

// Tiers — recurring events filtered to those that fire on the selected day
function hasFireInRange(e: ScheduledEvent): boolean {
  if (store.zoomStart === null) return true
  const start = displayStart.value
  const end = displayEnd.value
  return e.fires_utc.some((utcMin) => {
    const m = toDisplayMinute(utcMin, props.useLocal)
    return m >= start && m <= end
  })
}

const recurring = computed(() =>
  props.events.filter(
    (e) =>
      e.recurrence === "recurring" &&
      firesOnDay(e, selectedDate.value.getDay()) &&
      hasFireInRange(e),
  ),
)
const neverRan = computed(() =>
  store.zoomStart === null ? props.events.filter((e) => !e.last_run_at) : [],
)
const nonRecurring = computed(() => {
  const selectedIso = selectedDate.value.toLocaleDateString("sv")
  return props.events.filter((e) => {
    if (e.recurrence === "recurring" || !e.last_run_at) return false
    const d = new Date(e.last_run_at)
    const iso = props.useLocal
      ? d.toLocaleDateString("sv")
      : d.toISOString().slice(0, 10)
    if (iso !== selectedIso) return false
    if (store.zoomStart !== null) {
      const m = props.useLocal
        ? d.getHours() * 60 + d.getMinutes()
        : d.getUTCHours() * 60 + d.getUTCMinutes()
      return m >= displayStart.value && m <= displayEnd.value
    }
    return true
  })
})
const veryHigh = computed(() =>
  recurring.value.filter((e) => store.frequencyTierOf(e) === "very-high"),
)
const high = computed(() =>
  recurring.value.filter((e) => store.frequencyTierOf(e) === "high"),
)
const specific = computed(() =>
  recurring.value.filter((e) => store.frequencyTierOf(e) === "specific"),
)

function oneOffPct(e: ScheduledEvent): string {
  if (!e.last_run_at) return "0%"
  const d = new Date(e.last_run_at)
  const m = props.useLocal
    ? d.getHours() * 60 + d.getMinutes()
    : d.getUTCHours() * 60 + d.getUTCMinutes()
  return pct(m)
}
</script>

<style scoped>
.timeline-wrap {
  width: 100%;
}

.tl-header {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--bs-surface);
  border-bottom: 0.5px solid var(--bs-border);
}

.tl-label-col {
  width: 200px;
  min-width: 200px;
  border-right: 0.5px solid var(--bs-border);
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 4px 6px;
  gap: 2px;
}

.tl-day-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.day-nav {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--bs-text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
  padding: 0;
}

.day-nav:hover {
  background: var(--bs-border-faint);
  color: var(--bs-text);
}

.day-label {
  flex: 1;
  text-align: center;
  font-size: 11px;
  font-weight: 500;
  color: var(--bs-text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: inherit;
}

.day-label:hover {
  background: var(--bs-border-faint);
  color: var(--bs-text);
}

.day-label.today {
  color: var(--bs-accent);
}

.hours-strip {
  flex: 1;
  display: flex;
  position: relative;
  cursor: col-resize;
  user-select: none;
}

.zoom-select {
  position: absolute;
  top: 0;
  bottom: 0;
  background: var(--bs-accent);
  opacity: 0.25;
  pointer-events: none;
}

.hour-cell {
  flex: 1;
  font-size: 9px;
  color: var(--bs-text-faint);
  font-family: monospace;
  padding: 4px 0 4px 2px;
  border-right: 0.5px solid var(--bs-border-faint);
  min-height: 32px;
  display: flex;
  align-items: flex-end;
  white-space: nowrap;
  overflow: hidden;
}

.hour-cell.mid {
  color: var(--bs-text-faint);
}

.hour-cell.major {
  color: var(--bs-text-muted);
  font-size: 10px;
  font-weight: 600;
  border-right-color: var(--bs-border);
}

.tl-body {
  position: relative;
}

.bars-overlay {
  position: absolute;
  left: 200px;
  right: 0;
  top: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 5;
}

.now-needle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--bs-danger);
  opacity: 0.5;
}

.cursor-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--bs-text-muted);
  opacity: 0.6;
  z-index: 1;
}

.cursor-label {
  position: absolute;
  top: 2px;
  left: 4px;
  font-size: 9px;
  font-family: monospace;
  color: var(--bs-text-muted);
  background: var(--bs-surface);
  padding: 1px 3px;
  border-radius: 2px;
  white-space: nowrap;
}

.zoom-reset {
  font-size: 9px;
  font-weight: 600;
  width: auto;
  padding: 0 4px;
  color: var(--bs-accent);
}

.zoom-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 9px;
  font-family: monospace;
  color: var(--bs-text);
  background: var(--bs-surface);
  padding: 1px 5px;
  border-radius: 3px;
  pointer-events: none;
  white-space: nowrap;
}

.tier-row {
  display: flex;
  border-bottom: 0.5px solid var(--bs-border-faint);
  align-items: flex-start;
}

.tier-row:last-child {
  border-bottom: none;
}

.tier-label {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  text-align: left;
  padding: 7px 12px 3px;
  margin-top: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--bs-text-faint);
  background-color: inherit;
  border: none;
}

.tier-label:hover {
  color: var(--bs-text-muted);
}

.chevron {
  flex-shrink: 0;
  transform: rotate(-90deg);
  transition: transform 0.15s ease;
}

.chevron.open {
  transform: rotate(0deg);
}

.tl-row {
  display: flex;
  border-bottom: 0.5px solid var(--bs-border-faint);
  min-height: 26px;
  align-items: stretch;
  cursor: default;
}

.tl-row:hover {
  background: var(--bs-surface);
}

.tl-name {
  width: 200px;
  min-width: 200px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--bs-text);
  border-right: 0.5px solid var(--bs-border);
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.name-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dot {
  width: 5px;
  height: 5px;
  min-width: 5px;
  border-radius: 50%;
  background: var(--bs-success);
  flex-shrink: 0;
}

.dot.off {
  background: var(--bs-text-faint);
}

.tl-bars {
  flex: 1;
  position: relative;
  overflow: hidden;
  background-image:
    repeating-linear-gradient(
      to right,
      var(--bs-border) 0,
      var(--bs-border) 0.5px,
      transparent 0.5px,
      transparent 100%
    ),
    repeating-linear-gradient(
      to right,
      var(--bs-border-faint) 0,
      var(--bs-border-faint) 0.5px,
      transparent 0.5px,
      transparent 100%
    );
  background-size:
    calc(100% / 4) 100%,
    calc(100% / var(--tl-grid-minor, 24)) 100%;
}

.fire-tick {
  position: absolute;
  width: 2px;
  top: 4px;
  bottom: 4px;
  border-radius: 1px;
  opacity: 0.75;
  transform: translateX(-50%);
}

.tl-row:hover .fire-tick {
  opacity: 1;
}

.no-run {
  font-size: 11px;
  color: var(--bs-text-faint);
  padding-left: 12px;
  font-style: italic;
  line-height: 26px;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--bs-text-muted);
  font-size: 13px;
}
</style>
