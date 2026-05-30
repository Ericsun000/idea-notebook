<template>
  <div
    class="idea-card anim-fade-up"
    :class="[`cat-${idea.category}`, { completed: idea.completed }]"
    @dblclick="openCategoryPicker"
  >
    <button class="complete-btn" :class="{ checked: idea.completed }" @click.stop="$emit('toggle-completed', idea.id)" :aria-label="idea.completed ? '取消完成' : '标记完成'">
      <svg v-if="idea.completed" viewBox="0 0 24 24" fill="currentColor" stroke="none" width="16" height="16">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    </button>
    <div class="card-body">
      <p class="card-content">{{ idea.content }}</p>
      <div class="card-meta">
        <span class="meta-time">{{ formatTime(idea.timestamp) }}</span>
        <span v-if="idea.source === 'voice'" class="meta-voice" title="语音输入">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="12" height="12">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          </svg>
          {{ idea.voiceDuration }}s
        </span>
        <span class="meta-dot" v-if="idea.source === 'voice'">·</span>
        <button class="meta-cat" @click.stop="openCategoryPicker">{{ idea.category }}</button>
      </div>
      <div class="card-tags" v-if="idea.tags.length">
        <TagBadge v-for="tag in idea.tags" :key="tag" :tag="tag" />
      </div>
      <div class="card-discussion" v-if="idea.discussion && !discussionCollapsed">
        <div class="discussion-label">🤖 AI 评论</div>
        <p class="discussion-text">{{ idea.discussion }}</p>
      </div>
      <button class="discussion-toggle" v-if="idea.discussion" @click.stop="discussionCollapsed = !discussionCollapsed">
        {{ discussionCollapsed ? `🤖 查看 AI 评论` : '收起评论' }}
      </button>
    </div>
    <button class="card-delete" @click="confirmDelete" aria-label="删除">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" width="14" height="14">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import TagBadge from './TagBadge.vue'

const props = defineProps({
  idea: { type: Object, required: true }
})

const emit = defineEmits(['delete', 'change-category', 'toggle-completed'])

const discussionCollapsed = ref(true)

const CATEGORIES = ['工作', '生活', '学习', '创作', '其他']

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function openCategoryPicker() {
  const cat = prompt(`修改分类（${CATEGORIES.join('/')}）：`, props.idea.category)
  if (cat && CATEGORIES.includes(cat) && cat !== props.idea.category) {
    emit('change-category', cat)
  }
}

function confirmDelete() {
  if (confirm('删除这条想法？')) {
    emit('delete', props.idea.id)
  }
}
</script>

<style scoped>
.idea-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 14px 14px 14px 18px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-fast) var(--ease-out);
  position: relative;
  overflow: hidden;
}

.idea-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--color-text-tertiary);
  transition: background var(--duration-fast);
}

.idea-card.cat-工作::before { background: var(--color-accent); }
.idea-card.cat-生活::before { background: var(--color-green); }
.idea-card.cat-学习::before { background: var(--color-blue); }
.idea-card.cat-创作::before { background: var(--color-purple); }

.idea-card.completed {
  opacity: 0.55;
}

.idea-card.completed::before {
  background: var(--color-text-tertiary) !important;
}

.complete-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
  transition: all var(--duration-fast);
  color: transparent;
}

.complete-btn.checked {
  background: var(--color-green);
  border-color: var(--color-green);
  color: #fff;
}

.complete-btn:active {
  border-color: var(--color-green);
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-content {
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-text);
  word-break: break-word;
  transition: text-decoration var(--duration-fast);
}

.idea-card.completed .card-content {
  text-decoration: line-through;
  color: var(--color-text-tertiary);
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.meta-time {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.meta-voice {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: var(--text-xs);
  color: var(--color-accent);
}

.meta-dot {
  color: var(--color-text-tertiary);
  font-size: var(--text-xs);
}

.meta-cat {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--color-surface-hover);
  transition: background var(--duration-fast);
}

.meta-cat:active {
  background: var(--color-border);
}

.card-tags {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.card-discussion {
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--color-blue-soft);
  border-radius: var(--radius-sm);
}

.discussion-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-blue);
  margin-bottom: 4px;
}

.discussion-text {
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--color-text);
}

.discussion-toggle {
  margin-top: 6px;
  font-size: var(--text-xs);
  color: var(--color-blue);
  padding: 4px 0;
  transition: opacity var(--duration-fast);
}

.discussion-toggle:active {
  opacity: 0.7;
}

.card-delete {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--color-text-tertiary);
  opacity: 0;
  transition: all var(--duration-fast);
  flex-shrink: 0;
  margin-top: -2px;
}

.idea-card:hover .card-delete,
.idea-card:active .card-delete {
  opacity: 1;
}

.card-delete:active {
  background: #FEE2E2;
  color: #DC2626;
}

@media (hover: none) {
  .card-delete {
    opacity: 0.6;
    width: 32px;
    height: 32px;
  }
}
</style>
