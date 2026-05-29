<template>
  <div class="voice-input" v-if="isSupported">
    <transition name="fade">
      <button
        v-if="!isListening"
        class="voice-btn"
        @click="startListening"
        aria-label="语音输入"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
      <button
        v-else
        class="voice-btn listening"
        @click="stopListening"
        aria-label="停止录音"
      >
        <span class="pulse-ring"></span>
        <svg viewBox="0 0 24 24" fill="var(--color-accent)" stroke="none" width="18" height="18">
          <rect x="6" y="2" width="4" height="20" rx="2"/>
          <rect x="14" y="2" width="4" height="20" rx="2"/>
        </svg>
      </button>
    </transition>
  </div>
</template>

<script setup>
import { watch } from 'vue'

const props = defineProps({
  isListening: Boolean,
  isSupported: Boolean
})

const emit = defineEmits(['start', 'stop'])

function startListening() {
  emit('start')
}

function stopListening() {
  emit('stop')
}
</script>

<style scoped>
.voice-input {
  display: flex;
  align-items: center;
}

.voice-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  transition: all var(--duration-fast) var(--ease-out);
  position: relative;
  flex-shrink: 0;
}

.voice-btn:active {
  transform: scale(0.92);
  background: var(--color-surface-hover);
}

.voice-btn.listening {
  color: var(--color-accent);
  background: var(--color-accent-soft);
}

.pulse-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid var(--color-accent);
  animation: pulse-ring 1.2s var(--ease-out) infinite;
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.9);
    opacity: 1;
  }
  100% {
    transform: scale(1.4);
    opacity: 0;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-fast);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
