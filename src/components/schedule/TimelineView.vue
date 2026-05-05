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
          @click="dayOffset = 0"
        >
          {{ dayLabel }}
        </button>
        <button class="day-nav" title="Next day" @click="shiftDay(1)">›</button>
      </div>
      <div class="hours-strip">
        <div
          v-for="h in 24"
          :key="h"
          class="hour-cell"
          :class="{
            major: (h - 1) % 6 === 0,
            mid: (h - 1) % 2 === 0 && (h - 1) % 6 !== 0,
          }"
        >
          {{ String(h - 1).padStart(2, "0") }}
        </div>
      </div>
    </div>

    <div class="tl-body">
      <div
        v-if="isToday"
        class="now-needle"
        :style="{ left: `calc(200px + ${nowPct}%)` }"
      />

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
                v-if="e.last_run_at"
                class="fire-tick"
                :style="{
                  left: oneOffPct(e) + '%',
                  background: colorForEvent(e),
                }"
                :title="e.last_run_at"
              />
              <span v-else class="no-run">never ran</span>
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
          very frequent (&ge;{{ store.veryHighThreshold }}/day)
        </button>
        <div v-show="bandOpen" class="tier-content">
          <TimelineRow
            v-for="e in veryHigh"
            :key="e.id"
            :event="e"
            :color="colorForEvent(e)"
            :use-local="useLocal"
            @hover="onHover"
            @leave="onLeave"
          />
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
import { ref, reactive, computed, onMounted, onUnmounted } from "vue"
import type { ScheduledEvent } from "@/types"
import { firesOnDay } from "@/composables/useSchedule"
import { useCronLensStore } from "@/stores/scheduleStore"
import TimelineRow from "./TimelineRow.vue"
import TaskTooltip from "./TaskTooltip.vue"

const store = useCronLensStore()
const bandOpen = ref(true)
const oneOffOpen = ref(true)
const frequentOpen = ref(true)
const scheduledOpen = ref(true)

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

// Day picker
const dayOffset = ref(0)

const selectedDate = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset.value)
  d.setHours(0, 0, 0, 0)
  return d
})

const isToday = computed(() => dayOffset.value === 0)

const dayLabel = computed(() =>
  selectedDate.value.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }),
)

function shiftDay(n: number) {
  dayOffset.value += n
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

const nowPct = computed(() => (nowMin.value / 1440) * 100 + "%")
onMounted(() => {
  timer = setInterval(() => {
    nowMin.value = getNow()
  }, 30_000)
})
onUnmounted(() => clearInterval(timer))

// Tiers — recurring events filtered to those that fire on the selected day
const recurring = computed(() =>
  props.events.filter(
    (e) =>
      e.recurrence === "recurring" &&
      firesOnDay(e, selectedDate.value.getDay()),
  ),
)
const nonRecurring = computed(() =>
  props.events.filter((e) => e.recurrence !== "recurring"),
)
const veryHigh = computed(() =>
  recurring.value.filter((e) => store.frequencyTierOf(e) === "very-high"),
)
const high = computed(() =>
  recurring.value.filter((e) => store.frequencyTierOf(e) === "high"),
)
const specific = computed(() =>
  recurring.value.filter((e) => store.frequencyTierOf(e) === "specific"),
)

function oneOffPct(e: ScheduledEvent): number {
  if (!e.last_run_at) return 0
  const d = new Date(e.last_run_at)
  const m = props.useLocal
    ? d.getHours() * 60 + d.getMinutes()
    : d.getUTCHours() * 60 + d.getUTCMinutes()
  return (m / 1440) * 100
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
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  gap: 4px;
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
  display: grid;
  grid-template-columns: repeat(24, 1fr);
}

.hour-cell {
  font-size: 9px;
  color: var(--bs-text-faint);
  font-family: monospace;
  padding: 4px 0 4px 2px;
  border-right: 0.5px solid var(--bs-border-faint);
  min-height: 32px;
  display: flex;
  align-items: flex-end;
  margin-left: 0.125rem;
}

.hour-cell.mid {
  color: var(--bs-text-faint);
}

.hour-cell.major {
  color: var(--bs-text-muted);
  font-size: 10px;
  font-weight: 600;
  border-right-color: var(--bs-border);
  margin-left: 0.125rem;
}

.tl-body {
  position: relative;
}

.now-needle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--bs-danger);
  opacity: 0.5;
  z-index: 5;
  pointer-events: none;
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
    calc(100% / 24) 100%;
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
