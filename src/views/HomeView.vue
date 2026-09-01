<template>
  <main class="home">
    <div class="desktop">
      <!-- RUN AWAY -->
      <img
        class="run-away"
        src="/assets/run_away.png"
        alt="RUN AWAY"
        @click="closePage"
      />

      <!-- Command Window -->
      <PixelWindow
        class="command-window"
        :show-title-bar="false"
        :bring-to-front-on-click="false"
        :initial-z-index="1"
        width="20%"
      >
        <div class="command-content">
          <p class="command-line">&gt; Echo $USER $U_ALIAS</p>
          <p class="command-output">BLOVY</p>
          <p class="command-alias">蓝碱 らんけん</p>
        </div>
      </PixelWindow>

      <!-- printf Welcome Window -->
      <PixelWindow
        class="printf-window"
        :show-title-bar="false"
        :bring-to-front-on-click="false"
        :initial-z-index="2"
        width="44%"
      >
        <div class="printf-content">
          <p class="printf-line">
            <span class="prompt">&gt;</span> printf <span class="string">"${CYAN}%s${NC}\n"</span> <span class="string">"$WELCOME"</span>
          </p>
          <p class="welcome-text">
            Hello there, welcome to my workspace! I'm a Chinese illustrator and back-end developer shachiku. It might look a bit new here and it's still under construction, but you can have a look around!
          </p>
        </div>
      </PixelWindow>

      <!-- Gallery Window -->
      <PixelWindow
        ref="galleryWindowRef"
        class="gallery-window"
        title="GALLERY"
        width="66%"
        :initial-z-index="50"
        @dragend="onGalleryDragEnd"
      >
        <div class="gallery-body">
          <div class="gallery-tabs">
            <template v-for="(cat, idx) in categories" :key="cat.value">
              <span
                class="tab"
                :class="{ active: activeCategory === cat.value }"
                @click="activeCategory = cat.value"
              >{{ cat.label }}</span>
              <span v-if="idx < categories.length - 1" class="tab-sep">|</span>
            </template>
          </div>
          <div class="gallery-main">
            <div class="gallery-grid">
              <img
                v-for="(item, index) in filteredGalleryItems"
                :key="item.thumb"
                class="gallery-thumb"
                :class="{ 'is-loaded': loadedThumbs.has(item.thumb) }"
                :style="item.ar ? { aspectRatio: String(item.ar) } : null"
                :src="item.thumb"
                :alt="item.alt"
                loading="lazy"
                draggable="false"
                @load="onThumbLoad(item)"
                @click="openDetail(index)"
              />
            </div>
          </div>
        </div>
      </PixelWindow>

      <!-- Nothing Desktop Icon -->
      <DesktopIcon
        class="nothing-desktop-icon"
        initial-left="63%"
        initial-top="4%"
        @click="openNothingWindow"
      >
        <template #icon>
          <svg class="nothing-trigger-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <circle cx="29" cy="19" r="12" fill="none" stroke="#808080" stroke-width="3" />
            <line x1="21" y1="27" x2="9" y2="39" stroke="#808080" stroke-width="3" stroke-linecap="round" />
            <line x1="35" y1="13" x2="23" y2="25" stroke="#808080" stroke-width="3" stroke-linecap="round" />
            <line x1="23" y1="13" x2="35" y2="25" stroke="#808080" stroke-width="3" stroke-linecap="round" />
          </svg>
        </template>
        <template #label>Nothing</template>
      </DesktopIcon>

      <!-- Notice Sign (draggable, always on top like other desktop icons) -->
      <DesktopIcon
        class="notice-sign-icon"
        initial-left="68%"
        initial-top="18%"
        @click="openNoticeSign"
      >
        <template #icon>
          <img class="notice-sign-img" src="/assets/sign.png" alt="notice sign" draggable="false" @dragstart.prevent />
        </template>
      </DesktopIcon>

      <!-- Social Links Window -->
      <PixelWindow
        class="social-window"
        title="SOCIAL LINKS"
        :controls="{ minimize: false, maximize: false, close: false }"
        width="21%"
      >
        <div
          ref="socialBodyRef"
          class="social-body"
          :style="{ '--sl-height': socialHeight + 'px' }"
        >
          <div class="social-icons-row">
            <div
              v-for="(item, idx) in socialLinks"
              :key="item.key"
              class="social-item"
              :class="{
                'social-item--first': idx === 0,
                'social-item--last': idx === socialLinks.length - 1,
              }"
            >
              <a class="social-card" :href="item.href" :title="item.label" target="_blank" rel="noopener noreferrer">
                <img class="social-icon-img" :src="item.icon" :alt="item.label" />
                <span class="social-label">{{ item.label }}</span>
              </a>
            </div>
            <div class="social-email" @click="copyEmail">
              <span class="email-default-text">contact via email</span>
              <div class="email-hover-content">
                <span class="email-address">blovysol@gmail.com</span>
                <span class="email-copy-btn">{{ emailCopyText }}</span>
              </div>
            </div>
          </div>
        </div>
      </PixelWindow>

      <!-- Comments, Notes Window -->
      <PixelWindow
        class="comments-window"
        title="COMMENTS, NOTES"
        :show-minimize="true"
        :show-maximize="true"
        width="33%"
        :initial-z-index="40"
      >
        <div class="comments-body">
          <a
            v-for="note in notes"
            :key="note.title"
            class="note-item"
            :href="note.link || null"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div class="note-main">
              <p class="note-title">{{ note.title }}</p>
              <p class="note-tags">{{ formatTags(note.tags) }}</p>
            </div>
            <time class="note-date">{{ note.date }}</time>
          </a>
        </div>
      </PixelWindow>

      <!-- Fandom Projects Window -->
      <div
        ref="fandomOuterRef"
        class="fandom-outer"
        :class="{ 'expand-up': expandUp && isExpanded, expanded: isExpanded }"
        :style="{ '--fp-height': expandHeight + 'px' }"
        @mousedown="bringFandomToFront"
        @mouseenter="bringFandomToFront"
      >
        <PixelWindow
          ref="fandomWindowRef"
          class="fandom-window-inner"
          :show-title-bar="false"
          width="100%"
          :initial-z-index="100"
          @dragend="onFandomDragEnd"
        >
          <div
            class="fandom-collapsible"
            @mouseenter="onFandomEnter"
            @mouseleave="onFandomLeave"
          >
            <div class="fandom-header" @mousedown.stop="handleFandomDrag">
              <span class="fandom-title-text">FANDOM PROJECTS</span>
              <img
                class="fandom-logo-small"
                :src="fandomWindowIcon"
                alt="Fandom Projects logo"
              />
            </div>
            <div
              ref="fandomContentRef"
              class="fandom-content"
            >
              <div class="fandom-body">
                <div
                  v-for="(project, idx) in fandomProjects"
                  :key="project.title"
                  class="fandom-item"
                  @click="openFPDetail(idx)"
                >
                  <div class="fandom-info">
                    <p class="fandom-title">{{ project.title }}</p>
                    <p class="fandom-tags">{{ project.tags }}</p>
                  </div>
                  <img
                    class="fandom-logo"
                    :src="project.logo"
                    :alt="project.title"
                  />
                </div>
              </div>
            </div>
          </div>
        </PixelWindow>
      </div>

    </div>

    <!-- Bottom Button -->
    <button class="power-btn drag-top" v-draggable @click="onPowerBtnClick">巨硬™办公室力量点2003</button>

    <!-- Footer -->
    <footer class="site-footer">
      <p>© Blovy 2024-{{ currentYear }}</p>
      <p></p>
    </footer>

    <!-- Dialog Box -->
    <DialogBox
      :visible="dialogVisible"
      :content="dialogContent"
      @click="onDialogClick"
    />

    <!-- Option Box -->
    <OptionBox
      :visible="optionVisible"
      @select="onOptionSelect"
    />

    <!-- Dropped out warning -->
    <DialogBox
      :visible="droppedDialogVisible"
      :content="droppedDialogContent"
      @click="closeDroppedDialog"
    />

    <!-- Image Detail Window -->
    <ImageDetailWindow
      v-if="detailVisible && filteredGalleryItems[detailIndex]"
      :item="filteredGalleryItems[detailIndex]"
      :current-index="detailIndex"
      :total="filteredGalleryItems.length"
      :side="detailSide"
      @close="closeDetail"
      @prev="detailPrev"
      @next="detailNext"
      @random="detailRandom"
      @download="detailDownload"
    />

    <!-- Fandom Project Detail Window -->
    <FPDetailWindow
      v-if="fpDetailVisible && fpDetailItem"
      :item="fpDetailItem"
      :vertical="fpDetailVertical"
      :preview-active="fpPreviewItemId === fpDetailItem?.title"
      @close="closeFPDetail"
      @download="fpDetailDownload"
      @preview="onFPPreviewToggle"
    />

    <!-- Nothing Search Window -->
    <NothingWindow
      v-if="nothingVisible"
      @close="nothingVisible = false"
    />

    <!-- Mobile Notice Toast -->
    <CenterToast
      v-if="mobileNoticeVisible"
      title="Mobile Device Detected"
      message="I noticed you're on a phone. I might add support someday, but it's recommended you check it out on a computer for now."
      @close="mobileNoticeVisible = false"
    />

    <!-- StickyKeys neta Toast (non-blocking, draggable, top-left) -->
    <WinToast
      v-if="stickyVisible"
      title="StickyKeys"
      icon="⚠"
      message="Do you want to turn on StickyKeys?"
      description="StickyKeys lets you activate ?!%$!? mode. The shortcut to turn it on is to tap the <br><span style='font-family: var(--font-fangsong)'>巨硬™办公室力量点2003</span> button 5 times in a row."
      :buttons="[{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]"
      @action="onStickyAction"
    />
  </main>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import PixelWindow from '@/components/PixelWindow.vue'
import DialogBox from '@/components/DialogBox.vue'
import OptionBox from '@/components/OptionBox.vue'
import ImageDetailWindow from '@/components/ImageDetailWindow.vue'
import FPDetailWindow from '@/components/FPDetailWindow.vue'
import NothingWindow from '@/components/NothingWindow.vue'
import DesktopIcon from '@/components/DesktopIcon.vue'
import CenterToast from '@/components/CenterToast.vue'
import WinToast from '@/components/WinToast.vue'
import { nextZ } from '@/stores/windowZ.js'
import { CONTENT_DATA_URL, CONTENT_POLL_INTERVAL_MS } from '@/config/data.js'

const fandomWindowRef = ref(null)
const fandomContentRef = ref(null)
const fandomOuterRef = ref(null)
const galleryWindowRef = ref(null)
const isExpanded = ref(false)
const expandUp = ref(false)
const expandHeight = ref(0)
const galleryItems = ref([])
const loadedThumbs = ref(new Set())
const preloadedGalleryPreview = new Set()
const onThumbLoad = (item) => {
  const s = new Set(loadedThumbs.value)
  s.add(item.thumb)
  loadedThumbs.value = s
  // 视口内缩略图加载完成后，顺带预热详情预览图（preview 优先，原图兜底），点开即秒显
  const previewUrl = item.preview || item.highResSrc
  if (previewUrl && !preloadedGalleryPreview.has(previewUrl)) {
    preloadedGalleryPreview.add(previewUrl)
    const img = new Image()
    img.src = previewUrl
  }
}
const notes = ref([])
const fandomProjects = ref([])
const fandomWindowIcon = ref('/assets/placeholder.svg')

// 远端资源根 + 中间路径，全部来自 content.json（assetBase / fpDir / galleryDir），
// 代码只负责把「base + 路径 + 文件名」拼成完整 URL。默认值是兜底，正常由 JSON 提供。
const assetBase = ref('https://cdn.blovy.art')
const fpDir = ref('fandom-projects')
const galleryDir = ref('gallery')

// fp 资源相对 fpDir 解析（rel 可含子目录，如 thumbs/x 或 flowery-cursory/x）；
// 已是绝对 URL 或 / 开头则原样返回。
const fpAsset = (rel, prefix) => {
  if (!rel) return rel
  if (/^(https?:)?\/\//.test(rel) || rel.startsWith('/')) return rel
  const base = prefix
    ? `${assetBase.value}/${fpDir.value}/${prefix}`
    : `${assetBase.value}/${fpDir.value}`
  return `${base}/${rel.replace(/^\//, '')}`
}
const currentYear = new Date().getFullYear()
let collapseTimer = null

const formatTags = (tags) => {
  if (!tags) return ''
  const arr = Array.isArray(tags) ? tags : String(tags).split(/\s+/).filter(Boolean)
  return arr.map((t) => `#${String(t).replace(/^#/, '')}`).join(' ')
}

const categories = [
  { label: 'ALL', value: 'all' },
  { label: 'ORIGINAL', value: 'original' },
  { label: 'FANDOM', value: 'fandom' },
]
const activeCategory = ref('all')
const filteredGalleryItems = computed(() => {
  if (activeCategory.value === 'all') return galleryItems.value
  return galleryItems.value.filter(item => item.category === activeCategory.value)
})
const fpDetailItem = computed(() => fandomProjects.value[fpDetailIndex.value] || null)

// 远端内容热更新（Nacos 式）：仅在 CONTENT_DATA_URL 为外部直链时轮询
const isContentRemote = CONTENT_DATA_URL && !CONTENT_DATA_URL.startsWith('/')
let contentPollTimer = null
let contentSignature = ''

// FP 图片全量预载：首屏把 logo / 预览 src / 窗口图标拉进浏览器 + CDN 边缘缓存，
// 点开窗口即秒显（避免 R2 冷边 + 冷浏览器缓存的首开 1-2s 延迟）。仅 content 实际变更时重跑。
const preloadedFPImg = new Set()
function preloadFPImages() {
  const urls = [fandomWindowIcon.value]
  for (const p of fandomProjects.value) {
    if (p.logo) urls.push(p.logo)
    if (p.src) urls.push(p.src)
    if (p.cursors) {
      for (const key of Object.keys(p.cursors)) {
        const c = p.cursors[key]
        const u = typeof c === 'string' ? c : (c && c.url)
        if (u) urls.push(fpAsset(u, p.prefix))
      }
    }
  }
  // gallery 详情图遮罩：src 已是完整 URL（来自 content.json），无需 resolveGallery；
  // 首屏一并暖缓存，避免首次悬浮触发 R2 冷边 1-2s 卡顿
  for (const g of galleryItems.value) {
    const ovs = g.overlays
    if (!ovs || !ovs.length) continue
    for (const o of ovs) if (o.src) urls.push(o.src)
  }
  for (const u of urls) {
    if (!u || preloadedFPImg.has(u)) continue
    preloadedFPImg.add(u)
    const img = new Image()
    img.src = u
  }
}

async function loadContent() {
  if (!CONTENT_DATA_URL) return
  // 拼 _t 破 Cloudflare 边缘缓存，否则永远拿到旧 JSON
  const sep = CONTENT_DATA_URL.includes('?') ? '&' : '?'
  const url = `${CONTENT_DATA_URL}${sep}_t=${Date.now()}`
  try {
    const res = await fetch(url)
    const data = await res.json()
    // 远端根 + 中间路径全部来自 JSON；缺省走兜底默认值
    assetBase.value = data.assetBase || 'https://cdn.blovy.art'
    fpDir.value = data.fpDir || 'fandom-projects'
    galleryDir.value = data.galleryDir || 'gallery'
    const gman = data._gallery || {}
    const resolveGallery = (key) => {
      if (!key) return ''
      // 已是完整 URL（含协议/双斜杠）或绝对路径：直接返回（用于 highResSrc 指向用户自有原图）
      if (/^(https?:)?\/\//.test(key) || key.startsWith('/')) return key
      const h = gman[key] ? `?v=${gman[key]}` : ''
      return `${assetBase.value}/${galleryDir.value}/${key}.webp${h}`
    }
    // 变更检测：仅内容真正变化时重新赋值，避免无谓重渲染
    const sig = JSON.stringify([data.gallery, data.notes, data.fandomProjects, data.fandomWindow, data._gallery])
    if (sig === contentSignature) return
    contentSignature = sig
    galleryItems.value = (data.gallery || []).map((it) => ({
      ...it,
      thumb: resolveGallery(it.thumb),
      preview: resolveGallery(it.preview),
      highResSrc: resolveGallery(it.highResSrc),
    }))
    notes.value = data.notes || []
    fandomProjects.value = (data.fandomProjects || []).map((p) => ({
      ...p,
      logo: fpAsset(p.logo),
      src: fpAsset(p.src, p.prefix),
    }))
    fandomWindowIcon.value = fpAsset(data.fandomWindow?.icon) || '/assets/placeholder.svg'
    preloadFPImages()
  } catch (e) {
    console.error('Failed to load content:', e)
  }
}

function onContentVisibility() {
  if (document.visibilityState === 'visible') loadContent()
}

onMounted(async () => {
  if (!CONTENT_DATA_URL) {
    console.warn('CONTENT_DATA_URL is empty. Please set it in src/config/data.js')
    return
  }

  await loadContent()

  if (isMobile()) {
    mobileNoticeVisible.value = true
  }

  window.addEventListener('resize', onWindowResize)

  updateSocialHeight()
  if (socialBodyRef.value && typeof ResizeObserver !== 'undefined') {
    socialResizeObserver = new ResizeObserver(() => updateSocialHeight())
    socialResizeObserver.observe(socialBodyRef.value)
  }

  contentPollTimer = setInterval(loadContent, CONTENT_POLL_INTERVAL_MS)
  document.addEventListener('visibilitychange', onContentVisibility)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  if (socialResizeObserver) {
    socialResizeObserver.disconnect()
    socialResizeObserver = null
  }
  applyCursorPreview(null)
  if (contentPollTimer) {
    clearInterval(contentPollTimer)
    contentPollTimer = null
  }
  document.removeEventListener('visibilitychange', onContentVisibility)
})

function onWindowResize() {
  if (detailVisible.value) {
    updateDetailSide()
  }
  if (fpDetailVisible.value) {
    updateFPDetailVertical()
  }
}

function bringFandomToFront() {
  if (fandomOuterRef.value) {
    fandomOuterRef.value.style.zIndex = nextZ()
  }
}

function handleFandomDrag(e) {
  bringFandomToFront()
  fandomWindowRef.value?.startDrag(e)
}

function onFandomEnter() {
  clearTimeout(collapseTimer)
  isFandomHovered.value = true
  if (isExpanded.value) return

  const content = fandomContentRef.value
  if (!content) return
  const header = content.previousElementSibling
  if (!header) return
  const headerRect = header.getBoundingClientRect()

  // 临时展开以测量内容高度
  content.style.transition = 'none'
  content.style.maxHeight = 'none'
  content.style.visibility = 'hidden'
  const height = content.offsetHeight
  content.style.visibility = ''
  content.style.maxHeight = ''
  content.style.transition = ''

  expandHeight.value = height
  expandUp.value = headerRect.bottom + height > window.innerHeight

  requestAnimationFrame(() => {
    isExpanded.value = true
  })
}

function forceExpandFandom() {
  clearTimeout(collapseTimer)
  if (isExpanded.value) return

  const content = fandomContentRef.value
  if (!content) return
  const header = content.previousElementSibling
  if (!header) return
  const headerRect = header.getBoundingClientRect()

  content.style.transition = 'none'
  content.style.maxHeight = 'none'
  content.style.visibility = 'hidden'
  const height = content.offsetHeight
  content.style.visibility = ''
  content.style.maxHeight = ''
  content.style.transition = ''

  expandHeight.value = height
  expandUp.value = headerRect.bottom + height > window.innerHeight

  requestAnimationFrame(() => {
    isExpanded.value = true
  })
}

function onFandomLeave() {
  isFandomHovered.value = false
  if (fpDetailVisible.value) return

  collapseTimer = setTimeout(() => {
    isExpanded.value = false
    expandUp.value = false

    // 等收起动画结束后，检查窗口是否被甩出视口
    setTimeout(() => {
      checkFandomOutOfViewport()
    }, 220)
  }, 80)
}

function checkFandomOutOfViewport() {
  const outer = fandomWindowRef.value?.$el
  const header = fandomContentRef.value?.previousElementSibling
  if (!outer || !header) return

  const headerRect = header.getBoundingClientRect()
  const outerRect = outer.getBoundingClientRect()

  // 标题栏已跑到视口底部以下，用户无法操作
  if (headerRect.top > window.innerHeight - 40) {
    const padding = 20
    const targetTop = Math.max(padding, window.innerHeight - outerRect.height - padding)
    const dy = targetTop - outerRect.top
    fandomWindowRef.value?.moveBy(0, dy)
    droppedDialogVisible.value = true
  }
}

const dialogVisible = ref(false)
const dialogContent = ref('')
const optionVisible = ref(false)
const droppedDialogVisible = ref(false)
const droppedDialogContent = ref('HEY YOU DROPPED ME OUT!??!!!!!')
const detailVisible = ref(false)
const detailIndex = ref(0)
const detailSide = ref('right')
const fpDetailVisible = ref(false)
const fpDetailIndex = ref(0)
const fpDetailVertical = ref('above')
const fpPreviewItemId = ref(null)
const isFandomHovered = ref(false)
const nothingVisible = ref(false)
const mobileNoticeVisible = ref(false)
const stickyVisible = ref(false)
const powerClickCount = ref(0)
let lastPowerClick = 0

const socialLinks = [
  { key: 'bili', label: 'bilibili', icon: '/assets/sl_icon_bili.png', href: 'https://space.bilibili.com/160911011' },
  { key: 'rb',   label: 'redbook',  icon: '/assets/sl_icon_rb.png',   href: 'https://www.xiaohongshu.com/user/profile/670bdcfc000000001d0300c7' },
  { key: 'p',    label: 'pixiv',    icon: '/assets/sl_icon_p.png',     href: 'https://www.pixiv.net/users/118581129' },
  { key: 'bs',   label: 'bluesky',  icon: '/assets/sl_icon_bs.png',    href: 'https://bsky.app/profile/blovy.art' },
  { key: 'kofi', label: 'ko-fi',    icon: '/assets/sl_icon_kofi.png',  href: 'https://ko-fi.com/blovyh' },
]

const emailCopyText = ref('copy to clipboard')
let emailCopyTimer = null
const socialBodyRef = ref(null)
const socialHeight = ref(120)
let socialResizeObserver = null

function updateSocialHeight() {
  if (socialBodyRef.value) {
    socialHeight.value = socialBodyRef.value.scrollHeight
  }
}

function copyEmail() {
  navigator.clipboard.writeText('blovysol@gmail.com').then(() => {
    emailCopyText.value = 'copied!'
    clearTimeout(emailCopyTimer)
    emailCopyTimer = setTimeout(() => {
      emailCopyText.value = 'copy to clipboard'
    }, 2000)
  })
}

function onPowerBtnClick() {
  const now = Date.now()
  if (now - lastPowerClick > 1500) {
    powerClickCount.value = 0
  }
  lastPowerClick = now
  powerClickCount.value += 1
  if (powerClickCount.value >= 5) {
    stickyVisible.value = true
    powerClickCount.value = 0
  }
}

function onStickyAction(value) {
  if (value === 'no') {
    stickyVisible.value = false
  }
  // value === 'yes': ?!%$!? mode 暂未实现，点了不关闭、无反应
}

function openNothingWindow() {
  nothingVisible.value = true
}

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

function closePage() {
  window.close()
}

function closeDroppedDialog() {
  droppedDialogVisible.value = false
}

function updateDetailSide() {
  const el = galleryWindowRef.value?.$el
  if (!el) return
  const rect = el.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  detailSide.value = centerX > window.innerWidth / 2 ? 'left' : 'right'
}

function openDetail(index) {
  updateDetailSide()
  detailIndex.value = index
  detailVisible.value = true
}

function onGalleryDragEnd() {
  if (!detailVisible.value) return
  updateDetailSide()
}

function closeDetail() {
  detailVisible.value = false
}

function detailPrev() {
  if (filteredGalleryItems.value.length === 0) return
  detailIndex.value = (detailIndex.value - 1 + filteredGalleryItems.value.length) % filteredGalleryItems.value.length
}

function detailNext() {
  if (filteredGalleryItems.value.length === 0) return
  detailIndex.value = (detailIndex.value + 1) % filteredGalleryItems.value.length
}

function detailRandom() {
  if (filteredGalleryItems.value.length <= 1) return
  let next
  do {
    next = Math.floor(Math.random() * filteredGalleryItems.value.length)
  } while (next === detailIndex.value && filteredGalleryItems.value.length > 1)
  detailIndex.value = next
}

function detailDownload() {
  const item = filteredGalleryItems.value[detailIndex.value]
  if (!item || !item.highResSrc) return
  const a = document.createElement('a')
  a.href = item.highResSrc
  a.target = '_blank'
  a.download = item.title || 'image'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function updateFPDetailVertical() {
  const el = fandomWindowRef.value?.$el
  if (!el) return
  const rect = el.getBoundingClientRect()
  const centerY = rect.top + rect.height / 2
  fpDetailVertical.value = centerY < window.innerHeight / 2 ? 'below' : 'above'
}

function openFPDetail(index) {
  updateFPDetailVertical()
  fpDetailIndex.value = index
  fpDetailVisible.value = true
  forceExpandFandom()
}

function onFandomDragEnd() {
  if (!fpDetailVisible.value) return
  updateFPDetailVertical()
}

function closeFPDetail() {
  fpDetailVisible.value = false
  if (!isFandomHovered.value) {
    collapseTimer = setTimeout(() => {
      isExpanded.value = false
      expandUp.value = false
    }, 80)
  }
}

function fpDetailDownload() {
  const item = fpDetailItem.value
  if (!item || !item.downloadUrl || item.downloadUrl === '#') return
  const a = document.createElement('a')
  a.href = item.downloadUrl
  a.target = '_blank'
  a.download = item.title || 'cursor-set'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function onFPPreviewToggle({ active }) {
  fpPreviewItemId.value = active ? fpDetailItem.value?.title : null
  const fpItem = active ? fpDetailItem.value : null
  applyCursorPreview(fpItem?.cursors || null, fpItem ? fpAsset(fpItem.prefix) : '')
}

function applyCursorPreview(cursors, base = '') {
  const styleId = 'fp-cursor-preview'
  const existing = document.getElementById(styleId)
  if (existing) {
    existing.remove()
  }
  if (!cursors) return

  // 相对路径（非 http(s):// 且非 / 开头）按 base 拼接；绝对 URL 原样返回
  const resolve = (u) => {
    if (!u) return u
    if (/^https?:\/\//.test(u) || u.startsWith('/')) return u
    return `${base.replace(/\/$/, '')}/${u.replace(/^\//, '')}`
  }

  // 每个光标可写成字符串 URL，或 { url, hotspot:[x,y] } 对象（热点想配就配）
  const specOf = (key) => {
    const v = cursors[key]
    if (!v) return null
    if (typeof v === 'string') return { url: resolve(v), hotspot: null }
    return { url: resolve(v.url), hotspot: v.hotspot || null }
  }
  const expr = (key, fallback) => {
    const s = specOf(key)
    if (!s) return ''
    const ok = Array.isArray(s.hotspot) && s.hotspot.length === 2 && s.hotspot.every((n) => typeof n === 'number')
    const hs = ok ? ` ${s.hotspot[0]} ${s.hotspot[1]}` : ''
    return `url("${s.url}")${hs}, ${fallback}`
  }

  const groups = [
    { key: 'default', fallback: 'auto', selector: 'html, body' },
    { key: 'pointer', fallback: 'pointer', selector: 'a, button, [role="button"], input[type="submit"], input[type="button"], label, .tab, .gallery-thumb, .social-item, .social-email, .fandom-item, .fp-detail-btn, .page-arrow, .desktop-icon' },
    { key: 'text', fallback: 'text', selector: 'p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, pre, code, dt, dd, figcaption, summary, [contenteditable], input[type="text"], input[type="email"], input[type="password"], input[type="search"], textarea, .fp-detail-text, .detail-desc' },
    { key: 'help', fallback: 'help', selector: '.fp-help-icon' },
    { key: 'move', fallback: 'move', selector: '[draggable="true"], .pixel-titlebar, .fandom-header, .desktop-icon.is-dragging, .power-btn.is-dragging' },
    { key: 'not-allowed', fallback: 'not-allowed', selector: '[disabled], [aria-disabled="true"]' },
    { key: 'wait', fallback: 'wait', selector: 'html.fp-cursor-wait, html.fp-cursor-wait *' },
    { key: 'progress', fallback: 'progress', selector: 'html.fp-cursor-progress, html.fp-cursor-progress *' },
    { key: 'ew-resize', fallback: 'ew-resize', selector: '[data-resize="ew"], .resize-ew' },
    { key: 'ns-resize', fallback: 'ns-resize', selector: '[data-resize="ns"], .resize-ns' },
    { key: 'nesw-resize', fallback: 'nesw-resize', selector: '[data-resize="nesw"], .resize-nesw' },
    { key: 'nwse-resize', fallback: 'nwse-resize', selector: '[data-resize="nwse"], .resize-nwse' },
  ]

  const rules = []
  for (const g of groups) {
    const e = expr(g.key, g.fallback)
    if (e) rules.push(`${g.selector} { cursor: ${e} !important; }`)
  }

  if (rules.length === 0) return
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = rules.join('\n')
  document.head.appendChild(style)
}

const noticeFlow = {
  start: {
    content: 'Merely a notice sign.<br>There are some Morse codes written on it.<br>Read it?',
    next: 'choice',
  },
  choice: {
    options: [
      { label: 'YES', value: 'yes' },
      { label: 'NO', value: 'no' },
    ],
  },
  yes: {
    content: 'Well, it reads:<br>.. .-. . .-. . .-.. -.-- / .- / -. --- - .. -.-. . / ... .. --. -. .<br>(I\'m merely a notice sign.)',
    next: null,
  },
  no: {
    content: 'You decided not to read it. The sign remains a mystery.',
    next: null,
  },
}

let currentStep = null

function openNoticeSign() {
  currentStep = 'start'
  dialogContent.value = noticeFlow.start.content
  dialogVisible.value = true
  optionVisible.value = false
}

function onDialogClick() {
  if (!currentStep) return
  const step = noticeFlow[currentStep]
  if (step.next) {
    currentStep = step.next
    if (currentStep === 'choice') {
      dialogVisible.value = false
      optionVisible.value = true
    } else {
      dialogContent.value = noticeFlow[currentStep].content
    }
  } else {
    dialogVisible.value = false
    currentStep = null
  }
}

function onOptionSelect(value) {
  optionVisible.value = false
  currentStep = value
  dialogContent.value = noticeFlow[value].content
  dialogVisible.value = true
}
</script>

<style scoped>
.home {
  position: relative;
  width: 100%;
  min-height: 100vh;
  background: #000000;
  padding: 16px;
  overflow: hidden;
}

.desktop {
  position: relative;
  width: 100%;
  height: 680px;
  margin: 0 auto;
}

/* RUN AWAY */
.run-away {
  position: absolute;
  top: 0;
  right: 0;
  width: clamp(240px, 28vw, 420px);
  height: auto;
  image-rendering: pixelated;
}

/* Command Window */
.command-window {
  position: absolute;
  top: 0;
  left: 0;
}

.command-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: clamp(16px, 1.5vw, 24px);
  line-height: 1.25;
  user-select: text;
  -webkit-user-select: text;
}

.command-line {
  color: #ffffff;
}

.command-output {
  color: #ffffff;
  font-weight: bold;
  font-size: clamp(18px, 1.8vw, 28px);
}

.command-alias {
  color: #ffffff;
}

/* printf Window */
.printf-window {
  position: absolute;
  top: 8%;
  left: 13%;
}

.printf-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: clamp(14px, 1.3vw, 20px);
  line-height: 1.5;
  user-select: text;
  -webkit-user-select: text;
}

.printf-line {
  color: #ffffff;
  word-break: break-all;
}

.printf-line .prompt {
  color: #ffffff;
}

.printf-line .string {
  color: #ffffff;
}

.welcome-text {
  color: #00ffff;
  font-size: clamp(12px, 1.1vw, 17px);
  line-height: 1.6;
}

/* Gallery Window */
.gallery-window {
  position: absolute;
  top: 30%;
  left: 2%;
  height: 80%;
}

.gallery-window :deep(.pixel-window__content) {
  padding-top: 8px;
}

.gallery-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gallery-tabs {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: clamp(18px, 1.8vw, 28px);
}

.tab {
  cursor: pointer;
  padding: 2px 6px;
}

.tab.active {
  color: #ffffff;
}

.tab:not(.active) {
  color: #808080;
}

.tab-sep {
  color: #ffffff;
}

.gallery-main {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.gallery-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: center;
  flex: 1;
}

.gallery-thumb {
  box-sizing: border-box;
  width: auto;
  height: clamp(100px, 16vh, 180px);
  object-fit: contain;
  border: 2px solid transparent;   /* 占位留白，图未加载时不显白线 */
  image-rendering: pixelated;
  cursor: pointer;
  user-select: none;
  -webkit-user-drag: none;
  user-drag: none;
  transition: border-color 0.15s ease;
}
.gallery-thumb.is-loaded {
  border-color: #ffffff;           /* 图加载完成后才显示白框 */
}
.gallery-thumb.is-loaded:hover {
  border-style: double;            /* hover：双线 */
  border-width: 5px;               /* 在 2px 基础上叠加 3px，双线更明显 */
  border-color: var(--color-text-cyan);  /* 悬停时框变青色（同文字青色） */
}

/* Notice Sign (DesktopIcon: always on top + draggable) */
.notice-sign-icon.desktop-icon {
  width: clamp(56px, 6vw, 88px);
  height: auto;
  padding: 0;
}

.notice-sign-icon :deep(.desktop-icon__visual) {
  width: 100%;
  height: auto;
}

.notice-sign-img {
  width: 100%;
  height: auto;
  object-fit: contain;
  image-rendering: pixelated;
}

/* Nothing Desktop Icon */
.nothing-trigger-icon {
  width: 44px;
  height: 44px;
}

/* Social Links Window */
.social-window {
  position: absolute;
  top: 10%;
  right: 2%;
}

/* Tighten spacing for SL window only (no global side effects) */
.social-window :deep(.pixel-titlebar) {
  padding: 8px 12px 6px;
}

.social-window :deep(.pixel-window__content) {
  padding-top: 8px;
}

.social-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: var(--sl-height, auto);
  transition: max-height 0.25s ease;
}

.social-icons-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* ── Social icon items: width follows content (icon + expanding label) ── */
.social-item {
  height: 56px;
  min-width: 56px;
  max-width: 56px;
  flex-shrink: 0;
  transition: max-width 0.25s ease;
}

.social-item:hover {
  max-width: 140px;
}

.social-card {
  display: flex;
  align-items: center;
  width: max-content;
  height: 100%;
  padding: 8px;
  border: 2px solid #808080;
  background: transparent;
  color: #ffffff;
  text-decoration: none;
  transition: border-color 0.15s ease;
  overflow: hidden;
  box-sizing: border-box;
}

.social-card:hover {
  border-color: #ffffff;
}

.social-icon-img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  image-rendering: pixelated;
  flex-shrink: 0;
}

.social-label {
  font-size: 14px;
  white-space: nowrap;
  opacity: 0;
  max-width: 0;
  margin-left: 0;
  color: var(--color-text-cyan);
  transition:
    opacity 0.2s ease 0.05s,
    max-width 0.25s ease,
    margin-left 0.25s ease;
}

.social-item:hover .social-label {
  opacity: 1;
  max-width: 120px;
  margin-left: 6px;
}

/* ── Email box (fills remaining row width) ── */
.social-email {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  flex: 1 1 120px;
  min-width: 0;
  padding: 8px 12px;
  border: 2px solid #808080;
  cursor: pointer;
  transition: border-color 0.15s ease;
  user-select: none;
  overflow: hidden;
  box-sizing: border-box;
}

.social-email:hover {
  border-color: #ffffff;
}

.email-default-text {
  font-size: 18px;
  color: #808080;
  white-space: nowrap;
  transition: opacity 0.15s ease;
}

.email-hover-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.social-email:hover .email-default-text {
  opacity: 0;
}

.social-email:hover .email-hover-content {
  opacity: 1;
  pointer-events: auto;
}

.email-address {
  font-size: 15px;
  color: #ffffff;
  word-break: break-all;
  text-align: center;
}

.email-copy-btn {
  font-size: 10px;
  color: #808080;
}

/* Comments Window */
.comments-window {
  position: absolute;
  top: 50%;
  right: 2%;
  height: 70%;
}

.comments-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.note-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  border: 3px solid transparent;
  border-image-source: url('/assets/window_frame_sub.png');
  border-image-slice: 5;
  border-image-width: 4px;
  border-image-repeat: round;
  border-radius: 3px;
  padding: 14px;
  color: inherit;
  text-decoration: none;
}

a.note-item[href]:hover {
  border-image-source: url('/assets/window_frame.png');
}

.note-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.note-title {
  font-size: clamp(14px, 1.3vw, 20px);
  color: #ffffff;
}

.note-tags {
  font-size: clamp(11px, 1vw, 15px);
  color: #808080;
}

.note-date {
  font-size: clamp(14px, 1.3vw, 20px);
  color: #ffffff;
  white-space: nowrap;
}

/* Fandom Projects Window */
.fandom-outer {
  position: absolute;
  top: 106%;
  left: 34%;
  width: 38%;
  z-index: 100;
  transform: translateY(0);
  transition: transform 0.18s ease-out;
}

.fandom-outer.expand-up {
  transform: translateY(calc(-1 * var(--fp-height, 0px)));
}

.fandom-window-inner {
  width: 100%;
}

.fandom-collapsible {
  cursor: pointer;
}

.fandom-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  cursor: move;
}

.fandom-title-text {
  font-size: clamp(24px, 2.2vw, 34px);
  font-weight: bold;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.fandom-logo-small {
  width: clamp(32px, 2.8vw, 48px);
  height: clamp(32px, 2.8vw, 48px);
  object-fit: cover;
  image-rendering: pixelated;
  flex-shrink: 0;
  transition: opacity 0.08s ease;
}

.fandom-content {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition:
    max-height 0.18s ease-out,
    opacity 0.12s ease;
}

.fandom-outer.expanded .fandom-content {
  max-height: var(--fp-height, 0px);
  opacity: 1;
}

.fandom-outer.expanded .fandom-logo-small {
  opacity: 0;
}

.fandom-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 8px;
}

.fandom-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  border: 3px solid transparent;
  border-image-source: url('/assets/window_frame_sub.png');
  border-image-slice: 5;
  border-image-width: 4px;
  border-image-repeat: round;
  border-radius: 3px;
  overflow: hidden;
  padding: 14px;
  cursor: pointer;
}

.fandom-item:hover {
  border-image-source: url('/assets/window_frame.png');
}

.fandom-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fandom-title {
  font-size: clamp(14px, 1.3vw, 20px);
  color: #ffffff;
}

.fandom-tags {
  font-size: clamp(11px, 1vw, 15px);
  color: #808080;
}

.fandom-logo {
  width: clamp(60px, 5.5vw, 100px);
  height: clamp(60px, 5.5vw, 100px);
  object-fit: cover;
  image-rendering: pixelated;
  flex-shrink: 0;
}

/* Power Button */
.power-btn {
  position: absolute;
  bottom: 70px;
  left: 8%;
  background: #c0c0c0;
  color: #000000;
  border: none;
  border-top: 8px solid #ffffff;
  border-left: 8px solid #ffffff;
  border-right: 8px solid #555555;
  border-bottom: 8px solid #555555;
  border-radius: 0;
  padding: 14px 28px;
  font-size: clamp(18px, 1.8vw, 28px);
  font-family: var(--font-fangsong);
  /* drag offset comes from v-draggable (CSS vars) */
  transform: translate(var(--ddx, 0px), var(--ddy, 0px));
}

.power-btn:active:not(.is-dragging) {
  border-top: 8px solid #555555;
  border-left: 8px solid #555555;
  border-right: 8px solid #ffffff;
  border-bottom: 8px solid #ffffff;
  /* Sunken press = current (dragged) position + 4px, NOT a replacement of
     the drag transform, or the button would jump back to origin on click. */
  transform: translate(calc(var(--ddx, 0px) + 4px), calc(var(--ddy, 0px) + 4px));
}

/* Footer */
.site-footer {
  position: absolute;
  bottom: 16px;
  left: 16px;
  display: flex;
  flex-direction: column;
  color: #808080;
  user-select: text;
  -webkit-user-select: text;
}

.site-footer p:first-child {
  font-size: clamp(14px, 1.3vw, 20px);
}

.site-footer p:last-child {
  font-size: clamp(10px, 0.9vw, 14px);
}
</style>
