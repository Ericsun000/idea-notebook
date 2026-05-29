<template>
  <div class="daily-note-view">
    <header class="view-header">
      <button class="back-btn" @click="$router.back()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1 class="view-title">{{ pageTitle }}</h1>
    </header>

    <div class="content-area" v-if="!loading && note">
      <DailySummary :note="note" />

      <section class="section">
        <h3 class="section-title">当日想法</h3>
        <div class="idea-list">
          <IdeaCard
            v-for="(idea, i) in noteIdeas"
            :key="idea.id"
            :idea="idea"
            :class="'stagger-' + (Math.min(i, 4) + 1)"
            @delete="onDelete"
            @change-category="cat => onChangeCategory(idea.id, cat)"
          />
        </div>
        <EmptyState
          v-if="!noteIdeas.length"
          icon="💭"
          title="这些想法可能已被删除"
        />
      </section>
    </div>
    <div v-else-if="!loading && !note" class="not-found">
      <EmptyState icon="🔍" title="笔记不存在" desc="该日期的笔记尚未生成或已被删除" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getDailyNote, getIdeasByDate, deleteIdea, updateIdea } from '../db.js'
import IdeaCard from '../components/IdeaCard.vue'
import DailySummary from '../components/DailySummary.vue'
import EmptyState from '../components/EmptyState.vue'

const route = useRoute()
const date = computed(() => route.params.date)
const note = ref(null)
const noteIdeas = ref([])
const loading = ref(true)

const pageTitle = computed(() => {
  if (!date.value) return ''
  const d = new Date(date.value)
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
})

onMounted(async () => {
  note.value = await getDailyNote(date.value)
  if (note.value) {
    noteIdeas.value = await getIdeasByDate(date.value)
  }
  loading.value = false
})

async function onDelete(id) {
  await deleteIdea(id)
  noteIdeas.value = noteIdeas.value.filter(i => i.id !== id)
}

async function onChangeCategory(id, category) {
  const updated = await updateIdea(id, { category })
  if (updated) {
    const idx = noteIdeas.value.findIndex(i => i.id === id)
    if (idx !== -1) noteIdeas.value[idx] = updated
  }
}
</script>

<style scoped>
.daily-note-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.view-header {
  padding: calc(16px + var(--safe-top)) 16px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
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
  letter-spacing: -0.02em;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 24px;
}

.section {
  margin-top: 20px;
}

.section-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 20px 10px;
}

.idea-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 16px;
}

.not-found {
  padding-top: 40px;
}
</style>
