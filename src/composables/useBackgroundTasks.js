import { reactive, computed, readonly } from 'vue'

// Module-level state — survives component unmount / navigation
const state = reactive({
  discuss: { running: false, startedAt: 0, configLabel: '', targetCount: 0, error: '', lastResult: null, lastResultAt: 0 },
  debate:   { running: false, startedAt: 0, configLabel: '', targetCount: 0, error: '', lastResult: null, lastResultAt: 0 }
})

const RESULT_TTL = 10_000  // 10s 后自动清除 lastResult
const timers = { discuss: null, debate: null }

export function useBackgroundTasks() {

  function startTask(type, configLabel, targetCount) {
    const slot = state[type]
    if (!slot) return false
    if (slot.running) return false  // 防重复
    slot.running = true
    slot.startedAt = Date.now()
    slot.configLabel = configLabel || ''
    slot.targetCount = targetCount || 0
    slot.error = ''
    slot.lastResult = null
    slot.lastResultAt = 0
    // clear stale timer
    if (timers[type]) { clearTimeout(timers[type]); timers[type] = null }
    return true
  }

  function finishTask(type, summary) {
    const slot = state[type]
    if (!slot) return
    slot.running = false
    slot.startedAt = 0
    slot.error = ''
    slot.lastResult = summary || null
    slot.lastResultAt = Date.now()
    // auto-clear result after TTL
    if (timers[type]) clearTimeout(timers[type])
    timers[type] = setTimeout(() => {
      slot.lastResult = null
      slot.lastResultAt = 0
    }, RESULT_TTL)
  }

  function failTask(type, errMsg) {
    const slot = state[type]
    if (!slot) return
    slot.running = false
    slot.startedAt = 0
    slot.error = errMsg || '未知错误'
    slot.lastResult = { ok: false, message: errMsg }
    slot.lastResultAt = Date.now()
    if (timers[type]) clearTimeout(timers[type])
    timers[type] = setTimeout(() => {
      slot.lastResult = null
      slot.lastResultAt = 0
    }, RESULT_TTL)
  }

  function getTask(type) {
    return readonly(state[type])
  }

  function isRunning(type) {
    return state[type]?.running || false
  }

  // Any task running?
  const anyRunning = computed(() => state.discuss.running || state.debate.running)

  // Recent result (for display)
  const recentResult = computed(() => {
    const now = Date.now()
    const candidates = []
    if (state.discuss.lastResult && (now - state.discuss.lastResultAt) < RESULT_TTL) {
      candidates.push({ type: 'discuss', result: state.discuss.lastResult, configLabel: state.discuss.configLabel })
    }
    if (state.debate.lastResult && (now - state.debate.lastResultAt) < RESULT_TTL) {
      candidates.push({ type: 'debate', result: state.debate.lastResult, configLabel: state.debate.configLabel })
    }
    if (!candidates.length) return null
    return candidates[0]
  })

  // Readonly state for consumers
  const tasks = readonly(state)

  return { tasks, startTask, finishTask, failTask, getTask, isRunning, anyRunning, recentResult }
}
