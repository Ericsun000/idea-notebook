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

  const systemPrompt = `你是用户的思维伙伴。根据以下今日记录的想法，写一段 150-300 字的每日回顾。

这**不是**分类统计。像朋友一样帮用户回顾今天的思维轨迹：
- 今天脑子里主要在转什么？有什么主题或情绪串联了多个想法？
- 有没有特别闪光的灵感，或者值得关注的担忧？
- 给一条温和的、有共鸣的回应或建议。

**格式示例**（自然段落，像日记回顾，不是列表）：
"今天你的思绪主要围绕项目架构重构和周末出行计划。关于微服务拆分的几个想法很有深度，尤其是API网关那一块看得出你在认真思考。不过也注意到你对截止日期有些焦虑——也许明天可以先聚焦一个可交付的最小版本。"

**严格禁止**：
- 禁止写"工作类X条、生活类Y条"这种分类计数
- 禁止逐条罗列或编号复述每条想法
- 禁止只复读分类标签而不做内容整合`

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

  const systemPrompt = `你是数据分析师。检查以下想法列表，判断分类和标签是否准确。

**分类规则**（从内容实质判断，不是从表面关键词）：
- 工作：与职业、项目、任务、协作相关
- 生活：日常起居、饮食、出行、购物、社交
- 学习：阅读、上课、研究、技能习得、认知提升
- 创作：写作、设计、艺术表达、内容产出
- 其他：无法归入以上的

**标签规则**（从以下选择）：灵感、待办、疑问、发现、计划、学习、脑洞、想法

只修正确实错误的条目。如无错误，返回空数组。

返回纯 JSON，不要 markdown：
{"corrections":[{"id":"xxx","category":"新分类","tags":["标签1"]}],"splits":[{"id":"xxx","reason":"原因","parts":["部分1"]}]}`

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

  const systemPrompt = `你是用户的思维伙伴。对每条想法给出 80-200 字的深度评论。用中文。

每条评论应该：
- 针对想法**具体内容**展开，不是泛泛评价
- 可以延伸相关知识点、工具推荐、反向问题
- 像朋友聊天一样自然，不要像写论文

**示例评论**（假如想法是"周末想去露营放松一下"）：
"忙了一周确实需要换个环境。城西的森林公园不错，车程一小时内，而且这个季节蚊虫还不算多。建议带上便携咖啡壶——清晨在林子里煮一杯会很惬意。如果担心一个人，可以问问上次一起爬山的小王有没有兴趣。"

${previousDiscussions && Object.values(previousDiscussions).some(a => a.length) ? '部分想法已有其他模型的评论，你可以从新角度补充或提出不同看法，但**不要复述已有观点**。' : ''}
**严格禁止**：禁止只复述想法内容而不加入新信息。每条评论必须包含延伸、提问或建议中的至少一项。

返回纯 JSON，不要 markdown 标记：
{"discussions":[{"id":"想法ID","content":"评论内容"}]}`

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

  try {
    const response = await fetch(modelsUrl, { method: 'GET', headers })
    if (!response.ok) {
      throw new Error(`服务器返回 ${response.status}，请检查 URL 和端口是否正确`)
    }
    return true
  } catch (e) {
    if (e.message.includes('Failed to fetch') || e.name === 'TypeError') {
      const isLocal = url.includes('localhost') || url.includes('127.0.0.1')
      if (isLocal) {
        throw new Error(`无法连接到 ${url}\n请确认：\n1. LM Studio / Ollama 已启动\n2. 端口号正确\n3. Server 开关已打开`)
      }
      throw new Error(`无法连接到 ${url}\n请检查网络连接和 Base URL`)
    }
    throw e
  }
}
