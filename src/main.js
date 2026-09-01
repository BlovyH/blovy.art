import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import draggable from './directives/draggable'
import './assets/styles/global.css'

// 子集字体走 Vite 资源管线（构建时自动带 [hash]），此处动态注入 preload 以保留防闪烁优化
import fpFontUrl from './assets/fonts/generated/fusion-pixel-subset.woff2?url'
import zqFontUrl from './assets/fonts/generated/zhuque-fangsong-subset.woff2?url'

function preloadFont(href) {
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'font'
  link.type = 'font/woff2'
  link.crossOrigin = 'anonymous'
  link.href = href
  document.head.appendChild(link)
}
preloadFont(fpFontUrl)
preloadFont(zqFontUrl)

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.directive('draggable', draggable)
app.mount('#app')
