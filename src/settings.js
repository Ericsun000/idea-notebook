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

const LLM_CONFIG_KEY = 'llm_config'

export const MODEL_PRESETS = [
  {
    id: 'deepseek-chat',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    description: '国产高性价比，中文能力强'
  },
  {
    id: 'glm-4',
    label: '智谱 GLM-4',
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
    baseUrl: 'http://localhost:11434',
    description: '本地运行，完全离线',
    noV1: true,
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

export async function getLLMConfig() {
  const entry = await getSetting(LLM_CONFIG_KEY)
  return entry?.value || null
}

export async function setLLMConfig({ baseUrl, apiKey, model }) {
  await setSetting(LLM_CONFIG_KEY, { baseUrl, apiKey, model })
}

export async function clearLLMConfig() {
  await deleteSetting(LLM_CONFIG_KEY)
}

export async function isLLMConfigured() {
  const config = await getLLMConfig()
  return !!(config && config.baseUrl && config.apiKey)
}

export { getSetting, setSetting, deleteSetting }
