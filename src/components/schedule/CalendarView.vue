<template>
  <div class="cal-wrap">
    <div class="cal-nav">
      <button @click="shift(-1)">&#8592;</button>
      <span class="week-label">{{ weekLabel }}</span>
      <button @click="shift(1)">&#8594;</button>
      <button class="today-btn" @click="store.weekOffset = 0">today</button>
    </div>

    <!-- Day header row -->
    <div class="cal-row cal-header-row">
      <div
        v-for="wd in weekData"
        :key="wd.day.iso"
        class="cal-cell"
        :class="{ today: wd.day.isToday }"
      >
        <span class="day-name">{{ wd.day.dayName }}</span>
        <span class="day-num" :class="{ today: wd.day.isToday }">{{
          wd.day.dayNum
        }}</span>
      </div>
    </div>

    <!-- One-off tier -->
    <button class="cal-tier-label" @click="oneOffOpen = !oneOffOpen">
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
    <div v-show="oneOffOpen" class="cal-row">
      <div
        v-for="wd in weekData"
        :key="wd.day.iso"
        class="cal-cell"
        :class="{ today: wd.day.isToday }"
        title="Double-click to open in timeline"
        @dblclick="navigateToDay(wd.day.date)"
      >
        <div
          v-for="e in wd.oneOff"
          :key="e.id"
          class="cal-event one-off"
          :style="{ borderLeft: `2px solid ${colorForEvent(e)}` }"
        >
          <span class="event-time">{{ runTime(e.last_run_at!) }}</span>
          <span class="event-name">{{ e.name }}</span>
        </div>
        <div v-if="!wd.oneOff.length" class="day-empty">—</div>
      </div>
    </div>

    <!-- Scheduled tier -->
    <button class="cal-tier-label" @click="scheduledOpen = !scheduledOpen">
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
      scheduled
    </button>
    <div v-show="scheduledOpen" class="cal-row">
      <div
        v-for="wd in weekData"
        :key="wd.day.iso"
        class="cal-cell"
        :class="{ today: wd.day.isToday }"
        title="Double-click to open in timeline"
        @dblclick="navigateToDay(wd.day.date)"
      >
        <div
          v-for="{ ev, fires } in wd.scheduled"
          :key="ev.id"
          class="cal-event"
          :style="{ borderLeft: `2px solid ${colorForEvent(ev)}` }"
          @mouseenter="(e) => (hovered = { ev, mouse: e })"
          @mousemove="(e) => (hovered = { ev, mouse: e })"
          @mouseleave="hovered = null"
        >
          <span class="event-time">{{ fires.map(fmtMinute).join(" · ") }}</span>
          <span class="event-name">{{ ev.name }}</span>
        </div>
        <div v-if="!wd.scheduled.length" class="day-empty">—</div>
      </div>
    </div>

    <!-- Frequent tier -->
    <button class="cal-tier-label" @click="frequentOpen = !frequentOpen">
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
      frequent
    </button>
    <div v-show="frequentOpen" class="cal-row">
      <div
        v-for="wd in weekData"
        :key="wd.day.iso"
        class="cal-cell"
        :class="{ today: wd.day.isToday }"
        title="Double-click to open in timeline"
        @dblclick="navigateToDay(wd.day.date)"
      >
        <div
          v-for="e in wd.frequent"
          :key="e.id"
          class="cal-pill"
          :style="{
            borderLeft: `2px solid ${colorForEvent(e)}`,
            background: colorForEvent(e) + '15',
          }"
          @mouseenter="(ev) => (hovered = { ev: e, mouse: ev })"
          @mousemove="(ev) => (hovered = { ev: e, mouse: ev })"
          @mouseleave="hovered = null"
        >
          <span class="pill-name">{{ e.name }}</span>
          <span class="pill-count">{{ e.fires_utc.length }}&times;</span>
        </div>
        <div v-if="!wd.frequent.length" class="day-empty">—</div>
      </div>
    </div>

    <!-- Constant tier -->
    <button class="cal-tier-label" @click="constantOpen = !constantOpen">
      <svg
        class="chevron"
        :class="{ open: constantOpen }"
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
      constant
    </button>
    <div v-show="constantOpen" class="cal-row">
      <div
        v-for="wd in weekData"
        :key="wd.day.iso"
        class="cal-cell"
        :class="{ today: wd.day.isToday }"
      >
        <div
          v-for="g in veryHighGroups"
          :key="g.id"
          class="vhigh-badge"
          :style="{
            background: g.color + '20',
            borderColor: g.color + '60',
            color: g.color,
          }"
          :title="g.names.join('\n')"
        >
          {{ g.name }} &times;{{ g.firesPerDay }}/day
        </div>
        <div v-if="!veryHighGroups.length" class="day-empty">—</div>
      </div>
    </div>

    <!-- Never ran tier -->
    <button class="cal-tier-label" @click="neverRanOpen = !neverRanOpen">
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
    <div v-show="neverRanOpen" class="never-ran-section">
      <div v-if="neverRan.length" class="never-ran-list">
        <div
          v-for="e in neverRan"
          :key="e.id"
          class="never-ran-item"
          :style="{ borderLeft: `2px solid ${colorForEvent(e)}` }"
        >
          {{ e.name }}
        </div>
      </div>
      <div v-else class="never-ran-empty">—</div>
    </div>

    <TaskTooltip
      :event="hovered?.ev ?? null"
      :mouse-event="hovered?.mouse ?? null"
      :use-local="useLocal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import type { ScheduledEvent, ScheduleGroup } from "@/types"
import {
  firesOnDay,
  toDisplayMinute,
  fmtMinute,
} from "@/composables/useSchedule"
import { useCronLensStore } from "@/stores/scheduleStore"
import TaskTooltip from "./TaskTooltip.vue"

const store = useCronLensStore()

interface DayMeta {
  date: Date
  iso: string
  dayName: string
  dayNum: number
  dayOfWeek: number
  isToday: boolean
}

const props = defineProps<{
  events: ScheduledEvent[]
  colorForEvent: (e: ScheduledEvent) => string
  groups: ScheduleGroup[]
  useLocal: boolean
}>()

const hovered = ref<{ ev: ScheduledEvent; mouse: MouseEvent } | null>(null)
const todayStr = new Date().toDateString()

const oneOffOpen = ref(false)
const scheduledOpen = ref(false)
const frequentOpen = ref(false)
const constantOpen = ref(false)
const neverRanOpen = ref(false)

function navigateToDay(date: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  store.timelineDayOffset = Math.round(
    (d.getTime() - today.getTime()) / 86_400_000,
  )
  store.view = "timeline"
}

const weekDays = computed<DayMeta[]>(() => {
  const base = new Date()
  base.setDate(base.getDate() + store.weekOffset * 7)
  const mon = new Date(base)
  mon.setDate(base.getDate() - ((base.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return {
      date: d,
      iso: d.toLocaleDateString("sv"),
      dayName: d.toLocaleDateString("en-GB", { weekday: "short" }),
      dayNum: d.getDate(),
      dayOfWeek: d.getDay(),
      isToday: d.toDateString() === todayStr,
    }
  })
})

const weekLabel = computed(() => {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  return `${fmt(weekDays.value[0]!.date)} – ${fmt(weekDays.value[6]!.date)}`
})

function shift(n: number) {
  store.weekOffset += n
}

const recurring = computed(() =>
  props.events.filter((e) => e.recurrence === "recurring"),
)
const neverRan = computed(() => props.events.filter((e) => !e.last_run_at))
const nonRecurring = computed(() =>
  props.events.filter((e) => e.recurrence !== "recurring" && !!e.last_run_at),
)

// Very-high: grouped badges (same for all days)
const veryHighGroups = computed(() => {
  const vh = recurring.value.filter(
    (e) => store.frequencyTierOf(e) === "very-high",
  )
  const map: Record<
    string,
    {
      id: string
      name: string
      color: string
      names: string[]
      firesPerDay: number
    }
  > = {}
  for (const e of vh) {
    const g = props.groups.find((g) => g.kinds.includes(e.kind))
    const key = g?.id ?? "ungrouped"
    if (!map[key])
      map[key] = {
        id: key,
        name: g?.name ?? "Other",
        color: g?.color ?? "#888780",
        names: [],
        firesPerDay: 0,
      }
    map[key].names.push(e.name)
    map[key].firesPerDay = Math.max(map[key].firesPerDay, e.fires_utc.length)
  }
  return Object.values(map)
})

function highForDay(day: DayMeta) {
  return recurring.value.filter(
    (e) => store.frequencyTierOf(e) === "high" && firesOnDay(e, day.dayOfWeek),
  )
}

function specificForDay(day: DayMeta) {
  return recurring.value
    .filter(
      (e) =>
        store.frequencyTierOf(e) === "specific" && firesOnDay(e, day.dayOfWeek),
    )
    .map((ev) => ({
      ev,
      fires: ev.fires_utc.map((m) => toDisplayMinute(m, props.useLocal)),
    }))
    .sort((a, b) => (a.fires[0] ?? 0) - (b.fires[0] ?? 0))
}

function nonRecurringForDay(day: DayMeta) {
  return nonRecurring.value.filter((e) => {
    if (!e.last_run_at) return false
    const d = new Date(e.last_run_at)
    const iso = props.useLocal
      ? d.toLocaleDateString("sv")
      : d.toISOString().slice(0, 10)
    return iso === day.iso
  })
}

const weekData = computed(() =>
  weekDays.value.map((day) => ({
    day,
    oneOff: nonRecurringForDay(day),
    scheduled: specificForDay(day),
    frequent: highForDay(day),
  })),
)

function runTime(iso: string): string {
  const d = new Date(iso)
  return props.useLocal
    ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`
}
</script>

<style scoped>
.cal-wrap {
  width: 100%;
}
.cal-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 0.5px solid var(--bs-border);
}
.week-label {
  font-size: 13px;
  font-weight: 500;
  min-width: 160px;
  text-align: center;
}
.today-btn {
  margin-left: 6px;
  font-size: 12px;
}
.cal-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  border-top: 0.5px solid var(--bs-border-faint);
}
.cal-header-row {
  border-top: none;
  border-bottom: 0.5px solid var(--bs-border);
}
.cal-cell {
  border-right: 0.5px solid var(--bs-border-faint);
  padding: 4px 4px 6px;
}
.cal-cell:last-child {
  border-right: none;
}
.cal-cell.today {
  background: var(--bs-surface);
}
.cal-header-row .cal-cell {
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 8px 6px 6px;
}
.cal-tier-label {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bs-text-muted);
  background: transparent;
  border: none;
  border-radius: 0;
  border-top: 0.5px solid var(--bs-border-faint);
  cursor: pointer;
  text-align: left;
}
.cal-tier-label:hover {
  color: var(--bs-text);
  background: var(--bs-surface);
  border-color: var(--bs-border-faint);
}
.day-name {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bs-text-muted);
}
.day-num {
  font-size: 16px;
  font-weight: 500;
  color: var(--bs-text);
  line-height: 1;
}
.day-num.today {
  color: var(--bs-accent);
}
.vhigh-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 5px;
  border-radius: 3px;
  border: 0.5px solid;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cal-pill {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 3px 2px 4px;
  border-radius: 2px;
  margin-bottom: 2px;
  cursor: default;
  gap: 2px;
}
.pill-name {
  font-size: 10px;
  color: var(--bs-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pill-count {
  font-size: 9px;
  color: var(--bs-text-muted);
  flex-shrink: 0;
}
.cal-event {
  padding: 1px 3px 1px 4px;
  border-radius: 2px;
  margin-bottom: 2px;
  cursor: default;
}
.cal-event.one-off {
  opacity: 0.7;
}
.event-time {
  display: block;
  font-size: 9px;
  font-family: monospace;
  color: var(--bs-text-muted);
}
.event-name {
  display: block;
  font-size: 10px;
  color: var(--bs-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.day-empty {
  text-align: center;
  padding: 8px 0;
  font-size: 12px;
  color: var(--bs-text-faint);
}
button {
  background: transparent;
  border: 0.5px solid var(--bs-border);
  color: var(--bs-text-muted);
  border-radius: 5px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all 0.1s;
}
button:hover {
  color: var(--bs-text);
  border-color: var(--bs-border-strong);
}
.chevron {
  transition: transform 0.15s;
  flex-shrink: 0;
}
.chevron.open {
  transform: rotate(180deg);
}
.never-ran-section {
  padding: 6px 8px;
}
.never-ran-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.never-ran-item {
  font-size: 11px;
  color: var(--bs-text-muted);
  padding: 2px 6px 2px 5px;
  background: var(--bs-surface);
  border-radius: 3px;
}
.never-ran-empty {
  text-align: center;
  padding: 6px 0;
  font-size: 12px;
  color: var(--bs-text-faint);
}
</style>
