const CATEGORY_KEYWORDS = {
  '工作': ['工作', '会议', '项目', '需求', '上线', 'bug', 'bug', '产品', '运营', '客户', '周报', '汇报', '绩效', 'KPI', 'OKR', '任务', '进度', '排期', '迭代', '同事', '领导', '老板', '团队', '代码', '开发', '测试', '部署', '发布', 'review', 'PR', '邮件'],
  '生活': ['吃饭', '做饭', '买菜', '健身', '跑步', '运动', '睡觉', '起床', '打扫', '整理', '收纳', '购物', '买', '超市', '外卖', '快递', '搬家', '租房', '装修', '房间', '洗', '收拾', '周末', '放假', '旅行', '旅游', '出行', '车', '地铁', '公交', '打车'],
  '学习': ['学', '看书', '阅读', '课程', '教程', '视频', '笔记', '笔记', '练', '训练', '技能', '知识', '考试', '面试', '刷题', '英语', '编程', '框架', '文档', '理解', '掌握', '研究', '调研', '论文', 'paper', 'AI', '模型', '算法'],
  '创作': ['写', '画', '设计', '创意', '灵感', '音乐', '故事', '小说', '文章', '博客', '视频', '剪辑', '拍摄', '摄影', '照片', '配色', '排版', 'logo', 'UI', '字体', '海报', '原型', '草稿', 'demo'],
  '其他': []
}

const CATEGORIES = Object.keys(CATEGORY_KEYWORDS)

export function classify(text) {
  const lower = text.toLowerCase()
  const scores = {}

  for (const cat of CATEGORIES) {
    scores[cat] = 0
    for (const kw of CATEGORY_KEYWORDS[cat]) {
      if (lower.includes(kw.toLowerCase())) {
        scores[cat] += 1
      }
    }
  }

  let best = '其他'
  let bestScore = 0
  for (const cat of CATEGORIES) {
    if (scores[cat] > bestScore) {
      bestScore = scores[cat]
      best = cat
    }
  }

  return { category: best, confidence: bestScore }
}

export function extractTags(text) {
  const tags = new Set()
  const lower = text.toLowerCase()

  const tagPatterns = [
    { kw: ['灵感', 'idea', '想法', '点子'], tag: '灵感' },
    { kw: ['待办', 'todo', '要做', '记得', '别忘了'], tag: '待办' },
    { kw: ['问题', '疑问', '不懂', '困惑'], tag: '疑问' },
    { kw: ['发现', '注意到', '观察到', '有意思'], tag: '发现' },
    { kw: ['目标', '计划', '规划', '打算'], tag: '计划' },
    { kw: ['学习', '学', '教程'], tag: '学习' },
    { kw: ['突发奇想', '脑洞', '如果', '会不会'], tag: '脑洞' }
  ]

  for (const { kw, tag } of tagPatterns) {
    if (kw.some(k => lower.includes(k.toLowerCase()))) {
      tags.add(tag)
    }
  }

  return tags.size > 0 ? [...tags] : ['想法']
}

export function generateDailySummary(ideas) {
  if (!ideas.length) return ''

  const cats = {}
  for (const idea of ideas) {
    cats[idea.category] = (cats[idea.category] || 0) + 1
  }

  const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]
  const allTags = ideas.flatMap(i => i.tags)
  const tagCounts = {}
  for (const t of allTags) {
    tagCounts[t] = (tagCounts[t] || 0) + 1
  }
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t)

  const lines = []
  lines.push(`今天共记录了 ${ideas.length} 条想法。`)
  lines.push(`主要集中在「${topCat[0]}」领域（${topCat[1]} 条）。`)
  if (topTags.length) {
    lines.push(`高频标签：${topTags.join('、')}。`)
  }
  lines.push(`语音输入 ${ideas.filter(i => i.source === 'voice').length} 条，文字输入 ${ideas.filter(i => i.source === 'text').length} 条。`)

  return lines.join('')
}
