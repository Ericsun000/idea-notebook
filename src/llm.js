import { getLLMConfig, isLLMConfigured, MODEL_PRESETS } from './settings'
import { generateDailySummary } from './classifier'
import { getProject } from './db'

function cleanReasoningText(text) {
  if (!text) return null
  let cleaned = text.replace(/^Thinking Process:?\s*/im, '')
  cleaned = cleaned.replace(/^\d+\.\s*\*\*[^*]+\*\*[:：]?\s*/gm, '')
  const lines = cleaned.split('\n').filter(l => {
    const t = l.trim()
    if (!t) return true
    if (/^\d+\.\s/.test(t) && /\b(Analyze|分析|考虑|检查|判断|确定|Identify|Consider|理解|评估|Request\b|Step\b)/i.test(t)) return false
    return true
  })
  return lines.join('\n').trim() || text
}

function truncate(text, maxLen = 300) {
  if (!text || text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}

async function callLLM(systemPrompt, userMessage, options = {}, llmConfig = null) {
  const config = llmConfig || await getLLMConfig()
  if (!config || !config.baseUrl) {
    throw new Error('LLM 未配置，请先在 AI 助手页面设置')
  }

  const preset = MODEL_PRESETS.find(p => p.baseUrl && config.baseUrl.startsWith(p.baseUrl)) || {}
  const noV1 = config.noV1 ?? preset.noV1 ?? false
  const noApiKey = config.noApiKey ?? preset.noApiKey ?? false

  if (!noApiKey && !config.apiKey) {
    throw new Error('API Key 未配置，请先在 AI 助手页面设置')
  }

  const { model, temperature = 0.3, maxTokens = 1024, response_format } = options

  const body = {
    model: model || config.model || 'deepseek-v4-flash',
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

  let baseUrl = config.baseUrl.replace(/\/+$/, '')
  if (baseUrl.startsWith('/')) {
    baseUrl = window.location.origin + baseUrl
  }
  // 自动检测并剥离 API 路径后缀，防止双写 /v1/chat/completions
  let effectiveNoV1 = noV1
  if (baseUrl.endsWith('/v1/chat/completions')) {
    baseUrl = baseUrl.slice(0, -'/chat/completions'.length)
    effectiveNoV1 = true
  } else if (baseUrl.endsWith('/chat/completions')) {
    baseUrl = baseUrl.slice(0, -'/chat/completions'.length)
  } else if (!effectiveNoV1 && baseUrl.endsWith('/v1')) {
    effectiveNoV1 = true
  }
  const urlObj = new URL(baseUrl)
  if (urlObj.protocol !== 'https:' && urlObj.hostname !== 'localhost' && urlObj.hostname !== '127.0.0.1') {
    throw new Error('安全警告：API Key 将通过不安全的 HTTP 传输，请使用 HTTPS 地址')
  }

  const prefix = effectiveNoV1 ? '' : '/v1'
  const fetchUrl = `${baseUrl}${prefix}/chat/completions`
  const headers = {
    'Content-Type': 'application/json',
    ...(noApiKey ? {} : { 'Authorization': `Bearer ${config.apiKey}` })
  }
  const TIMEOUT_MS = 120000  // 120 秒，GLM 等慢模型需要更长时间

  // 重试循环：超时和 5xx 服务器错误自动重试（最多 2 次）
  const MAX_RETRIES = 2
  let lastError
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // 指数退避：1s, 2s
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('API Key 无效，请检查配置')
        }
        const errText = await response.text().catch(() => '')
        console.error('API error details:', response.status, errText)
        throw new Error(`API 请求失败 (${response.status})`)
      }

      const data = await response.json()
      const choice = data.choices?.[0]?.message || {}
      const content = choice.content || choice.reasoning_content || null
      const usage = data.usage || null

      if (!content) {
        console.warn('LLM returned empty/null content.',
          'Model:', config.model,
          'Response keys:', Object.keys(choice),
          'Full choice:', JSON.stringify(choice).slice(0, 300))
      }

      return { content, usage }
    } catch (e) {
      clearTimeout(timeoutId)
      lastError = e

      // 仅对超时和服务器错误进行重试
      const isTimeout = e.name === 'AbortError'
      const isServerError = e.message && /API 请求失败 \(5\d{2}\)/.test(e.message)
      const isNetworkError = e.message && e.message.includes('Failed to fetch')
      const shouldRetry = isTimeout || isServerError || isNetworkError

      if (!shouldRetry || attempt >= MAX_RETRIES) break

      const reason = isTimeout ? '超时' : isServerError ? '服务器错误' : '网络错误'
      console.warn(`LLM 请求${reason}，${1000 * Math.pow(2, attempt - 1) / 1000}s 后重试 (${attempt + 1}/${MAX_RETRIES})`,
        'Model:', config.model)
    }
  }

  throw lastError
}

function parseJSONResponse(text) {
  if (!text) return null
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  try { return JSON.parse(cleaned) } catch {}
  // 从混合文本中找 JSON：定位第一个 { 到最后一个 }
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)) } catch {}
  }
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

export async function generateSmartSummary(ideas, llmConfig = null) {
  if (!Array.isArray(ideas)) return { content: '', usage: null, fallback: true }
  if (!llmConfig && !(await isLLMConfigured())) {
    return { content: generateDailySummary(ideas), usage: null, fallback: true }
  }

  const ideasText = ideas.map(i =>
    `- ${truncate(i.content)}`
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
    const { content, usage } = await callLLM(systemPrompt, ideasText, {}, llmConfig)
    const cleaned = cleanReasoningText(content)
    const fallback = !cleaned
    return { content: cleaned || generateDailySummary(ideas), usage: formatUsage(usage), fallback }
  } catch {
    return { content: generateDailySummary(ideas), usage: null, fallback: true }
  }
}

export async function generatePeriodSummary(ideas, periodLabel, llmConfig = null) {
  if (!Array.isArray(ideas) || !ideas.length) {
    return { content: `${periodLabel}暂无想法记录。`, usage: null, fallback: true }
  }
  if (!llmConfig && !(await isLLMConfigured())) {
    return { content: '', usage: null, fallback: true }
  }

  // Group ideas by date for richer context
  const dateGroups = {}
  for (const idea of ideas) {
    if (!dateGroups[idea.date]) dateGroups[idea.date] = []
    dateGroups[idea.date].push(idea)
  }
  const sortedDates = Object.keys(dateGroups).sort()

  const periodText = sortedDates.map(date => {
    const dayIdeas = dateGroups[date]
    return `--- ${date}（${dayIdeas.length}条）---\n` +
      dayIdeas.map(i => `- ${truncate(i.content)}`).join('\n')
  }).join('\n\n')

  const systemPrompt = `你是用户的思维伙伴。根据以下${periodLabel}记录的所有想法，写一段 250-500 字的周期回顾。

回顾需要：
- 梳理${periodLabel}的思维主题演变：想法之间有什么关联？有什么反复出现的主题？
- 有没有值得注意的趋势或变化？比如关注点从某个领域向另个领域的转移
- 找出 1-3 个最值得深入的想法或洞察
- 给一条温和的、有共鸣的回应或建议

格式：自然段落式的回顾文字，不要 markdown 标记。

严格禁止：
- 禁止写"工作类X条、生活类Y条"这种分类计数
- 禁止逐条罗列或编号复述每条想法
- 禁止只复读分类标签而不做内容整合`

  try {
    const { content, usage } = await callLLM(systemPrompt, periodText, { maxTokens: 2048 }, llmConfig)
    const cleaned = cleanReasoningText(content)
    const fallback = !cleaned
    return { content: cleaned || '', usage: formatUsage(usage), fallback }
  } catch {
    return { content: '', usage: null, fallback: true }
  }
}

const CALIBRATE_BATCH_SIZE = 15

async function calibrateOneBatch(ideas, llmConfig) {
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
      { temperature: 0.1, response_format: { type: 'json_object' } }, llmConfig)
    const parsed = parseJSONResponse(content)
    const fallback = !parsed
    return { corrections: parsed?.corrections || [], splits: parsed?.splits || [], usage: formatUsage(usage), fallback }
  } catch {
    return { corrections: [], splits: [], usage: null, fallback: true }
  }
}

export async function calibrateIdeas(ideas, llmConfig = null) {
  if (!Array.isArray(ideas)) return { corrections: [], splits: [], usage: null, fallback: true }
  if (!llmConfig && !(await isLLMConfigured())) {
    return { corrections: [], splits: [], usage: null, fallback: true }
  }

  // 分批处理，避免单次请求过大导致超时或失败
  const batches = []
  for (let i = 0; i < ideas.length; i += CALIBRATE_BATCH_SIZE) {
    batches.push(ideas.slice(i, i + CALIBRATE_BATCH_SIZE))
  }

  let allCorrections = []
  let allSplits = []
  let totalUsage = null
  let anySuccess = false

  for (const batch of batches) {
    const result = await calibrateOneBatch(batch, llmConfig)
    allCorrections.push(...result.corrections)
    allSplits.push(...result.splits)
    if (result.usage) {
      if (!totalUsage) totalUsage = { prompt: 0, completion: 0, total: 0 }
      totalUsage.prompt += result.usage.prompt
      totalUsage.completion += result.usage.completion
      totalUsage.total += result.usage.total
    }
    if (!result.fallback) anySuccess = true
  }

  return { corrections: allCorrections, splits: allSplits, usage: totalUsage, fallback: !anySuccess && ideas.length > 0 }
}

export async function discussIdeasBatch(ideas, previousDiscussions = {}, llmConfig = null) {
  if (!Array.isArray(ideas)) return []
  if (!llmConfig && !(await isLLMConfigured())) return []

  const config = llmConfig || await getLLMConfig()
  const modelName = config?.model || config?.label || 'unknown'

  // 过滤：跳过已完成、评论≥3条、同模型已评论的想法
  const eligible = ideas.filter(i => {
    if (i.completed) return false
    const discCount = (i.discussion?.length || 0)
    if (discCount >= 3) return false
    if (i.discussion?.some(d => d.model === modelName)) return false
    return true
  })
  if (!eligible.length) return []
  ideas = eligible

  // Pre-fetch project context for ideas that belong to a project
  const projectIds = [...new Set(ideas.filter(i => i.projectId).map(i => i.projectId))]
  const projectMap = {}
  for (const pid of projectIds) {
    const p = await getProject(pid)
    if (p) projectMap[pid] = p
  }
  const hasProjectContext = Object.keys(projectMap).length > 0

  const ideasJSON = (Array.isArray(ideas) ? ideas : []).map(i => {
    const raw = previousDiscussions[i.id]
    const prev = Array.isArray(raw) ? raw : []
    const prevContext = prev.length > 0
      ? `\n已有评论：${prev.map(d => `[${d.model}] ${d.content}`).join(' | ')}`
      : ''
    const proj = projectMap[i.projectId]
    const projContext = proj
      ? `\n所属项目：${proj.name}${proj.description ? `（${proj.description}）` : ''}${proj.context ? `\n项目上下文：${proj.context}` : ''}`
      : ''
    return {
      id: i.id,
      content: truncate(i.content) + projContext,
      category: i.category,
      tags: i.tags,
      hasPrevious: prev.length > 0
    }
  })

  const projectContextBlock = hasProjectContext
    ? `部分想法属于某个项目，系统已附上项目背景信息。请结合项目上下文给出更有针对性的评论。\n`
    : ''

  const systemPrompt = `你是用户的思维伙伴。对每条想法给出 80-200 字的深度评论。用中文。
${projectContextBlock}

每条评论应该：
- 针对想法**具体内容**展开，不是泛泛评价
- 可以延伸相关知识点、工具推荐、反向问题
- 像朋友聊天一样自然，不要像写论文

**示例评论**（假如想法是"周末想去露营放松一下"）：
"忙了一周确实需要换个环境。城西的森林公园不错，车程一小时内，而且这个季节蚊虫还不算多。建议带上便携咖啡壶——清晨在林子里煮一杯会很惬意。如果担心一个人，可以问问上次一起爬山的小王有没有兴趣。"

${previousDiscussions && Object.values(previousDiscussions).some(a => Array.isArray(a) && a.length) ? '部分想法已有其他模型的评论，你可以从新角度补充或提出不同看法，但**不要复述已有观点**。' : ''}
**严格禁止**：禁止只复述想法内容而不加入新信息。每条评论必须包含延伸、提问或建议中的至少一项。

返回纯 JSON，不要 markdown 标记：
{"discussions":[{"id":"想法ID","content":"评论内容"}]}`

  try {
    const { content } = await callLLM(systemPrompt, JSON.stringify(ideasJSON),
      { temperature: 0.6, maxTokens: 2048 }, llmConfig)
    const parsed = parseJSONResponse(content)
    if (parsed?.discussions && Array.isArray(parsed.discussions)) {
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

export async function debateIdeasBatch(ideas, previousDebates = {}, llmConfig = null) {
  if (!Array.isArray(ideas)) return []
  if (!llmConfig && !(await isLLMConfigured())) return []

  const config = llmConfig || await getLLMConfig()
  const modelName = config?.model || config?.label || 'unknown'

  // 过滤：跳过已完成、辩驳≥3条、同模型已辩驳的想法
  const eligible = ideas.filter(i => {
    if (i.completed) return false
    const debateCount = (i.debate?.length || 0)
    if (debateCount >= 3) return false
    if (i.debate?.some(d => d.model === modelName)) return false
    return true
  })
  if (!eligible.length) return []
  ideas = eligible

  // Pre-fetch project context for ideas that belong to a project
  const projectIds = [...new Set(ideas.filter(i => i.projectId).map(i => i.projectId))]
  const projectMap = {}
  for (const pid of projectIds) {
    const p = await getProject(pid)
    if (p) projectMap[pid] = p
  }
  const hasProjectContext = Object.keys(projectMap).length > 0

  const ideasJSON = (Array.isArray(ideas) ? ideas : []).map(i => {
    const raw = previousDebates[i.id]
    const prev = Array.isArray(raw) ? raw : []
    const prevContext = prev.length > 0
      ? `\n已有辩驳：${prev.map(d => `[${d.model}] ${d.content}`).join(' | ')}`
      : ''
    const proj = projectMap[i.projectId]
    const projContext = proj
      ? `\n所属项目：${proj.name}${proj.description ? `（${proj.description}）` : ''}${proj.context ? `\n项目上下文：${proj.context}` : ''}`
      : ''
    return {
      id: i.id,
      content: truncate(i.content) + projContext,
      category: i.category,
      tags: i.tags,
      hasPrevious: prev.length > 0
    }
  })

  const projectContextBlock = hasProjectContext
    ? `部分想法属于某个项目，系统已附上项目背景信息。请结合项目上下文给出更有针对性的辩驳。\n`
    : ''

  const systemPrompt = `你是用户的蓝方辩手（反方）。你的职责是**只提出反对意见**——挑战用户的想法，指出潜在问题、盲点、风险和逻辑漏洞。用中文。

${projectContextBlock}
每条辩驳应该：
- 针对想法**具体内容**提出质疑和挑战
- 指出可能被忽略的风险、代价或矛盾
- 从不同角度反驳，激发用户更深入的思考
- 语气理性克制，不要人身攻击，像一位严谨的对手

**示例辩驳**（假如想法是"周末想去露营放松一下"）：
"放松的前提是安全。这个季节蛇虫活跃，你对那片区域了解多少？手机信号覆盖如何？如果遇到突发天气变化，你的装备能扛住吗？另外，一个人的话，紧急联系人安排好了吗？露营不是搭个帐篷那么简单，建议先把安全预案做足。"

${previousDebates && Object.values(previousDebates).some(a => Array.isArray(a) && a.length) ? '部分想法已有其他模型的辩驳，你可以从新角度补充质疑，但**不要复述已有观点**。' : ''}
**严格禁止**：禁止同意或附和用户的想法。你的职责是质疑，不是支持。每条辩驳必须包含具体的质疑点或风险提示。

返回纯 JSON，不要 markdown 标记：
{"debates":[{"id":"想法ID","content":"辩驳内容"}]}`

  try {
    const { content } = await callLLM(systemPrompt, JSON.stringify(ideasJSON),
      { temperature: 0.7, maxTokens: 2048 }, llmConfig)
    const parsed = parseJSONResponse(content)
    if (parsed?.debates && Array.isArray(parsed.debates)) {
      return parsed.debates.map(d => ({
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

export async function generateProjectSummary(project, ideas, llmConfig = null) {
  if (!project) return { content: '', usage: null, fallback: true }
  if (!Array.isArray(ideas) || !ideas.length) {
    return { content: `项目"${project.name}"下暂无想法，记录一些想法后再来总结。`, usage: null, fallback: true }
  }
  if (!llmConfig && !(await isLLMConfigured())) {
    return { content: '', usage: null, fallback: true }
  }

  const ideasText = ideas.map((i, idx) =>
    `${idx + 1}. ${truncate(i.content)} [标签: ${(i.tags || []).join(', ')}]`
  ).join('\n')

  const projectInfo = [
    `项目名称：${project.name}`,
    project.description ? `简介：${project.description}` : '',
    project.background ? `背景/目标：${project.background}` : '',
    project.context ? `关键上下文：${project.context}` : '',
    `状态：${project.status}`,
    `想法数量：${ideas.length}`
  ].filter(Boolean).join('\n')

  const systemPrompt = `你是项目顾问。根据以下项目信息和相关想法，写一段 200-400 字的项目阶段性回顾。

回顾需要：
- 结合项目背景，梳理当前想法的主题脉络和进展
- 识别想法之间的关联、演进和值得注意的趋势
- 给出 1-2 条具体的下一步建议或风险提醒
- 像项目合伙人一样有洞察力，不要只复述列表

返回自然段落式的回顾文字，不要 markdown 格式。`

  const userMessage = `=== 项目信息 ===\n${projectInfo}\n\n=== 项目下的想法 ===\n${ideasText}`

  try {
    const { content, usage } = await callLLM(systemPrompt, userMessage, { maxTokens: 1536 }, llmConfig)
    const cleaned = cleanReasoningText(content)
    const fallback = !cleaned
    return { content: cleaned || `项目"${project.name}"共有 ${ideas.length} 条想法，无法生成智能总结。`, usage: formatUsage(usage), fallback }
  } catch {
    return { content: `项目"${project.name}"共有 ${ideas.length} 条想法。`, usage: null, fallback: true }
  }
}

export async function testConnection(baseUrl, apiKey, noV1 = false, noApiKey = false) {
  const url = baseUrl.replace(/\/+$/, '')
  const prefix = noV1 ? '' : '/v1'
  const testUrl = `${url}${prefix}/models`
  const headers = {
    'Content-Type': 'application/json',
    ...(noApiKey ? {} : { 'Authorization': `Bearer ${apiKey}` })
  }

  try {
    const response = await fetch(testUrl, { method: 'GET', headers })
    // 200 = 连接成功；401/403 = 端点可达但 API Key 无效，也说明连接成功
    if (response.ok || response.status === 401 || response.status === 403) {
      return true
    }
    const text = await response.text().catch(() => '')
    throw new Error(`服务器返回 ${response.status}${text ? '：' + text.slice(0, 100) : ''}，请检查 URL 和端口是否正确`)
  } catch (e) {
    if (e.message.includes('Failed to fetch') || e.name === 'TypeError') {
      const isLocal = url.includes('localhost') || url.includes('127.0.0.1')
      if (isLocal) {
        throw new Error(`无法连接到 ${url}\n请确认：\n1. LM Studio / Ollama 已启动\n2. 端口号正确\n3. Server 开关已打开`)
      }
      throw new Error(
        `无法连接到 ${url}\n\n` +
        `可能原因：\n` +
        `1. 该 API 服务不支持浏览器直接调用（CORS 限制）\n` +
        `2. 网络无法访问该地址\n` +
        `3. Base URL 配置不正确\n\n` +
        `测试地址：${testUrl}\n` +
        `提示：如果网络正常但仍无法连接，通常是该 API 不支持浏览器端调用。` +
        `DeepSeek、GLM、Qwen、Kimi 等已确认支持浏览器直接访问。`
      )
    }
    throw e
  }
}
