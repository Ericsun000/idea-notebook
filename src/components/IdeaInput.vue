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
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import VoiceInput from './VoiceInput.vue'
import { useVoiceInput } from '../composables/useVoiceInput.js'

const emit = defineEmits(['submit', 'voice-submit'])

const text = ref('')
const isFocused = ref(false)
const textareaRef = ref(null)
const voice = useVoiceInput()
const isListening = ref(false)
const voiceStartTime = ref(0)

watch(() => voice.isListening.value, (val) => {
  isListening.value = val
})

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
  emit('submit', t)
  text.value = ''
  nextTick(autoResize)
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
