<template>
  <div class="trash-view">
    <header class="view-header">
      <button class="back-btn" @click="$router.back()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1 class="view-title">回收站</h1>
      <button v-if="trashIdeas.length" class="empty-btn" @click="confirmEmpty">清空</button>
    </header>

    <div class="content-area">
      <div class="trash-list" v-if="trashIdeas.length">
        <div class="idea-card anim-fade-up" v-for="(idea, i) in trashIdeas" :key="idea.id" :class="'stagger-' + (Math.min(i, 4) + 1)">
          <div class="card-body">
            <p class="card-content">{{ idea.content }}</p>
            <div class="card-meta">
              <span class="meta-cat">{{ idea.category }}</span>
              <span class="meta-dot">·</span>
              <span class="meta-time">删除于 {{ formatDate(idea.deletedAt) }}</span>
            </div>
          </div>
          <button class="restore-btn" @click="restore(idea.id)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" width="16" height="16">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            <span>恢复</span>
          </button>
        </div>
      </div>
      <EmptyState
        v-else-if="!loading"
        icon="🗑️"
        title="回收站是空的"
        desc="删除的想法会先移入回收站，3天后自动清除"
      />
      <div v-else class="loading-shimmer"></div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useIdeaStore } from '../store.js'
import EmptyState from '../components/EmptyState.vue'

const store = useIdeaStore()
const loading = ref(true)

const trashIdeas = computed(() => store.trashIdeas)

onMounted(async () => {
  await store.loadTrash()
  loading.value = false
})

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 3600000) return '刚刚'
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 259200000) return `${Math.floor(diff / 86400000)} 天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

async function restore(id) {
  await store.undoDelete(id)
}

async function confirmEmpty() {
  if (confirm('确定永久删除回收站中的所有内容？此操作不可撤销。')) {
    await store.emptyTrash()
  }
}
</script>

<style scoped>
.trash-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg);
}

.view-header {
  padding: calc(16px + var(--safe-top)) 16px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.back-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--color-text);
  transition: background var(--duration-fast);
}

.back-btn:active {
  background: var(--color-surface-hover);
}

.view-title {
  font-size: var(--text-xl);
  font-weight: 700;
  flex: 1;
}

.empty-btn {
  font-size: var(--text-sm);
  color: #DC2626;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast);
}

.empty-btn:active {
  background: #FEE2E2;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 24px;
}

.trash-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.idea-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  box-shadow: var(--shadow-sm);
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-content {
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--color-text);
  word-break: break-word;
  opacity: 0.7;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.meta-cat {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--color-surface-hover);
}

.meta-dot {
  color: var(--color-text-tertiary);
}

.meta-time {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.restore-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  color: var(--color-accent);
  font-size: var(--text-xs);
  transition: background var(--duration-fast);
  flex-shrink: 0;
}

.restore-btn:active {
  background: var(--color-accent-soft);
}

.loading-shimmer {
  height: 80px;
  border-radius: var(--radius-md);
  background: linear-gradient(90deg, var(--color-surface-hover) 25%, var(--color-surface) 50%, var(--color-surface-hover) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
</style>
