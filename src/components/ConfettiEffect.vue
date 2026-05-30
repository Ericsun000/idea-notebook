<template>
  <canvas
    v-if="active"
    ref="canvasRef"
    class="confetti-canvas"
  ></canvas>
</template>

<script setup>
import { ref, watch, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  active: { type: Boolean, default: false },
  duration: { type: Number, default: 3000 }
})

const canvasRef = ref(null)
let particles = []
let animId = null
let startTime = 0

const COLORS = ['#E8915A', '#F0A070', '#8FA88A', '#9FBB98', '#7B9EC7', '#93B4DA', '#A089C0', '#B9A2D8']

watch(() => props.active, async (val) => {
  if (val) {
    await nextTick()
    start()
  }
})

function start() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  particles = []
  for (let i = 0; i < 100; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * -0.5,
      w: Math.random() * 8 + 3,
      h: Math.random() * 6 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 1.5,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8,
      opacity: 0.7 + Math.random() * 0.3
    })
  }

  startTime = performance.now()
  animate(ctx, canvas)
}

function animate(ctx, canvas) {
  const elapsed = performance.now() - startTime
  if (elapsed > props.duration) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    return
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const progress = elapsed / props.duration

  for (const p of particles) {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate((p.rotation + p.rotSpeed * elapsed / 16) * Math.PI / 180)
    ctx.globalAlpha = p.opacity * (1 - progress * progress)
    ctx.fillStyle = p.color
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
    ctx.restore()

    p.x += p.vx
    p.vy += 0.06
    p.y += p.vy
  }

  animId = requestAnimationFrame(() => animate(ctx, canvas))
}

onUnmounted(() => {
  if (animId) cancelAnimationFrame(animId)
})
</script>

<style scoped>
.confetti-canvas {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
}
</style>
