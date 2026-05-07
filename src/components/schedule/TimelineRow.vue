<template>
  <div
    class="tl-row"
    @mouseenter="emit('hover', $event, event)"
    @mousemove="emit('hover', $event, event)"
    @mouseleave="emit('leave')"
  >
    <div class="tl-name" :title="event.name">
      <span class="dot" :class="{ off: !event.enabled }" />
      <span class="name-text">{{ event.name }}</span>
    </div>
    <div class="tl-bars">
      <template v-if="tier === 'very-high'">
        <div
          class="freq-band"
          :style="{
            background: color + '30',
            borderLeft: `2px solid ${color}`,
          }"
        >
          <span class="band-label">{{ event.fires_utc.length }}</span>
        </div>
      </template>
      <template v-else>
        <div
          v-for="m in fires"
          :key="m"
          class="fire-tick"
          :style="{ left: pct(m) + '%', background: color }"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { ScheduledEvent } from "@/types"
import { toDisplayMinute } from "@/composables/useSchedule"
import { useCronLensStore } from "@/stores/scheduleStore"

const store = useCronLensStore()

const props = defineProps<{
  event: ScheduledEvent
  color: string
  useLocal: boolean
  displayStart: number
  displayEnd: number
}>()

const emit = defineEmits<{
  hover: [e: MouseEvent, event: ScheduledEvent]
  leave: []
}>()

const tier = computed(() => store.frequencyTierOf(props.event))
const fires = computed(() =>
  props.event.fires_utc.map((m) => toDisplayMinute(m, props.useLocal)),
)

function pct(m: number) {
  return (
    ((m - props.displayStart) / (props.displayEnd - props.displayStart)) * 100
  )
}
</script>

<style scoped>
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
.freq-band {
  position: absolute;
  inset: 4px 0;
  border-radius: 2px;
  display: flex;
  align-items: center;
  padding: 0 8px;
}
.band-label {
  font-size: 10px;
  color: var(--bs-text-muted);
  font-weight: 500;
}
</style>
