<template>
  <div class="cronlens-page">
    <header class="toolbar">
      <div class="toolbar-left">
        <div class="view-switch">
          <button
            :class="{ active: store.view === 'timeline' }"
            @click="store.view = 'timeline'"
          >
            timeline
          </button>
          <button
            :class="{ active: store.view === 'calendar' }"
            @click="store.view = 'calendar'"
          >
            calendar
          </button>
        </div>
        <input
          v-model="store.searchQuery"
          type="text"
          class="search"
          placeholder="search events…"
        />
        <template v-if="filterableKeys.length">
          <select v-model="store.attrFilterKey" class="id-select">
            <option :value="null">filter by attribute…</option>
            <option v-for="k in filterableKeys" :key="k" :value="k">
              {{ k }}
            </option>
          </select>
          <input
            v-if="store.attrFilterKey"
            v-model="store.attrFilterVal"
            type="text"
            class="id-val"
            :placeholder="`${store.attrFilterKey} value…`"
          />
        </template>
      </div>

      <div class="toolbar-right">
        <div class="group-pills">
          <button
            class="pill"
            :class="{ active: store.activeGroupId === null }"
            @click="store.activeGroupId = null"
          >
            all
          </button>
          <button
            v-for="g in store.groups"
            :key="g.id"
            class="pill"
            :class="{ active: store.activeGroupId === g.id }"
            :style="
              store.activeGroupId === g.id
                ? { background: g.color, borderColor: g.color, color: '#fff' }
                : { borderColor: g.color + '99', color: g.color }
            "
            @click="
              store.activeGroupId = store.activeGroupId === g.id ? null : g.id
            "
          >
            {{ g.name }}
          </button>
        </div>

        <div class="tz-toggle">
          <span class="tz-lbl">UTC</span>
          <label class="switch">
            <input type="checkbox" v-model="store.useLocalTime" />
            <span class="track" />
          </label>
          <span class="tz-lbl">local</span>
        </div>

        <button
          class="icon-btn"
          title="Manage groups"
          @click="showGroups = true"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          >
            <circle cx="5" cy="4.5" r="1.8" />
            <path d="M1.5 12c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5" />
            <path d="M9.5 2.5 11 4l2-3" />
          </svg>
          groups
        </button>

        <button
          class="icon-btn sq"
          :class="{ spinning: loading }"
          title="Refresh"
          @click="fetchEvents"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 13 13"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M11.5 6.5A5 5 0 1 1 6.5 1.5" />
            <polyline points="9,1 12,1 12,4" />
          </svg>
        </button>
      </div>
    </header>

    <div class="stats-bar">
      <span class="stat">
        <strong>{{ filtered.length }}</strong> events
        <template v-if="filtered.length !== events.length"
          ><span class="of"> of {{ events.length }}</span></template
        >
      </span>
      <span class="sep" />
      <span class="stat"
        ><strong>{{ totalFires }}</strong> fires/day</span
      >
      <span class="sep" />I
      <span class="stat"
        ><strong>{{ nonRecurringCount }}</strong> one-off</span
      >
      <span class="sep" />
      <span class="stat mono">{{ tzDisplay }}</span>
      <span v-if="meta?.source" class="stat source"
        >source: {{ meta.source }}</span
      >
      <span v-if="error" class="stat err"
        >&#9888; {{ error }} — showing demo data</span
      >
    </div>

    <div v-if="loading" class="status-bar">loading…</div>

    <TimelineView
      v-if="store.view === 'timeline'"
      :events="filtered"
      :color-for-event="store.colorForEvent"
      :use-local="store.useLocalTime"
    />
    <CalendarView
      v-else
      :events="filtered"
      :color-for-event="store.colorForEvent"
      :groups="store.groups"
      :use-local="store.useLocalTime"
    />

    <GroupEditor
      v-if="showGroups"
      :groups="store.groups"
      @close="showGroups = false"
      @update="(id, p) => store.updateGroup(id, p)"
      @create="(p) => store.createGroup(p)"
      @delete="(id) => store.deleteGroup(id)"
      @reset="store.resetToDefaults()"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import { useCronLensStore } from "@/stores/scheduleStore"
import { useSchedule } from "@/composables/useSchedule"
import TimelineView from "@/components/schedule/TimelineView.vue"
import CalendarView from "@/components/schedule/CalendarView.vue"
import GroupEditor from "@/components/schedule/GroupEditor.vue"
import type { ResponseMeta } from "@/types"

const store = useCronLensStore()
const { events, loading, error, filterableKeys, fetchEvents } = useSchedule()
const showGroups = ref(false)
const meta = ref<ResponseMeta | null>(null)

const filtered = computed(() => store.filteredEvents(events.value))

const totalFires = computed(() =>
  filtered.value
    .filter((e) => e.recurrence === "recurring")
    .reduce((s, e) => s + e.fires_utc.length, 0)
    .toLocaleString(),
)

const nonRecurringCount = computed(
  () => filtered.value.filter((e) => e.recurrence !== "recurring").length,
)

const tzDisplay = computed(() => {
  if (!store.useLocalTime) return "UTC"
  const offset = -new Date().getTimezoneOffset()
  const sign = offset >= 0 ? "+" : "-"
  const h = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")
  const m = String(Math.abs(offset) % 60).padStart(2, "0")
  return `local (UTC${sign}${h}:${m})`
})

onMounted(async () => {
  await Promise.all([fetchEvents(), store.fetchGroups()])
})
</script>

<style scoped>
.cronlens-page {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 14px;
  color: var(--bs-text);
  background: var(--bs-bg);
  border: 0.5px solid var(--bs-border);
  border-radius: 10px;
  overflow: hidden;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 0.5px solid var(--bs-border);
  background: var(--bs-surface);
  flex-wrap: wrap;
}
.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.view-switch {
  display: flex;
  border: 0.5px solid var(--bs-border);
  border-radius: 6px;
  overflow: hidden;
}
.view-switch button {
  border: none;
  border-radius: 0;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--bs-text-muted);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.1s;
}
.view-switch button.active {
  background: var(--bs-bg);
  color: var(--bs-text);
  font-weight: 500;
}
.view-switch button:first-child {
  border-right: 0.5px solid var(--bs-border);
}
.search,
.id-select,
.id-val {
  font-size: 12px;
  padding: 4px 10px;
  border: 0.5px solid var(--bs-border);
  border-radius: 6px;
  background: var(--bs-bg);
  color: var(--bs-text);
  font-family: inherit;
}
.search {
  width: 180px;
}
.id-val {
  width: 130px;
}
.search:focus,
.id-select:focus,
.id-val:focus {
  outline: none;
  border-color: var(--bs-accent);
}
.group-pills {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.pill {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 20px;
  border: 0.5px solid var(--bs-border);
  cursor: pointer;
  background: transparent;
  color: var(--bs-text-muted);
  transition: all 0.12s;
  font-family: inherit;
  white-space: nowrap;
}
.pill:hover {
  border-color: var(--bs-border-strong);
  color: var(--bs-text);
}
.pill.active {
  font-weight: 500;
}
.tz-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
}
.tz-lbl {
  font-size: 11px;
  color: var(--bs-text-muted);
}
.switch {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
  cursor: pointer;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.track {
  position: absolute;
  inset: 0;
  background: var(--bs-border-strong);
  border-radius: 9px;
  transition: background 0.2s;
}
.track::after {
  content: "";
  position: absolute;
  left: 3px;
  top: 3px;
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}
.switch input:checked + .track {
  background: var(--bs-accent);
}
.switch input:checked + .track::after {
  transform: translateX(14px);
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  padding: 4px 10px;
  border: 0.5px solid var(--bs-border);
  border-radius: 6px;
  background: transparent;
  color: var(--bs-text-muted);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s;
}
.icon-btn.sq {
  padding: 4px 7px;
}
.icon-btn:hover {
  color: var(--bs-text);
  border-color: var(--bs-border-strong);
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.icon-btn.spinning svg {
  animation: spin 0.7s linear infinite;
}
.stats-bar {
  display: flex;
  align-items: center;
  padding: 4px 14px;
  border-bottom: 0.5px solid var(--bs-border-faint);
  gap: 0;
  flex-wrap: wrap;
}
.stat {
  font-size: 12px;
  color: var(--bs-text-muted);
  padding: 0 10px;
}
.stat strong {
  color: var(--bs-text);
}
.of {
  color: var(--bs-text-faint);
}
.sep {
  width: 0.5px;
  height: 12px;
  background: var(--bs-border);
  flex-shrink: 0;
}
.mono {
  font-family: monospace;
  font-size: 11px;
}
.source {
  font-style: italic;
}
.err {
  color: var(--bs-danger);
}
.legend-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 14px;
  border-bottom: 0.5px solid var(--bs-border-faint);
  flex-wrap: wrap;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--bs-text-muted);
  cursor: pointer;
  transition: opacity 0.12s;
  user-select: none;
}
.legend-item.dimmed {
  opacity: 0.3;
}
.ldot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-bar {
  padding: 6px 14px;
  font-size: 12px;
  color: var(--bs-text-muted);
  background: var(--bs-surface);
  text-align: center;
}
</style>
