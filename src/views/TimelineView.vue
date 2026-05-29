<template>
  <div class="timeline-view">
    <header class="view-header">
      <h1 class="view-title">时间线</h1>
    </header>

    <div class="content-area" v-if="!loading">
      <template v-if="groupedIdeas.length">
        <section class="section" v-for="group in groupedIdeas" :key="group.date">
          <div class="date-header">
            <span class="date-label">{{ group.label }}</span>
            <span class="date-count">{{ group.ideas.length }} 条</span>
          </div>
          <div class="idea-list">
            <IdeaCard
              v-for="(idea, i) in group.ideas"
              :key="idea.id"
              :idea="idea"
              :class="'stagger-' + (Math.min(i, 4) + 1)"
              @delete="onDelete"
              @change-category="cat => onChangeCategory(idea.id, cat)"
            />
          </div>
        </section>
      </template>
      <EmptyState
        v-else
        icon="🕐"
        title="还没有想法"
        desc="记录下你的第一个灵感吧"
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
import IdeaCard from '../components/IdeaCard.vue'
import EmptyState from '../components/EmptyState.vue'

const store = useIdeaStore()
const loading = ref(true)

onMounted(async () => {
  await store.loadAll()
  loading.value = false
})

const groupedIdeas = computed(() => {
  const map = {}
  for (const idea of store.allIdeas) {
    if (!map[idea.date]) map[idea.date] = []
    map[idea.date].push(idea)
  }
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, ideas]) => ({
      date,
      label: date === today ? '今天' : date === yesterday ? '昨天' : formatDate(date),
      ideas
    }))
})

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
}

async function onDelete(id) {
  await store.removeIdea(id)
}

async function onChangeCategory(id, category) {
  await store.updateIdeaCat(id, category)
}
</script>

<style scoped>
.timeline-view {
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
}

.section {
  margin-bottom: 16px;
}

.date-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 8px 20px 8px;
  position: sticky;
  top: 0;
  background: var(--color-bg);
  z-index: 5;
}

.date-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.date-count {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.idea-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 16px;
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
