<template>
  <div class="project-detail-view">
    <header class="view-header">
      <button class="back-btn" @click="$router.push('/projects')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1 class="view-title">{{ project?.name || '加载中...' }}</h1>
      <button class="edit-btn" @click="showEdit = !showEdit" v-if="project">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    </header>

    <div class="content-area" v-if="project">
      <!-- 编辑项目信息 -->
      <div v-if="showEdit" class="edit-card anim-fade-up">
        <div class="form-group">
          <label class="form-label">项目名称</label>
          <input v-model="editName" type="text" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">简介</label>
          <input v-model="editDesc" type="text" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">背景/目标</label>
          <textarea v-model="editBackground" class="form-textarea" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">关键上下文</label>
          <textarea v-model="editContext" class="form-textarea" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">状态</label>
          <select v-model="editStatus" class="form-select">
            <option value="active">进行中</option>
            <option value="completed">已完成</option>
            <option value="paused">暂停</option>
          </select>
        </div>
        <div class="form-actions">
          <button class="btn-primary" :disabled="!editName.trim()" @click="doSave">保存</button>
          <button class="btn-text" @click="showEdit = false">取消</button>
        </div>
        <button class="btn-delete" @click="doDelete">删除项目</button>
      </div>

      <!-- 项目信息区 -->
      <div v-else class="project-info anim-fade-up">
        <div class="info-row" v-if="project.description">
          <span class="info-label">简介</span>
          <p class="info-text">{{ project.description }}</p>
        </div>
        <div class="info-row" v-if="project.background">
          <span class="info-label">背景/目标</span>
          <p class="info-text">{{ project.background }}</p>
        </div>
        <div class="info-row" v-if="project.context">
          <span class="info-label">关键上下文</span>
          <p class="info-text">{{ project.context }}</p>
        </div>
        <div class="info-row">
          <span class="info-label">状态</span>
          <span class="info-status" :class="project.status">{{ statusLabel(project.status) }}</span>
        </div>
        <div class="info-row" v-if="project.summary">
          <span class="info-label">AI 项目总结</span>
          <p class="info-text summary-text">{{ project.summary }}</p>
          <span class="summary-meta" v-if="project.summaryModel || project.summaryTime">
            生成模型: {{ project.summaryModel }} · {{ formatDate(project.summaryTime) }}
          </span>
        </div>
        <router-link :to="`/llm?project=${project.id}`" class="ai-summarize-btn">
          🤖 {{ project.summary ? '重新生成总结' : 'AI 项目总结' }}
        </router-link>
      </div>

      <!-- 想法列表 -->
      <section class="ideas-section" v-if="!showEdit">
        <div class="section-header">
          <h2 class="section-title">项目想法</h2>
          <span class="section-count" v-if="projectIdeas.length">{{ filteredIdeas.length }} 条</span>
        </div>

        <div class="filter-tabs" v-if="projectIdeas.length">
          <button v-for="f in filters" :key="f.key" class="filter-tab" :class="{ active: viewFilter === f.key }" @click="viewFilter = f.key">{{ f.label }}</button>
        </div>

        <div class="tag-filter-bar" v-if="tagFilter">
          <span class="tag-filter-chip">
            {{ tagFilter }}
            <button class="tag-filter-close" @click="tagFilter = ''">&times;</button>
          </span>
        </div>

        <div class="idea-list" v-if="filteredIdeas.length">
          <IdeaCard
            v-for="(idea, i) in filteredIdeas"
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
        <EmptyState v-else-if="projectIdeas.length === 0" icon="💡" title="还没有想法" desc="回到首页，选择此项目后记录你的第一条想法" />
        <EmptyState v-else icon="📋" title="没有匹配的想法" desc="尝试切换筛选条件" />
      </section>
    </div>

    <div class="loading-shimmer" v-else></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useIdeaStore } from '../store.js'
import { getIdeasByProject, updateIdea } from '../db.js'
import IdeaCard from '../components/IdeaCard.vue'
import EmptyState from '../components/EmptyState.vue'

const props = defineProps({ id: String })
const store = useIdeaStore()
const router = useRouter()

const project = computed(() => store.projects.find(p => p.id === props.id) || null)
const projectIdeas = ref([])
const viewFilter = ref('all')
const tagFilter = ref('')
const showEdit = ref(false)

const editName = ref('')
const editDesc = ref('')
const editBackground = ref('')
const editContext = ref('')
const editStatus = ref('active')

const filters = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'completed', label: '已完成' }
]

const filteredIdeas = computed(() => {
  let ideas = projectIdeas.value
  if (viewFilter.value !== 'all') {
    const completed = viewFilter.value === 'completed'
    ideas = ideas.filter(i => !!i.completed === completed)
  }
  if (tagFilter.value) {
    ideas = ideas.filter(i => i.tags && i.tags.includes(tagFilter.value))
  }
  return ideas
})

function statusLabel(s) {
  return { active: '进行中', completed: '已完成', paused: '暂停' }[s] || s
}

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(async () => {
  await store.loadProjects()
  projectIdeas.value = await getIdeasByProject(props.id)
})

function openEdit() {
  const p = project.value
  if (!p) return
  editName.value = p.name
  editDesc.value = p.description
  editBackground.value = p.background
  editContext.value = p.context
  editStatus.value = p.status
  showEdit.value = true
}

watch(showEdit, (val) => { if (val) openEdit() })

async function doSave() {
  await store.updateProject(props.id, {
    name: editName.value.trim(),
    description: editDesc.value.trim(),
    background: editBackground.value.trim(),
    context: editContext.value.trim(),
    status: editStatus.value
  })
  showEdit.value = false
}

async function doDelete() {
  if (!confirm(`确定删除项目"${project.value?.name}"？\n所有相关想法的项目关联将被移除，但想法本身会保留。`)) return
  await store.deleteProject(props.id)
  router.push('/projects')
}

async function onDelete(id) {
  await store.deleteIdea(id)
  projectIdeas.value = projectIdeas.value.filter(i => i.id !== id)
}

async function onToggleCompleted(id) {
  const idea = projectIdeas.value.find(i => i.id === id)
  if (idea) {
    const updated = await updateIdea(id, { completed: !idea.completed })
    if (updated) {
      const idx = projectIdeas.value.findIndex(i => i.id === id)
      if (idx !== -1) projectIdeas.value[idx] = updated
    }
  }
}

async function onChangeCategory(id, category) {
  const updated = await updateIdea(id, { category })
  if (updated) {
    const idx = projectIdeas.value.findIndex(i => i.id === id)
    if (idx !== -1) projectIdeas.value[idx] = updated
  }
}

function onTagClick(tag) {
  tagFilter.value = tagFilter.value === tag ? '' : tag
}
</script>

<style scoped>
.project-detail-view {
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

.back-btn, .edit-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--color-text);
  transition: background var(--duration-fast);
}

.back-btn:active, .edit-btn:active { background: var(--color-surface-hover); }

.view-title {
  font-size: var(--text-xl);
  font-weight: 700;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 24px;
}

.project-info {
  max-width: 420px;
  margin: 0 auto 20px;
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.info-row {
  margin-bottom: 12px;
}

.info-row:last-child { margin-bottom: 0; }

.info-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 4px;
}

.info-text {
  font-size: var(--text-sm);
  color: var(--color-text);
  line-height: 1.6;
}

.info-status {
  font-size: var(--text-xs);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-weight: 500;
}

.info-status.active { background: var(--color-green-soft); color: var(--color-green); }
.info-status.completed { background: var(--color-surface-hover); color: var(--color-text-tertiary); }
.info-status.paused { background: #FEF3C7; color: #B45309; }

.ai-summarize-btn {
  display: block;
  margin-top: 14px;
  padding: 10px;
  text-align: center;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
  transition: transform var(--duration-fast);
}

.ai-summarize-btn:active { transform: scale(0.98); }

.summary-text {
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--color-accent-soft);
  padding: 12px;
  border-radius: var(--radius-sm);
  margin-top: 4px;
}

.summary-meta {
  display: block;
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: 6px;
}

.edit-card {
  max-width: 420px;
  margin: 0 auto 16px;
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.form-group { margin-bottom: 12px; }

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.form-input, .form-textarea, .form-select {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text);
  background: var(--color-surface);
}

.form-textarea { resize: vertical; min-height: 52px; }

.form-select {
  -webkit-appearance: none;
  appearance: none;
}

.form-input:focus, .form-textarea:focus, .form-select:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}

.form-actions {
  display: flex;
  gap: 10px;
}

.btn-primary {
  flex: 1;
  padding: 10px;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
}

.btn-primary:disabled { opacity: 0.5; }

.btn-text {
  padding: 10px 14px;
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.btn-delete {
  display: block;
  width: 100%;
  margin-top: 14px;
  padding: 10px;
  text-align: center;
  border: 1px solid #FEE2E2;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: #DC2626;
  font-weight: 500;
}

.btn-delete:active { background: #FEF2F2; }

/* ideas section */
.ideas-section { max-width: 420px; margin: 0 auto; }

.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 0 8px;
}

.section-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-count { font-size: var(--text-xs); color: var(--color-text-tertiary); }

.filter-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.filter-tab {
  padding: 4px 12px;
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

.tag-filter-bar { margin-bottom: 8px; }

.tag-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px 3px 10px;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
}

.tag-filter-close {
  font-size: 14px;
  padding: 0 2px;
  color: var(--color-accent);
  opacity: 0.6;
}

.idea-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loading-shimmer {
  height: 120px;
  margin: 20px 16px;
  border-radius: var(--radius-md);
  background: linear-gradient(90deg, var(--color-surface-hover) 25%, var(--color-surface) 50%, var(--color-surface-hover) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
</style>
