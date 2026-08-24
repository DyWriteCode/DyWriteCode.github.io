// sound-configurator.js
/**
 * Sound Configurator - 声音配置与播放核心
 * @version 1.0.0
 * @description 管理心跳、城市、太空、流星、烟花等音效，支持预加载、轨迹控制
 * @dependencies 无 (使用原生 Web Audio API 和 fetch)
 *
 * @example
 * // 浏览器引入
 * <script src="sound-configurator.js"></script>
 * <script>
 *   const { engine, meteorManager, fireworkManager } = await SoundSystem.create({
 *       sounds: {
 *           heartbeat: { url: 'heartbeat.mp3', start: 0, end: 2 }
 *       }
 *   });
 *   await engine.playSound('heartbeat', 0, 2);
 * </script>
 *
 * @example
 * // ES Module
 * import SoundSystem from './sound-configurator.js';
 * const system = await SoundSystem.create();
 * system.engine.playSound('space', 0, 4);
 */

(function (global) {
    'use strict';

    // ============================================================
    // 默认配置 (可直接覆盖)
    // ============================================================
    const DEFAULT_CONFIG = {
        sounds: {
            heartbeat: { url: 'heartbeat.mp3', start: 0.0, end: 2.0 },
            city: { url: 'city_ambient.mp3', start: 0.0, end: 6.0 },
            space: { url: 'space_hum.mp3', start: 0.0, end: 4.0 },
            meteor: { url: 'meteor_fall.mp3', start: 0.0, end: 3.5 },
            firework_launch: { url: 'firework_launch.mp3', start: 0.0, end: 1.8 },
            firework_explode: { url: 'firework_explode.mp3', start: 0.0, end: 2.5 },
        },
        meteor: {
            panStart: -0.8,
            panEnd: 0.8,
            volumeStart: 0.6,
            volumeEnd: 0.2,
            duration: 3.5,
        },
        firework: {
            launchDuration: 1.5,
            explodeDelay: 0.6,
            panSpread: 0.6,
        },
    };

    // ============================================================
    // 音频引擎 (Web Audio API)
    // ============================================================
    class AudioEngine {
        constructor() {
            this.ctx = null;
            this.buffers = {};
            this.activeSources = new Map();
            this.sourceIdCounter = 0;
            this.isPreloading = false;
        }

        getContext() {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            return this.ctx;
        }

        async preloadAll(soundConfigs) {
            this.isPreloading = true;
            const entries = Object.entries(soundConfigs);
            await Promise.all(entries.map(([key, cfg]) => {
                if (cfg.url) {
                    return this.loadSound(key, cfg.url).catch(err => {
                        console.warn(`预加载 ${key} 失败，使用合成后备音`, err);
                        return null;
                    });
                }
                return Promise.resolve();
            }));
            this.isPreloading = false;
            console.log('✅ 所有音频预加载完成');
        }

        async loadSound(key, url) {
            if (this.buffers[key]) return this.buffers[key];
            try {
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const arrayBuffer = await resp.arrayBuffer();
                const ctx = this.getContext();
                const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                this.buffers[key] = audioBuffer;
                return audioBuffer;
            } catch (err) {
                console.warn(`⚠️ 加载音频 "${key}" 失败 (${url})，使用合成音代替`, err);
                const synth = this._synthesizeFallback(key);
                this.buffers[key] = synth;
                return synth;
            }
        }

        // ----- 合成后备音 (内部) -----
        _synthesizeFallback(key) {
            const ctx = this.getContext();
            const sr = ctx.sampleRate;
            const synths = {
                heartbeat: () => {
                    const dur = 2.0;
                    const buf = ctx.createBuffer(1, sr * dur, sr);
                    const d = buf.getChannelData(0);
                    for (let i = 0; i < d.length; i++) {
                        const t = i / sr;
                        let env = 0;
                        if (t < 0.15) env = Math.sin(t / 0.15 * Math.PI) * 0.8;
                        else if (t < 0.3) env = Math.sin((t - 0.15) / 0.15 * Math.PI) * 0.4;
                        else if (t > 1.0 && t < 1.15) env = Math.sin((t - 1.0) / 0.15 * Math.PI) * 0.7;
                        else if (t > 1.15 && t < 1.3) env = Math.sin((t - 1.15) / 0.15 * Math.PI) * 0.3;
                        const freq = 60 + 30 * Math.sin(t * 8);
                        d[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.5;
                    }
                    return buf;
                },
                city: () => {
                    const dur = 6.0;
                    const buf = ctx.createBuffer(1, sr * dur, sr);
                    const d = buf.getChannelData(0);
                    for (let i = 0; i < d.length; i++) {
                        const t = i / sr;
                        const noise = (Math.random() * 2 - 1) * 0.3;
                        const hum = Math.sin(2 * Math.PI * 120 * t) * 0.1;
                        const ring = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 0.5) * 0.05;
                        const spike = (Math.random() > 0.995) ? (Math.random() * 2 - 1) * 0.2 : 0;
                        const env = Math.exp(-t * 0.08) * 0.8 + 0.2;
                        d[i] = (noise + hum + ring + spike) * env * 0.6;
                    }
                    return buf;
                },
                space: () => {
                    const dur = 4.0;
                    const buf = ctx.createBuffer(1, sr * dur, sr);
                    const d = buf.getChannelData(0);
                    for (let i = 0; i < d.length; i++) {
                        const t = i / sr;
                        const freq = 80 + 40 * Math.sin(t * 0.5);
                        const v = Math.sin(2 * Math.PI * freq * t) * 0.3 +
                            Math.sin(2 * Math.PI * (freq * 1.5) * t) * 0.1;
                        d[i] = v * Math.exp(-t * 0.05) * 0.6;
                    }
                    return buf;
                },
                meteor: () => {
                    const dur = 3.5;
                    const buf = ctx.createBuffer(1, sr * dur, sr);
                    const d = buf.getChannelData(0);
                    for (let i = 0; i < d.length; i++) {
                        const t = i / sr;
                        const freq = 800 - t * 200 + Math.sin(t * 30) * 50;
                        const env = Math.exp(-t * 1.2) * 0.7 + 0.1;
                        const noise = (Math.random() * 2 - 1) * 0.15 * env;
                        const tone = Math.sin(2 * Math.PI * freq * t) * env * 0.5;
                        d[i] = (tone + noise) * 0.5;
                    }
                    return buf;
                },
                firework_launch: () => {
                    const dur = 1.8;
                    const buf = ctx.createBuffer(1, sr * dur, sr);
                    const d = buf.getChannelData(0);
                    for (let i = 0; i < d.length; i++) {
                        const t = i / sr;
                        const freq = 150 + t * 600;
                        const env = Math.sin(t / dur * Math.PI) * 0.8;
                        const noise = (Math.random() * 2 - 1) * 0.2 * env;
                        const tone = Math.sin(2 * Math.PI * freq * t) * env * 0.5;
                        d[i] = (tone + noise) * 0.5;
                    }
                    return buf;
                },
                firework_explode: () => {
                    const dur = 2.5;
                    const buf = ctx.createBuffer(1, sr * dur, sr);
                    const d = buf.getChannelData(0);
                    for (let i = 0; i < d.length; i++) {
                        const t = i / sr;
                        const env = Math.exp(-t * 1.8) * 0.9;
                        const noise = (Math.random() * 2 - 1) * 0.6 * env;
                        const low = Math.sin(2 * Math.PI * 80 * t) * env * 0.3;
                        const mid = Math.sin(2 * Math.PI * 300 * t) * Math.exp(-t * 2.5) * 0.2;
                        d[i] = (noise + low + mid) * 0.6;
                    }
                    return buf;
                },
            };
            const gen = synths[key] || (() => {
                const dur = 2.0;
                const buf = ctx.createBuffer(1, sr * dur, sr);
                const d = buf.getChannelData(0);
                for (let i = 0; i < d.length; i++) {
                    const t = i / sr;
                    d[i] = Math.sin(2 * Math.PI * 440 * t) * Math.exp(-t * 0.5) * 0.3;
                }
                return buf;
            });
            return gen();
        }

        // ----- 播放方法 -----
        async playSound(key, startTime, endTime, volume = 0.8, pan = 0) {
            const buffer = await this.loadSound(key, key); // 缓存中已有
            if (!buffer) return null;

            const ctx = this.getContext();
            const source = ctx.createBufferSource();
            source.buffer = buffer;

            const gainNode = ctx.createGain();
            gainNode.gain.value = Math.min(1, Math.max(0, volume));

            const panner = ctx.createStereoPanner();
            panner.pan.value = Math.min(1, Math.max(-1, pan));

            source.connect(gainNode);
            gainNode.connect(panner);
            panner.connect(ctx.destination);

            const actualStart = Math.min(Math.max(0, startTime || 0), buffer.duration - 0.05);
            const actualEnd = Math.min(Math.max(actualStart + 0.05, endTime || buffer.duration), buffer.duration);
            const duration = actualEnd - actualStart;

            source.start(0, actualStart, duration);

            const id = ++this.sourceIdCounter;
            const entry = {
                id,
                key,
                source,
                gainNode,
                panner,
                isPlaying: true,
                stop: () => {
                    try { source.stop(); } catch (_) { }
                    entry.isPlaying = false;
                    this.activeSources.delete(id);
                },
            };
            this.activeSources.set(id, entry);

            source.onended = () => {
                entry.isPlaying = false;
                this.activeSources.delete(id);
            };

            return entry;
        }

        stopSound(id) {
            const entry = this.activeSources.get(id);
            if (entry) {
                entry.stop();
                this.activeSources.delete(id);
                return true;
            }
            return false;
        }

        stopAll() {
            for (const [id, entry] of this.activeSources) {
                entry.stop();
            }
            this.activeSources.clear();
        }

        setVolume(id, vol) {
            const entry = this.activeSources.get(id);
            if (entry) {
                entry.gainNode.gain.value = Math.min(1, Math.max(0, vol));
            }
        }

        setPan(id, pan) {
            const entry = this.activeSources.get(id);
            if (entry) {
                entry.panner.pan.value = Math.min(1, Math.max(-1, pan));
            }
        }

        isPlaying(id) {
            const entry = this.activeSources.get(id);
            return entry ? entry.isPlaying : false;
        }
    }

    // ============================================================
    // 流星管理器
    // ============================================================
    class MeteorManager {
        constructor(engine, config) {
            this.engine = engine;
            this.config = config;
            this.meteors = [];
            this.idCounter = 0;
            this.onUpdate = null;
            this.animFrame = null;
            this.isRunning = false;
        }

        async addMeteor(panStart, panEnd, volStart, volEnd, duration) {
            const cfg = this.config.meteor;
            const startPan = panStart ?? cfg.panStart;
            const endPan = panEnd ?? cfg.panEnd;
            const startVol = volStart ?? cfg.volumeStart;
            const endVol = volEnd ?? cfg.volumeEnd;
            const dur = Math.min(duration ?? cfg.duration, this.config.sounds.meteor.end - this.config.sounds.meteor.start || 3.5);

            const id = ++this.idCounter;
            const meteor = {
                id,
                panStart: startPan,
                panEnd: endPan,
                volStart: startVol,
                volEnd: endVol,
                duration: dur,
                elapsed: 0,
                isPlaying: false,
                sourceId: null,
                progress: 0,
                active: true,
            };

            this.meteors.push(meteor);
            this._startAnimation();
            this._updateUI();
            return meteor;
        }

        async playMeteor(meteor) {
            if (meteor.isPlaying) return;
            const cfg = this.config.sounds.meteor;
            const entry = await this.engine.playSound(
                'meteor',
                cfg.start,
                cfg.end,
                meteor.volStart,
                meteor.panStart
            );
            if (entry) {
                meteor.sourceId = entry.id;
                meteor.isPlaying = true;
                meteor.elapsed = 0;
                meteor.progress = 0;
                this._updateUI();
            }
        }

        stopMeteor(meteor) {
            if (meteor.sourceId) {
                this.engine.stopSound(meteor.sourceId);
                meteor.sourceId = null;
            }
            meteor.isPlaying = false;
            this._updateUI();
        }

        removeMeteor(meteor) {
            this.stopMeteor(meteor);
            meteor.active = false;
            this.meteors = this.meteors.filter(m => m !== meteor);
            if (this.meteors.length === 0) this._stopAnimation();
            this._updateUI();
        }

        clearAll() {
            for (const m of this.meteors) this.stopMeteor(m);
            this.meteors = [];
            this._stopAnimation();
            this._updateUI();
        }

        _startAnimation() {
            if (this.isRunning) return;
            this.isRunning = true;
            const step = () => {
                if (!this.isRunning) return;
                let hasActive = false;
                for (const m of this.meteors) {
                    if (!m.isPlaying) continue;
                    hasActive = true;
                    m.elapsed += 0.04;
                    m.progress = Math.min(1, m.elapsed / m.duration);
                    const pan = m.panStart + (m.panEnd - m.panStart) * m.progress;
                    const vol = m.volStart + (m.volEnd - m.volStart) * m.progress;
                    this.engine.setPan(m.sourceId, pan);
                    this.engine.setVolume(m.sourceId, vol);
                    if (m.progress >= 1) this.stopMeteor(m);
                }
                this._updateUI();
                if (hasActive || this.meteors.some(m => m.isPlaying)) {
                    this.animFrame = requestAnimationFrame(step);
                } else {
                    this.isRunning = false;
                    this.animFrame = null;
                }
            };
            this.animFrame = requestAnimationFrame(step);
        }

        _stopAnimation() {
            this.isRunning = false;
            if (this.animFrame) {
                cancelAnimationFrame(this.animFrame);
                this.animFrame = null;
            }
        }

        _updateUI() {
            if (this.onUpdate) this.onUpdate(this.meteors);
        }

        get count() { return this.meteors.length; }
    }

    // ============================================================
    // 烟花管理器
    // ============================================================
    class FireworkManager {
        constructor(engine, config) {
            this.engine = engine;
            this.config = config;
            this.fireworks = [];
            this.idCounter = 0;
            this.onUpdate = null;
            this.timeouts = [];
        }

        async addFirework() {
            const id = ++this.idCounter;
            const fw = {
                id,
                isPlaying: false,
                launchId: null,
                explodeId: null,
                active: true,
                phase: 'idle',
            };
            this.fireworks.push(fw);
            this._updateUI();
            await this._playFirework(fw);
            return fw;
        }

        async _playFirework(fw) {
            if (fw.isPlaying) return;
            fw.isPlaying = true;
            fw.phase = 'launching';
            this._updateUI();

            const launchCfg = this.config.sounds.firework_launch;
            const launchEntry = await this.engine.playSound(
                'firework_launch',
                launchCfg.start,
                launchCfg.end,
                0.7,
                0
            );
            fw.launchId = launchEntry?.id || null;

            let launchProgress = 0;
            const launchInterval = setInterval(() => {
                if (!fw.active || !fw.isPlaying) { clearInterval(launchInterval); return; }
                launchProgress += 0.05;
                const vol = 0.4 + launchProgress * 0.5;
                const pan = Math.sin(launchProgress * 3) * 0.2;
                if (fw.launchId) {
                    this.engine.setVolume(fw.launchId, Math.min(1, vol));
                    this.engine.setPan(fw.launchId, pan);
                }
                if (launchProgress >= 1) clearInterval(launchInterval);
            }, 50);

            const delay = this.config.firework.explodeDelay || 0.6;
            const timeoutId = setTimeout(async () => {
                if (!fw.active || !fw.isPlaying) return;
                if (fw.launchId) {
                    this.engine.stopSound(fw.launchId);
                    fw.launchId = null;
                }
                fw.phase = 'exploding';
                this._updateUI();
                const explodeCfg = this.config.sounds.firework_explode;
                const panSpread = this.config.firework.panSpread || 0.6;
                const pan = (Math.random() * 2 - 1) * panSpread;
                const explodeEntry = await this.engine.playSound(
                    'firework_explode',
                    explodeCfg.start,
                    explodeCfg.end,
                    0.9,
                    pan
                );
                fw.explodeId = explodeEntry?.id || null;
                if (explodeEntry) {
                    const checkDone = () => {
                        if (!fw.active) return;
                        if (!this.engine.isPlaying(explodeEntry.id)) {
                            fw.isPlaying = false;
                            fw.phase = 'done';
                            this._updateUI();
                        } else {
                            setTimeout(checkDone, 200);
                        }
                    };
                    setTimeout(checkDone, 100);
                } else {
                    fw.isPlaying = false;
                    fw.phase = 'done';
                    this._updateUI();
                }
            }, delay * 1000);

            this.timeouts.push(timeoutId);
            fw._cleanup = () => {
                clearInterval(launchInterval);
                clearTimeout(timeoutId);
                if (fw.launchId) this.engine.stopSound(fw.launchId);
                if (fw.explodeId) this.engine.stopSound(fw.explodeId);
                fw.launchId = null;
                fw.explodeId = null;
                fw.isPlaying = false;
            };
        }

        stopFirework(fw) {
            if (fw._cleanup) fw._cleanup();
            fw.isPlaying = false;
            fw.phase = 'idle';
            this._updateUI();
        }

        removeFirework(fw) {
            this.stopFirework(fw);
            fw.active = false;
            this.fireworks = this.fireworks.filter(f => f !== fw);
            this._updateUI();
        }

        clearAll() {
            for (const fw of this.fireworks) this.stopFirework(fw);
            this.fireworks = [];
            this.timeouts.forEach(t => clearTimeout(t));
            this.timeouts = [];
            this._updateUI();
        }

        get count() { return this.fireworks.length; }

        _updateUI() {
            if (this.onUpdate) this.onUpdate(this.fireworks);
        }
    }

    // ============================================================
    // 主入口：创建声音系统（含预加载）
    // ============================================================
    async function createSoundSystem(customConfig = {}) {
        // 深度合并配置
        const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        // 合并 sounds
        if (customConfig.sounds) {
            for (const [key, val] of Object.entries(customConfig.sounds)) {
                if (config.sounds[key]) {
                    Object.assign(config.sounds[key], val);
                } else {
                    config.sounds[key] = val;
                }
            }
        }
        if (customConfig.meteor) {
            Object.assign(config.meteor, customConfig.meteor);
        }
        if (customConfig.firework) {
            Object.assign(config.firework, customConfig.firework);
        }

        const engine = new AudioEngine();
        await engine.preloadAll(config.sounds);

        const meteorManager = new MeteorManager(engine, config);
        const fireworkManager = new FireworkManager(engine, config);

        return {
            engine,
            meteorManager,
            fireworkManager,
            config,
        };
    }

    // ============================================================
    // 导出
    // ============================================================
    const SoundSystem = {
        version: '1.0.0',
        DEFAULT_CONFIG,
        AudioEngine,
        MeteorManager,
        FireworkManager,
        create: createSoundSystem,
    };

    // 浏览器全局
    if (typeof window !== 'undefined') {
        window.SoundSystem = SoundSystem;
    }

    // CommonJS / Node.js
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SoundSystem;
        module.exports.default = SoundSystem;
    }

    // AMD
    if (typeof define === 'function' && define.amd) {
        define([], function () {
            return SoundSystem;
        });
    }

    return SoundSystem;
})(this);