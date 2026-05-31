<template>
  <div class="idea-input-wrap">
    <div class="project-select-row" v-if="hasProjects">
      <button class="project-chip" @click="showProjectPicker = !showProjectPicker">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" width="14" height="14">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span>{{ activeProjectName }}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="10" height="10" class="chip-caret">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <transition name="fade-slide-up">
        <div class="project-picker" v-if="showProjectPicker">
          <button
            class="project-option"
            :class="{ selected: activeProjectId === null }"
            @click="selectProject(null)"
          >📝 无项目</button>
          <button
            v-for="p in projects"
            :key="p.id"
            class="project-option"
            :class="{ selected: activeProjectId === p.id }"
            @click="selectProject(p.id)"
          >{{ p.name }}</button>
        </div>
      </transition>
    </div>

    <!-- 收缩态：紧凑胶囊条 -->
    <div
      v-if="collapsed"
      class="input-collapsed"
      @click="expand"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18" class="collapse-icon">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      <span class="collapse-placeholder">记录想法...</span>
    </div>

    <!-- 展开态：完整输入框 -->
    <div v-else class="input-card" :class="{ focused: isFocused, 'has-text': text.length > 0 }">
      <textarea
        ref="textareaRef"
        v-model="text"
        placeholder="一闪而过的想法..."
        rows="1"
        @focus="isFocused = true"
        @blur="onBlur"
        @input="autoResize"
        @keydown.meta.enter.prevent="submit"
        @keydown.ctrl.enter.prevent="submit"
      ></textarea>
      <div class="input-actions">
        <div></div>
        <button
          class="submit-btn"
          :class="{ visible: text.trim().length > 0 }"
          @click="submit"
          aria-label="保存想法"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <polyline points="19 12 12 19 5 12"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 多条目分割提示 -->
    <transition name="expand">
      <div v-if="showSplitBanner && splitCandidates" class="split-banner">
        <div class="split-info">检测到 {{ splitCandidates.length }} 条内容</div>
        <div class="split-preview">
          <div class="split-item" v-for="(item, i) in splitCandidates" :key="i">
            <span class="split-num">{{ i + 1 }}.</span>
            {{ item }}
          </div>
        </div>
        <div class="split-actions">
          <button class="btn-split primary" @click="confirmSplit">分开保存</button>
          <button class="btn-split" @click="cancelSplit">合并为一条</button>
          <button class="btn-split dismiss" @click="dismissSplit">取消</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, nextTick, computed, onMounted } from 'vue'
import { useIdeaStore } from '../store.js'

const emit = defineEmits(['submit', 'submit-multiple'])
const store = useIdeaStore()

const text = ref('')
const isFocused = ref(false)
const textareaRef = ref(null)
const collapsed = ref(true)

const showSplitBanner = ref(false)
const splitCandidates = ref(null)
const showProjectPicker = ref(false)

const projects = computed(() => store.projects)
const hasProjects = computed(() => projects.value.length > 0)
const activeProjectId = computed(() => store.activeProjectId)
const activeProjectName = computed(() => {
  if (!activeProjectId.value) return '无项目'
  const p = projects.value.find(x => x.id === activeProjectId.value)
  return p ? p.name : '无项目'
})

onMounted(() => {
  if (!store.projects.length) store.loadProjects()
})

function expand() {
  collapsed.value = false
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function detectMultiIdea(input) {
  const trimmed = input.trim()
  if (!trimmed) return null

  const lines = trimmed.split(/\n/).map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length < 2) return null

  const numberedRe = /^(\d+[\.\、\)）]|\(\d+\))\s*/
  let candidates = null
  let isNumbered = true
  for (const line of lines) {
    if (!numberedRe.test(line)) { isNumbered = false; break }
  }
  if (isNumbered) {
    candidates = lines.map(l => l.replace(numberedRe, '').trim())
  }

  if (!candidates) {
    let isBulleted = true
    for (const line of lines) {
      if (!/^[-*•]\s/.test(line)) { isBulleted = false; break }
    }
    if (isBulleted) {
      candidates = lines.map(l => l.replace(/^[-*•]\s+/, '').trim())
    }
  }

  if (!candidates) {
    const validLines = lines.filter(l => l.length > 5)
    if (validLines.length >= 3) {
      candidates = validLines
    }
  }

  if (candidates && candidates.length < 2) return null

  return candidates
}

function autoResize() {
  nextTick(() => {
    const el = textareaRef.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  })
}

function submit() {
  const t = text.value.trim()
  if (!t) return

  const candidates = detectMultiIdea(t)
  if (candidates && candidates.length > 1) {
    splitCandidates.value = candidates
    showSplitBanner.value = true
    return
  }

  emit('submit', t)
  text.value = ''
  nextTick(autoResize)
}

function confirmSplit() {
  emit('submit-multiple', splitCandidates.value)
  splitCandidates.value = null
  showSplitBanner.value = false
  text.value = ''
  nextTick(autoResize)
}

function cancelSplit() {
  emit('submit', text.value.trim())
  splitCandidates.value = null
  showSplitBanner.value = false
  text.value = ''
  nextTick(autoResize)
}

function dismissSplit() {
  splitCandidates.value = null
  showSplitBanner.value = false
}

function selectProject(id) {
  store.setActiveProject(id)
  showProjectPicker.value = false
}

function onBlur() {
  setTimeout(() => {
    isFocused.value = false
    // 失焦时若无内容则收缩
    if (!text.value.trim()) {
      collapsed.value = true
    }
  }, 150)
}
</script>

<style scoped>
.idea-input-wrap {
  padding: 0 16px 16px;
  position: relative;
  z-index: 10;
}

.project-select-row {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 6px;
  position: relative;
}

.project-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: var(--radius-full);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  transition: all var(--duration-fast);
}

.project-chip:active {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.chip-caret {
  opacity: 0.5;
  transition: transform var(--duration-fast);
}

.project-picker {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 160px;
  max-height: 200px;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 20;
  padding: 4px;
}

.project-option {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  font-size: var(--text-sm);
  color: var(--color-text);
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast);
}

.project-option:active {
  background: var(--color-surface-hover);
}

.project-option.selected {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-weight: 600;
}

/* ---- 收缩态 ---- */
.input-collapsed {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px;
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.input-collapsed:active {
  border-color: var(--color-accent);
  background: var(--color-surface-hover);
}

.collapse-icon {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  transition: color var(--duration-fast);
}

.input-collapsed:active .collapse-icon {
  color: var(--color-accent);
}

.collapse-placeholder {
  font-size: var(--text-base);
  color: var(--color-text-tertiary);
}

/* ---- 展开态 ---- */
.input-card {
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 8px 12px;
  transition: all var(--duration-fast) var(--ease-out);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-card.focused,
.input-card.has-text {
  padding: 12px 14px;
  gap: 8px;
}

.input-card.focused {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}

.input-card.has-text {
  border-color: var(--color-text-secondary);
}

textarea {
  width: 100%;
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--color-text);
  overflow: hidden;
}

textarea::placeholder {
  color: var(--color-text-tertiary);
}

.input-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.submit-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--color-text-tertiary);
  opacity: 0;
  transform: translateX(8px);
  transition: all var(--duration-fast) var(--ease-spring);
  pointer-events: none;
}

.submit-btn.visible {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
  color: var(--color-accent);
  background: var(--color-accent-soft);
}

/* ---- 分割提示 ---- */
.split-banner {
  margin-top: 8px;
  padding: 14px;
  background: var(--color-surface);
  border: 1.5px solid var(--color-accent);
  border-radius: var(--radius-md);
}

.split-info {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-accent);
  margin-bottom: 10px;
}

.split-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 150px;
  overflow-y: auto;
  margin-bottom: 12px;
}

.split-item {
  font-size: var(--text-sm);
  color: var(--color-text);
  line-height: 1.5;
  padding: 4px 0;
}

.split-num {
  color: var(--color-text-tertiary);
  font-weight: 600;
  margin-right: 4px;
}

.split-actions {
  display: flex;
  gap: 8px;
}

.btn-split {
  flex: 1;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  border: 1.5px solid var(--color-border);
  color: var(--color-text-secondary);
  transition: all var(--duration-fast);
}

.btn-split.primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

.btn-split:active {
  transform: scale(0.96);
}

.expand-enter-active,
.expand-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
