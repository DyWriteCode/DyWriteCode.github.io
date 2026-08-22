<template>
    <div class="city-fireworks" ref="containerRef">
        <canvas ref="canvasRef" class="canvas-layer"></canvas>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const emit = defineEmits(['finished'])
const containerRef = ref(null)
const canvasRef = ref(null)
let ctx = null
let animId = null
let startTime = 0
let elapsed = 0
let finished = false
let w = 0,
    h = 0
let dpr = 1

// ========== 工具函数 ==========
const rand = (min, max) => Math.random() * (max - min) + min
const randInt = (min, max) => Math.floor(rand(min, max + 1))
const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
const easeOutQuad = t => t * (2 - t)
const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// ========== 抬头控制 ==========
let lookUpProgress = 0
let bgColor = { r: 26, g: 26, b: 46 }

// ========== 城市数据 ==========
let buildings = []
let cityGlow = null
const CITY_BOTTOM = 0.95 // 城市底部位置

// ========== 星星 ==========
let stars = []
const STAR_COLORS = ['#f0f4f8', '#b8d9f0', '#f5d78a']

// ========== 烟花 ==========
let fireworks = []
const FIREWORK_TIMES = Array.from({ length: 10 }, (_, i) => 9.0 + i * 0.4)
const FIREWORK_COLORS = ['#7dd3c6', '#ff9a9a', '#c084fc', '#fcd34d', '#60a5fa', '#f472b6', '#34d399', '#fb923c', '#a78bfa', '#fbbf24']

// ========== 星尘汇聚 ==========
let dustParticles = []
let dustPhase = 'idle'

// ========== 祝福语光点拼接 ==========
const BLESSINGS = [
    '愿你眼中有星辰大海',
    '心中有繁花似锦',
    '前路漫漫亦灿灿',
    '做自己的光',
    '温柔且坚定',
    '去更远的地方',
]
let blessingLines = []
let currentLineIndex = 0
let blessingPhase = 'idle'
let blessingStartTime = 0
let textParticles = []

// ========== 最终汇聚 ==========
let finalPhase = 'idle'
let finalParticles = []
let finalTextAlpha = 0
let finalFlashAlpha = 0
let finalFlashStart = 0

// ========== 离屏Canvas ==========
let offscreenCanvas = null
let offCtx = null

// ========== 初始化城市（多层混合，消除空隙） ==========
function buildCity() {
    buildings = []
    // 定义三个层次的参数，它们在垂直范围上重叠，形成渐变
    const layers = [
        // 远景：小楼，浅色，密集
        {
            yMin: 0.08,
            yMax: 0.42,
            colorMin: 10,
            colorMax: 16,
            bwMin: 6,
            bwMax: 14,
            bhMin: 8,
            bhMax: 30,
            gapMin: 0,
            gapMax: 2,
            windowSize: 1,
            windowChance: 0.3,
            winPerBuilding: 6,
        },
        // 中景：标准楼
        {
            yMin: 0.15,
            yMax: 0.72,
            colorMin: 16,
            colorMax: 24,
            bwMin: 18,
            bwMax: 45,
            bhMin: 30,
            bhMax: 100,
            gapMin: 1,
            gapMax: 3,
            windowSize: 3,
            windowChance: 0.7,
            winPerBuilding: 40,
        },
        // 近景：高大楼，深色
        {
            yMin: 0.40,
            yMax: 0.95,
            colorMin: 8,
            colorMax: 14,
            bwMin: 28,
            bwMax: 70,
            bhMin: 60,
            bhMax: 180,
            gapMin: 2,
            gapMax: 5,
            windowSize: 5,
            windowChance: 0.7,
            winPerBuilding: 60,
        },
    ]

    for (const layer of layers) {
        const yStart = h * layer.yMin
        const yEnd = h * layer.yMax
        let x = 0

        // 水平方向密集排列，直到铺满宽度
        while (x < w) {
            const bw = rand(layer.bwMin, layer.bwMax)
            const bh = rand(layer.bhMin, layer.bhMax)
            // 垂直位置随机，确保建筑从底部到顶部都有分布
            const y = rand(yStart, yEnd - bh)
            // 确保不超出底部
            if (y + bh > h * 0.95) continue

            const color = `hsl(220, 30%, ${randInt(layer.colorMin, layer.colorMax)})`
            const windows = []
            let winCount = 0

            if (layer.windowSize === 1) {
                winCount = randInt(3, 8)
                for (let j = 0; j < winCount; j++) {
                    windows.push({
                        x: x + rand(1, bw - 2),
                        y: y + rand(1, bh - 2),
                        w: 1,
                        h: 1 + randInt(0, 1),
                        color: '#fbbf24',
                        alpha: rand(0.15, 0.5),
                        phase: rand(0, Math.PI * 2),
                    })
                }
            } else if (layer.windowSize === 3) {
                const cols = randInt(4, 8)
                const rows = randInt(10, 22)
                const rowBright = Array.from({ length: rows }, () => Math.random() < 0.7)
                for (let r = 0; r < rows; r++) {
                    if (!rowBright[r]) continue
                    for (let c = 0; c < cols; c++) {
                        if (Math.random() > 0.7) continue
                        const alpha = rand(0.3, 1.0)
                        const colorType = Math.random() < 0.08 ? '#7ab7d4' : (Math.random() < 0.02 ? '#f87171' : '#fbbf24')
                        windows.push({
                            x: x + (c + 1) * (bw / (cols + 1)) - 2,
                            y: y + (r + 1) * (bh / (rows + 1)) - 2,
                            w: 3,
                            h: 5,
                            color: colorType,
                            alpha: alpha,
                            phase: rand(0, Math.PI * 2),
                        })
                    }
                }
            } else {
                const cols = randInt(6, 12)
                const rows = randInt(12, 28)
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        if (Math.random() > 0.7) continue
                        windows.push({
                            x: x + (c + 1) * (bw / (cols + 1)) - 3,
                            y: y + (r + 1) * (bh / (rows + 1)) - 3,
                            w: 5,
                            h: 7,
                            color: '#fcd34d',
                            alpha: rand(0.7, 1.0),
                            phase: rand(0, Math.PI * 2),
                        })
                    }
                }
            }

            let antenna = 0
            let topColor = null
            if (layer.windowSize === 3) {
                topColor = '#2a3d5a'
                antenna = Math.random() > 0.6 ? randInt(5, 18) : 0
            }

            buildings.push({
                x,
                y,
                w: bw,
                h: bh,
                color,
                layer: layer.windowSize === 1 ? 'far' : (layer.windowSize === 3 ? 'mid' : 'near'),
                windows,
                topColor,
                antenna,
            })

            const gap = rand(layer.gapMin, layer.gapMax)
            x += bw + gap
        }
    }

    // 城市辉光
    cityGlow = {
        cx: w * 0.5,
        cy: h * 0.2,
        radius: 400,
        intensity: 0.15,
    }
}

// ========== 初始化星星 ==========
function initStars() {
    stars = []
    const count = 120
    const centerX = w * 0.4,
        centerY = h * 0.3
    const angle = -0.5
    for (let i = 0; i < count; i++) {
        let x, y
        if (i < 48) {
            const t = rand(0, 1)
            const dist = rand(0, 180)
            const a = angle + rand(-0.4, 0.4)
            x = centerX + dist * Math.cos(a)
            y = centerY + dist * Math.sin(a)
        } else {
            x = rand(0, w)
            y = rand(0, h)
        }
        const isBright = i < 10
        const r = isBright ? rand(6, 8) : rand(1, 5)
        const color = isBright ? '#f5d78a' : STAR_COLORS[randInt(0, 2)]
        stars.push({
            x,
            y,
            r,
            color,
            baseX: x,
            baseY: y,
            speed: rand(0.8, 3.0),
            phase: rand(0, Math.PI * 2),
            baseOpacity: rand(0.3, 0.9),
            isBright,
            glow: isBright ? 40 : 8,
            alpha: 0,
        })
    }
    const anchor = stars[0]
    anchor.x = w * 0.5
    anchor.y = h * 0.65
    anchor.baseX = anchor.x
    anchor.baseY = anchor.y
    anchor.r = 8
    anchor.color = '#f5d78a'
    anchor.isBright = true
    anchor.glow = 50
}

// ========== 烟花 ==========
function spawnFirework(time) {
    const idx = FIREWORK_TIMES.indexOf(time)
    const x = w * (0.05 + (idx % 10) * 0.1) + rand(-15, 15)
    const y = h * 0.92
    const targetY = rand(h * 0.12, h * 0.30)
    const baseColor = FIREWORK_COLORS[idx % FIREWORK_COLORS.length]
    const particleCount = randInt(120, 150)
    const particles = []
    for (let i = 0; i < particleCount; i++) {
        const angle = rand(0, Math.PI * 2)
        const speed = rand(6, 22)
        particles.push({
            x: 0,
            y: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: rand(3, 6),
            life: 1,
            decay: rand(0.01, 0.025),
            color: baseColor,
            trail: [],
            sparkle: rand(0, Math.PI * 2),
            split: Math.random() < 0.1,
            _splitDone: false,
        })
    }
    fireworks.push({
        x,
        y,
        targetY,
        color: baseColor,
        phase: 'rising',
        startTime: time,
        riseSpeed: rand(8, 12) * 30,
        particles,
        glowRadius: 15,
        glowAlpha: 1.0,
        secondaryParticles: [],
    })
}

// ========== 星尘汇聚 ==========
function startDustConverge() {
    dustPhase = 'converging'
    dustParticles = []
    for (let i = 0; i < 300; i++) {
        const angle = rand(0, Math.PI * 2)
        const radius = rand(0, 220)
        dustParticles.push({
            x: w / 2 + Math.cos(angle) * radius * 0.8,
            y: h / 2 + Math.sin(angle) * radius * 0.6,
            targetX: w / 2 + Math.cos(angle) * radius * 0.35,
            targetY: h / 2 + Math.sin(angle) * radius * 0.25,
            radius: rand(0.5, 1.8),
            alpha: rand(0.3, 0.8),
            phase: rand(0, Math.PI * 2),
            speed: rand(0.5, 1.5),
        })
    }
}

// ========== 离屏Canvas文字像素提取 ==========
function getTextPixels(text, fontSize = 36) {
    if (!offscreenCanvas) {
        offscreenCanvas = document.createElement('canvas')
        offscreenCanvas.width = w
        offscreenCanvas.height = h
        offCtx = offscreenCanvas.getContext('2d')
    }
    offCtx.clearRect(0, 0, w, h)
    offCtx.fillStyle = '#fff'
    offCtx.font = `300 ${fontSize}px "PingFang SC","Microsoft YaHei",sans-serif`
    offCtx.textAlign = 'center'
    offCtx.textBaseline = 'middle'
    offCtx.fillText(text, w / 2, h / 2)
    const imageData = offCtx.getImageData(0, 0, w, h)
    const data = imageData.data
    const pixels = []
    const step = 4
    for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
            const idx = (y * w + x) * 4
            if (data[idx + 3] > 128) {
                pixels.push({ x, y })
            }
        }
    }
    return pixels
}

// ========== 祝福语光点拼接 ==========
function buildBlessingLine(idx) {
    const text = BLESSINGS[idx]
    if (!text) return
    const fontSize = 36
    const pixels = getTextPixels(text, fontSize)
    let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity
    for (const p of pixels) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
    }
    const cx = (minX + maxX) / 2,
        cy = (minY + maxY) / 2
    const targetY = h * 0.38 - idx * h * 0.06
    const targetX = w / 2
    let pts = []
    for (const p of pixels) {
        const px = p.x - cx + targetX
        const py = p.y - cy + targetY
        const angle = rand(0, Math.PI * 2)
        const dist = rand(80, 200)
        pts.push({
            targetX: px,
            targetY: py,
            currentX: w / 2 + Math.cos(angle) * dist,
            currentY: h / 2 + Math.sin(angle) * dist,
            radius: rand(1.5, 3),
            alpha: 0,
            phase: rand(0, Math.PI * 2),
        })
    }
    const maxPts = Math.min(pts.length, 350)
    const selected = []
    const step2 = Math.max(1, Math.floor(pts.length / maxPts))
    for (let i = 0; i < pts.length && selected.length < maxPts; i += step2) {
        selected.push(pts[i])
    }
    const lineData = {
        text,
        idx,
        particles: selected,
        active: false,
        alpha: 0,
    }
    blessingLines[idx] = lineData
    blessingPhase = 'building'
    blessingStartTime = elapsed
    textParticles = selected
    currentLineIndex = idx
}

// ========== 触发最终汇聚 ==========
function triggerFinal() {
    const allPts = []
    for (const line of blessingLines) {
        if (line && line.active) {
            for (const p of line.particles) {
                allPts.push({
                    x: p.targetX,
                    y: p.targetY,
                    vx: rand(-2, 2),
                    vy: rand(-2, 2),
                    radius: p.radius,
                    color: '#f5d78a',
                    life: 1,
                })
            }
        }
    }
    if (allPts.length < 100) {
        for (let i = 0; i < 200; i++) {
            allPts.push({
                x: rand(0, w),
                y: rand(0, h),
                vx: rand(-3, 3),
                vy: rand(-3, 3),
                radius: rand(1, 3),
                color: '#f5d78a',
                life: 1,
            })
        }
    }
    finalParticles = allPts.map(p => ({
        ...p,
        phase: 'flyout',
        targetX: w / 2 + rand(-30, 30),
        targetY: h / 2 + rand(-30, 30),
    }))
    setTimeout(() => {
        for (const p of finalParticles) {
            p.phase = 'converge'
            const angle = Math.atan2(h / 2 - p.y, w / 2 - p.x)
            const speed = rand(4, 10)
            p.vx = Math.cos(angle) * speed
            p.vy = Math.sin(angle) * speed
        }
    }, 400)

    finalPhase = 'converging'
    finalTextAlpha = 0
    finalFlashAlpha = 0.8
    finalFlashStart = elapsed
}

// ========== 更新逻辑 ==========
function update(dt) {
    const now = elapsed

    // ---- 抬头进度：背景变暗 + 城市下沉 ----
    if (now < 7.0) {
        lookUpProgress = Math.min(now / 7.0, 1)
        const t = lookUpProgress
        bgColor.r = Math.round(26 - 26 * t)
        bgColor.g = Math.round(26 - 26 * t)
        bgColor.b = Math.round(46 - 46 * t)
        if (cityGlow) cityGlow.intensity = 0.15 * (1 - t * 0.5)
    } else {
        lookUpProgress = 1
        bgColor = { r: 0, g: 0, b: 0 }
        if (cityGlow) cityGlow.intensity = 0.075
    }

    // ---- 星星显现 (5-9s) ----
    if (now >= 5.0 && now < 9.0) {
        const t = (now - 5.0) / 4.0
        for (const s of stars) {
            s.alpha = Math.min(1, t * 1.2)
        }
    } else if (now >= 9.0) {
        for (const s of stars) s.alpha = 1
    } else {
        for (const s of stars) s.alpha = 0
    }

    // ---- 烟花 ----
    for (const t of FIREWORK_TIMES) {
        if (now >= t && !window._fireworkLaunched) {
            window._fireworkLaunched = true
            spawnFirework(t)
        }
    }
    for (let i = fireworks.length - 1; i >= 0; i--) {
        const f = fireworks[i]
        if (f.phase === 'rising') {
            f.y -= f.riseSpeed * dt
            if (f.y <= f.targetY) {
                f.phase = 'exploding'
                for (const p of f.particles) {
                    p.x = f.x
                    p.y = f.y
                    p.trail = []
                }
                f.glowRadius = 15
                f.glowAlpha = 1.0
            }
        } else if (f.phase === 'exploding') {
            let allDead = true
            for (const p of f.particles) {
                if (p.life <= 0) continue
                p.x += p.vx * dt * 30
                p.y += p.vy * dt * 30
                p.vy += 0.06 * dt * 30
                p.life -= p.decay * dt * 30
                p.radius *= 0.995
                p.trail.push({ x: p.x, y: p.y })
                if (p.trail.length > 10) p.trail.shift()
                p.sparkle += dt * 10
                if (p.split && !p._splitDone && p.life < 0.5) {
                    p._splitDone = true
                    const count = randInt(3, 5)
                    for (let j = 0; j < count; j++) {
                        const angle = rand(0, Math.PI * 2)
                        const speed = rand(3, 8)
                        f.secondaryParticles.push({
                            x: p.x,
                            y: p.y,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed - 1,
                            radius: rand(1, 3),
                            life: 0.8,
                            decay: rand(0.02, 0.04),
                            color: p.color,
                            trail: [],
                        })
                    }
                }
                if (p.y > h * 0.70) p.life = 0
                if (p.life > 0) allDead = false
            }
            for (let j = f.secondaryParticles.length - 1; j >= 0; j--) {
                const sp = f.secondaryParticles[j]
                sp.x += sp.vx * dt * 30
                sp.y += sp.vy * dt * 30
                sp.vy += 0.04 * dt * 30
                sp.life -= sp.decay * dt * 30
                sp.radius *= 0.998
                sp.trail.push({ x: sp.x, y: sp.y })
                if (sp.trail.length > 5) sp.trail.shift()
                if (sp.y > h * 0.70) sp.life = 0
                if (sp.life <= 0) f.secondaryParticles.splice(j, 1)
                else allDead = false
            }
            f.glowRadius += 120 * dt
            f.glowAlpha *= (1 - dt * 0.5)
            if (f.glowAlpha < 0.01) f.glowAlpha = 0
            if (allDead && f.secondaryParticles.length === 0) {
                fireworks.splice(i, 1)
            }
        }
    }

    // ---- 星尘汇聚 (13-15s) ----
    if (now >= 13.0 && now < 15.0 && dustPhase === 'idle') {
        startDustConverge()
    }
    if (dustPhase === 'converging') {
        const progress = (now - 13.0) / 2.0
        const ease = easeInOutCubic(Math.min(progress, 1))
        for (const p of dustParticles) {
            p.x = lerp(p.x, p.targetX, 0.04 * dt * 30)
            p.y = lerp(p.y, p.targetY, 0.04 * dt * 30)
            p.alpha = lerp(p.alpha, 0.6 + 0.4 * Math.sin(now * p.speed + p.phase), 0.02)
        }
        if (progress >= 1) dustPhase = 'done'
    }

    // ---- 祝福语 (15-23s) ----
    if (now >= 15.0 && now < 23.0) {
        const interval = 4.5
        const idx = Math.floor((now - 15.0) / interval)
        if (idx < BLESSINGS.length && idx !== currentLineIndex) {
            if (idx > currentLineIndex) {
                if (currentLineIndex > 0) {
                    const prev = blessingLines[currentLineIndex - 1]
                    if (prev) prev.active = true
                }
                currentLineIndex = idx
                buildBlessingLine(idx)
            }
        }
        if (blessingPhase === 'building' && blessingLines[currentLineIndex]) {
            const line = blessingLines[currentLineIndex]
            const t = (now - blessingStartTime) / 2.0
            if (t >= 1) {
                blessingPhase = 'active'
                line.active = true
                for (const p of line.particles) {
                    p.alpha = 1
                    p.currentX = p.targetX
                    p.currentY = p.targetY
                }
                textParticles = []
            } else {
                const ease = easeOutQuad(t)
                for (const p of line.particles) {
                    p.currentX = lerp(p.currentX, p.targetX, 0.06 * dt * 30)
                    p.currentY = lerp(p.currentY, p.targetY, 0.06 * dt * 30)
                    p.alpha = ease
                }
            }
        }
        for (let i = 0; i < blessingLines.length; i++) {
            const line = blessingLines[i]
            if (line && line.active) {
                const offset = Math.min(i, currentLineIndex) * h * 0.06
                for (const p of line.particles) {
                    p.yOffset = offset
                }
            }
        }
    }

    // ---- 最终汇聚 (23s+) ----
    if (now >= 23.0 && finalPhase === 'idle') {
        triggerFinal()
    }
    if (finalPhase === 'converging') {
        let allDone = true
        for (const p of finalParticles) {
            if (p.phase === 'flyout') {
                p.x += p.vx * dt * 30
                p.y += p.vy * dt * 30
                p.life *= 0.99
            } else if (p.phase === 'converge') {
                const dx = p.targetX - p.x
                const dy = p.targetY - p.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                if (dist > 1) {
                    allDone = false
                    p.vx += dx * 0.03 * dt * 30
                    p.vy += dy * 0.03 * dt * 30
                    p.vx *= 0.97
                    p.vy *= 0.97
                    p.x += p.vx * dt * 30
                    p.y += p.vy * dt * 30
                } else {
                    p.x = p.targetX
                    p.y = p.targetY
                }
            }
        }
        if (finalFlashAlpha > 0) {
            const t = (now - finalFlashStart) / 0.4
            if (t >= 1) finalFlashAlpha = 0
            else finalFlashAlpha *= (1 - dt * 3)
        }
        if (now - finalFlashStart > 0.3) {
            finalTextAlpha = Math.min(1, (now - finalFlashStart - 0.3) / 0.5)
        }
        if (allDone && finalPhase === 'converging') {
            finalPhase = 'showing'
            const pixels = getTextPixels('✨生日快乐✨', 64)
            const shuffled = pixels.slice().sort(() => Math.random() - 0.5)
            for (let i = 0; i < finalParticles.length && i < shuffled.length; i++) {
                finalParticles[i].targetX = shuffled[i].x
                finalParticles[i].targetY = shuffled[i].y
                finalParticles[i].x = lerp(finalParticles[i].x, shuffled[i].x, 0.5)
                finalParticles[i].y = lerp(finalParticles[i].y, shuffled[i].y, 0.5)
                finalParticles[i].radius = 2.5
                finalParticles[i].color = '#fcd34d'
            }
            finalFlashAlpha = 0.6
            finalFlashStart = now
        }
    }

    if (now > 28 && !finished) {
        finished = true
        emit('finished')
    }
}

// ========== 绘制 ==========
function draw(ctx) {
    ctx.save()
    // 第1层：背景
    ctx.fillStyle = `rgb(${bgColor.r},${bgColor.g},${bgColor.b})`
    ctx.fillRect(0, 0, w, h)

    // 第2层：城市（纯垂直下沉）
    drawCity(ctx)

    // 第3层：星星（lighter）
    ctx.globalCompositeOperation = 'lighter'
    drawStars(ctx)

    // 第4层：烟花（lighter）
    drawFireworks(ctx)

    // 第5层：文字（lighter）
    drawBlessings(ctx)
    drawFinal(ctx)

    ctx.restore()
}

// ---- 绘制城市 ----
function drawCity(ctx) {
    ctx.save()
    // 城市只垂直下降
    const offsetY = lookUpProgress * h * 0.6
    ctx.translate(0, offsetY)

    for (const b of buildings) {
        ctx.fillStyle = b.color
        ctx.fillRect(b.x, b.y, b.w, b.h)
        for (const win of b.windows) {
            const flicker = 0.7 + 0.3 * Math.sin(elapsed * 0.5 + win.phase)
            const alpha = win.alpha * flicker
            if (alpha < 0.01) continue
            ctx.globalAlpha = alpha
            ctx.fillStyle = win.color
            ctx.shadowColor = 'rgba(251,191,36,0.15)'
            ctx.shadowBlur = 2
            ctx.fillRect(win.x, win.y, win.w, win.h)
        }
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
        if (b.topColor) {
            ctx.fillStyle = b.topColor
            ctx.fillRect(b.x, b.y, b.w, 1)
        }
        if (b.antenna && b.antenna > 0) {
            ctx.strokeStyle = '#445566'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(b.x + b.w / 2, b.y)
            ctx.lineTo(b.x + b.w / 2, b.y - b.antenna)
            ctx.stroke()
        }
    }

    // 城市辉光
    if (cityGlow && cityGlow.intensity > 0) {
        ctx.globalAlpha = cityGlow.intensity * 1.5
        const grad = ctx.createRadialGradient(cityGlow.cx, cityGlow.cy, 20, cityGlow.cx, cityGlow.cy, cityGlow.radius)
        grad.addColorStop(0, 'rgba(255,180,80,0.15)')
        grad.addColorStop(1, 'rgba(255,180,80,0)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)
    }

    ctx.restore()
}

// ---- 星星 ----
function drawStars(ctx) {
    ctx.save()
    for (const s of stars) {
        if (s.alpha < 0.01) continue
        const opacity = s.baseOpacity * (0.3 + 0.7 * Math.sin(elapsed * s.speed + s.phase))
        const alpha = s.alpha * opacity
        const r = s.r * (1 + 0.12 * Math.sin(elapsed * s.speed * 0.7 + s.phase))
        ctx.beginPath()
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
        ctx.fillStyle = s.color
        ctx.globalAlpha = alpha
        ctx.shadowColor = s.color
        ctx.shadowBlur = s.glow
        ctx.fill()
        if (s.isBright && alpha > 0.3) {
            ctx.shadowBlur = 0
            for (let i = 0; i < 4; i++) {
                const angle = i * Math.PI / 4
                const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x + Math.cos(angle) * 20, s.y + Math.sin(angle) * 20, 20)
                grad.addColorStop(0, `rgba(255,215,0,${alpha * 0.3})`)
                grad.addColorStop(1, 'rgba(255,215,0,0)')
                ctx.fillStyle = grad
                ctx.beginPath()
                ctx.ellipse(s.x + Math.cos(angle) * 10, s.y + Math.sin(angle) * 10, 20, 3, angle, 0, Math.PI * 2)
                ctx.fill()
            }
        }
    }
    ctx.restore()
}

// ---- 烟花 ----
function drawFireworks(ctx) {
    ctx.save()
    for (const f of fireworks) {
        if (f.phase === 'rising') {
            ctx.beginPath()
            ctx.arc(f.x, f.y, 6, 0, Math.PI * 2)
            ctx.fillStyle = f.color
            ctx.shadowColor = f.color
            ctx.shadowBlur = 70
            ctx.fill()
            for (let j = 0; j < 15; j++) {
                const alpha = 0.8 - j * 0.053
                ctx.beginPath()
                ctx.arc(f.x, f.y + j * 3, 5 * alpha, 0, Math.PI * 2)
                ctx.fillStyle = f.color
                ctx.globalAlpha = alpha
                ctx.shadowBlur = 0
                ctx.fill()
            }
            ctx.globalAlpha = 1
            ctx.shadowBlur = 0
        } else if (f.phase === 'exploding') {
            if (f.glowAlpha > 0.01) {
                const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.glowRadius)
                grad.addColorStop(0, `rgba(255,255,255,${f.glowAlpha * 0.6})`)
                grad.addColorStop(1, `rgba(255,200,100,0)`)
                ctx.fillStyle = grad
                ctx.beginPath()
                ctx.arc(f.x, f.y, f.glowRadius, 0, Math.PI * 2)
                ctx.fill()
            }
            for (const p of f.particles) {
                if (p.life <= 0) continue
                for (let j = 0; j < p.trail.length - 1; j++) {
                    const t = p.trail[j]
                    const alpha = (j / p.trail.length) * p.life * 0.3
                    ctx.beginPath()
                    ctx.arc(t.x, t.y, p.radius * 0.5 * alpha, 0, Math.PI * 2)
                    ctx.fillStyle = p.color
                    ctx.globalAlpha = alpha
                    ctx.shadowBlur = 0
                    ctx.fill()
                }
                ctx.globalAlpha = p.life
                ctx.beginPath()
                ctx.arc(p.x, p.y, Math.max(p.radius, 0.3), 0, Math.PI * 2)
                ctx.fillStyle = p.color
                ctx.shadowColor = p.color
                ctx.shadowBlur = 50
                ctx.fill()
            }
            for (const sp of f.secondaryParticles) {
                if (sp.life <= 0) continue
                for (let j = 0; j < sp.trail.length - 1; j++) {
                    const t = sp.trail[j]
                    const alpha = (j / sp.trail.length) * sp.life * 0.3
                    ctx.beginPath()
                    ctx.arc(t.x, t.y, sp.radius * 0.5 * alpha, 0, Math.PI * 2)
                    ctx.fillStyle = sp.color
                    ctx.globalAlpha = alpha
                    ctx.shadowBlur = 0
                    ctx.fill()
                }
                ctx.globalAlpha = sp.life
                ctx.beginPath()
                ctx.arc(sp.x, sp.y, Math.max(sp.radius, 0.3), 0, Math.PI * 2)
                ctx.fillStyle = sp.color
                ctx.shadowColor = sp.color
                ctx.shadowBlur = 35
                ctx.fill()
            }
            ctx.globalAlpha = 1
            ctx.shadowBlur = 0
        }
    }
    ctx.restore()
}

// ---- 祝福语 ----
function drawBlessings(ctx) {
    ctx.save()
    for (const line of blessingLines) {
        if (!line || !line.active) continue
        const yOffset = line.idx * h * 0.06
        for (const p of line.particles) {
            if (p.alpha < 0.01) continue
            const drawX = p.currentX
            const drawY = p.currentY + yOffset
            ctx.beginPath()
            ctx.arc(drawX, drawY, p.radius * p.alpha, 0, Math.PI * 2)
            ctx.fillStyle = '#f0f4f8'
            ctx.globalAlpha = p.alpha * 0.9
            ctx.shadowColor = 'rgba(245,215,138,0.5)'
            ctx.shadowBlur = 12
            ctx.fill()
        }
    }
    for (const p of textParticles) {
        if (p.alpha < 0.01) continue
        ctx.beginPath()
        ctx.arc(p.currentX, p.currentY, p.radius * p.alpha, 0, Math.PI * 2)
        ctx.fillStyle = '#f0f4f8'
        ctx.globalAlpha = p.alpha * 0.8
        ctx.shadowColor = 'rgba(245,215,138,0.4)'
        ctx.shadowBlur = 10
        ctx.fill()
    }
    ctx.restore()
}

// ---- 最终 ----
function drawFinal(ctx) {
    ctx.save()
    for (const p of finalParticles) {
        if (p.life < 0.01) continue
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * (p.life || 1), 0, Math.PI * 2)
        ctx.fillStyle = p.color || '#f5d78a'
        ctx.globalAlpha = p.life || 1
        ctx.shadowColor = '#f5d78a'
        ctx.shadowBlur = 12
        ctx.fill()
    }

    if (finalPhase === 'showing') {
        for (const p of finalParticles) {
            if (p.life < 0.01) continue
            ctx.beginPath()
            ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
            ctx.fillStyle = '#fcd34d'
            ctx.globalAlpha = finalTextAlpha
            ctx.shadowColor = '#fcd34d'
            ctx.shadowBlur = 20
            ctx.fill()
        }
    }

    if (finalFlashAlpha > 0.01) {
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = `rgba(255,255,255,${finalFlashAlpha * 0.85})`
        ctx.fillRect(0, 0, w, h)
    }
    ctx.restore()
}

// ========== 动画循环 ==========
function animate(timestamp) {
    if (!startTime) startTime = timestamp
    const newElapsed = (timestamp - startTime) / 1000
    const delta = Math.min(newElapsed - elapsed, 0.05)
    elapsed = newElapsed
    if (elapsed > 32 && !finished) {
        finished = true
        emit('finished')
        return
    }
    update(delta)
    draw(ctx)
    animId = requestAnimationFrame(animate)
}

// ========== 自适应 ==========
function resizeCanvas() {
    if (!canvasRef.value) return
    const rect = containerRef.value.getBoundingClientRect()
    w = rect.width
    h = rect.height
    dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    canvasRef.value.width = w * dpr
    canvasRef.value.height = h * dpr
    canvasRef.value.style.width = w + 'px'
    canvasRef.value.style.height = h + 'px'
    ctx.scale(dpr, dpr)

    buildCity()
    initStars()
    fireworks = []
    window._fireworkLaunched = false
    dustPhase = 'idle'
    dustParticles = []
    blessingLines = []
    textParticles = []
    currentLineIndex = 0
    blessingPhase = 'idle'
    finalPhase = 'idle'
    finalParticles = []
    finalTextAlpha = 0
    finalFlashAlpha = 0
    lookUpProgress = 0
    bgColor = { r: 26, g: 26, b: 46 }
    startTime = 0
    elapsed = 0
    finished = false
}

// ========== 生命周期 ==========
onMounted(() => {
    nextTick(() => {
        const canvas = canvasRef.value
        if (!canvas) return
        ctx = canvas.getContext('2d')
        if (!ctx) return
        resizeCanvas()
        window.addEventListener('resize', resizeCanvas)
        animId = requestAnimationFrame(animate)
    })
})

onUnmounted(() => {
    window.removeEventListener('resize', resizeCanvas)
    if (animId) cancelAnimationFrame(animId)
})
</script>

<style scoped>
.city-fireworks {
    position: fixed;
    inset: 0;
    z-index: 9999;
    overflow: hidden;
    background: #000;
    pointer-events: auto;
}

.canvas-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
}
</style>