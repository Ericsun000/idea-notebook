import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/variables.css'
import './styles/base.css'
import './styles/animations.css'
import { provisionBuiltinGLM } from './builtin-keys.js'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

// 自动配置内置 GLM（首次访问）
provisionBuiltinGLM()

// 动态视口高度：解决移动端地址栏伸缩导致 100vh 不准确的问题
function setAppHeight() {
  const vh = window.visualViewport
    ? window.visualViewport.height
    : window.innerHeight
  document.documentElement.style.setProperty('--app-height', `${vh}px`)
}
window.visualViewport?.addEventListener('resize', setAppHeight)
window.visualViewport?.addEventListener('scroll', setAppHeight)
setAppHeight()
