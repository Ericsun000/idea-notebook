<template>
  <div class="history-view">
    <header class="view-header">
      <h1 class="view-title">历史笔记</h1>
    </header>

    <div class="content-area" v-if="!loading">
      <div class="note-list" v-if="notes.length">
        <router-link
          v-for="(note, i) in notes"
          :key="note.date"
          :to="`/daily/${note.date}`"
          class="note-card anim-fade-up"
          :class="'stagger-' + (Math.min(i, 4) + 1)"
        >
          <div class="note-date">
            <span class="note-day">{{ formatDay(note.date) }}</span>
            <span class="note-weekday">{{ formatWeekday(note.date) }}</span>
          </div>
          <div class="note-body">
            <p class="note-summary-text">{{ note.summary }}</p>
            <div class="note-meta">
              <span>{{ note.totalCount }} 条想法</span>
              <span class="meta-dot">·</span>
              <span>{{ formatTime(note.generatedAt) }}</span>
            </div>
          </div>
          <svg class="note-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </router-link>
      </div>
      <EmptyState
        v-else
        icon="📖"
        title="还没有笔记"
        desc="记录足够想法后，生成每日笔记就会出现在这里"
      />
    </div>
    <div v-else class="loading-state">
      <div class="loading-shimmer" v-for="i in 3" :key="i"></div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useIdeaStore } from '../store.js'
import EmptyState from '../components/EmptyState.vue'

const store = useIdeaStore()
const loading = ref(true)

const notes = computed(() => store.allNotes)

onMounted(async () => {
  await store.loadAllNotes()
  loading.value = false
})

function formatDay(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function formatWeekday(dateStr) {
  const d = new Date(dateStr)
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateStr === today) return '今天'
  if (dateStr === yesterday) return '昨天'
  return d.toLocaleDateString('zh-CN', { weekday: 'short' })
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.history-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.view-header {
  padding: calc(16px + var(--safe-top)) 20px 12px;
}

.view-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 16px;
}

.note-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 16px;
}

.note-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 16px;
  text-decoration: none;
  color: inherit;
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-fast);
}

.note-card:active {
  transform: scale(0.98);
}

.note-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 44px;
}

.note-day {
  font-size: var(--text-lg);
  font-weight: 700;
}

.note-weekday {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.note-body {
  flex: 1;
  min-width: 0;
}

.note-summary-text {
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--color-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.note-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.note-arrow {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.loading-state {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.loading-shimmer {
  height: 80px;
  border-radius: var(--radius-md);
  background: linear-gradient(90deg, var(--color-surface-hover) 25%, var(--color-surface) 50%, var(--color-surface-hover) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
</style>
