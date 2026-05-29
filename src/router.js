import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
  { path: '/timeline', name: 'timeline', component: () => import('./views/TimelineView.vue') },
  { path: '/history', name: 'history', component: () => import('./views/HistoryView.vue') },
  { path: '/daily/:date', name: 'daily', component: () => import('./views/DailyNoteView.vue'), props: true }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
