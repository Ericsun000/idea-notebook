<template>
  <span class="tag-badge" :class="{ active }" @click.stop="$emit('click', tag)">{{ tag }}</span>
</template>

<script setup>
defineProps({ tag: String, active: Boolean })
defineEmits(['click'])
</script>

<style scoped>
.tag-badge {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  background: var(--color-surface-hover);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--duration-fast);
}
.tag-badge:active {
  transform: scale(0.94);
}
.tag-badge.active {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-weight: 600;
}
</style>
