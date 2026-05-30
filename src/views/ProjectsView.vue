<template>
  <div class="projects-view">
    <header class="view-header">
      <h1 class="view-title">项目</h1>
      <button class="add-btn" @click="showForm = true" v-if="!showForm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </header>

    <div class="content-area">
      <!-- 创建项目表单 -->
      <div v-if="showForm" class="form-card anim-fade-up">
        <div class="form-group">
          <label class="form-label">项目名称</label>
          <input v-model="formName" type="text" class="form-input" placeholder="如: 微服务重构" />
        </div>
        <div class="form-group">
          <label class="form-label">简介</label>
          <input v-model="formDesc" type="text" class="form-input" placeholder="一句话描述这个项目" />
        </div>
        <div class="form-group">
          <label class="form-label">背景/目标</label>
          <textarea v-model="formBackground" class="form-textarea" rows="2" placeholder="为什么要做、期望达成什么"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">关键上下文</label>
          <textarea v-model="formContext" class="form-textarea" rows="2" placeholder="技术栈、约束条件、相关人员等"></textarea>
        </div>
        <div class="form-actions">
          <button class="btn-primary" :disabled="!formName.trim()" @click="doCreate">创建项目</button>
          <button class="btn-text" @click="showForm = false">取消</button>
        </div>
      </div>

      <!-- 项目列表 -->
      <div v-if="projects.length && !showForm" class="project-list anim-fade-up">
        <router-link
          v-for="p in projects"
          :key="p.id"
          :to="`/project/${p.id}`"
          class="project-card"
        >
          <div class="project-card-header">
            <h3 class="project-name">{{ p.name }}</h3>
            <span class="project-status" :class="p.status">{{ statusLabel(p.status) }}</span>
          </div>
          <p class="project-desc" v-if="p.description">{{ p.description }}</p>
          <div class="project-meta">
            <span class="project-idea-count">{{ getIdeaCount(p.id) }} 条想法</span>
          </div>
        </router-link>
      </div>

      <EmptyState
        v-if="!projects.length && !showForm"
        icon="📁"
        title="还没有项目"
        desc="点击右上角 + 创建你的第一个项目"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useIdeaStore } from '../store.js'
import EmptyState from '../components/EmptyState.vue'

const store = useIdeaStore()
const showForm = ref(false)

const formName = ref('')
const formDesc = ref('')
const formBackground = ref('')
const formContext = ref('')

const projects = computed(() => store.projects)

onMounted(() => {
  store.loadProjects()
  store.loadAll()
})

function statusLabel(s) {
  return { active: '进行中', completed: '已完成', paused: '暂停' }[s] || s
}

function getIdeaCount(projectId) {
  return store.allIdeas.filter(i => i.projectId === projectId).length
}

async function doCreate() {
  await store.createProject({
    name: formName.value.trim(),
    description: formDesc.value.trim(),
    background: formBackground.value.trim(),
    context: formContext.value.trim()
  })
  formName.value = ''
  formDesc.value = ''
  formBackground.value = ''
  formContext.value = ''
  showForm.value = false
}
</script>

<style scoped>
.projects-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg);
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

.add-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--color-accent);
  background: var(--color-accent-soft);
  transition: transform var(--duration-fast);
}

.add-btn:active { transform: scale(0.92); }

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 24px;
}

.form-card {
  max-width: 420px;
  margin: 0 auto;
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.form-group { margin-bottom: 14px; }

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text);
  background: var(--color-surface);
}

.form-textarea {
  resize: vertical;
  min-height: 52px;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.btn-primary {
  flex: 1;
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: #fff;
  font-size: var(--text-base);
  font-weight: 600;
}

.btn-primary:disabled { opacity: 0.5; }

.btn-primary:active:not(:disabled) { transform: scale(0.98); }

.btn-text {
  padding: 12px 16px;
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 420px;
  margin: 0 auto;
}

.project-card {
  display: block;
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  text-decoration: none;
  transition: transform var(--duration-fast);
}

.project-card:active { transform: scale(0.98); }

.project-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.project-name {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text);
}

.project-status {
  font-size: var(--text-xs);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-weight: 500;
  flex-shrink: 0;
}

.project-status.active {
  background: var(--color-green-soft);
  color: var(--color-green);
}

.project-status.completed {
  background: var(--color-surface-hover);
  color: var(--color-text-tertiary);
}

.project-status.paused {
  background: #FEF3C7;
  color: #B45309;
}

.project-desc {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-top: 6px;
  line-height: 1.5;
}

.project-meta {
  margin-top: 8px;
}

.project-idea-count {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}
</style>
