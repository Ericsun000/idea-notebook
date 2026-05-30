<template>
  <div class="timeline-view">
    <header class="view-header">
      <h1 class="view-title">时间线</h1>
    </header>

    <div class="content-area" v-if="!loading">
      <div class="filter-tabs" v-if="allIdeas.length">
        <button
          v-for="f in filters"
          :key="f.key"
          class="filter-tab"
          :class="{ active: viewFilter === f.key }"
          @click="viewFilter = f.key"
        >{{ f.label }}</button>
      </div>
      <div class="tag-filter-bar" v-if="tagFilter">
        <span class="tag-filter-label">标签筛选：</span>
        <span class="tag-filter-chip">
          {{ tagFilter }}
          <button class="tag-filter-close" @click="tagFilter = ''" title="取消筛选">&times;</button>
        </span>
      </div>
      <template v-if="filteredGroupedIdeas.length">
        <section class="section" v-for="group in filteredGroupedIdeas" :key="group.date">
          <div class="date-header">
            <span class="date-label">{{ group.label }}</span>
            <span class="date-count">{{ group.ideas.length }} 条</span>
          </div>
          <div class="idea-list">
            <IdeaCard
              v-for="(idea, i) in group.ideas"
              :key="idea.id"
              :idea="idea"
              :active-tag="tagFilter"
              :class="'stagger-' + (Math.min(i, 4) + 1)"
              @delete="onDelete"
              @change-category="cat => onChangeCategory(idea.id, cat)"
              @toggle-completed="onToggleCompleted"
              @tag-click="onTagClick"
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
const viewFilter = ref('all')
const tagFilter = ref('')

const filters = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'completed', label: '已完成' }
]

const allIdeas = computed(() => store.allIdeas)

onMounted(async () => {
  await store.loadAll()
  loading.value = false
})

function onTagClick(tag) {
  tagFilter.value = tagFilter.value === tag ? '' : tag
}

function applyFilters(ideas) {
  let result = ideas
  if (viewFilter.value !== 'all') {
    const completed = viewFilter.value === 'completed'
    result = result.filter(i => !!i.completed === completed)
  }
  if (tagFilter.value) {
    result = result.filter(i => i.tags && i.tags.includes(tagFilter.value))
  }
  return result
}

function groupByDate(ideas) {
  const map = {}
  for (const idea of ideas) {
    if (!map[idea.date]) map[idea.date] = []
    map[idea.date].push(idea)
  }
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dateIdeas]) => ({
      date,
      label: date === today ? '今天' : date === yesterday ? '昨天' : formatDate(date),
      ideas: dateIdeas
    }))
}

const filteredGroupedIdeas = computed(() => {
  return groupByDate(applyFilters(store.allIdeas))
})

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
}

async function onToggleCompleted(id) {
  const idea = store.allIdeas.find(i => i.id === id)
  if (idea) {
    const { updateIdea } = await import('../db.js')
    const updated = await updateIdea(id, { completed: !idea.completed })
    if (updated) {
      const idx = store.allIdeas.findIndex(i => i.id === id)
      if (idx !== -1) store.allIdeas[idx] = updated
    }
  }
}

async function onDelete(id) {
  await store.deleteIdea(id)
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

.filter-tabs {
  display: flex;
  gap: 6px;
  padding: 0 16px 12px;
}

.filter-tab {
  padding: 4px 14px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-surface-hover);
  transition: all var(--duration-fast);
}

.filter-tab.active {
  background: var(--color-accent);
  color: #fff;
}

.filter-tab:active {
  transform: scale(0.96);
}

.tag-filter-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 20px 10px;
  font-size: var(--text-xs);
}

.tag-filter-label {
  color: var(--color-text-tertiary);
}

.tag-filter-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px 3px 10px;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border-radius: var(--radius-full);
  font-weight: 600;
}

.tag-filter-close {
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
  color: var(--color-accent);
  opacity: 0.6;
}

.tag-filter-close:active {
  opacity: 1;
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
