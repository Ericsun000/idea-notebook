<template>
  <span class="tag-badge">{{ tag }}</span>
</template>

<script setup>
defineProps({ tag: String })
</script>

<style scoped>
.tag-badge {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  background: var(--color-surface-hover);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}
</style>
