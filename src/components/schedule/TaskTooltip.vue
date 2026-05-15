<template>
  <Teleport to="body">
    <div v-if="event && mouseEvent" class="tooltip" :style="style">
      <div class="tt-name">{{ event.name }}</div>
      <div class="tt-kind">{{ event.kind }}</div>
      <hr class="tt-divider" />

      <div class="tt-row">
        <span class="tt-key">schedule</span>
        <span class="tt-val">{{ scheduleDisplay }}</span>
      </div>
      <div v-if="event.recurrence === 'recurring'" class="tt-row">
        <span class="tt-key">fires/day</span>
        <span class="tt-val">{{ event.fires_utc.length }}</span>
      </div>
      <div v-if="event.recurrence === 'recurring' && nextFires" class="tt-row">
        <span class="tt-key">next fires</span>
        <span class="tt-val">{{ nextFires }}</span>
      </div>
      <div class="tt-row">
        <span class="tt-key">last run</span>
        <span class="tt-val">{{ lastRunStr }}</span>
      </div>
      <div class="tt-row">
        <span class="tt-key">total runs</span>
        <span class="tt-val">{{ event.total_run_count.toLocaleString() }}</span>
      </div>

      <template v-if="event.attributes?.length">
        <hr class="tt-divider" />
        <div v-for="attr in event.attributes" :key="attr.key" class="tt-row">
          <span class="tt-key">{{ attr.label ?? attr.key }}</span>
          <span class="tt-val tt-mono">{{ attr.value }}</span>
        </div>
      </template>

      <hr class="tt-divider" />
      <div class="tt-row">
        <span class="tt-key">enabled</span>
        <span class="tt-val" :class="event.enabled ? 'tt-yes' : 'tt-no'">
          {{ event.enabled ? "yes" : "no" }}
        </span>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { ScheduledEvent } from "@/types"
import { toDisplayMinute, fmtMinute } from "@/composables/useSchedule"

const props = defineProps<{
  event: ScheduledEvent | null
  mouseEvent: MouseEvent | null
  useLocal: boolean
}>()

const style = computed(() => {
  if (!props.mouseEvent) return {}
  return {
    left: `${Math.min(props.mouseEvent.clientX + 16, window.innerWidth - 310)}px`,
    top: `${props.mouseEvent.clientY - 8}px`,
  }
})

const nextFires = computed(() => {
  if (!props.event?.fires_utc.length) return null
  const now = new Date()
  const nowM = props.useLocal
    ? now.getHours() * 60 + now.getMinutes()
    : now.getUTCHours() * 60 + now.getUTCMinutes()
  const display = props.event.fires_utc
    .map((m) => toDisplayMinute(m, props.useLocal))
    .sort((a, b) => a - b)
  const upcoming = display.filter((m) => m > nowM)
  return (upcoming.length ? upcoming : display)
    .slice(0, 4)
    .map(fmtMinute)
    .join("  ·  ")
})

const scheduleDisplay = computed(() => {
  const s = props.event?.schedule_display ?? ""
  return s.length > 80 ? s.slice(0, 77) + "…" : s
})

const lastRunStr = computed(() => {
  if (!props.event?.last_run_at) return "never"
  const d = new Date(props.event.last_run_at)
  return props.useLocal
    ? d.toLocaleString()
    : d.toUTCString().replace(" GMT", " UTC")
})
</script>

<style scoped>
.tooltip {
  position: fixed;
  z-index: 9000;
  background: var(--bs-bg);
  border: 0.5px solid var(--bs-border);
  border-radius: 8px;
  padding: 10px 13px;
  min-width: 220px;
  max-width: 300px;
  pointer-events: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  font-size: 12px;
}
.tt-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--bs-text);
  margin-bottom: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tt-kind {
  font-size: 11px;
  color: var(--bs-text-muted);
  font-family: monospace;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tt-divider {
  border: none;
  border-top: 0.5px solid var(--bs-border-faint);
  margin: 5px 0;
}
.tt-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  line-height: 1.7;
}
.tt-key {
  color: var(--bs-text-muted);
  flex-shrink: 0;
}
.tt-val {
  color: var(--bs-text);
  text-align: right;
  word-break: break-all;
}
.tt-mono {
  font-family: monospace;
}
.tt-yes {
  color: var(--bs-success);
}
.tt-no {
  color: var(--bs-text-muted);
}
</style>
