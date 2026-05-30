<template>
  <div class="idea-input-wrap">
    <div class="input-card" :class="{ focused: isFocused, 'has-text': text.length > 0 }">
      <textarea
        ref="textareaRef"
        v-model="text"
        :placeholder="isListening ? '正在聆听...' : '一闪而过的想法...'"
        rows="1"
        @focus="isFocused = true"
        @blur="onBlur"
        @input="autoResize"
        @keydown.enter.exact.prevent="submit"
      ></textarea>
      <div class="input-actions">
        <VoiceInput
          :is-listening="isListening"
          :is-supported="voice.isSupported.value"
          @start="onVoiceStart"
          @stop="onVoiceStop"
        />
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
    <transition name="expand">
      <div v-if="isListening && voice.transcript.value" class="voice-preview">
        <span class="voice-dot"></span>
        {{ voice.transcript.value }}
      </div>
    </transition>
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
import { ref, nextTick, watch } from 'vue'
import VoiceInput from './VoiceInput.vue'
import { useVoiceInput } from '../composables/useVoiceInput.js'

const emit = defineEmits(['submit', 'voice-submit', 'submit-multiple'])

const text = ref('')
const isFocused = ref(false)
const textareaRef = ref(null)
const voice = useVoiceInput()
const isListening = ref(false)
const voiceStartTime = ref(0)

const showSplitBanner = ref(false)
const splitCandidates = ref(null)

watch(() => voice.isListening.value, (val) => {
  isListening.value = val
})

function detectMultiIdea(input) {
  const trimmed = input.trim()
  if (!trimmed) return null

  const lines = trimmed.split(/\n/).map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length < 2) return null

  let candidates = null
  let isNumbered = true
  for (const line of lines) {
    if (!/^\d+[\.\、\)]\s+/.test(line)) { isNumbered = false; break }
  }
  if (isNumbered) {
    candidates = lines.map(l => l.replace(/^\d+[\.\、\)]\s+/, '').trim())
  }

  if (!candidates) {
    let isBulleted = true
    for (const line of lines) {
      if (!/^[-*•]\s+/.test(line)) { isBulleted = false; break }
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

function onVoiceStart() {
  voiceStartTime.value = Date.now()
  voice.start()
}

function onVoiceStop() {
  const duration = (Date.now() - voiceStartTime.value) / 1000
  voice.stop()
  const t = voice.transcript.value.trim()
  if (t) {
    emit('voice-submit', { text: t, duration })
    voice.transcript.value = ''
  }
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

function onBlur() {
  setTimeout(() => { isFocused.value = false }, 150)
}
</script>

<style scoped>
.idea-input-wrap {
  padding: 0 16px 16px;
  position: relative;
  z-index: 10;
}

.input-card {
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  transition: all var(--duration-fast) var(--ease-out);
  display: flex;
  flex-direction: column;
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
  justify-content: space-between;
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

.voice-preview {
  margin-top: 8px;
  padding: 10px 14px;
  background: var(--color-accent-soft);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-accent);
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.5;
}

.voice-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  margin-top: 6px;
  flex-shrink: 0;
  animation: pulse 1s infinite;
}

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
