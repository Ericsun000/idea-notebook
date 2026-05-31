import { getLLMConfigs, saveLLMConfig, getSetting, setSetting } from './settings'

const BUILTIN_GLM_STATE_KEY = 'glm_builtin_state'

function getBuiltinApiKey() {
  const enc = '0rCN1bCqhs3y2puFBlVRUCUvfScUCFQSUQ1jAwZR0LObnuj7kerEkp2EVGdrdzd7Pw=='
  const seed = '灵感笔记2026GLMBuiltinSeed'
  const bytes = Uint8Array.from(atob(enc), c => c.charCodeAt(0))
  const kb = new TextEncoder().encode(seed)
  const r = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) r[i] = bytes[i] ^ kb[i % kb.length]
  return new TextDecoder().decode(r)
}

export async function provisionBuiltinGLM() {
  // 1. 检查是否已被手动移除
  const state = await getSetting(BUILTIN_GLM_STATE_KEY)
  if (state?.value === 'removed') return

  // 2. 检查是否已 provision
  if (state?.value === 'provisioned') return

  // 3. 检查是否已有 GLM 配置（用户自己添加的也算）
  const configs = await getLLMConfigs()
  const hasGLM = configs.some(c => c.baseUrl && c.baseUrl.includes('bigmodel.cn'))
  if (hasGLM) return

  // 4. 自动添加内置 GLM-4.7
  await saveLLMConfig({
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKey: getBuiltinApiKey(),
    model: 'glm-4.7',
    label: '智谱 GLM-4.7（内置）',
    noV1: true,
    builtin: true,
    lockedModel: true
  })
  await setSetting(BUILTIN_GLM_STATE_KEY, 'provisioned')
}

export async function markBuiltinGLMRemoved() {
  await setSetting(BUILTIN_GLM_STATE_KEY, 'removed')
}
