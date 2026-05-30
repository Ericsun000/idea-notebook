<template>
  <div class="app-shell">
    <main class="app-main">
      <router-view v-slot="{ Component, route }">
        <transition :name="transitionName" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </main>
    <nav class="tab-bar" v-if="showTabBar">
      <router-link to="/" class="tab-item" exact-active-class="tab-active">
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span class="tab-label">今日</span>
      </router-link>
      <router-link to="/timeline" class="tab-item" active-class="tab-active">
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span class="tab-label">时间线</span>
      </router-link>
      <router-link to="/history" class="tab-item" active-class="tab-active">
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span class="tab-label">历史</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const showTabBar = computed(() => {
  const name = router.currentRoute.value.name
  return name === 'home' || name === 'timeline' || name === 'history' || name === 'trash' || name === 'settings'
})

const transitionName = computed(() => {
  const from = router.currentRoute.value.name
  const to = router.currentRoute.value.query?._to
  if (to === 'home' || from === 'llm' || from === 'trash' || from === 'daily') {
    return 'fade-slide-up'
  }
  const tabRoutes = ['home', 'timeline', 'history']
  const fromIdx = tabRoutes.indexOf(from)
  if (fromIdx >= 0 && to) {
    const toIdx = tabRoutes.indexOf(to)
    if (toIdx >= 0) return toIdx > fromIdx ? 'slide-left' : 'slide-right'
  }
  return from === 'home' ? 'slide-left' : 'slide-right'
})
</script>

<style scoped>
.app-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-main {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tab-bar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 6px 8px calc(6px + var(--safe-bottom));
  background: var(--color-surface);
  border-top: 1px solid var(--color-divider);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 100;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 20px;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--color-text-tertiary);
  transition: color var(--duration-fast) var(--ease-out);
}

.tab-active {
  color: var(--color-accent);
}

.tab-icon {
  width: 22px;
  height: 22px;
}

.tab-label {
  font-size: var(--text-xs);
  font-weight: 500;
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active,
.fade-slide-up-enter-active,
.fade-slide-up-leave-active,
.fade-enter-active,
.fade-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
}

.slide-left-enter-from,
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.slide-left-leave-to,
.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.fade-slide-up-enter-from {
  opacity: 0;
  transform: translateY(24px);
}

.fade-slide-up-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
