<template>
  <div class="home-view">
    <header class="view-header">
      <h1 class="view-title">灵感笔记</h1>
      <span class="today-date">{{ todayLabel }}</span>
    </header>

    <div class="content-area" ref="scrollRef">
      <section class="section" v-if="todayNote">
        <DailySummary :note="todayNote" />
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">今日想法</h2>
          <span class="section-count" v-if="todayIdeas.length">{{ todayIdeas.length }} 条</span>
        </div>

        <div class="idea-list" v-if="todayIdeas.length">
          <IdeaCard
            v-for="(idea, i) in todayIdeas"
            :key="idea.id"
            :idea="idea"
            :class="'stagger-' + (Math.min(i, 4) + 1)"
            @delete="onDelete"
            @change-category="cat => onChangeCategory(idea.id, cat)"
          />
        </div>
        <EmptyState
          v-else-if="!loading"
          icon="✨"
          title="今天还没有想法"
          desc="在下方输入框记录一闪而过的灵感吧"
        />
        <div v-else class="loading-shimmer"></div>
      </section>

      <section class="section" v-if="!todayNote && todayIdeas.length >= 3">
        <div class="gen-hint" @click="generateNote">
          <span>已有 {{ todayIdeas.length }} 条想法，生成今日笔记</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </section>

      <div class="bottom-spacer"></div>
    </div>

    <IdeaInput
      @submit="onSubmit"
      @voice-submit="onVoiceSubmit"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useIdeaStore } from '../store.js'
import IdeaInput from '../components/IdeaInput.vue'
import IdeaCard from '../components/IdeaCard.vue'
import EmptyState from '../components/EmptyState.vue'
import DailySummary from '../components/DailySummary.vue'

const store = useIdeaStore()
const scrollRef = ref(null)

const todayIdeas = computed(() => store.todayIdeas)
const todayNote = computed(() => store.todayNote)
const loading = computed(() => store.loading)

const todayLabel = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
})

onMounted(async () => {
  await store.loadToday()
  if (store.todayNote) return
  const lastDate = localStorage.getItem('last-visit-date')
  const todayStr = new Date().toISOString().slice(0, 10)
  if (lastDate && lastDate !== todayStr) {
    const ideas = await store.getIdeasForDate(lastDate)
    if (ideas.length) {
      await store.generateNote()
    }
  }
  localStorage.setItem('last-visit-date', todayStr)
})

async function onSubmit(text) {
  await store.createIdea(text)
}

async function onVoiceSubmit({ text, duration }) {
  await store.createVoiceIdea(text, duration)
}

async function onDelete(id) {
  await store.removeIdea(id)
}

async function onChangeCategory(id, category) {
  await store.updateIdeaCat(id, category)
}

async function generateNote() {
  await store.generateNote()
}
</script>

<style scoped>
.home-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.view-header {
  padding: calc(16px + var(--safe-top)) 20px 12px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.view-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.today-date {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.content-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
}

.section {
  margin-bottom: 4px;
}

.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 20px 10px;
}

.section-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-count {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.idea-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 16px;
}

.bottom-spacer {
  height: 16px;
}

.gen-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 12px 16px;
  padding: 14px;
  background: var(--color-accent-soft);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-accent);
  cursor: pointer;
  transition: transform var(--duration-fast);
}

.gen-hint:active {
  transform: scale(0.98);
}

.loading-shimmer {
  height: 80px;
  margin: 0 16px;
  border-radius: var(--radius-md);
  background: linear-gradient(90deg, var(--color-surface-hover) 25%, var(--color-surface) 50%, var(--color-surface-hover) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
</style>
