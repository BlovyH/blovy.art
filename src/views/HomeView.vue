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
                :key="item.src"
                class="gallery-thumb"
                :src="item.src"
                :alt="item.alt"
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

      <!-- Notice Sign Placeholder -->
      <div class="notice-sign">
        <img src="/assets/placeholder.svg" alt="notice sign placeholder" @click="openNoticeSign" />
      </div>

      <!-- Social Links Window -->
      <PixelWindow
        class="social-window"
        title="SOCIAL LINKS"
        :controls="{ minimize: false, maximize: false, close: false }"
        width="20%"
      >
        <div class="social-body">
          <div class="social-icons-row">
            <a class="social-link" href="#" title="bilibili">
              <div class="social-icon">📺</div>
              <span class="social-id">@blovy</span>
            </a>
            <a class="social-link" href="#" title="xiaohongshu">
              <div class="social-icon">📕</div>
              <span class="social-id">@blovy</span>
            </a>
            <a class="social-link" href="#" title="X">
              <div class="social-icon">𝕏</div>
              <span class="social-id">@blovy</span>
            </a>
          </div>
        </div>
      </PixelWindow>

      <!-- Comments, Notes Window -->
      <PixelWindow
        class="comments-window"
        title="COMMENTS, NOTES"
        :show-minimize="true"
        :show-maximize="true"
        width="32%"
        :initial-z-index="40"
      >
        <div class="comments-body">
          <article
            v-for="note in notes"
            :key="note.title"
            class="note-item"
          >
            <div class="note-main">
              <p class="note-title">{{ note.title }}</p>
              <p class="note-tags">{{ note.tags }}</p>
            </div>
            <time class="note-date">{{ note.date }}</time>
          </article>
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
                src="/assets/placeholder.svg"
                alt="Fandom Projects logo"
              />
            </div>
            <div
              ref="fandomContentRef"
              class="fandom-content"
            >
              <div class="fandom-body">
                <div
                  v-for="project in fandomProjects"
                  :key="project.title"
                  class="fandom-item"
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
    <button class="power-btn">巨硬™办公室力量点2003</button>

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
  </main>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import PixelWindow from '@/components/PixelWindow.vue'
import DialogBox from '@/components/DialogBox.vue'
import OptionBox from '@/components/OptionBox.vue'
import ImageDetailWindow from '@/components/ImageDetailWindow.vue'
import NothingWindow from '@/components/NothingWindow.vue'
import DesktopIcon from '@/components/DesktopIcon.vue'
import CenterToast from '@/components/CenterToast.vue'
import { nextZ } from '@/stores/windowZ.js'
import { CONTENT_DATA_URL } from '@/config/data.js'

const fandomWindowRef = ref(null)
const fandomContentRef = ref(null)
const fandomOuterRef = ref(null)
const galleryWindowRef = ref(null)
const isExpanded = ref(false)
const expandUp = ref(false)
const expandHeight = ref(0)
const galleryItems = ref([])
const notes = ref([])
const fandomProjects = ref([])
const currentYear = new Date().getFullYear()
let collapseTimer = null

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

onMounted(async () => {
  if (!CONTENT_DATA_URL) {
    console.warn('CONTENT_DATA_URL is empty. Please set it in src/config/data.js')
    return
  }

  try {
    const res = await fetch(CONTENT_DATA_URL)
    const data = await res.json()
    galleryItems.value = data.gallery || []
    notes.value = data.notes || []
    fandomProjects.value = data.fandomProjects || []
  } catch (e) {
    console.error('Failed to load content:', e)
  }

  if (isMobile()) {
    mobileNoticeVisible.value = true
  }

  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
})

function onWindowResize() {
  if (detailVisible.value) {
    updateDetailSide()
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

function onFandomLeave() {
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
const nothingVisible = ref(false)
const mobileNoticeVisible = ref(false)

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
  height: 460px;
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
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  flex: 1;
}

.gallery-thumb {
  width: 100%;
  height: clamp(100px, 16vh, 180px);
  object-fit: cover;
  border: 2px solid #ffffff;
  image-rendering: pixelated;
  background: #111;
  cursor: pointer;
}

/* Notice Sign */
.notice-sign {
  position: absolute;
  top: 14%;
  left: 72%;
  width: clamp(48px, 5vw, 72px);
  height: 160px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.notice-sign img {
  width: 100%;
  height: 100px;
  object-fit: contain;
  image-rendering: pixelated;
  border: 2px solid #ffffff;
  background: #000;
  cursor: pointer;
}

.notice-sign::after {
  content: '';
  width: 3px;
  height: 60px;
  background: #ffffff;
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

.social-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.social-icons-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.social-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #ffffff;
  text-decoration: none;
}

.social-icon {
  width: clamp(40px, 3.6vw, 58px);
  height: clamp(40px, 3.6vw, 58px);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #ffffff;
  font-size: clamp(18px, 1.8vw, 28px);
  flex-shrink: 0;
}

.social-id {
  font-size: clamp(10px, 0.9vw, 14px);
  color: #808080;
  opacity: 0;
  transition: opacity 0.2s;
  white-space: nowrap;
}

.social-link:hover .social-id {
  opacity: 1;
  color: #00ffff;
}

/* Comments Window */
.comments-window {
  position: absolute;
  top: 50%;
  right: 2%;
  height: 420px;
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
  border: 1px solid #c0c0c0;
  border-radius: clamp(3px, 0.5vw, 6px);
  padding: 14px;
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
  top: 90%;
  left: 32%;
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
}

.fandom-title-text {
  font-size: clamp(18px, 1.6vw, 26px);
  font-weight: bold;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.fandom-logo-small {
  width: clamp(32px, 2.8vw, 48px);
  height: clamp(32px, 2.8vw, 48px);
  object-fit: cover;
  border: 2px solid #ffffff;
  image-rendering: pixelated;
  background: #111;
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
  border: 1px solid #c0c0c0;
  border-radius: clamp(3px, 0.5vw, 6px);
  padding: 14px;
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
  width: clamp(56px, 5.5vw, 84px);
  height: clamp(56px, 5.5vw, 84px);
  object-fit: cover;
  border: 2px solid #ffffff;
  image-rendering: pixelated;
  background: #111;
  flex-shrink: 0;
}

/* Power Button */
.power-btn {
  position: absolute;
  bottom: 100px;
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
}

.power-btn:active {
  border-top: 8px solid #555555;
  border-left: 8px solid #555555;
  border-right: 8px solid #ffffff;
  border-bottom: 8px solid #ffffff;
  transform: translate(4px, 4px);
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
