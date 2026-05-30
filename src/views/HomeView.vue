<template>
  <div class="home-view">
    <header class="view-header">
      <h1 class="view-title">灵感笔记</h1>
      <div class="header-right">
        <router-link to="/settings" class="settings-btn" aria-label="设置" title="设置">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" width="18" height="18">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </router-link>
        <router-link to="/llm" class="ai-btn" aria-label="AI 助手">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
            <path d="M12 2a4 4 0 0 1 4 4v1h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2V6a4 4 0 0 1 4-4z"/>
            <path d="M9 18v-4"/>
            <path d="M12 18v-2"/>
            <path d="M15 18v-6"/>
          </svg>
        </router-link>
        <span class="today-date">{{ todayLabel }}</span>
      </div>
    </header>

    <div class="content-area" ref="scrollRef">
      <section class="section" v-if="todayNote">
        <DailySummary :note="todayNote" />
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">今日想法</h2>
          <span class="section-count" v-if="todayIdeas.length">{{ filteredIdeas.length }} 条</span>
        </div>

        <div class="filter-tabs" v-if="todayIdeas.length">
          <button
            v-for="f in filters"
            :key="f.key"
            class="filter-tab"
            :class="{ active: store.viewFilter === f.key }"
            @click="store.setFilter(f.key)"
          >{{ f.label }}</button>
        </div>

        <div class="idea-list" v-if="filteredIdeas.length">
          <IdeaCard
            v-for="(idea, i) in filteredIdeas"
            :key="idea.id"
            :idea="idea"
            :class="'stagger-' + (Math.min(i, 4) + 1)"
            @delete="onDelete"
            @change-category="cat => onChangeCategory(idea.id, cat)"
            @toggle-completed="onToggleCompleted"
          />
        </div>
        <EmptyState
          v-else-if="!loading && todayIdeas.length === 0"
          icon="✨"
          title="今天还没有想法"
          desc="在下方输入框记录一闪而过的灵感吧"
        />
        <EmptyState
          v-else-if="!loading"
          icon="📋"
          title="没有匹配的想法"
          :desc="viewFilter === 'active' ? '所有想法都已完成！' : '还没有完成任何想法'"
        />
        <div v-else class="loading-shimmer"></div>
      </section>

      <section class="section" v-if="!todayNote && todayIdeas.length >= 3">
        <router-link to="/llm" class="gen-hint">
          <span>已有 {{ todayIdeas.length }} 条想法，用 AI 生成今日笔记</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </router-link>
      </section>

      <div class="bottom-spacer"></div>
    </div>

    <IdeaInput
      @submit="onSubmit"
      @voice-submit="onVoiceSubmit"
      @submit-multiple="onSubmitMultiple"
    />
    <ConfettiEffect :active="milestone.showCelebration.value" :duration="3000" />
    <transition name="fade-slide-up">
      <div v-if="milestone.showCelebration.value && milestone.currentMilestone.value" class="milestone-toast" @click="milestone.dismiss()">
        <span class="milestone-emoji">{{ milestone.currentMilestone.value.emoji }}</span>
        <span class="milestone-text">{{ milestone.currentMilestone.value.label }}</span>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useIdeaStore } from '../store.js'
import { getAllIdeas } from '../db.js'
import { useMilestone } from '../composables/useMilestone.js'
import { useAutoBackup } from '../composables/useAutoBackup.js'
import IdeaInput from '../components/IdeaInput.vue'
import IdeaCard from '../components/IdeaCard.vue'
import EmptyState from '../components/EmptyState.vue'
import DailySummary from '../components/DailySummary.vue'
import ConfettiEffect from '../components/ConfettiEffect.vue'

const store = useIdeaStore()
const scrollRef = ref(null)
const milestone = useMilestone()
const autoBackup = useAutoBackup()

const filters = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'completed', label: '已完成' }
]
const todayIdeas = computed(() => store.todayIdeas)
const todayNote = computed(() => store.todayNote)
const loading = computed(() => store.loading)
const filteredIdeas = computed(() => store.filteredTodayIdeas)
const viewFilter = computed(() => store.viewFilter)

const todayLabel = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
})

onMounted(async () => {
  await store.loadToday()
  autoBackup.checkAndBackup()
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
  checkMilestone()
}

async function onVoiceSubmit({ text, duration }) {
  await store.createVoiceIdea(text, duration)
}

async function onSubmitMultiple(texts) {
  for (const t of texts) {
    await store.createIdea(t)
  }
}

async function onDelete(id) {
  await store.deleteIdea(id)
}

async function onChangeCategory(id, category) {
  await store.updateIdeaCat(id, category)
}

async function onToggleCompleted(id) {
  await store.toggleCompleted(id)
}

async function checkMilestone() {
  const all = await getAllIdeas()
  milestone.check(all.length)
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
  align-items: center;
  justify-content: space-between;
}

.view-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-btn,
.ai-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  transition: all var(--duration-fast);
}

.settings-btn:active {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.ai-btn:active {
  background: var(--color-surface-hover);
  color: var(--color-accent);
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

.filter-tabs {
  display: flex;
  gap: 6px;
  padding: 0 16px 10px;
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
  text-decoration: none;
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

.milestone-toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: var(--color-surface);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-lg);
  z-index: 10000;
  cursor: pointer;
  font-weight: 600;
  font-size: var(--text-base);
  animation: scaleBounce 0.5s var(--ease-spring) both;
}

.milestone-emoji {
  font-size: 1.5rem;
}

.milestone-text {
  font-size: var(--text-base);
  color: var(--color-text);
}

.fade-slide-up-enter-active,
.fade-slide-up-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
}

.fade-slide-up-enter-from,
.fade-slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
