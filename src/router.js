import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
  { path: '/timeline', name: 'timeline', component: () => import('./views/TimelineView.vue') },
  { path: '/history', name: 'history', component: () => import('./views/HistoryView.vue') },
  { path: '/daily/:date', name: 'daily', component: () => import('./views/DailyNoteView.vue'), props: true },
  { path: '/llm', name: 'llm', component: () => import('./views/LLMView.vue') },
  { path: '/trash', name: 'trash', component: () => import('./views/TrashView.vue') },
  { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
