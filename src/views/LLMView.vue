<template>
  <div class="llm-view">
    <header class="view-header">
      <button class="back-btn" @click="$router.push('/')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1 class="view-title">AI 助手</h1>
      <span v-if="configs.length" class="status-badge connected">{{ configs.length }} 个模型</span>
    </header>

    <div class="content-area">
      <!-- 已连接模型列表 -->
      <div v-if="configs.length" class="config-section anim-fade-up">
        <div class="section-label">已连接的模型</div>
        <div class="config-card" v-for="cfg in configs" :key="cfg.id">
          <div class="config-body">
            <span class="config-model">
              {{ cfg.label || cfg.model || '未命名' }}
              <span v-if="cfg.builtin" class="builtin-badge">内置</span>
            </span>
            <span class="config-url">{{ cfg.baseUrl }}</span>
            <span class="config-extra" v-if="cfg.model && cfg.model !== cfg.label">{{ cfg.model }}</span>
          </div>
          <button
            v-if="!cfg.builtin"
            class="config-logout"
            @click="doLogoutConfig(cfg.id)"
            title="登出此模型"
          >登出</button>
          <button
            v-else
            class="config-remove"
            @click="doRemoveBuiltin(cfg.id)"
            title="移除此模型"
          >移除</button>
        </div>
        <button class="add-model-btn" @click="showAddForm = !showAddForm">
          {{ showAddForm ? '收起' : '+ 添加模型' }}
        </button>
      </div>

      <!-- 添加/登录面板 -->
      <div v-if="!configs.length || showAddForm" class="login-panel anim-fade-up">
        <div class="login-hero" v-if="!configs.length">
          <span class="login-icon">🤖</span>
          <p class="login-desc">连接大模型，解锁智能总结、标签校准、深度讨论功能</p>
        </div>

        <div class="form-group">
          <label class="form-label">选择模型</label>
          <select v-model="selectedPreset" class="form-select" @change="onPresetChange">
            <option v-for="p in presets" :key="p.label" :value="p">{{ p.label }}</option>
          </select>
          <p class="form-hint" v-if="selectedPreset.description">{{ selectedPreset.description }}</p>
        </div>

        <div class="form-group">
          <label class="form-label">Base URL</label>
          <input
            v-model="baseUrl"
            type="text"
            class="form-input"
            placeholder="https://api.deepseek.com"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Model ID</label>
          <input
            v-model="modelId"
            type="text"
            class="form-input"
            placeholder="deepseek-v4-flash"
          />
        </div>

        <div class="form-group">
          <label class="form-label">连接名称</label>
          <input
            v-model="labelName"
            type="text"
            class="form-input"
            :placeholder="selectedPreset.label"
          />
          <p class="form-hint">用于区分同一厂商的多个模型，如"DeepSeek Flash"和"DeepSeek Pro"</p>
        </div>

        <div class="form-group" v-if="!selectedPreset.noApiKey">
          <label class="form-label">API Key</label>
          <div class="input-password">
            <input
              v-model="apiKey"
              :type="showKey ? 'text' : 'password'"
              class="form-input"
              placeholder="sk-..."
            />
            <button class="toggle-btn" @click="showKey = !showKey">
              <svg v-if="!showKey" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="form-group" v-else>
          <p class="no-key-hint">此模型运行在本地，无需 API Key</p>
        </div>

        <button class="connect-btn" :class="{ loading: connecting }" :disabled="connecting || !canConnect" @click="doConnect">
          <span v-if="!connecting">🔗 连接</span>
          <span v-else class="spinner-text">测试连接中...</span>
        </button>
        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <p class="privacy-hint">API Key 保存在本设备，仅发送至你配置的 API 地址</p>
      </div>

      <!-- 功能面板（有已连接模型时显示） -->
      <div v-if="configs.length" class="function-panel anim-fade-up">
        <div class="action-card" @click="doSummarize">
          <div class="action-icon">📋</div>
          <div class="action-body">
            <h3 class="action-title">总结</h3>
            <p class="action-desc">帮我进行今日想法总结</p>
          </div>
          <select class="model-selector" v-model="activeForSummarize" @click.stop>
            <option v-for="cfg in configs" :key="cfg.id" :value="cfg.id">{{ cfg.label || cfg.model || '未命名' }}</option>
          </select>
          <div v-if="summarizing" class="action-spinner"></div>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16" class="action-arrow">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>

        <div class="action-card" @click="doCalibrate">
          <div class="action-icon">🎯</div>
          <div class="action-body">
            <h3 class="action-title">校准</h3>
            <p class="action-desc">标签、分类等系统识别校准</p>
          </div>
          <select class="model-selector" v-model="activeForCalibrate" @click.stop>
            <option v-for="cfg in configs" :key="cfg.id" :value="cfg.id">{{ cfg.label || cfg.model || '未命名' }}</option>
          </select>
          <div v-if="calibrating" class="action-spinner"></div>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16" class="action-arrow">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>

        <div class="action-card" @click="doDiscuss">
          <div class="action-icon">💬</div>
          <div class="action-body">
            <h3 class="action-title">讨论</h3>
            <p class="action-desc">对每条想法生成 AI 评论</p>
          </div>
          <select class="model-selector" v-model="activeForDiscuss" @click.stop>
            <option v-for="cfg in configs" :key="cfg.id" :value="cfg.id">{{ cfg.label || cfg.model || '未命名' }}</option>
          </select>
          <div v-if="discussing" class="action-spinner"></div>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16" class="action-arrow">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>

        <!-- 结果区域 -->
        <div v-if="result" class="result-card" :class="result.type">
          <div class="result-header">
            <h3>{{ result.title }}</h3>
            <button class="result-close" @click="result = null">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="result-content" v-if="result.text">{{ result.text }}</div>
          <div class="result-content" v-else v-html="result.content"></div>
          <div class="result-actions" v-if="result.actions">
            <button v-for="a in result.actions" :key="a.label" class="btn-result" :class="a.variant" @click="a.handler">{{ a.label }}</button>
          </div>
        </div>

        <p v-if="actionError" class="error-msg">{{ actionError }}</p>

        <div v-if="projects.length" class="project-summary-section">
          <div class="section-divider">
            <span class="section-label">项目总结</span>
          </div>
          <div class="project-pick-row">
            <select v-model="activeProjectForSummary" class="form-select" @click.stop>
              <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <button class="btn-project-summary" :disabled="projectSummarizing" @click="doProjectSummary">
              <span v-if="!projectSummarizing">🤖 生成项目总结</span>
              <span v-else class="spinner-text">生成中...</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getLLMConfigs, saveLLMConfig, removeLLMConfig, getActiveLLMIds, setActiveLLMId, MODEL_PRESETS } from '../settings'
import { generateSmartSummary, calibrateIdeas, discussIdeasBatch, generateProjectSummary, testConnection } from '../llm'
import { getTodayIdeas, getTodayNote, updateIdea, getIdeasByProject } from '../db'
import { useIdeaStore } from '../store'

const store = useIdeaStore()
const route = useRoute()

const presets = MODEL_PRESETS
const selectedPreset = ref(presets[0])
const baseUrl = ref(presets[0].baseUrl)
const modelId = ref(presets[0].id)
const labelName = ref('')
const apiKey = ref('')
const showKey = ref(false)
const connecting = ref(false)
const errorMsg = ref('')
const showAddForm = ref(false)

const configs = ref([])
const activeForSummarize = ref('')
const activeForCalibrate = ref('')
const activeForDiscuss = ref('')

const summarizing = ref(false)
const calibrating = ref(false)
const discussing = ref(false)
const projectSummarizing = ref(false)
const result = ref(null)
const actionError = ref('')

const projects = computed(() => store.projects)
const activeProjectForSummary = ref('')

const canConnect = computed(() => {
  if (!baseUrl.value) return false
  if (selectedPreset.value.noApiKey) return true
  return !!apiKey.value.trim()
})

onMounted(async () => {
  await loadConfigs()
  await store.loadProjects()
  activeProjectForSummary.value = store.projects[0]?.id || ''
  // If navigated from project detail with ?project=xxx param
  const queryProjectId = route.query.project
  if (queryProjectId) {
    activeProjectForSummary.value = queryProjectId
  }
})

async function loadConfigs() {
  configs.value = await getLLMConfigs()
  const activeIds = await getActiveLLMIds()
  // Set defaults: use stored selection or first available config
  const firstId = configs.value[0]?.id || ''
  activeForSummarize.value = activeIds.summarize || firstId
  activeForCalibrate.value = activeIds.calibrate || firstId
  activeForDiscuss.value = activeIds.discuss || firstId
  if (!configs.value.length) showAddForm.value = true
}

function resolveConfig(action) {
  const idMap = { summarize: activeForSummarize.value, calibrate: activeForCalibrate.value, discuss: activeForDiscuss.value }
  const id = idMap[action]
  return configs.value.find(c => c.id === id) || configs.value[0] || null
}

// Persist active selections
watch(activeForSummarize, (val) => { if (val) setActiveLLMId('summarize', val) })
watch(activeForCalibrate, (val) => { if (val) setActiveLLMId('calibrate', val) })
watch(activeForDiscuss, (val) => { if (val) setActiveLLMId('discuss', val) })

function onPresetChange() {
  baseUrl.value = selectedPreset.value.baseUrl || ''
  modelId.value = selectedPreset.value.id || ''
  labelName.value = ''
}

async function doConnect() {
  connecting.value = true
  errorMsg.value = ''
  try {
    const noV1 = selectedPreset.value.noV1 || false
    const noApiKey = selectedPreset.value.noApiKey || false

    // 智能 URL 处理：剥离用户可能粘贴的 API 路径后缀，避免双写
    let url = baseUrl.value.replace(/\/+$/, '')
    let effectiveNoV1 = noV1

    // 检测并剥离常见 API 路径后缀
    if (url.endsWith('/v1/chat/completions')) {
      url = url.slice(0, -'/chat/completions'.length)
      effectiveNoV1 = true
    } else if (url.endsWith('/chat/completions')) {
      url = url.slice(0, -'/chat/completions'.length)
    } else if (!noV1 && url.endsWith('/v1')) {
      effectiveNoV1 = true
    }

    await testConnection(url, apiKey.value.trim(), effectiveNoV1, noApiKey)
    const label = labelName.value.trim() || selectedPreset.value.label
    const cfg = {
      baseUrl: url,
      apiKey: apiKey.value.trim(),
      model: modelId.value || undefined,
      noV1: effectiveNoV1,
      noApiKey,
      label
    }
    await saveLLMConfig(cfg)
    await loadConfigs()
    // Reset form
    apiKey.value = ''
    labelName.value = ''
    showAddForm.value = false
    await store.loadToday()
  } catch (e) {
    errorMsg.value = e.message || '连接失败'
  } finally {
    connecting.value = false
  }
}

async function doRemoveBuiltin(id) {
  if (!confirm('移除内置 GLM-4.7 后将无法自动恢复，确定移除？')) return
  await removeLLMConfig(id)
  const { markBuiltinGLMRemoved } = await import('../builtin-keys.js')
  await markBuiltinGLMRemoved()
  await loadConfigs()
  result.value = null
  actionError.value = ''
}

async function doLogoutConfig(id) {
  await removeLLMConfig(id)
  await loadConfigs()
  result.value = null
  actionError.value = ''
}

async function doSummarize() {
  const cfg = resolveConfig('summarize')
  if (!cfg) { actionError.value = '请先连接模型'; return }
  summarizing.value = true
  actionError.value = ''
  result.value = null
  try {
    const ideas = await getTodayIdeas()
    if (!ideas.length) {
      result.value = { type: 'info', title: '今天还没有想法', text: '先记录一些想法再回来总结吧' }
      return
    }
    const existing = await getTodayNote()
    const { content: summary, usage, fallback } = await generateSmartSummary(ideas, cfg)
    const tokenInfo = usage ? ` (消耗 ${usage.total} tokens)` : ''
    const warnText = fallback ? '⚠️ AI 模型未返回有效结果，已使用本地规则生成。\n\n' : ''
    result.value = {
      type: fallback ? 'fallback' : 'success',
      title: `今日总结${fallback ? '（本地生成）' : tokenInfo}`,
      text: warnText + summary,
      actions: [
        {
          label: existing ? '覆盖今日笔记' : '保存为今日笔记',
          variant: 'primary',
          handler: () => saveSummary(summary, ideas, existing)
        }
      ]
    }
  } catch (e) {
    actionError.value = e.message || '生成失败'
  } finally {
    summarizing.value = false
  }
}

async function saveSummary(summary, ideas, existing) {
  if (existing && !confirm('今日已有笔记，是否覆盖？')) return
  const { saveDailyNote } = await import('../db')
  const categoryStats = {}
  for (const idea of ideas) {
    categoryStats[idea.category] = (categoryStats[idea.category] || 0) + 1
  }
  await saveDailyNote({
    date: new Date().toISOString().slice(0, 10),
    ideas: ideas.map(i => i.id),
    summary,
    categoryStats,
    totalCount: ideas.length,
    generatedAt: Date.now()
  })
  const msg = existing ? '今日笔记已覆盖更新，可在历史页面查看' : '今日笔记已保存，可在历史页面查看'
  result.value = { type: 'success', title: '已保存', text: msg }
}

async function doCalibrate() {
  const cfg = resolveConfig('calibrate')
  if (!cfg) { actionError.value = '请先连接模型'; return }
  calibrating.value = true
  actionError.value = ''
  result.value = null
  try {
    const ideas = await getTodayIdeas()
    if (!ideas.length) {
      result.value = { type: 'info', title: '今天还没有想法', text: '先记录一些想法再校准' }
      return
    }
    const calibration = await calibrateIdeas(ideas, cfg)
    if (calibration.fallback) {
      result.value = { type: 'fallback', title: '校准失败（本地生成）', text: '⚠️ AI 模型未返回有效结果，请检查模型配置或网络连接。' }
      return
    }
    const tokenInfo = calibration.usage ? ` (消耗 ${calibration.usage.total} tokens)` : ''
    const total = calibration.corrections.length + calibration.splits.length
    if (total === 0) {
      result.value = { type: 'info', title: `校准完成${tokenInfo}`, text: '你的想法分类和标签看起来很准确，无需调整 👍' }
      return
    }
    const items = []
    for (const c of calibration.corrections) {
      const idea = ideas.find(i => i.id === c.id)
      const oldInfo = idea ? `[${idea.category}] ${idea.tags.join(', ')}` : ''
      const newInfo = `[${c.category}] ${c.tags.join(', ')}`
      items.push(`旧: ${oldInfo} → 新: ${newInfo}`)
    }
    result.value = {
      type: 'calibration',
      title: `发现 ${total} 处可优化${tokenInfo}`,
      text: items.join('\n'),
      actions: [
        { label: `应用修正 (${calibration.corrections.length})`, variant: 'primary', handler: () => applyCalibration(calibration, ideas) }
      ]
    }
  } catch (e) {
    actionError.value = e.message || '校准失败'
  } finally {
    calibrating.value = false
  }
}

async function applyCalibration(calibration, ideas) {
  for (const c of calibration.corrections) {
    const idea = ideas.find(i => i.id === c.id)
    if (idea) {
      await updateIdea(c.id, { category: c.category, tags: c.tags })
    }
  }
  for (const s of calibration.splits) {
    const idea = ideas.find(i => i.id === s.id)
    if (idea && s.parts?.length > 1) {
      const { addIdea } = await import('../db')
      for (const part of s.parts) {
        await addIdea({ content: part, category: idea.category, tags: idea.tags, source: 'text' })
      }
    }
  }
  await store.loadToday()
  result.value = { type: 'success', title: '修正已应用', text: `已更新 ${calibration.corrections.length} 条标签和分类` }
}

async function doDiscuss(supplement = false) {
  const cfg = resolveConfig('discuss')
  if (!cfg) { actionError.value = '请先连接模型'; return }
  discussing.value = true
  actionError.value = ''
  result.value = null
  try {
    const ideas = await getTodayIdeas()
    if (!ideas.length) {
      result.value = { type: 'info', title: '今天还没有想法', text: '记录一些想法后再来讨论吧' }
      return
    }

    function shouldSkip(idea) {
      if (idea.completed) return true
      const disc = idea.discussion || []
      if (disc.length >= 3) return true
      const mn = cfg.model || cfg.label || ''
      if (disc.some(d => d.model === mn)) return true
      return false
    }

    const targets = supplement
      ? ideas.filter(i => !shouldSkip(i))
      : ideas.filter(i => {
          if (shouldSkip(i)) return false
          return !i.discussion || !i.discussion.length
        })

    if (!targets.length) {
      const msg = supplement
        ? '所有符合条件的想法都已有评论或已完成'
        : '每条想法都已有 AI 评论，或已完成/评论过多'
      result.value = {
        type: 'info', title: '无需讨论',
        text: supplement ? msg : `${msg}。点击"补充讨论"可让当前模型基于已有评论追加新观点。`,
        actions: supplement ? [] : [{ label: '补充讨论', variant: 'primary', handler: () => doDiscuss(true) }]
      }
      return
    }

    result.value = { type: 'info', title: '正在生成评论...', text: `正在分析 ${targets.length} 条想法，请稍候...` }

    const prevDiscussions = {}
    for (const idea of targets) {
      if (Array.isArray(idea.discussion) && idea.discussion.length) {
        prevDiscussions[idea.id] = idea.discussion
      }
    }

    const newDiscussions = await discussIdeasBatch(targets, prevDiscussions, cfg)
    // 并行写入 IndexedDB，提升大批量保存性能
    const updates = newDiscussions.map(async (d) => {
      const idea = ideas.find(i => i.id === d.id)
      if (!idea) return null
      const existing = Array.isArray(idea.discussion) ? idea.discussion : []
      return updateIdea(d.id, { discussion: [...existing, d] })
    })
    const results = await Promise.all(updates)
    const count = results.filter(Boolean).length

    await store.loadToday()
    const modelName = cfg.model || cfg.label || ''
    const tokenInfo = newDiscussions.length ? ` · 模型: ${modelName}` : ''
    const suffix = supplement && count > 0 ? `（${modelName} 补充）` : ''
    result.value = {
      type: 'success',
      title: `讨论完成${suffix}`,
      text: `已为 ${count} 条想法生成评论${tokenInfo}。返回首页查看每条想法下方的讨论内容。`,
      actions: supplement ? [] : [{ label: '补充讨论', variant: 'primary', handler: () => doDiscuss(true) }]
    }
  } catch (e) {
    actionError.value = e.message || '讨论生成失败'
  } finally {
    discussing.value = false
  }
}

async function doProjectSummary() {
  const pid = activeProjectForSummary.value
  const cfg = configs.value.find(c => c.id === activeForDiscuss.value) || configs.value[0]
  if (!pid) { actionError.value = '请先选择项目'; return }
  if (!cfg) { actionError.value = '请先连接模型'; return }
  projectSummarizing.value = true
  actionError.value = ''
  result.value = null
  try {
    const project = store.projects.find(p => p.id === pid)
    const ideas = await getIdeasByProject(pid)
    if (!project) { actionError.value = '项目不存在'; return }
    const { content: summary, usage, fallback } = await generateProjectSummary(project, ideas, cfg)
    const tokenInfo = usage ? ` (消耗 ${usage.total} tokens)` : ''
    const warn = fallback ? '⚠️ AI 模型未返回有效结果。\n' : ''
    result.value = {
      type: fallback ? 'fallback' : 'success',
      title: `${project.name} — 项目总结${fallback ? '（本地生成）' : tokenInfo}`,
      text: warn + summary
    }
  } catch (e) {
    actionError.value = e.message || '生成失败'
  } finally {
    projectSummarizing.value = false
  }
}
</script>

<style scoped>
.llm-view {
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

.status-badge {
  font-size: var(--text-xs);
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-weight: 600;
}

.status-badge.connected {
  background: var(--color-green-soft);
  color: var(--color-green);
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 24px;
}

.login-panel {
  max-width: 420px;
  margin: 0 auto;
}

.login-hero {
  text-align: center;
  margin-bottom: 24px;
}

.login-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 12px;
}

.login-desc {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 6px;
}

.form-input,
.form-select {
  width: 100%;
  padding: 12px 14px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text);
  background: var(--color-surface);
  transition: border-color var(--duration-fast);
  -webkit-appearance: none;
  appearance: none;
}

.form-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238B8680' stroke-width='2' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  padding-right: 36px;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}

.form-input[readonly] {
  background: var(--color-surface-hover);
  color: var(--color-text-secondary);
}

.form-hint {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: 4px;
}

.input-password {
  position: relative;
}

.input-password .form-input {
  padding-right: 40px;
}

.toggle-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-tertiary);
  padding: 4px;
}

.toggle-btn:active {
  color: var(--color-text);
}

.connect-btn {
  width: 100%;
  padding: 14px;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: #fff;
  font-size: var(--text-base);
  font-weight: 600;
  transition: all var(--duration-fast);
  margin-top: 8px;
}

.connect-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.connect-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.connect-btn.loading {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.error-msg {
  margin-top: 12px;
  padding: 10px 14px;
  background: #FEE2E2;
  color: #DC2626;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.no-key-hint {
  padding: 12px 14px;
  background: var(--color-green-soft);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--color-green);
  text-align: center;
}

.privacy-hint {
  margin-top: 12px;
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  text-align: center;
  line-height: 1.5;
}

/* config section */
.config-section {
  max-width: 420px;
  margin: 0 auto 16px;
}

.section-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 10px;
  padding: 0 4px;
}

.config-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  margin-bottom: 6px;
  box-shadow: var(--shadow-sm);
}

.config-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.config-model {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text);
}

.config-url {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  word-break: break-all;
}

.config-extra {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.config-logout {
  font-size: var(--text-xs);
  font-weight: 500;
  color: #DC2626;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid #FEE2E2;
  flex-shrink: 0;
  transition: all var(--duration-fast);
}

.config-logout:active {
  background: #FEF2F2;
}

.config-remove {
  font-size: var(--text-xs);
  font-weight: 500;
  color: #D97706;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid #FEF3C7;
  flex-shrink: 0;
  transition: all var(--duration-fast);
}

.config-remove:active {
  background: #FFFBEB;
}

.builtin-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--color-green-soft);
  color: var(--color-green);
  margin-left: 6px;
  vertical-align: middle;
}

.form-input.readonly {
  background: var(--color-surface-hover);
  color: var(--color-text-secondary);
  cursor: default;
}

.add-model-btn {
  display: block;
  width: 100%;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1.5px dashed var(--color-border);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  text-align: center;
  transition: all var(--duration-fast);
}

.add-model-btn:active {
  background: var(--color-surface-hover);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* function panel */
.function-panel {
  max-width: 420px;
  margin: 0 auto;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  margin-bottom: 10px;
  cursor: pointer;
  transition: transform var(--duration-fast);
  box-shadow: var(--shadow-sm);
}

.action-card:active {
  transform: scale(0.98);
}

.action-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.action-body {
  flex: 1;
  min-width: 0;
}

.action-title {
  font-size: var(--text-base);
  font-weight: 600;
}

.action-desc {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.action-arrow {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.model-selector {
  font-size: var(--text-xs);
  padding: 4px 24px 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-hover);
  color: var(--color-text-secondary);
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238B8680' stroke-width='2' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  flex-shrink: 0;
  max-width: 120px;
}

.model-selector:focus {
  outline: none;
  border-color: var(--color-accent);
}

.action-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* result */
.result-card {
  margin-top: 16px;
  padding: 16px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.result-card.calibration {
  border-left: 3px solid var(--color-accent);
}

.result-card.success {
  border-left: 3px solid var(--color-green);
}

.result-card.fallback {
  border-left: 3px solid #F59E0B;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.result-header h3 {
  font-size: var(--text-lg);
  font-weight: 600;
}

.result-close {
  color: var(--color-text-tertiary);
  padding: 4px;
}

.result-content {
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--color-text);
}

.result-content :deep(.calib-item) {
  padding: 8px 0;
  border-bottom: 1px solid var(--color-divider);
}

.result-content :deep(.calib-old) {
  color: var(--color-text-tertiary);
  text-decoration: line-through;
}

.result-content :deep(.calib-new) {
  color: var(--color-green);
  font-weight: 600;
}

.result-actions {
  margin-top: 14px;
  display: flex;
  gap: 8px;
}

.btn-result {
  padding: 8px 18px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 600;
  transition: background var(--duration-fast);
}

.btn-result.primary {
  background: var(--color-accent);
  color: #fff;
}

.btn-result:active {
  transform: scale(0.96);
}

/* project summary */
.project-summary-section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--color-divider);
}

.section-divider {
  margin-bottom: 8px;
}

.section-divider .section-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.project-pick-row {
  display: flex;
  gap: 8px;
}

.project-pick-row .form-select {
  flex: 1;
}

.btn-project-summary {
  flex-shrink: 0;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-size: var(--text-sm);
  font-weight: 600;
  white-space: nowrap;
  transition: all var(--duration-fast);
}

.btn-project-summary:disabled {
  opacity: 0.5;
}

.btn-project-summary:active:not(:disabled) {
  transform: scale(0.98);
}
</style>
