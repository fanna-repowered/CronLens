<template>
  <div class="cronlens-page">
    <header class="toolbar">
      <!-- Brand + back navigation -->
      <div class="brand-row">
        <span class="brand-name">CronLens</span>
        <button
          v-if="store.view === 'timeline'"
          class="back-btn"
          @click="store.view = 'calendar'"
        >
          ← calendar
        </button>
      </div>

      <!-- Collapsible groups row -->
      <div class="config-row">
        <button class="config-label" @click="groupsOpen = !groupsOpen">
          <svg
            class="chevron"
            :class="{ open: groupsOpen }"
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
          groups
        </button>
        <div v-show="groupsOpen" class="config-content">
          <div class="group-pills">
            <button
              class="pill"
              :class="{ active: store.activeGroupIds.size === 0 }"
              @click="store.activeGroupIds.clear()"
            >
              All
            </button>
            <button
              v-for="g in store.groups"
              :key="g.id"
              class="pill"
              :class="{ active: store.activeGroupIds.has(g.id) }"
              :style="
                store.activeGroupIds.has(g.id)
                  ? { background: g.color, borderColor: g.color, color: '#fff' }
                  : { borderColor: g.color + '99', color: g.color }
              "
              @click="store.toggleGroupId(g.id)"
            >
              {{ g.name }}
            </button>
          </div>

          <div class="view-row-actions">
            <button
              class="icon-btn"
              title="Manage groups"
              @click="showGroups = true"
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
                <path d="M6.5 1.5v10M1.5 6.5h10" />
              </svg>
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
                <path
                  d="M11 2.5v3h-3M2 10.5v-3h3M10.5 4.5a4.5 4.5 0 0 0-7.5-1.5M2.5 8.5a4.5 4.5 0 0 0 7.5 1.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Collapsible settings row -->
      <div class="config-row">
        <button class="config-label" @click="settingsOpen = !settingsOpen">
          <svg
            class="chevron"
            :class="{ open: settingsOpen }"
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
          settings
        </button>
        <div v-show="settingsOpen" class="config-content layered">
          <div class="tz-toggle">
            <span class="tz-lbl">UTC</span>
            <label class="switch">
              <input type="checkbox" v-model="store.useLocalTime" />
              <span class="track" />
            </label>
            <span class="tz-lbl">local</span>
          </div>
          <div>
            <div class="tier-config">
              <span class="tier-lbl">Constant ≥</span>
              <input
                v-model.number="store.veryHighThreshold"
                type="number"
                min="1"
                max="1440"
                class="tier-input"
                title="Tasks with this many fires/day or more are shown as a solid band"
              />
              <span class="tier-lbl">/day</span>
            </div>
            <div class="tier-config">
              <span class="tier-lbl">Frequent ≥</span>
              <input
                v-model.number="store.highThreshold"
                type="number"
                min="1"
                max="1440"
                class="tier-input"
                title="Tasks with this many fires/day or more are shown as individual ticks"
              />
              <span class="tier-lbl">/day</span>
            </div>
            <div
              class="tier-config"
              :class="{ 'zoom-disabled': store.view === 'calendar' }"
            >
              <span class="tier-lbl">Zoom</span>
              <input
                v-model.number="store.zoomSnapValue"
                type="number"
                min="1"
                class="tier-input"
                :disabled="store.view === 'calendar'"
                title="Drag-select snaps to this interval on the timeline"
              />
              <select
                v-model="store.zoomSnapUnit"
                class="snap-unit"
                :disabled="store.view === 'calendar'"
              >
                <option value="min">min</option>
                <option value="hour">hour</option>
              </select>
              <button
                class="reset-zoom-btn"
                :class="{ active: store.zoomStart !== null }"
                :disabled="store.view === 'calendar'"
                title="Reset timeline zoom to full day"
                @click="store.resetZoom()"
              >
                ↺
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Collapsible filter row -->
      <div class="config-row">
        <button class="config-label" @click="filterOpen = !filterOpen">
          <svg
            class="chevron"
            :class="{ open: filterOpen }"
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
          filter
        </button>
        <div v-show="filterOpen" class="config-content layered">
          <input
            v-model="store.searchQuery"
            type="text"
            class="search"
            placeholder="Search events…"
          />
          <template v-if="attrValueCounts.length">
            <select v-model="store.attrFilterKey" class="id-select">
              <option :value="null">...</option>
              <option
                v-for="{ key, count } in attrValueCounts"
                :key="key"
                :value="key"
              >
                {{ key }} ({{ count }})
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
      </div>
    </header>

    <!--    Collapsible status bar-->
    <div class="config-row">
      <button class="config-label" @click="infoStatusOpen = !infoStatusOpen">
        <svg
          class="chevron"
          :class="{ open: infoStatusOpen }"
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
        Info
      </button>
      <div v-show="infoStatusOpen" class="config-content">
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
      </div>
    </div>

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
const { events, loading, error, fetchEvents } = useSchedule()
const showGroups = ref(false)
const settingsOpen = ref(true)
const groupsOpen = ref(true)
const filterOpen = ref(true)
const infoStatusOpen = ref(true)

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

const attrValueCounts = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const e of events.value) {
    for (const a of e.attributes) {
      if (!a.filterable) continue
      if (!map.has(a.key)) map.set(a.key, new Set())
      map.get(a.key)!.add(a.value)
    }
  }
  return [...map.entries()].map(([key, vals]) => ({ key, count: vals.size }))
})

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
  scrollbar-gutter: stable;
}

.brand-row {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 0.5px solid var(--bs-border-faint);
}

.brand-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--bs-text);
  letter-spacing: 0.02em;
}

.back-btn {
  font-size: 12px;
  padding: 4px 12px;
  border: 0.5px solid var(--bs-border);
  border-radius: 6px;
  background: transparent;
  color: var(--bs-text-muted);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s;
}

.back-btn:hover {
  color: var(--bs-accent);
  border-color: var(--bs-accent);
}

.toolbar {
  display: grid;
  grid-template-columns: max-content 1fr;
  border-bottom: 0.5px solid var(--bs-border);
  background: var(--bs-surface);
}

.config-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid;
  border-bottom: 0.5px solid var(--bs-border-faint);
  align-items: flex-start;
}

.config-row:last-child {
  border-bottom: none;
}

.config-label {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px 7px 14px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bs-text-faint);
  background: transparent;
  border: none;
  border-right: 0.5px solid var(--bs-border-faint);
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  text-align: left;
}

.config-label:hover {
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

.config-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  flex-wrap: wrap;

  &.layered {
    align-items: start;
    flex-direction: column;
    padding: 0.5rem 1.2rem;
  }
}

.view-row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  flex-shrink: 0;
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

.tier-config {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tier-lbl {
  font-size: 12px;
  font-weight: 700;
  color: var(--bs-text-faint);
  white-space: nowrap;
}

.tier-input {
  width: 5rem;
  font-size: 11px;
  padding: 3px 5px;
  border: 0.5px solid var(--bs-border);
  border-radius: 4px;
  background: var(--bs-bg);
  color: var(--bs-text);
  font-family: monospace;
  text-align: right;
}

.tier-input:focus {
  outline: none;
  border-color: var(--bs-accent);
}

.snap-unit {
  font-size: 11px;
  padding: 3px 4px;
  border: 0.5px solid var(--bs-border);
  border-radius: 4px;
  background: var(--bs-bg);
  color: var(--bs-text);
  font-family: inherit;
  cursor: pointer;
}

.snap-unit:focus {
  outline: none;
  border-color: var(--bs-accent);
}

.reset-zoom-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0.5px solid var(--bs-border);
  border-radius: 4px;
  background: transparent;
  color: var(--bs-text-faint);
  cursor: pointer;
  font-size: 14px;
  font-family: inherit;
  padding: 0;
  transition: all 0.12s;
}

.reset-zoom-btn:hover {
  color: var(--bs-text-muted);
  border-color: var(--bs-border-strong);
}

.reset-zoom-btn.active {
  color: var(--bs-accent);
  border-color: var(--bs-accent);
}

.zoom-disabled {
  opacity: 0.4;
  pointer-events: none;
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

.status-bar {
  padding: 6px 14px;
  font-size: 12px;
  color: var(--bs-text-muted);
  background: var(--bs-surface);
  text-align: center;
}
</style>
