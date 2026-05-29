<template>
  <div class="daily-summary anim-scale-in" v-if="note">
    <div class="summary-header">
      <h2 class="summary-title">{{ formattedDate }}</h2>
      <span class="summary-count">{{ note.totalCount }} 条想法</span>
    </div>

    <p class="summary-text">{{ note.summary }}</p>

    <div class="category-chart" v-if="Object.keys(note.categoryStats).length">
      <div class="chart-bar" v-for="(count, cat) in note.categoryStats" :key="cat" :class="`bar-${cat}`">
        <div class="bar-label">
          <span>{{ cat }}</span>
          <span>{{ count }}</span>
        </div>
        <div class="bar-track">
          <div
            class="bar-fill"
            :style="{ width: (count / note.totalCount * 100) + '%' }"
          ></div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="no-summary" @click="$emit('generate')">
    <div class="no-summary-icon">📝</div>
    <p>今日还没有总结</p>
    <button class="gen-btn">生成今日笔记</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  note: { type: Object, default: null },
  date: { type: String, default: '' }
})

defineEmits(['generate'])

const formattedDate = computed(() => {
  if (!props.note) return ''
  const d = new Date(props.note.date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (props.note.date === today.toISOString().slice(0, 10)) return '今日笔记'
  if (props.note.date === yesterday.toISOString().slice(0, 10)) return '昨日笔记'
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
})
</script>

<style scoped>
.daily-summary {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: var(--shadow-sm);
  margin: 0 16px;
}

.summary-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

.summary-title {
  font-size: var(--text-xl);
  font-weight: 700;
}

.summary-count {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.summary-text {
  font-size: var(--text-base);
  line-height: 1.7;
  color: var(--color-text);
  margin-bottom: 16px;
}

.category-chart {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chart-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bar-label {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.bar-track {
  height: 6px;
  background: var(--color-surface-hover);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--color-accent);
  transition: width 0.6s var(--ease-out);
}

.bar-工作 .bar-fill { background: var(--color-accent); }
.bar-生活 .bar-fill { background: var(--color-green); }
.bar-学习 .bar-fill { background: var(--color-blue); }
.bar-创作 .bar-fill { background: var(--color-purple); }

.no-summary {
  text-align: center;
  padding: 32px 24px;
  margin: 0 16px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1.5px dashed var(--color-border);
  cursor: pointer;
  transition: border-color var(--duration-fast);
}

.no-summary:active {
  border-color: var(--color-accent);
}

.no-summary-icon {
  font-size: 2rem;
  margin-bottom: 8px;
}

.no-summary p {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: 12px;
}

.gen-btn {
  padding: 8px 20px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
  transition: transform var(--duration-fast);
}

.gen-btn:active {
  transform: scale(0.96);
}
</style>
