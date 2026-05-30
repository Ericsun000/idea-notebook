import { getLLMConfig, isLLMConfigured } from './settings'
import { classify, extractTags, generateDailySummary } from './classifier'

async function callLLM(systemPrompt, userMessage, options = {}) {
  const config = await getLLMConfig()
  if (!config || !config.baseUrl || !config.apiKey) {
    throw new Error('LLM 未配置，请先在 AI 助手页面设置')
  }

  const { model, temperature = 0.3, maxTokens = 2048, response_format } = options

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

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
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
  return data.choices?.[0]?.message?.content || null
}

function parseJSONResponse(text) {
  if (!text) return null
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        return null
      }
    }
    return null
  }
}

export async function generateSmartSummary(ideas) {
  if (!(await isLLMConfigured())) {
    return generateDailySummary(ideas)
  }

  const ideasText = ideas.map((i, idx) =>
    `${idx + 1}. [${i.category}] ${i.content} 标签: ${i.tags.join(', ')}`
  ).join('\n')

  const systemPrompt = `你是一个思维整理助手。用户今天记录了一些想法和灵感，请根据这些内容生成一段自然、温暖、有洞察力的每日总结。
要求：
1. 用中文
2. 150-300 字
3. 先概括今天的思维主题
4. 指出值得关注的亮点或趋势
5. 给出一个温和的建议或鼓励
6. 不要逐条罗列，而是整合叙述`

  try {
    const result = await callLLM(systemPrompt, ideasText)
    return result || generateDailySummary(ideas)
  } catch {
    return generateDailySummary(ideas)
  }
}

export async function calibrateIdeas(ideas) {
  if (!(await isLLMConfigured())) {
    return { corrections: [], splits: [] }
  }

  const ideasJSON = ideas.map(i => ({
    id: i.id,
    content: i.content,
    currentCategory: i.category,
    currentTags: i.tags
  }))

  const systemPrompt = `你是一个数据分析师。检查以下想法列表，判断各项是否正确分类、标签是否合适、是否存在应该拆分为多条的想法。
返回严格 JSON（不要包含 markdown 标记）：
{
  "corrections": [
    { "id": "xxx", "category": "新分类", "tags": ["标签1", "标签2"] }
  ],
  "splits": [
    { "id": "xxx", "reason": "拆分原因", "parts": ["第1部分", "第2部分"] }
  ]
}
分类只能是：工作、生活、学习、创作、其他。标签从常用标签中选择：灵感、待办、疑问、发现、计划、学习、脑洞、想法。
只返回确实需要修改的条目，不需要修改的不要返回。如果没有需要修改的，返回空数组。`

  try {
    const result = await callLLM(systemPrompt, JSON.stringify(ideasJSON, null, 2),
      { temperature: 0.1, response_format: { type: 'json_object' } })
    const parsed = parseJSONResponse(result)
    if (parsed && (parsed.corrections || parsed.splits)) {
      return {
        corrections: parsed.corrections || [],
        splits: parsed.splits || []
      }
    }
    return { corrections: [], splits: [] }
  } catch {
    return { corrections: [], splits: [] }
  }
}

export async function discussIdea(content, category, tags) {
  if (!(await isLLMConfigured())) return null

  const systemPrompt = `你是一个思维伙伴。用户记录了一个想法，请提出有价值的评论、延伸思考或实践建议。
要求：
1. 用中文
2. 100-300 字
3. 风格：友善、有深度、启发思考
4. 可以提出反问来激发更深入的思考
5. 可以建议相关的书籍、工具或方法
6. 格式：自然段落，不要列表或编号`

  const context = `分类：${category}\n标签：${tags.join(', ')}\n想法：${content}`

  try {
    return await callLLM(systemPrompt, context, { temperature: 0.6 })
  } catch {
    return null
  }
}

export async function testConnection(baseUrl, apiKey) {
  const url = baseUrl.replace(/\/+$/, '')
  const response = await fetch(`${url}/v1/models`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })
  return response.ok
}

export { callLLM }
