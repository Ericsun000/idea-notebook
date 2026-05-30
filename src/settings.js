import { getDB } from './db'

async function getSetting(key) {
  const db = await getDB()
  return db.get('settings', key)
}

async function setSetting(key, value) {
  const db = await getDB()
  await db.put('settings', { key, value, updatedAt: Date.now() })
}

async function deleteSetting(key) {
  const db = await getDB()
  await db.delete('settings', key)
}

const LLM_CONFIGS_KEY = 'llm_configs'
const ACTIVE_LLM_KEY = 'active_llm_ids'

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export const MODEL_PRESETS = [
  {
    id: 'deepseek-v4-flash',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    description: '国产高性价比，中文能力强'
  },
  {
    id: 'glm-4.7',
    label: '智谱 GLM-4.7',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    description: '智谱AI，中文理解优秀',
    noV1: true
  },
  {
    id: 'qwen-plus',
    label: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode',
    description: '阿里云，多模态能力强'
  },
  {
    id: 'moonshot-v1',
    label: 'Kimi',
    baseUrl: 'https://api.moonshot.cn',
    description: '月之暗面，长文本处理'
  },
  {
    id: '',
    label: '本地 Llama / Ollama',
    baseUrl: '/api/ollama',
    description: '本地运行，需通过 Vite 代理',
    noV1: true,
    noApiKey: true,
    customUrl: true,
    customModel: true
  },
  {
    id: '',
    label: 'LM Studio',
    baseUrl: '/api/lmstudio',
    description: '本地 LM Studio，需通过 Vite 代理',
    noV1: true,
    noApiKey: true,
    customUrl: true,
    customModel: true
  },
  {
    id: '',
    label: '自定义',
    baseUrl: '',
    description: '任意 OpenAI 兼容接口',
    custom: true,
    customUrl: true,
    customModel: true
  }
]

export async function getLLMConfigs() {
  const entry = await getSetting(LLM_CONFIGS_KEY)
  return entry?.value || []
}

export async function getLLMConfig(id) {
  const configs = await getLLMConfigs()
  if (id) return configs.find(c => c.id === id) || null
  return configs[0] || null
}

export async function saveLLMConfig(config) {
  const configs = await getLLMConfigs()
  const idx = configs.findIndex(c => c.id === config.id)
  if (idx >= 0) {
    configs[idx] = { ...configs[idx], ...config }
  } else {
    const newConfig = { ...config }
    newConfig.id = newConfig.id || genId()
    newConfig.label = newConfig.label || newConfig.model || newConfig.baseUrl || '未命名'
    newConfig.createdAt = newConfig.createdAt || Date.now()
    configs.push(newConfig)
  }
  await setSetting(LLM_CONFIGS_KEY, configs)
  return config
}

export async function removeLLMConfig(id) {
  let configs = await getLLMConfigs()
  configs = configs.filter(c => c.id !== id)
  await setSetting(LLM_CONFIGS_KEY, configs)
  const active = await getActiveLLMIds()
  let changed = false
  for (const [key, val] of Object.entries(active)) {
    if (val === id) { delete active[key]; changed = true }
  }
  if (changed) await setSetting(ACTIVE_LLM_KEY, active)
}

export async function getActiveLLMIds() {
  const entry = await getSetting(ACTIVE_LLM_KEY)
  return entry?.value || {}
}

export async function getActiveLLMId(action) {
  const ids = await getActiveLLMIds()
  return ids[action] || null
}

export async function setActiveLLMId(action, id) {
  const ids = await getActiveLLMIds()
  if (id) {
    ids[action] = id
  } else {
    delete ids[action]
  }
  await setSetting(ACTIVE_LLM_KEY, ids)
}

export async function isLLMConfigured() {
  const configs = await getLLMConfigs()
  return configs.length > 0
}

// Backward compat wrappers
export async function setLLMConfig({ baseUrl, apiKey, model, noV1, noApiKey, label }) {
  const config = { baseUrl, apiKey, model, noV1, noApiKey, label }
  return saveLLMConfig(config)
}

export async function clearLLMConfig() {
  await setSetting(LLM_CONFIGS_KEY, [])
  await setSetting(ACTIVE_LLM_KEY, {})
}

export { getSetting, setSetting, deleteSetting }
