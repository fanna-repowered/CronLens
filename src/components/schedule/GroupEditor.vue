<template>
  <Teleport to="body">
    <div class="overlay" @click.self="$emit('close')">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h2>schedule groups</h2>
          <button class="close-btn" @click="$emit('close')">&#x2715;</button>
        </div>

        <div class="group-list">
          <div v-for="g in groups" :key="g.id" class="group-item">
            <div v-if="editingId === g.id" class="edit-form">
              <div class="field">
                <label>name</label><input v-model="draft.name" type="text" />
              </div>
              <div class="field">
                <label>color</label>
                <div class="color-row">
                  <input
                    v-model="draft.color"
                    type="color"
                    class="color-swatch-input"
                  />
                  <input v-model="draft.color" type="text" class="color-hex" />
                  <div class="swatches">
                    <div
                      v-for="sw in SWATCHES"
                      :key="sw"
                      class="swatch"
                      :style="{
                        background: sw,
                        outline:
                          draft.color === sw ? `2px solid ${sw}` : 'none',
                        outlineOffset: '2px',
                      }"
                      @click="draft.color = sw"
                    />
                  </div>
                </div>
              </div>
              <div class="field">
                <label
                  >event kinds
                  <span class="label-hint">(one per line)</span></label
                >
                <textarea
                  v-model="kindsText"
                  rows="5"
                  placeholder="analyze_image&#10;run_image_processor"
                />
                <p class="hint">
                  the <code>kind</code> value from the API — for beat this is
                  the task function name; for other backends it's whatever the
                  backend sets
                </p>
              </div>
              <div class="field">
                <label>description</label
                ><input
                  v-model="draft.description"
                  type="text"
                  placeholder="Optional"
                />
              </div>
              <div class="edit-actions">
                <button class="btn-primary" @click="saveEdit(g.id)">
                  save
                </button>
                <button @click="editingId = null">cancel</button>
                <button
                  class="btn-danger"
                  style="margin-left: auto"
                  @click="doDelete(g.id)"
                >
                  delete
                </button>
              </div>
            </div>
            <div v-else class="group-preview" @click="startEdit(g)">
              <span class="preview-dot" :style="{ background: g.color }" />
              <div class="preview-info">
                <span class="preview-name">{{ g.name }}</span>
                <span class="preview-count"
                  >{{ g.kinds.length }} kind{{
                    g.kinds.length !== 1 ? "s" : ""
                  }}</span
                >
              </div>
              <span class="preview-edit">edit</span>
            </div>
          </div>
        </div>

        <div class="add-section">
          <button v-if="!adding" class="add-btn" @click="startAdd">
            + add group
          </button>
          <div v-else class="edit-form new-form">
            <div class="field">
              <label>name</label><input v-model="newDraft.name" type="text" />
            </div>
            <div class="field">
              <label>color</label>
              <div class="color-row">
                <input
                  v-model="newDraft.color"
                  type="color"
                  class="color-swatch-input"
                />
                <input v-model="newDraft.color" type="text" class="color-hex" />
                <div class="swatches">
                  <div
                    v-for="sw in SWATCHES"
                    :key="sw"
                    class="swatch"
                    :style="{
                      background: sw,
                      outline:
                        newDraft.color === sw ? `2px solid ${sw}` : 'none',
                      outlineOffset: '2px',
                    }"
                    @click="newDraft.color = sw"
                  />
                </div>
              </div>
            </div>
            <div class="field">
              <label
                >event kinds
                <span class="label-hint">(one per line)</span></label
              >
              <textarea
                v-model="newKindsText"
                rows="4"
                placeholder="analyze_image&#10;run_image_processor"
              />
            </div>
            <div class="edit-actions">
              <button
                class="btn-primary"
                :disabled="!newDraft.name.trim()"
                @click="saveNew"
              >
                create
              </button>
              <button @click="adding = false">cancel</button>
            </div>
          </div>
        </div>

        <div class="modal-foot">
          <button class="reset-btn" @click="$emit('reset')">
            reset to defaults
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue"
import type { ScheduleGroup } from "@/types"

defineProps<{ groups: ScheduleGroup[] }>()
const emit = defineEmits<{
  close: []
  update: [id: string, payload: Partial<ScheduleGroup>]
  create: [payload: Omit<ScheduleGroup, "id">]
  delete: [id: string]
  reset: []
}>()

const SWATCHES = [
  "#378ADD",
  "#1D9E75",
  "#BA7517",
  "#D4537E",
  "#7F77DD",
  "#D85A30",
  "#639922",
  "#888780",
  "#E24B4A",
  "#5DCAA5",
]

const editingId = ref<string | null>(null)
const draft = reactive({ name: "", color: "", description: "" })
const kindsText = ref("")

function startEdit(g: ScheduleGroup) {
  editingId.value = g.id
  draft.name = g.name
  draft.color = g.color
  draft.description = g.description
  kindsText.value = g.kinds.join("\n")
}
function saveEdit(id: string) {
  const kinds = kindsText.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
  emit("update", id, { ...draft, kinds })
  editingId.value = null
}
function doDelete(id: string) {
  if (confirm("Delete group? Events will appear as ungrouped.")) {
    emit("delete", id)
    editingId.value = null
  }
}

const adding = ref(false)
const newDraft = reactive({
  name: "",
  color: SWATCHES[0] ?? "",
  description: "",
})
const newKindsText = ref("")
function startAdd() {
  adding.value = true
  newDraft.name = ""
  newDraft.color = SWATCHES[Math.floor(Math.random() * SWATCHES.length)] ?? ""
  newKindsText.value = ""
}
function saveNew() {
  const kinds = newKindsText.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
  emit("create", { ...newDraft, kinds })
  adding.value = false
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal {
  background: var(--bs-bg);
  border: 0.5px solid var(--bs-border);
  border-radius: 12px;
  width: 540px;
  max-height: 88vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 20px 13px;
  border-bottom: 0.5px solid var(--bs-border);
  position: sticky;
  top: 0;
  background: var(--bs-bg);
  z-index: 2;
}
.modal-head h2 {
  font-size: 14px;
  font-weight: 500;
}
.close-btn {
  background: none;
  border: none;
  font-size: 16px;
  color: var(--bs-text-muted);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}
.close-btn:hover {
  background: var(--bs-surface);
}
.group-list {
  padding: 4px 0;
}
.group-item {
  border-bottom: 0.5px solid var(--bs-border-faint);
}
.group-item:last-child {
  border-bottom: none;
}
.group-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  cursor: pointer;
  transition: background 0.1s;
}
.group-preview:hover {
  background: var(--bs-surface);
}
.group-preview:hover .preview-edit {
  opacity: 1;
}
.preview-dot {
  width: 12px;
  height: 12px;
  min-width: 12px;
  border-radius: 3px;
}
.preview-info {
  flex: 1;
}
.preview-name {
  font-size: 13px;
  font-weight: 500;
  display: block;
}
.preview-count {
  font-size: 11px;
  color: var(--bs-text-muted);
}
.preview-edit {
  font-size: 11px;
  color: var(--bs-text-muted);
  opacity: 0;
  transition: opacity 0.1s;
}
.edit-form {
  padding: 14px 20px;
  background: var(--bs-surface);
}
.new-form {
  border-top: 0.5px solid var(--bs-border);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}
.field label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bs-text-muted);
}
.label-hint {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}
.field input[type="text"],
.field textarea {
  border: 0.5px solid var(--bs-border);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  background: var(--bs-bg);
  color: var(--bs-text);
  font-family: inherit;
  resize: vertical;
  width: 100%;
}
.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--bs-accent);
}
.hint {
  font-size: 11px;
  color: var(--bs-text-muted);
  margin: 0;
}
.hint code {
  background: var(--bs-border-faint);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: monospace;
}
.color-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.color-swatch-input {
  width: 32px;
  height: 28px;
  border: 0.5px solid var(--bs-border);
  border-radius: 5px;
  padding: 2px;
  cursor: pointer;
  background: none;
}
.color-hex {
  width: 88px;
}
.swatches {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.swatch {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  cursor: pointer;
  transition: transform 0.1s;
}
.swatch:hover {
  transform: scale(1.25);
}
.edit-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.add-section {
  padding: 12px 20px;
  border-top: 0.5px solid var(--bs-border-faint);
}
.add-btn {
  width: 100%;
  padding: 8px;
  border: 0.5px dashed var(--bs-border);
  border-radius: 6px;
  background: none;
  color: var(--bs-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.12s;
  font-family: inherit;
}
.add-btn:hover {
  color: var(--bs-text);
  border-color: var(--bs-border-strong);
  background: var(--bs-surface);
}
.modal-foot {
  padding: 10px 20px 14px;
  border-top: 0.5px solid var(--bs-border-faint);
}
.reset-btn {
  background: none;
  border: none;
  color: var(--bs-text-muted);
  font-size: 11px;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.reset-btn:hover {
  color: var(--bs-text);
}
button {
  background: none;
  border: 0.5px solid var(--bs-border);
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  color: var(--bs-text);
  cursor: pointer;
  transition: background 0.1s;
  font-family: inherit;
}
button:hover {
  background: var(--bs-surface);
}
.btn-primary {
  background: var(--bs-accent);
  color: #fff;
  border-color: var(--bs-accent);
}
.btn-primary:hover {
  opacity: 0.88;
}
.btn-primary:disabled {
  opacity: 0.4;
  cursor: default;
}
.btn-danger {
  color: var(--bs-danger);
  border-color: var(--bs-danger);
}
.btn-danger:hover {
  background: rgba(226, 75, 74, 0.08);
}
</style>
