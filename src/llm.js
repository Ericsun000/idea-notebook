import { getLLMConfig, isLLMConfigured } from './settings'
import { generateDailySummary } from './classifier'

function truncate(text, maxLen = 300) {
  if (!text || text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}

async function callLLM(systemPrompt, userMessage, options = {}) {
  const config = await getLLMConfig()
  if (!config || !config.baseUrl) {
    throw new Error('LLM 未配置，请先在 AI 助手页面设置')
  }
  if (!config.noApiKey && !config.apiKey) {
    throw new Error('API Key 未配置，请先在 AI 助手页面设置')
  }

  const { model, temperature = 0.3, maxTokens = 1024, response_format } = options

  const body = {
    model: model || config.model || 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature,
    max_tokens: maxTokens
  }

  if (response_format) {
    body.response_format = response_format
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, '')
  const urlObj = new URL(baseUrl)
  if (urlObj.protocol !== 'https:' && urlObj.hostname !== 'localhost' && urlObj.hostname !== '127.0.0.1') {
    throw new Error('安全警告：API Key 将通过不安全的 HTTP 传输，请使用 HTTPS 地址')
  }

  const prefix = config.noV1 ? '' : '/v1'
  const response = await fetch(`${baseUrl}${prefix}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.noApiKey ? {} : { 'Authorization': `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('API Key 无效，请检查配置')
    }
    console.error('API error details:', response.status, await response.text())
    throw new Error(`API 请求失败 (${response.status})`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || null
  const usage = data.usage || null
  return { content, usage }
}

function parseJSONResponse(text) {
  if (!text) return null
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  try { return JSON.parse(cleaned) } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (match) { try { return JSON.parse(match[0]) } catch { return null } }
  return null
}

function formatUsage(usage) {
  if (!usage) return null
  return {
    prompt: usage.prompt_tokens || 0,
    completion: usage.completion_tokens || 0,
    total: usage.total_tokens || 0
  }
}

export async function generateSmartSummary(ideas) {
  if (!(await isLLMConfigured())) {
    return { content: generateDailySummary(ideas), usage: null }
  }

  const ideasText = ideas.map((i, idx) =>
    `${idx + 1}. [${i.category}] ${truncate(i.content)}`
  ).join('\n')

  const systemPrompt = `你是思维整理助手。根据用户今日想法生成一段 150-300 字的每日总结。用中文，概括思维主题，指出亮点或趋势，给一条温和建议。整合叙述，不要逐条罗列。`

  try {
    const { content, usage } = await callLLM(systemPrompt, ideasText)
    return { content: content || generateDailySummary(ideas), usage: formatUsage(usage) }
  } catch {
    return { content: generateDailySummary(ideas), usage: null }
  }
}

export async function calibrateIdeas(ideas) {
  if (!(await isLLMConfigured())) {
    return { corrections: [], splits: [], usage: null }
  }

  const ideasJSON = ideas.map(i => ({
    id: i.id,
    content: truncate(i.content),
    currentCategory: i.category,
    currentTags: i.tags
  }))

  const systemPrompt = `你是数据分析师。检查想法列表，修正分类和标签。返回纯 JSON（无 markdown）：
{"corrections":[{"id":"xxx","category":"新分类","tags":["标签1"]}],"splits":[{"id":"xxx","reason":"原因","parts":["部分1"]}]}
分类限：工作、生活、学习、创作、其他。标签从：灵感、待办、疑问、发现、计划、学习、脑洞、想法 中选择。只返回需修改的条目，无需修改返回空数组。`

  try {
    const { content, usage } = await callLLM(systemPrompt, JSON.stringify(ideasJSON),
      { temperature: 0.1, response_format: { type: 'json_object' } })
    const parsed = parseJSONResponse(content)
    return {
      corrections: parsed?.corrections || [],
      splits: parsed?.splits || [],
      usage: formatUsage(usage)
    }
  } catch {
    return { corrections: [], splits: [], usage: null }
  }
}

export async function discussIdeasBatch(ideas, previousDiscussions = {}) {
  if (!(await isLLMConfigured())) return []

  const config = await getLLMConfig()
  const modelName = config?.model || 'unknown'

  const ideasJSON = ideas.map(i => {
    const prev = previousDiscussions[i.id] || []
    const prevContext = prev.length > 0
      ? `\n已有评论：${prev.map(d => `[${d.model}] ${d.content}`).join(' | ')}`
      : ''
    return {
      id: i.id,
      content: truncate(i.content),
      category: i.category,
      tags: i.tags,
      hasPrevious: prev.length > 0
    }
  })

  const systemPrompt = `你是一个思维伙伴。对每条想法给出 80-200 字的评论。用中文，友善有深度。
${previousDiscussions && Object.values(previousDiscussions).some(a => a.length) ? '部分想法已有其他模型的评论，你可以补充新角度或提出不同观点，但不要重复已有内容。' : ''}
返回纯 JSON：{"discussions":[{"id":"想法ID","content":"评论内容"}]}`

  try {
    const { content } = await callLLM(systemPrompt, JSON.stringify(ideasJSON),
      { temperature: 0.6, maxTokens: 2048 })
    const parsed = parseJSONResponse(content)
    if (parsed?.discussions) {
      return parsed.discussions.map(d => ({
        id: d.id,
        model: modelName,
        content: d.content,
        timestamp: Date.now()
      }))
    }
    return []
  } catch {
    return []
  }
}

export async function testConnection(baseUrl, apiKey, noV1 = false, noApiKey = false) {
  const url = baseUrl.replace(/\/+$/, '')
  const prefix = noV1 ? '' : '/v1'
  const modelsUrl = noV1 ? `${url}/models` : `${url}${prefix}/models`
  const headers = noApiKey ? {} : { 'Authorization': `Bearer ${apiKey}` }
  const response = await fetch(modelsUrl, { method: 'GET', headers })
  return response.ok
}
