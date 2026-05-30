import { ref } from 'vue'

const THRESHOLDS = [
  { count: 10, label: '10 条灵感', emoji: '🎯' },
  { count: 50, label: '50 条灵感', emoji: '🌟' },
  { count: 100, label: '100 条灵感', emoji: '💫' },
  { count: 500, label: '500 条灵感', emoji: '⭐' },
  { count: 1000, label: '1000 条 — 思维大师', emoji: '🏆' }
]

export function useMilestone() {
  const celebrated = ref(new Set(
    JSON.parse(localStorage.getItem('milestones_celebrated') || '[]')
  ))
  const currentMilestone = ref(null)
  const showCelebration = ref(false)

  let dismissTimer = null

  function check(totalCount) {
    if (!totalCount) return null
    const threshold = THRESHOLDS.find(
      t => totalCount >= t.count && !celebrated.value.has(t.count)
    )
    if (threshold) {
      celebrated.value.add(threshold.count)
      localStorage.setItem('milestones_celebrated', JSON.stringify([...celebrated.value]))
      currentMilestone.value = threshold
      showCelebration.value = true
      if (dismissTimer) clearTimeout(dismissTimer)
      dismissTimer = setTimeout(() => { showCelebration.value = false }, 4000)
      return threshold
    }
    return null
  }

  function dismiss() {
    showCelebration.value = false
    if (dismissTimer) clearTimeout(dismissTimer)
  }

  return { check, currentMilestone, showCelebration, dismiss, THRESHOLDS }
}
