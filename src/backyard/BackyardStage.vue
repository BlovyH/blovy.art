<template>
  <!-- 后院框 -->
  <div v-if="backyardEntered" class="backyard-stage" :class="{ 'is-editing': flowerbedEditing || boardHighlight }" data-drag-bounds=".backyard-frame">
    <div class="backyard-frame">
      <span v-if="flowerbedEditing" class="backyard-board-hint">Find a maximum placement</span>
      <BackyardBoard @click="onBoardClick" />
      <FlowerTray />
      <img
        class="backyard-basement"
        src="/assets/basement_entrance.png"
        alt=""
        draggable="false"
        @click="dlg.start('basementLocked')"
      />
    </div>

    <span class="backyard-wall-notch" aria-hidden="true" />

    <BackyardDoor variant="exit" @click="leaveBackyard" />

    <BackyardEmotions />

    <img
      v-if="draggingFlower"
      class="backyard-drag-flower"
      :src="FLOWER_SRC"
      :style="dragStyle"
      alt=""
      draggable="false"
    />

    <ImpactBurst :on="burstOn" :x="burstAt.x" :y="burstAt.y" :particles="burstParticles" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDialogFlow } from '@/dialogs/useDialogFlow.js'
import ImpactBurst from '@/fx/ImpactBurst.vue'
import { BURST_MS, makeImpactParticles } from '@/fx/impactFx.js'
import BackyardBoard from './BackyardBoard.vue'
import BackyardDoor from './BackyardDoor.vue'
import BackyardEmotions from './BackyardEmotions.vue'
import FlowerTray from './FlowerTray.vue'
import { backyardEntered, consumeRestoreNotice, leaveBackyard } from './backyard.js'
import { suckFlowers } from './flowerSpitBridge.js'
import {
  FLOWER_SRC,
  beginFlowerEdit,
  boardFlowSeen,
  cakePhase,
  cakeTaken,
  draggingFlower,
  flowerbedEditing,
  flowerbedSpent,
  confirmPudding,
  flowerbedLocked,
  startCakeSequence,
  startPuddingSequence,
} from './flowerbed.js'

const dlg = useDialogFlow()

const boardHighlight = computed(() => dlg.activeKey.value === 'flowerbedEmpty')

function onBoardClick() {
  if (!flowerbedEditing.value && suckFlowers()) return
  if (flowerbedLocked.value || cakeTaken.value) {
    dlg.start('flowerbedEmpty', { preempt: true })
    return
  }
  if (flowerbedSpent.value) dlg.start('flowerbedAngel')
  else if (boardFlowSeen.value) beginFlowerEdit()
  else dlg.start('backyardBoard')
}

const burstOn = ref(false)
const burstAt = ref({ x: 0, y: 0 })
const burstParticles = ref([])
let burstTimer = 0

function spawnCakeBurst() {
  const target =
    document.querySelector('.backyard-cake') || document.querySelector('.backyard-board')
  const box = target ? target.getBoundingClientRect() : null
  if (box) burstAt.value = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  burstParticles.value = makeImpactParticles(box, burstAt.value)
  burstOn.value = true
  clearTimeout(burstTimer)
  burstTimer = setTimeout(() => {
    burstOn.value = false
    burstParticles.value = []
  }, BURST_MS)
}

onBeforeUnmount(() => clearTimeout(burstTimer))

watch(cakePhase, (phase) => {
  if (phase === 'cake') spawnCakeBurst()
}, { flush: 'post' })

const dragStyle = computed(() =>
  draggingFlower.value
    ? { left: `${draggingFlower.value.x}px`, top: `${draggingFlower.value.y}px` }
    : null
)

onMounted(() => {
  if (consumeRestoreNotice()) dlg.start('backyardReturn')
})

let lastFlowKey = dlg.activeKey.value
watch(
  () => [dlg.activeKey.value, dlg.currentStep.value],
  ([key, step]) => {
    if (key === 'flowerbedPudding' && step === 'pudding') confirmPudding()
    if (lastFlowKey === 'backyardBoard' && key === null) beginFlowerEdit()
    else if (lastFlowKey === 'flowerbedMax' && key === null) startCakeSequence()
    else if (lastFlowKey === 'flowerbedPudding' && key === null) startPuddingSequence()
    lastFlowKey = key
  }
)
</script>

<style scoped>
.backyard-stage {
  --backyard-w: min(1000px, 88vw);
  --backyard-h: min(520px, 62vh);
  --backyard-wall: 4px;
  --backyard-cx: 40%;
  --backyard-top: max(84px, 10vh);
  --backyard-board-cols: 6; /* 后院右下角棋盘是 6×6 */
  --backyard-board-scale: 0.56; /* 棋盘高 = 框内高的一半再多一些 */
  --backyard-board-inset: 24px; /* 棋盘离框内边的留白：贴着框放会和墙线糊成一片 */
  /* 棋盘边长集中在这里：花槽大小、花的尺寸、三消演出都以它当尺子 */
  --backyard-board-size: calc(
    (var(--backyard-h) - var(--backyard-wall) * 2) * var(--backyard-board-scale)
  );
  --flower-tray-gap: 16px; /* 花槽离棋盘左边多远 */
  /*--flower-pad: 2px;*/
  --flower-pad: 0;
  /* 三消演出：--merge-ms 要跟 flowerbed.js 的 MERGE_MS 一致，否则花还没飞完就被清掉。
     演出的尺度全在这一组里调，别去 BackyardBoard 里翻 keyframes */
  --merge-ms: 2600ms; /* 整场时长：收拢 → 转着升空 → 飞出视口顶边 */
  --merge-r: calc(var(--backyard-board-size) / var(--backyard-board-cols) * 0.8); /* 抱团半径（单位 = 一格） */
  --merge-scale: 1.2; /* 演出里花放大到几格：花心距 = r × √3，要比「花宽 × 这个数」大才不互相压 */
  /* 转出视口顶边之后还要多飞这么远才算彻底看不见（花自己有半格高）。
     真正的升空距离 --merge-rise 在 BackyardBoard 里算：它要用到这一局三连的行号 --ar，
     而嵌套 var() 只在「声明它的那一层」求值，挂在祖先上取不到 --ar，整条会失效。 */
  --merge-exit-margin: calc(var(--backyard-board-size) / var(--backyard-board-cols));
  /* 通关演出：--cake-ms 要跟 flowerbed.js 的 CAKE_SPIN_MS 一致，否则花还没转完就变蛋糕了。
     尺度 / 圈数 / 快慢全在这一组里调 */
  --cake-ms: 1800ms; /* 收拢 + 转圈的总时长 */
  --cake-turns: 3; /* 外圈转几圈 */
  --cake-turns-inner: 2; /* 内圈转几圈（写负数 = 反过来转，交叠感更强） */
  --cake-scale: 0.8; /* 团里每朵花缩到几格 */
  /* 转圈的快慢曲线：起手就要有速度（0 斜率 = 收拢那一段几乎不转，看着像先收拢再开始转），
     最后一截飞出去（残影就是在那一截才现身的） */
  --cake-ease: cubic-bezier(0.4, 0.16, 0.86, 0.2);
  --cake-trail-lag: 0.15; /* 每多一层残影，整段时长拉长百分之几（= 落后多少角度） */
  --cake-trail-op: 0.45; /* 残影的不透明度 */
  --cake-flash-ms: 160ms; /* 变蛋糕前花闪白的时长 */
  --cake-collapse: 0.18; /* 最后一截飞速旋转时，整团收到原来半径的几成 */
  --cake-pop-ms: 420ms; /* 蛋糕弹出来那一下的时长 */
  --cake-w: 3; /* 蛋糕贴图（单位 = 一格） */
  --cake-h: 2;
  /* --swallow-ms 与逐格错开的总时长要小于 PUDDING_SWALLOW_MS */
  --swallow-ms: 520ms;
  --swallow-stagger: 45ms;
  /* 外框与格线同粗。取偶数：格线由两个格子各出一半，奇数会算出半像素 */
  --backyard-board-border: 4px;
  /* --backyard-board-half-line: calc(var(--backyard-board-border) / 2); */
  --backyard-board-half-line: 0;
  --backyard-board-dark: #000;
  --backyard-board-light: rgb(255 255 255 / 0.78); /* 浅格的白度：纯白在黑底上太跳 */
  /* 格线取本格的反色，所以是两种：黑格用 line、浅格用 line-alt。外框也用 line */
  --backyard-board-line: #fff;
  --backyard-board-line-alt: #000;
  position: fixed;
  inset: 0;
  background: #000;
  z-index: var(--z-backyard);
}

/* 编辑模式：外框换色，提示这里现在可以放花 */
.backyard-stage.is-editing {
  --backyard-board-line: #ac3535;
}

/* 拖着的那朵花 */
.backyard-drag-flower {
  position: fixed;
  box-sizing: border-box; /* 跟棋盘上那朵同一个留白，松手落下时大小不变 */
  width: calc(var(--backyard-board-size) / var(--backyard-board-cols));
  height: calc(var(--backyard-board-size) / var(--backyard-board-cols));
  padding: var(--flower-pad, 1px);
  /* 中心对准指针。走独立属性而不是 transform：transform 会让这个元素自己也变成
     后代 fixed 的包含块（虽然它现在没有后代，但省得以后踩同一个坑），也避免整条覆盖。 */
  translate: -50% -50%;
  pointer-events: none;
  image-rendering: pixelated;
}

.backyard-frame {
  --basement-size: 77px;
  --basement-inset: 24px;
  box-sizing: border-box;
  position: fixed;
  top: var(--backyard-top);
  left: var(--backyard-cx);
  transform: translateX(-50%);
  width: var(--backyard-w);
  height: var(--backyard-h);
  border: var(--backyard-wall) solid #fff;
}

.backyard-basement {
  position: absolute;
  left: var(--basement-inset);
  bottom: var(--basement-inset);
  width: var(--basement-size);
  height: auto;
  image-rendering: pixelated;
  cursor: pointer;
}

.backyard-board-hint {
  position: absolute;
  right: var(--backyard-board-inset);
  bottom: calc(var(--backyard-board-inset) + var(--backyard-board-size) + 8px);
  width: var(--backyard-board-size);
  color: #fff;
  font-family: var(--font-pixel);
  font-size: clamp(16px, 1.4vw, 23px);
  font-style: italic;
  scale: 1 0.85;
  text-align: center;
  white-space: nowrap;
}

/* 把门底下那段墙线变成黑色 */
.backyard-wall-notch {
  position: fixed;
  top: var(--backyard-top);
  left: calc(30% - 42px);
  width: 66px;
  height: var(--backyard-wall);
  background: #000;
  pointer-events: none;
}
</style>
