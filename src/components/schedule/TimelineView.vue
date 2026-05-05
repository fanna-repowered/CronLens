<template>
  <div class="timeline-wrap">
    <div class="tl-header">
      <div class="tl-label-col">event</div>
      <div class="hours-strip">
        <div v-for="h in 24" :key="h" class="hour-cell">
          {{ h === 1 || h % 6 === 1 ? String(h - 1).padStart(2, "0") : "" }}
        </div>
      </div>
    </div>

    <div class="tl-body">
      <div class="now-needle" :style="{ left: `calc(200px + ${nowPct}%)` }" />

      <template v-if="veryHigh.length">
        <div class="tier-header">very frequent (&ge;60/day)</div>
        <TimelineRow
          v-for="e in veryHigh"
          :key="e.id"
          :event="e"
          :color="colorForEvent(e)"
          :use-local="useLocal"
          @hover="onHover"
          @leave="onLeave"
        />
      </template>

      <template v-if="high.length">
        <div class="tier-header">frequent (hourly range)</div>
        <TimelineRow
          v-for="e in high"
          :key="e.id"
          :event="e"
          :color="colorForEvent(e)"
          :use-local="useLocal"
          @hover="onHover"
          @leave="onLeave"
        />
      </template>

      <template v-if="specific.length">
        <div class="tier-header">scheduled (specific times)</div>
        <TimelineRow
          v-for="e in specific"
          :key="e.id"
          :event="e"
          :color="colorForEvent(e)"
          :use-local="useLocal"
          @hover="onHover"
          @leave="onLeave"
        />
      </template>

      <template v-if="nonRecurring.length">
        <div class="tier-header">one-off &amp; clocked (past runs)</div>
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
              class="one-off-pin"
              :style="{
                left: oneOffPct(e) + '%',
                background: colorForEvent(e),
              }"
              :title="e.last_run_at"
            />
            <span v-else class="no-run">never ran</span>
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
import { reactive, computed, onMounted, onUnmounted } from "vue"
import type { ScheduledEvent } from "@/types"
import { frequencyTier } from "@/composables/useSchedule"
import TimelineRow from "./TimelineRow.vue"
import TaskTooltip from "./TaskTooltip.vue"

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

// Tiers
const recurring = computed(() =>
  props.events.filter((e) => e.recurrence === "recurring"),
)
const nonRecurring = computed(() =>
  props.events.filter((e) => e.recurrence !== "recurring"),
)
const veryHigh = computed(() =>
  recurring.value.filter((e) => frequencyTier(e) === "very-high"),
)
const high = computed(() =>
  recurring.value.filter((e) => frequencyTier(e) === "high"),
)
const specific = computed(() =>
  recurring.value.filter((e) => frequencyTier(e) === "specific"),
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
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 500;
  color: var(--bs-text-muted);
  border-right: 0.5px solid var(--bs-border);
  display: flex;
  align-items: center;
}
.hours-strip {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(24, 1fr);
}
.hour-cell {
  font-size: 10px;
  color: var(--bs-text-muted);
  padding: 6px 2px;
  border-right: 0.5px solid var(--bs-border-faint);
  min-height: 28px;
  display: flex;
  align-items: center;
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
.tier-header {
  padding: 7px 12px 3px;
  border-top: 0.5px solid var(--bs-border-faint);
  margin-top: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--bs-text-faint);
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
}
.one-off-pin {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
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
