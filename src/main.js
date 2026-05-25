import './style.css';


// --- IMAGE ASSET DEFINITIONS ---
const GAME_ASSETS = {
    lunaire_idle: '/assets/lunaire_idle.png',
    lunaire_run: '/assets/lunaire_run.png',
    lunaire_parry: '/assets/lunaire_parry.png',
    lunaire_slash: '/assets/lunaire_slash.png',
    lunaire_hit: '/assets/lunaire_hit.png',
    lunaire_face: '/assets/lunaire_face.png',
    boss_hound_idle: '/assets/boss_hound_idle.png',
    boss_hound_telegraph: '/assets/boss_hound_telegraph.png',
    boss_hound_charge: '/assets/boss_hound_charge.png',
    boss_hound_stun: '/assets/boss_hound_stun.png',
    boss_harpy_idle: '/assets/boss_harpy_idle.png',
    boss_harpy_telegraph: '/assets/boss_harpy_telegraph.png',
    boss_harpy_attack: '/assets/boss_harpy_attack.png',
    boss_harpy_stun: '/assets/boss_harpy_stun.png',
    background: '/assets/background.jpg'
};

const IMAGES = {};
let assetsLoaded = 0;
const totalAssets = Object.keys(GAME_ASSETS).length;
for (let key in GAME_ASSETS) {
    IMAGES[key] = new Image();
    IMAGES[key].onload = () => {
        assetsLoaded++;
        console.log("Loaded asset: " + key + " (" + assetsLoaded + "/" + totalAssets + ")");
    };
    IMAGES[key].onerror = (e) => {
        console.error("Failed to load asset: " + key, e);
        assetsLoaded++;
    };
    IMAGES[key].src = GAME_ASSETS[key];
}


// 音声エンジン
        const AudioEngine = {
            ctx: null,
            muted: false,
            bgmFilter: null,
            bgmVolumeNode: null,
            bgmNextNoteTime: 0,
            bgmIndex: 0,
            bgmTimerId: null,
            tempo: 132, // BPM (疾走感のある132BPM)
            bgmStarted: false,

            init() {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                
                // BGM用マスターローパスフィルター
                this.bgmFilter = this.ctx.createBiquadFilter();
                this.bgmFilter.type = 'lowpass';
                this.bgmFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);
                this.bgmFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);
                
                // BGM用ボリュームゲイン
                this.bgmVolumeNode = this.ctx.createGain();
                this.bgmVolumeNode.gain.setValueAtTime(this.muted ? 0.0 : 1.0, this.ctx.currentTime);
                
                // 接続: フィルター ➔ ボリューム ➔ 出力
                this.bgmFilter.connect(this.bgmVolumeNode);
                this.bgmVolumeNode.connect(this.ctx.destination);
            },
            
            startBGM() {
                if (this.bgmStarted || !this.ctx) return;
                
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
                
                this.bgmStarted = true;
                this.bgmNextNoteTime = this.ctx.currentTime;
                this.bgmIndex = 0;
                this.scheduler();
            },
            
            stopBGM() {
                if (this.bgmTimerId) {
                    clearTimeout(this.bgmTimerId);
                    this.bgmTimerId = null;
                }
                this.bgmStarted = false;
            },
            
            updateBGMFilter(slowMoActive) {
                if (!this.ctx || !this.bgmFilter) return;
                let now = this.ctx.currentTime;
                let targetFreq = slowMoActive ? 150 : 1200;
                // 滑らかにフィルター周波数をスイープ (時定数 0.12秒)
                this.bgmFilter.frequency.setTargetAtTime(targetFreq, now, 0.12);
            },
            
            scheduler() {
                if (!this.bgmStarted) return;
                while (this.bgmNextNoteTime < this.ctx.currentTime + 0.1) {
                    this.scheduleNextNote(this.bgmIndex, this.bgmNextNoteTime);
                    this.advanceNote();
                }
                this.bgmTimerId = setTimeout(() => this.scheduler(), 25);
            },
            
            advanceNote() {
                const secondsPerBeat = 60.0 / this.tempo;
                // 16分音符なので、1拍を4分割して時間を進める
                this.bgmNextNoteTime += 0.25 * secondsPerBeat;
                this.bgmIndex = (this.bgmIndex + 1) % 16;
            },
            
            scheduleNextNote(step, time) {
                if (this.muted) return;
                
                // インダストリアル・テクノベースライン (A1➔C2➔D2➔G1)
                const bassNotes = [55.00, 65.41, 73.42, 49.00];
                const rootFreq = bassNotes[Math.floor(step / 4)];
                
                // 疾走感溢れる16ステップのリズムパターン
                const bassPattern = [
                    true, false, true, true,  
                    true, false, true, false,
                    true, true, false, true,  
                    false, true, false, true
                ];
                
                if (bassPattern[step]) {
                    const osc = this.ctx.createOscillator();
                    const oscGain = this.ctx.createGain();
                    const oscFilter = this.ctx.createBiquadFilter();
                    
                    osc.type = 'sawtooth';
                    
                    // 特徴的なステップでオクターブ上昇させてグルーヴを作る
                    let octaveMult = 1.0;
                    if (step === 3 || step === 11 || step === 15) {
                        octaveMult = 2.0;
                    }
                    osc.frequency.setValueAtTime(rootFreq * octaveMult, time);
                    
                    // シンセベースの音色：アタックが明るくリリースに向けてこもるローパススイープ
                    oscFilter.type = 'lowpass';
                    oscFilter.frequency.setValueAtTime(450, time);
                    oscFilter.frequency.exponentialRampToValueAtTime(90, time + 0.14);
                    
                    oscGain.gain.setValueAtTime(0.08, time);
                    oscGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
                    
                    osc.connect(oscFilter);
                    oscFilter.connect(oscGain);
                    oscGain.connect(this.bgmFilter); // BGMマスターフィルターに接続
                    
                    osc.start(time);
                    osc.stop(time + 0.18);
                }
                
                // ノイズを使ったダイナミックハイハット
                let playHat = false;
                let hatVol = 0.0;
                let hatDecay = 0.0;
                
                if (step % 4 === 2) {
                    // 裏拍オープンハット (長めの余韻)
                    playHat = true;
                    hatVol = 0.016;
                    hatDecay = 0.07;
                } else if (step % 2 === 0) {
                    // 表・中間クローズドハット (短い余韻)
                    playHat = true;
                    hatVol = 0.008;
                    hatDecay = 0.025;
                }
                
                if (playHat) {
                    const noiseBuffer = this.createNoiseBuffer(hatDecay + 0.02);
                    const noise = this.ctx.createBufferSource();
                    noise.buffer = noiseBuffer;
                    
                    const hatFilter = this.ctx.createBiquadFilter();
                    hatFilter.type = 'highpass';
                    hatFilter.frequency.setValueAtTime(7500, time);
                    
                    const hatGain = this.ctx.createGain();
                    hatGain.gain.setValueAtTime(hatVol, time);
                    hatGain.gain.exponentialRampToValueAtTime(0.0001, time + hatDecay);
                    
                    noise.connect(hatFilter);
                    hatFilter.connect(hatGain);
                    hatGain.connect(this.bgmFilter); // BGMマスターフィルターに接続
                    
                    noise.start(time);
                    noise.stop(time + hatDecay + 0.02);
                }
            },

            // ディストーション用のカーブ生成ヘルパー (tanhによる温かいサチュレーション)
            makeDistortionCurve(amount) {
                const k = typeof amount === 'number' ? amount : 50;
                const n_samples = 44100;
                const curve = new Float32Array(n_samples);
                for (let i = 0; i < n_samples; ++i) {
                    const x = (i * 2) / n_samples - 1;
                    curve[i] = Math.tanh(x * k) / Math.tanh(k);
                }
                return curve;
            },
            // ヘルパー: ノイズバッファの生成
            createNoiseBuffer(duration) {
                const bufferSize = this.ctx.sampleRate * duration;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                return buffer;
            },
            // ヘルパー: ステレオパンナーの作成（フォールバック付き）
            createPanner(panValue) {
                if (this.ctx.createStereoPanner) {
                    const panner = this.ctx.createStereoPanner();
                    panner.pan.setValueAtTime(panValue, this.ctx.currentTime);
                    return panner;
                }
                return this.ctx.createGain(); // フォールバック
            },
            playParry() {
                if (this.muted || !this.ctx) return;
                try {
                    if (this.ctx.state === 'suspended') {
                        this.ctx.resume();
                    }
                    let now = this.ctx.currentTime;
                    
                    // 1. 金属の非調和うなり（Inharmonic Metallic Beating Ring）
                    const baseFreq = 420;
                    const ratios = [1.0, 1.41, 1.98, 2.44, 3.65, 5.2];
                    const gains = [0.15, 0.12, 0.1, 0.08, 0.05, 0.03];
                    const decays = [0.3, 0.45, 0.55, 0.7, 0.8, 1.1]; // 高音ほど残響を長くしてきらめき感を強調
                    
                    const ringMix = this.ctx.createGain();
                    ringMix.gain.setValueAtTime(1.0, now);
                    
                    ratios.forEach((ratio, index) => {
                        const osc = this.ctx.createOscillator();
                        const oscGain = this.ctx.createGain();
                        
                        osc.type = index % 2 === 0 ? 'sine' : 'triangle';
                        
                        // 高音域に微小な周波数ズレを追加して強烈なうなりを生成
                        const freq = baseFreq * ratio + (ratio > 2.0 ? Math.sin(index) * 8 : 0);
                        osc.frequency.setValueAtTime(freq, now);
                        
                        oscGain.gain.setValueAtTime(gains[index] * 1.5, now);
                        oscGain.gain.exponentialRampToValueAtTime(0.0001, now + decays[index]);
                        
                        osc.connect(oscGain);
                        oscGain.connect(ringMix);
                        osc.start(now);
                        osc.stop(now + decays[index] + 0.1);
                    });
                    
                    const pannerRing = this.createPanner(-0.25);
                    ringMix.connect(pannerRing);
                    pannerRing.connect(this.ctx.destination);
                    
                    // 2. 超高速アタックの金属衝撃音 (Metallic Impact Click / Transient)
                    const noiseBuffer = this.createNoiseBuffer(0.1);
                    const noise = this.ctx.createBufferSource();
                    noise.buffer = noiseBuffer;
                    
                    const noiseFilter = this.ctx.createBiquadFilter();
                    noiseFilter.type = 'bandpass';
                    noiseFilter.frequency.setValueAtTime(1800, now);
                    noiseFilter.Q.setValueAtTime(6.0, now); // 高いQ値で鋭い金属音にする
                    
                    const gainNoise = this.ctx.createGain();
                    gainNoise.gain.setValueAtTime(0.6, now);
                    gainNoise.gain.exponentialRampToValueAtTime(0.0001, now + 0.015); // 15msで消えるアタック
                    
                    const pannerNoise = this.createPanner(0.25);
                    
                    noise.connect(noiseFilter);
                    noiseFilter.connect(gainNoise);
                    gainNoise.connect(pannerNoise);
                    pannerNoise.connect(this.ctx.destination);
                    noise.start(now);
                    noise.stop(now + 0.1);
                    
                    // 3. お腹に響くサブベース衝撃波 (Sub-Bass Drop)
                    const subOsc = this.ctx.createOscillator();
                    const gainSub = this.ctx.createGain();
                    subOsc.type = 'sine';
                    subOsc.frequency.setValueAtTime(150, now);
                    subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
                    
                    gainSub.gain.setValueAtTime(0.8, now);
                    gainSub.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
                    
                    subOsc.connect(gainSub);
                    gainSub.connect(this.ctx.destination);
                    subOsc.start(now);
                    subOsc.stop(now + 0.4);
                    
                    // 4. ディストーションによるサチュレーション（厚みの追加）
                    const satOsc = this.ctx.createOscillator();
                    const satGain = this.ctx.createGain();
                    const shaper = this.ctx.createWaveShaper();
                    
                    shaper.curve = this.makeDistortionCurve(15);
                    satOsc.type = 'triangle';
                    satOsc.frequency.setValueAtTime(220, now);
                    satOsc.frequency.linearRampToValueAtTime(80, now + 0.15);
                    
                    satGain.gain.setValueAtTime(0.25, now);
                    satGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
                    
                    satOsc.connect(shaper);
                    shaper.connect(satGain);
                    satGain.connect(this.ctx.destination);
                    satOsc.start(now);
                    satOsc.stop(now + 0.2);
                    
                } catch(e) {
                    console.error("playParry error:", e);
                }
            },
            playSlash() {
                if (this.muted || !this.ctx) return;
                try {
                    if (this.ctx.state === 'suspended') {
                        this.ctx.resume();
                    }
                    let now = this.ctx.currentTime;
                    
                    // 1. 鋸歯状波の鋭いスライス音 (Slash Pitch Sweep)
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(700, now);
                    osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
                    
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
                    
                    // 2. 風切りノイズ (Whoosh Noise)
                    const noiseBuffer = this.createNoiseBuffer(0.12);
                    const noise = this.ctx.createBufferSource();
                    noise.buffer = noiseBuffer;
                    
                    const filter = this.ctx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.setValueAtTime(1400, now);
                    filter.frequency.exponentialRampToValueAtTime(400, now + 0.1);
                    filter.Q.setValueAtTime(3.0, now);
                    
                    const gainNoise = this.ctx.createGain();
                    gainNoise.gain.setValueAtTime(0.18, now);
                    gainNoise.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
                    
                    const pannerSlash = this.createPanner(-0.1);
                    osc.connect(gain);
                    gain.connect(pannerSlash);
                    pannerSlash.connect(this.ctx.destination);
                    
                    const pannerNoise = this.createPanner(0.1);
                    noise.connect(filter);
                    filter.connect(gainNoise);
                    gainNoise.connect(pannerNoise);
                    pannerNoise.connect(this.ctx.destination);
                    
                    osc.start(now);
                    osc.stop(now + 0.16);
                    noise.start(now);
                    noise.stop(now + 0.16);
                } catch(e){}
            },
            playHit() {
                if (this.muted || !this.ctx) return;
                try {
                    if (this.ctx.state === 'suspended') {
                        this.ctx.resume();
                    }
                    let now = this.ctx.currentTime;
                    
                    // 1. 低い衝撃音 (Low Punch)
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(180, now);
                    osc.frequency.linearRampToValueAtTime(50, now + 0.16);
                    
                    gain.gain.setValueAtTime(0.35, now);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
                    
                    // 2. 肉厚な打撃歪みノイズ (Body Thud with distortion)
                    const noiseBuffer = this.createNoiseBuffer(0.18);
                    const noise = this.ctx.createBufferSource();
                    noise.buffer = noiseBuffer;
                    
                    const filter = this.ctx.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(450, now);
                    filter.frequency.exponentialRampToValueAtTime(60, now + 0.14);
                    
                    const shaper = this.ctx.createWaveShaper();
                    shaper.curve = this.makeDistortionCurve(30);
                    
                    const noiseGain = this.ctx.createGain();
                    noiseGain.gain.setValueAtTime(0.45, now);
                    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
                    
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    
                    noise.connect(filter);
                    filter.connect(shaper);
                    shaper.connect(noiseGain);
                    noiseGain.connect(this.ctx.destination);
                    
                    osc.start(now);
                    osc.stop(now + 0.2);
                    noise.start(now);
                    noise.stop(now + 0.2);
                } catch(e){}
            },
            playCritical() {
                if (this.muted || !this.ctx) return;
                try {
                    if (this.ctx.state === 'suspended') {
                        this.ctx.resume();
                    }
                    let now = this.ctx.currentTime;
                    
                    // 1. 肉薄する巨大な切り裂き歪み音 (Distorted Heavy Saw Slash)
                    const osc = this.ctx.createOscillator();
                    const gainOsc = this.ctx.createGain();
                    const shaperSlash = this.ctx.createWaveShaper();
                    shaperSlash.curve = this.makeDistortionCurve(40);
                    
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(1200, now);
                    osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);
                    
                    gainOsc.gain.setValueAtTime(0.4, now);
                    gainOsc.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
                    
                    const pannerSlash = this.createPanner(-0.4);
                    
                    osc.connect(shaperSlash);
                    shaperSlash.connect(gainOsc);
                    gainOsc.connect(pannerSlash);
                    pannerSlash.connect(this.ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.55);
                    
                    // 2. 空間を破砕する大爆発ノイズ (Heavy Distorted Lowpass Blast)
                    const noiseBuffer = this.createNoiseBuffer(0.6);
                    const noise = this.ctx.createBufferSource();
                    noise.buffer = noiseBuffer;
                    
                    const filter = this.ctx.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(800, now);
                    filter.frequency.exponentialRampToValueAtTime(20, now + 0.45);
                    
                    const shaperNoise = this.ctx.createWaveShaper();
                    shaperNoise.curve = this.makeDistortionCurve(60);
                    
                    const noiseGain = this.ctx.createGain();
                    noiseGain.gain.setValueAtTime(0.8, now);
                    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
                    
                    noise.connect(filter);
                    filter.connect(shaperNoise);
                    shaperNoise.connect(noiseGain);
                    noiseGain.connect(this.ctx.destination);
                    noise.start(now);
                    noise.stop(now + 0.65);
                    
                    // 3. 脳震盪を誘発する超低音サブドロップ (Deep Sub-Bass Shockwave)
                    const subOsc = this.ctx.createOscillator();
                    const subGain = this.ctx.createGain();
                    const shaperSub = this.ctx.createWaveShaper();
                    shaperSub.curve = this.makeDistortionCurve(20);
                    
                    subOsc.type = 'sine';
                    subOsc.frequency.setValueAtTime(110, now);
                    subOsc.frequency.linearRampToValueAtTime(15, now + 0.55);
                    
                    subGain.gain.setValueAtTime(1.2, now);
                    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
                    
                    subOsc.connect(shaperSub);
                    shaperSub.connect(subGain);
                    subGain.connect(this.ctx.destination);
                    subOsc.start(now);
                    subOsc.stop(now + 0.7);
                    
                    // 4. ガラス／クリスタルの破砕余韻 (High Crystal Shimmer Shatter)
                    const crystalFreqs = [3200, 3900, 4800, 5600, 6800];
                    const crystalGains = [0.1, 0.08, 0.07, 0.05, 0.03];
                    const crystalDecays = [0.45, 0.55, 0.65, 0.75, 0.9];
                    
                    const pannerCrystal = this.createPanner(0.4);
                    
                    crystalFreqs.forEach((freq, index) => {
                        const crystal = this.ctx.createOscillator();
                        const gainCrystal = this.ctx.createGain();
                        
                        crystal.type = 'triangle';
                        crystal.frequency.setValueAtTime(freq, now);
                        
                        // 高周波の微細な揺れ（ビブラート）
                        const lfo = this.ctx.createOscillator();
                        const lfoGain = this.ctx.createGain();
                        lfo.frequency.setValueAtTime(18 + index * 3, now);
                        lfoGain.gain.setValueAtTime(15, now);
                        
                        lfo.connect(lfoGain);
                        lfoGain.connect(crystal.frequency);
                        
                        gainCrystal.gain.setValueAtTime(crystalGains[index] * 1.5, now);
                        gainCrystal.gain.exponentialRampToValueAtTime(0.0001, now + crystalDecays[index]);
                        
                        crystal.connect(gainCrystal);
                        gainCrystal.connect(pannerCrystal);
                        
                        lfo.start(now);
                        crystal.start(now);
                        lfo.stop(now + crystalDecays[index] + 0.1);
                        crystal.stop(now + crystalDecays[index] + 0.1);
                    });
                    
                    pannerCrystal.connect(this.ctx.destination);
                    
                } catch(e) {
                    console.error("playCritical error:", e);
                }
            },
            playDodge() {
                if (this.muted || !this.ctx) return;
                try {
                    if (this.ctx.state === 'suspended') {
                        this.ctx.resume();
                    }
                    let now = this.ctx.currentTime;
                    
                    // 1. スリックな周波数スイープ (Triangle Swoosh)
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(450, now);
                    osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
                    
                    gain.gain.setValueAtTime(0.18, now);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
                    
                    // 2. 風切り立体パンノイズ (Spatial Whoosh Noise)
                    const noiseBuffer = this.createNoiseBuffer(0.16);
                    const noise = this.ctx.createBufferSource();
                    noise.buffer = noiseBuffer;
                    
                    const filter = this.ctx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.setValueAtTime(1200, now);
                    filter.frequency.exponentialRampToValueAtTime(180, now + 0.14);
                    filter.Q.setValueAtTime(4.0, now);
                    
                    const noiseGain = this.ctx.createGain();
                    noiseGain.gain.setValueAtTime(0.25, now);
                    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
                    
                    const panner = this.createPanner(0.4);
                    if (panner.pan) {
                        panner.pan.setValueAtTime(0.4, now);
                        panner.pan.linearRampToValueAtTime(-0.4, now + 0.16);
                    }
                    
                    osc.connect(gain);
                    gain.connect(panner);
                    
                    noise.connect(filter);
                    filter.connect(noiseGain);
                    noiseGain.connect(panner);
                    
                    panner.connect(this.ctx.destination);
                    
                    osc.start(now);
                    noise.start(now);
                    osc.stop(now + 0.2);
                    noise.stop(now + 0.2);
                    
                    // 3. スローモーション突入時の低音インジケータ (Subtle Slow-mo Bass)
                    const slowOsc = this.ctx.createOscillator();
                    const slowGain = this.ctx.createGain();
                    slowOsc.type = 'sine';
                    slowOsc.frequency.setValueAtTime(80, now);
                    slowOsc.frequency.linearRampToValueAtTime(30, now + 0.35);
                    
                    slowGain.gain.setValueAtTime(0.35, now);
                    slowGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
                    
                    slowOsc.connect(slowGain);
                    slowGain.connect(this.ctx.destination);
                    
                    slowOsc.start(now);
                    slowOsc.stop(now + 0.4);
                    
                } catch(e){}
            }
        };

        // DOM構築完了後にゲームエンジンを開始
        window.addEventListener('DOMContentLoaded', () => {
            const canvas = document.getElementById('gameCanvas');
            const ctx = canvas.getContext('2d');

            // 音声切替ボタンの処理
            const soundToggle = document.getElementById('soundToggle');
            if (soundToggle) {
                soundToggle.addEventListener('click', () => {
                    AudioEngine.muted = !AudioEngine.muted;
                    if (AudioEngine.bgmVolumeNode) {
                        AudioEngine.bgmVolumeNode.gain.setValueAtTime(AudioEngine.muted ? 0.0 : 1.0, AudioEngine.ctx.currentTime);
                    }
                    if (AudioEngine.muted) {
                        soundToggle.classList.add('muted');
                        soundToggle.innerHTML = `<svg id="soundOffIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v6a3 3 0 0 0 3 3h1.586l4.707 4.707A1 1 0 0 0 20 22V4a1 1 0 0 0-1.707-.707L13.586 8H12a3 3 0 0 0-3 1z"></path></svg>`;
                    } else {
                        soundToggle.classList.remove('muted');
                        soundToggle.innerHTML = `<svg id="soundOnIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
                        if (!AudioEngine.bgmStarted) {
                            if (!AudioEngine.ctx) AudioEngine.init();
                            AudioEngine.startBGM();
                        }
                    }
                });
            }

            const CANVAS_WIDTH = canvas.width;
            const CANVAS_HEIGHT = canvas.height;
            const GROUND_Y = 320;

            // ゲームシステム状態
            let keys = {};
            let particles = [];
            let slashWaves = [];     
            let hitStops = 0;        
            let slowMoTimer = 0;     
            let screenShake = 0;     
            let cameraZoom = 1.0;    
            let cameraTargetZoom = 1.0;
            let cameraZoomImpulse = 0.0; // ズーム引き絞り・衝撃用インパルス
            let cameraX = 850 / 2; // CANVAS_WIDTH / 2
            let cameraY = 420 / 2; // CANVAS_HEIGHT / 2
            let showFlash = 0;       
            let debugMode = false;
            let inputBuffer = { action: null, timer: 0 }; // 先行入力バッファ
            let monorailX = 1100; // モノレール初期位置

            // ビネット演出用変数
            let vignetteColor = 'rgba(0, 0, 0, 0.8)';
            let vignetteOpacity = 0.0;

            // インパクトリング（衝撃波）リスト
            let impactRings = [];

            // アクションポップアップ
            function triggerPopup(id, x, y) {
                const popup = document.getElementById(id);
                if (!popup) return;
                const rect = canvas.getBoundingClientRect();
                
                popup.style.left = `${rect.left + x - popup.offsetWidth/2}px`;
                popup.style.top = `${rect.top + y - 45}px`;
                popup.style.opacity = '1';
                popup.style.transform = 'translateY(-25px)';
                
                setTimeout(() => {
                    popup.style.opacity = '0';
                    popup.style.transform = 'translateY(0)';
                }, 500);
            }

            // インパクトリング（衝撃波）生成関数
            function spawnImpactRing(x, y, color, maxRadius = 140, expandSpeed = 5, isParry = false) {
                impactRings.push({
                    x: x,
                    y: y,
                    radius: 10,
                    maxRadius: maxRadius,
                    expandSpeed: expandSpeed,
                    alpha: 0.9,
                    decay: 0.045,
                    color: color,
                    isParry: isParry
                });
            }

            // プレイヤー
            const player = {
                x: 200,
                y: GROUND_Y,
                width: 65,
                height: 135,
                vx: 0,
                speed: 4.0,
                direction: 1, 
                state: 'idle', 
                stateTimer: 0,
                parryWindow: 0,  
                dashWindow: 0,   
                hp: 1000,
                maxHp: 1000,
                lagHp: 1000,       // HP減少時の追従ラグ表示用
                stamina: 100,      // 現在のスタミナ
                maxStamina: 100,   // 最大スタミナ
                dodgeCounterAvailable: false, // 回避反撃可能フラグ
                isCounter: false,             // 回避カウンター攻撃実行中フラグ
                parryCounterAvailable: false, // パリィ反撃可能フラグ
                parryCounterTimer: 0,         // パリィ反撃受付時間
                isParryCounter: false,        // パリィカウンター攻撃実行中フラグ
                attackActive: false, 
                attackHasHit: false, 
                shadows: [] 
            };

            // ボス
            const boss = {
                x: 600,
                y: GROUND_Y,
                width: 185,
                height: 230,
                state: 'idle', 
                stateTimer: 60, // 最初は少し待機
                currentPattern: null, 
                hp: 5000,
                maxHp: 5000,
                lagHp: 5000,       // HP減少時の追従ラグ表示用
                posture: 100, 
                maxPosture: 100,
                telegraphFlash: 0, 
                attackActive: false,
                attackHasHit: false,
                facing: -1,
                slideTargetX: 0,
                slideSpeed: 0,
                archetype: 'hound', // ボス特性 ('hound' or 'harpy')
                hitTimer: 0,
                shieldPulse: 0.0,   // シールド波紋演出用
                shieldPulseColor: '#9900ff' // 紫ネオンシールドに変更
            };

            // ボスの攻撃パターン定義
            const BOSS_PATTERNS = {
                overhead: {
                    telegraphTime: 120, // 予備動作
                    attackTime: 20,    
                    hitWindowStart: 12, 
                    hitWindowEnd: 4,   
                    recoveryTime: 90,  
                    damage: 250,
                    color: '#ff0055',     // 赤色：パリィ不可
                    tellColor: '#ff0055', 
                    parryable: false,
                    dodgeable: true,
                    name: 'グランドスラム'
                },
                slash: {
                    telegraphTime: 100, // 予備動作
                    attackTime: 16,
                    hitWindowStart: 10,
                    hitWindowEnd: 3,
                    recoveryTime: 85,  // 後隙
                    damage: 180,
                    color: '#ffd700',     // 黄色：パリィ・回避両方可
                    tellColor: '#ffd700', 
                    parryable: true,
                    dodgeable: true,
                    name: '薙ぎ払い'
                },
                thrust: {
                    telegraphTime: 140, // 予備動作 (140F = 2.33秒)
                    attackTime: 24,    
                    hitWindowStart: 14,
                    hitWindowEnd: 6,
                    recoveryTime: 100, // 後隙
                    damage: 220,
                    color: '#0088ff',     // 青色：回避不可・パリィ専用
                    tellColor: '#0088ff', 
                    parryable: true,
                    dodgeable: false,
                    name: '神速の突き'
                }
            };

            // ボスの特性定義
            const BOSS_ARCHETYPES = {
                hound: {
                    name: 'ドリームハウンド',
                    description: '夢境を彷徨う機械の獣。硬い外殻を持ち、通常攻撃や回避反撃のHPダメージを80%カットする。パリィによる体幹ダメージが2.0倍になり、パリィ反撃（Jの後にL）で体幹を破壊して「致命の一撃」を入れるのが攻略の鍵！',
                    color: '#251647', // 深いバイオレット
                    eyeColor: '#cc00ff', // 紫ネオンの瞳
                    damageResist: 0.8,
                    parryPostureMult: 2.0,
                    dodgePostureMult: 0.2,
                    maxHp: 5000,
                    maxPosture: 100
                },
                harpy: {
                    name: 'ネオン・ハーピー',
                    description: '素早い連撃と赤警告（パリィ不可）の空中強襲を多用する。攻撃を華麗に回避し、背後からの「回避反撃」でダメージと体幹を大きく削るのが効果的！',
                    color: '#4a1135', // ピンクダーク
                    eyeColor: '#ff0077', // ネオンピンクの瞳
                    damageResist: 0.0,
                    parryPostureMult: 0.4,
                    dodgePostureMult: 1.5,
                    maxHp: 3000,
                    maxPosture: 150
                }
            };

            // ボスアーキタイプの切り替え
            window.switchBossArchetype = function(type) {
                if (!BOSS_ARCHETYPES[type]) return;
                boss.archetype = type;
                const config = BOSS_ARCHETYPES[type];
                if (type === 'hound') {
                    boss.width = 185;
                    boss.height = 230;
                } else if (type === 'harpy') {
                    boss.width = 140;
                    boss.height = 215;
                }
                boss.maxHp = config.maxHp;
                boss.hp = config.maxHp;
                boss.lagHp = config.maxHp; // ラグバー初期化
                boss.maxPosture = config.maxPosture;
                boss.posture = config.maxPosture;
                boss.state = 'idle';
                boss.stateTimer = 90;
                boss.attackActive = false;
                boss.attackHasHit = false;
                boss.shieldPulse = 0.0; // シールド初期化
                
                // プレイヤーも初期化
                player.hp = player.maxHp;
                player.lagHp = player.maxHp; // ラグバー初期化
                player.stamina = player.maxStamina;
                player.state = 'idle';
                player.stateTimer = 0;
                player.parryCounterAvailable = false;
                player.parryCounterTimer = 0;
                player.dodgeCounterAvailable = false;
                slowMoTimer = 0;
                
                // UI表示の更新
                document.getElementById('boss-name-label').innerText = config.name;
                document.getElementById('boss-desc-text').innerText = config.description;
                document.getElementById('boss-desc-panel').style.borderColor = config.eyeColor;
                
                // ボタンのactiveクラス更新
                document.querySelectorAll('.boss-btn').forEach(btn => {
                    if (btn.getAttribute('data-type') === type) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
                
                // アナウンス表示
                triggerAnnouncement(config.name + " 現る！");
            };

            // アナウンスポップアップ
            function triggerAnnouncement(text) {
                const popup = document.getElementById('announcementPopup');
                if (!popup) return;
                const rect = canvas.getBoundingClientRect();
                popup.innerText = text;
                popup.style.left = `${rect.left + canvas.width/2 - popup.offsetWidth/2}px`;
                popup.style.top = `${rect.top + canvas.height/2 - popup.offsetHeight/2}px`;
                popup.style.opacity = '1';
                popup.style.transform = 'translateY(0) scale(1.1)';
                
                setTimeout(() => {
                    popup.style.opacity = '0';
                    popup.style.transform = 'translateY(0) scale(1.0)';
                }, 1200);
            }

            // プレイヤービジュアル描画ヘルパー (ルネール完全再現)

            // プレイヤービジュアル描画ヘルパー (ルネール画像アセット＆ダイナミック変形版)
            function drawPlayer(x, y, direction, state, stateTimer, alpha, isShadow) {
                if (!IMAGES['lunaire_idle'] || assetsLoaded < totalAssets) {
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    ctx.translate(x, y);
                    ctx.fillStyle = isShadow ? 'rgba(153, 0, 255, 0.3)' : '#110926';
                    ctx.beginPath();
                    ctx.arc(0, -25, 15, 0, Math.PI*2); // player.heightに依存しない固定フォールバック
                    ctx.fill();
                    ctx.restore();
                    return;
                }

                ctx.save();
                ctx.globalAlpha = alpha;

                let drawY = y;
                let rotation = 0;
                let scaleX = 1.0;
                let scaleY = 1.0;

                // 待機時のイージング呼吸アニメーション
                if (!isShadow) {
                    if (state === 'idle') {
                        scaleY = Math.sin(Date.now() / 250) * 0.012 + 0.988;
                        scaleX = Math.cos(Date.now() / 250) * 0.004 + 0.996;
                    } else if (state === 'walk') {
                        drawY += Math.sin(Date.now() / 70) * 2;
                        rotation = direction * 0.05; // 走る方向に僅かに傾ける物理チルト
                    }
                }

                // 状態に応じた画像決定 (新規スプライトアセット)
                let img = IMAGES['lunaire_idle'];
                if (state === 'walk') {
                    img = IMAGES['lunaire_run'];
                } else if (state === 'dash' || state === 'dodge') {
                    img = IMAGES['lunaire_run']; // 回避/ダッシュ時も走行スプライトを使用
                } else if (state === 'parry') {
                    img = IMAGES['lunaire_parry'];
                } else if (state === 'slash') {
                    img = IMAGES['lunaire_slash'];
                } else if (state === 'hit') {
                    img = IMAGES['lunaire_hit']; // 被弾ポーズアセットを反映
                }

                // 回避・ダッシュ時のネオンパープル残影（isShadow）
                if (isShadow) {
                    ctx.save();
                    ctx.translate(x, drawY);
                    let targetHeight = 160;
                    let scale = targetHeight / img.height;
                    ctx.scale(direction * 0.9 * scale, 0.9 * scale);
                    
                    // 残像のエフェクト加工（加算ブレンドとグロー）
                    ctx.globalCompositeOperation = 'screen';
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = '#cc00ff';
                    ctx.drawImage(img, -img.width/2, -img.height);
                    ctx.restore();
                    ctx.restore();
                    return;
                }

                ctx.translate(x, drawY);
                ctx.rotate(rotation);

                // 高さをおよそ 85px にリサイズ（アス比維持）
                let targetHeight = 160;
                let scale = targetHeight / img.height;
                ctx.scale(scale * direction * scaleX, scale * scaleY);

                // 被弾時（state === 'hit'）の白フラッシュ表現
                if (state === 'hit') {
                    ctx.filter = 'brightness(3.0) saturate(0)';
                }

                // 足元が (0, 0) になるように描画
                ctx.drawImage(img, -img.width / 2, -img.height);

                if (state === 'hit') {
                    ctx.filter = 'none';
                }

                ctx.restore();
            }

            function triggerParry() {
                if (player.state !== 'hit') {
                    player.state = 'parry';
                    player.stateTimer = 35; 
                    player.parryWindow = 30; 
                    AudioEngine.playSlash();
                    
                    inputBuffer.action = null;
                    inputBuffer.timer = 0;
                }
            }

            function triggerDodge() {
                if (player.state !== 'hit') {
                    if (player.stamina >= 30) {
                        player.stamina -= 30; 
                        player.state = 'dash';
                        player.stateTimer = 40; 
                        player.dashWindow = 35; 
                        let dir = 0;
                        if (keys['KeyA']) dir = -1;
                        else if (keys['KeyD']) dir = 1;
                        else dir = boss.x > player.x ? 1 : -1; 
                        player.vx = dir * 6.0; 
                        AudioEngine.playDodge();
                    } else {
                        AudioEngine.playHit(); 
                        triggerPopup('dodgePopup', player.x, player.y - 25);
                        const popup = document.getElementById('dodgePopup');
                        if (popup) {
                            popup.innerText = "NO STAMINA!";
                            popup.style.color = "#ff0055";
                            popup.style.textShadow = "0 0 15px rgba(255,0,85,0.75)";
                            setTimeout(() => {
                                popup.innerText = "DODGE!";
                                popup.style.color = "#ffd700";
                                popup.style.textShadow = "0 0 15px rgba(255,215,0,0.75)";
                            }, 800);
                        }
                    }
                    inputBuffer.action = null;
                    inputBuffer.timer = 0;
                }
            }

            function triggerAttack() {
                if (player.state !== 'hit') {
                    if (player.parryCounterAvailable) {
                        player.parryCounterAvailable = false;
                        player.state = 'slash';
                        player.stateTimer = 22;
                        player.attackActive = true; 
                        player.attackHasHit = false;
                        player.isParryCounter = true;
                        
                        let toBossDir = boss.x > player.x ? 1 : -1;
                        player.direction = toBossDir;
                        player.vx = toBossDir * 16; // 高速スライド接近
                        
                        triggerPopup('parryPopup', player.x, player.y - 25);
                        const popup = document.getElementById('parryPopup');
                        if (popup) {
                            popup.innerText = "PARRY COUNTER!";
                            popup.style.color = "#00e5ff";
                            popup.style.textShadow = "0 0 15px rgba(0,229,255,0.9)";
                            setTimeout(() => {
                                popup.innerText = "PARRY!";
                                popup.style.color = "#00e5ff";
                                popup.style.textShadow = "0 0 15px rgba(0,229,255,0.75)";
                            }, 800);
                        }
                        AudioEngine.playSlash();
                    } else if (player.dodgeCounterAvailable && slowMoTimer > 0) {
                        player.dodgeCounterAvailable = false;
                        slowMoTimer = 0; 
                        player.state = 'slash';
                        player.stateTimer = 22;
                        player.attackActive = true; 
                        player.attackHasHit = false;
                        player.isCounter = true;
                        
                        let toBossDir = boss.x > player.x ? 1 : -1;
                        player.direction = toBossDir;
                        player.vx = toBossDir * 15; 
                        
                        triggerPopup('dodgePopup', player.x, player.y - 25);
                        const popup = document.getElementById('dodgePopup');
                        if (popup) {
                            popup.innerText = "COUNTER SLASH!";
                            popup.style.color = "#ffd700";
                            popup.style.textShadow = "0 0 15px rgba(255,215,0,0.9)";
                            setTimeout(() => {
                                popup.innerText = "DODGE!";
                                popup.style.color = "#ffd700";
                                popup.style.textShadow = "0 0 15px rgba(255,215,0,0.75)";
                            }, 800);
                        }
                        AudioEngine.playSlash();
                    } else {
                        player.state = 'slash';
                        player.stateTimer = 22;
                        player.attackActive = false;
                        player.attackHasHit = false;
                        AudioEngine.playSlash();
                        
                        let toBossDir = boss.x > player.x ? 1 : -1;
                        player.direction = toBossDir;
                        
                        const dist = Math.abs(boss.x - player.x);
                        const minAssistDist = (player.width / 2) + (boss.width / 2) - 10;
                        const maxAssistDist = minAssistDist + 180;
                        if (dist > minAssistDist && dist < maxAssistDist) {
                            player.vx = toBossDir * 7.5; 
                        } else {
                            player.vx = 0;
                        }
                    }
                    inputBuffer.action = null;
                    inputBuffer.timer = 0;
                }
            }

            // キー登録
            window.addEventListener('keydown', e => {
                if (!AudioEngine.ctx) {
                    AudioEngine.init();
                    AudioEngine.startBGM();
                }
                keys[e.code] = true;
                
                // デバッグ表示の切替 (T)
                if (e.code === 'KeyT') {
                    debugMode = !debugMode;
                }

                // ボス特性切り替え (B)
                if (e.code === 'KeyB') {
                    const nextType = boss.archetype === 'hound' ? 'harpy' : 'hound';
                    switchBossArchetype(nextType);
                }

                if (hitStops > 0) return; 

                // パリィ (J)
                if (e.code === 'KeyJ') {
                    // 通常時、または攻撃の後隙（残り8F以下）の時のみ即発動可能
                    let canAct = (player.state === 'idle' || player.state === 'walk' || (player.state === 'slash' && player.stateTimer <= 8));
                    if (canAct) {
                        triggerParry();
                    } else if (player.state !== 'hit') {
                        // 先行入力としてバッファに登録
                        inputBuffer.action = 'KeyJ';
                        inputBuffer.timer = 15;
                    }
                }
                
                // 回避ステップ (K)
                if (e.code === 'KeyK') {
                    // 通常時、または攻撃の後隙（残り8F以下）の時のみ即発動可能（攻撃中の即回避連打を防止）
                    let canAct = (player.state === 'idle' || player.state === 'walk' || (player.state === 'slash' && player.stateTimer <= 8));
                    if (canAct) {
                        triggerDodge();
                    } else if (player.state !== 'hit') {
                        // 先行入力としてバッファに登録
                        inputBuffer.action = 'KeyK';
                        inputBuffer.timer = 15;
                    }
                }

                // 攻撃 (L)
                if (e.code === 'KeyL') {
                    // 通常時、または回避スロー中、またはパリィ反撃可能状態の時のみ即発動可能
                    let canAct = (player.state === 'idle' || player.state === 'walk' || 
                                  (player.state === 'dash' && player.dodgeCounterAvailable && slowMoTimer > 0) ||
                                  player.parryCounterAvailable);
                    if (canAct) {
                        triggerAttack();
                    } else if (player.state !== 'hit') {
                        // 先行入力としてバッファに登録
                        inputBuffer.action = 'KeyL';
                        inputBuffer.timer = 15;
                    }
                }
            });
            window.addEventListener('keyup', e => {
                keys[e.code] = false;
            });

            // ボスAI
            function updateBossAI(speedFactor) {
                const dist = Math.abs(boss.x - player.x);

                // idleかwalkの時だけ向きをプレイヤーへ合わせる
                if (boss.state === 'idle' || boss.state === 'walk') {
                    boss.facing = player.x < boss.x ? -1 : 1;
                }

                if (boss.state === 'idle') {
                    // もしプレイヤーが攻撃間合い（130px）より遠くにいるなら、追いかけるステートへ
                    if (dist > 130) {
                        boss.state = 'walk';
                        boss.stateTimer = 0;
                    } else {
                        // 攻撃射程内なら、インターバルタイマーを減らし、0になったら攻撃
                        boss.stateTimer -= speedFactor;
                        if (boss.stateTimer <= 0) {
                            const rand = Math.random();
                            // 近接なら大振り下ろしか薙ぎ払い
                            boss.currentPattern = rand < 0.5 ? 'overhead' : 'slash';
                            
                            boss.state = 'telegraph';
                            boss.stateTimer = BOSS_PATTERNS[boss.currentPattern].telegraphTime;
                            boss.telegraphFlash = 0;
                        }
                    }
                } else if (boss.state === 'walk') {
                    // プレイヤーに向かってゆっくり歩く
                    boss.x += boss.facing * 2.2 * speedFactor;
                    boss.x = Math.max(80, Math.min(CANVAS_WIDTH - 80, boss.x));
                    
                    // プレイヤーとの距離が適正値以下になったら、立ち止まって戦闘態勢（idle）へ
                    const colDist = (player.width / 2) + (boss.width / 2) - 25;
                    if (dist <= colDist + 50) {
                        boss.state = 'idle';
                        // 次の攻撃を繰り出すまでのディレイ（1.2秒〜2.0秒程度）を設定してテンポを遅くする
                        boss.stateTimer = Math.random() * 48 + 72;
                    } else if (dist > 280 && Math.random() < 0.015) {
                        // 遠距離かつ低確率で「突進突き」をいきなり繰り出す！
                        boss.currentPattern = 'thrust';
                        boss.state = 'telegraph';
                        boss.stateTimer = BOSS_PATTERNS[boss.currentPattern].telegraphTime;
                        boss.telegraphFlash = 0;
                    }
                }
            }

            // --- アップデート ---
            function update() {
                // 1. ヒットストップ
                if (hitStops > 0) {
                    hitStops--;
                    if (hitStops <= 0) {
                        cameraTargetZoom = 1.0; 
                    }
                    return;
                }

                // 2. スローモーション ＆ パリィ反撃受付タイマー
                let speedFactor = 1.0;
                if (slowMoTimer > 0) {
                    slowMoTimer--;
                    speedFactor = 0.2; 
                } else {
                    player.dodgeCounterAvailable = false;
                }

                // BGMフィルターの更新
                AudioEngine.updateBGMFilter(slowMoTimer > 0);

                // ズームインパルスの減衰
                if (Math.abs(cameraZoomImpulse) > 0.005) {
                    cameraZoomImpulse *= 0.85;
                } else {
                    cameraZoomImpulse = 0;
                }

                // HPラグバーの更新
                player.lagHp += (player.hp - player.lagHp) * 0.05 * speedFactor;
                boss.lagHp += (boss.hp - boss.lagHp) * 0.05 * speedFactor;

                // ボスシールド演出の減衰
                if (boss.shieldPulse > 0) {
                    boss.shieldPulse -= 0.05 * speedFactor;
                    if (boss.shieldPulse < 0) boss.shieldPulse = 0;
                }

                // ビネット不透明度の減衰
                if (vignetteOpacity > 0) {
                    vignetteOpacity -= 0.04 * speedFactor;
                    if (vignetteOpacity < 0) vignetteOpacity = 0;
                }

                // インパクトリングの更新
                impactRings.forEach(ring => {
                    ring.radius += ring.expandSpeed * speedFactor;
                    ring.alpha -= ring.decay * speedFactor;
                });
                impactRings = impactRings.filter(ring => ring.alpha > 0);

                // monorail update
                monorailX -= 0.8 * speedFactor;
                if (monorailX < -400) {
                    monorailX = CANVAS_WIDTH + 300;
                }

                if (player.parryCounterAvailable) {
                    player.parryCounterTimer -= speedFactor;
                    if (player.parryCounterTimer <= 0) {
                        player.parryCounterAvailable = false;
                    }
                }

                // 先行入力バッファの更新と実行
                if (inputBuffer.timer > 0) {
                    inputBuffer.timer -= speedFactor;
                    if (inputBuffer.timer <= 0) {
                        inputBuffer.action = null; // 猶予切れでクリア
                    } else {
                        // プレイヤーが行動可能なステートになった瞬間にキューを実行
                        let canParryDodge = (player.state === 'idle' || player.state === 'walk' || (player.state === 'slash' && player.stateTimer <= 8));
                        let canAttack = (player.state === 'idle' || player.state === 'walk' || (player.state === 'dash' && player.dodgeCounterAvailable && slowMoTimer > 0));
                        
                        if (inputBuffer.action === 'KeyJ' && canParryDodge) {
                            triggerParry();
                        } else if (inputBuffer.action === 'KeyK' && canParryDodge) {
                            triggerDodge();
                        } else if (inputBuffer.action === 'KeyL' && canAttack) {
                            triggerAttack();
                        }
                    }
                }

                // 2Dターゲットカメラの計算 (距離に応じてズーム・中央追従)
                let dist = Math.abs(player.x - boss.x);
                let baseZoom = 1.25 - (dist / 850);
                baseZoom = Math.max(0.92, Math.min(1.22, baseZoom));
                
                if (hitStops > 0) {
                    cameraTargetZoom = baseZoom * 1.15;
                } else {
                    cameraTargetZoom = baseZoom;
                }

                cameraZoom += (cameraTargetZoom - cameraZoom) * 0.08;
                cameraX += (((player.x + boss.x) / 2) - cameraX) * 0.08;
                cameraY += ((GROUND_Y - 60) - cameraY) * 0.08;

                if (screenShake > 0) screenShake *= 0.9;
                if (showFlash > 0) showFlash -= 0.07;

                // 3. プレイヤー更新
                // スタミナ自動回復
                if (player.state !== 'dash') {
                    player.stamina = Math.min(player.maxStamina, player.stamina + 0.45 * speedFactor);
                }

                if (player.state === 'idle' || player.state === 'walk') {
                    player.vx = 0;
                    if (keys['KeyA']) {
                        player.vx = -player.speed;
                        player.state = 'walk';
                    } else if (keys['KeyD']) {
                        player.vx = player.speed;
                        player.state = 'walk';
                    } else {
                        player.state = 'idle';
                    }
                    // 自動でボスの方を向く（2Dターゲットロック）
                    player.direction = boss.x > player.x ? 1 : -1;
                }

                player.x += player.vx * speedFactor;
                player.x = Math.max(40, Math.min(CANVAS_WIDTH - 40, player.x));

                // キャラクター同士の衝突判定（通常回避や徒歩ではボスをすり抜けられない）
                // ただし、ジャスト回避スロー中のダッシュ、または回避反撃突進（isCounter）のときはすり抜けを許可する
                const pDist = Math.abs(boss.x - player.x);
                const isPerfectDodgeActive = (player.state === 'dash' && player.dashWindow > 0 && slowMoTimer > 0) || player.isCounter;
                const colDist = (player.width / 2) + (boss.width / 2) - 25;
                if (pDist < colDist && !isPerfectDodgeActive && boss.state !== 'stun') {
                    // ボスとの接触時に押し戻す
                    if (player.x < boss.x) {
                        player.x = boss.x - colDist;
                    } else {
                        player.x = boss.x + colDist;
                    }
                    // ダッシュ中だった場合は衝突したため速度を0にする
                    if (player.state === 'dash') {
                        player.vx = 0;
                    }
                }

                if (boss.hitTimer > 0) {
                    boss.hitTimer -= speedFactor;
                }
                if (player.stateTimer > 0) {
                    player.stateTimer -= speedFactor;
                    if (player.stateTimer <= 0) {
                        player.state = 'idle';
                        player.vx = 0;
                    }
                }

                if (player.parryWindow > 0) player.parryWindow -= speedFactor;
                if (player.dashWindow > 0 || (player.state === 'slash' && player.isCounter)) {
                    if (player.dashWindow > 0) player.dashWindow -= speedFactor;
                    if (Math.random() < 0.5) {
                        player.shadows.push({ x: player.x, y: player.y, alpha: 0.5 });
                    }
                }

                player.shadows.forEach(sh => {
                    sh.alpha -= 0.06 * speedFactor;
                });
                player.shadows = player.shadows.filter(sh => sh.alpha > 0);

                if (player.state === 'slash') {
                    // 攻撃判定発生フレーム
                    if (player.stateTimer <= 14 && player.stateTimer >= 8) {
                        player.attackActive = true;
                    } else {
                        player.attackActive = false;
                    }
                    
                    // ターゲットアシスト: 踏み込み中にボスの手前（密着距離）に達したらスライドを停止
                    const dist = Math.abs(boss.x - player.x);
                    const toBossDir = boss.x > player.x ? 1 : -1;
                    const colDist = (player.width / 2) + (boss.width / 2) - 25;
                    if (dist <= colDist + 10 && Math.sign(player.vx) === toBossDir && !player.isCounter) {
                        player.vx = 0;
                    }
                } else {
                    player.attackActive = false;
                }

                // 4. ボス更新
                if (boss.state === 'idle' || boss.state === 'walk') {
                    boss.facing = player.x < boss.x ? -1 : 1;
                }

                if (boss.state === 'telegraph') {
                    boss.stateTimer -= speedFactor;
                    
                    // タメ時間の経過割合 (0.0 ～ 1.0)
                    let totalTelegraph = BOSS_PATTERNS[boss.currentPattern].telegraphTime;
                    let progress = (totalTelegraph - boss.stateTimer) / totalTelegraph;
                    boss.telegraphFlash = progress; // 終盤に向けて赤目・剣が激しく発光

                    if (boss.stateTimer <= 0) {
                        boss.state = 'attack_swing';
                        const pattern = BOSS_PATTERNS[boss.currentPattern];
                        boss.stateTimer = pattern.attackTime;
                        boss.attackActive = false; // 初期状態はfalse
                        boss.attackHasHit = false;
                        
                        // 瞬間移動を廃止し、滑らかな「突進スライド移動」へ変更
                        if (boss.currentPattern === 'thrust') {
                            boss.slideTargetX = boss.x + boss.facing * 180;
                            boss.slideTargetX = Math.max(60, Math.min(CANVAS_WIDTH - 60, boss.slideTargetX));
                            boss.slideSpeed = (boss.slideTargetX - boss.x) / pattern.attackTime;
                        } else {
                            boss.slideSpeed = 0;
                        }
                    }
                } else if (boss.state === 'attack_swing') {
                    boss.stateTimer -= speedFactor;
                    
                    // 突進スライドの滑らかな物理移動
                    if (boss.slideSpeed !== 0) {
                        boss.x += boss.slideSpeed * speedFactor;
                        boss.x = Math.max(80, Math.min(CANVAS_WIDTH - 80, boss.x));
                    }

                    // 当たり判定のアクティブ判定 (中盤の特定フレームでのみ判定を発生させる)
                    const pattern = BOSS_PATTERNS[boss.currentPattern];
                    if (boss.stateTimer <= pattern.hitWindowStart && boss.stateTimer >= pattern.hitWindowEnd) {
                        boss.attackActive = true;
                    } else {
                        boss.attackActive = false;
                    }

                    if (boss.stateTimer <= 0) {
                        boss.state = 'recovery';
                        boss.stateTimer = BOSS_PATTERNS[boss.currentPattern].recoveryTime;
                        boss.attackActive = false;
                        boss.slideSpeed = 0;
                    }
                } else if (boss.state === 'recovery') {
                    boss.stateTimer -= speedFactor;

                    // 後退（バックステップ）して間合いを仕切り直す
                    if (boss.stateTimer > BOSS_PATTERNS[boss.currentPattern].recoveryTime - 15) {
                        boss.x -= boss.facing * 1.5 * speedFactor;
                        boss.x = Math.max(80, Math.min(CANVAS_WIDTH - 80, boss.x));
                    }

                    // プレイヤーが背後に回り込んでいる場合、後隙モーションの途中でも素早く振り向いて警戒する
                    const isPlayerBehind = boss.facing === 1 ? (player.x < boss.x) : (player.x > boss.x);
                    if (isPlayerBehind && boss.currentPattern && BOSS_PATTERNS[boss.currentPattern] && boss.stateTimer < BOSS_PATTERNS[boss.currentPattern].recoveryTime - 15) {
                        boss.facing = player.x < boss.x ? -1 : 1;
                    }

                    if (boss.stateTimer <= 0) {
                        boss.state = 'idle';
                        boss.stateTimer = Math.random() * 20 + 20; // 攻撃後の立ち上がりディレイ
                    }
                } else if (boss.state === 'stun') {
                    boss.stateTimer -= speedFactor;
                    if (boss.stateTimer <= 0) {
                        boss.state = 'idle';
                        boss.posture = boss.maxPosture; 
                        boss.stateTimer = 40;
                    }
                }

                if (boss.state !== 'stun' && boss.posture < boss.maxPosture) {
                    boss.posture += 0.03 * speedFactor; // 回復速度を遅く
                }

                updateBossAI(speedFactor);

                // 5. アクション衝突判定

                // ボス攻撃判定（当たり判定のタイミングと見た目を一致させる）
                if (boss.attackActive && !boss.attackHasHit) {
                    const dist = Math.abs(boss.x - player.x);
                    const reach = boss.currentPattern === 'thrust' ? 300 : (boss.currentPattern === 'slash' ? 250 : 180);
                    const inFront = boss.facing === -1 ? (player.x <= boss.x + 10) : (player.x >= boss.x - 10);
                    const isCloseEnough = dist < reach && inFront;

                    if (isCloseEnough) {
                        const pattern = BOSS_PATTERNS[boss.currentPattern];
                        const archetype = BOSS_ARCHETYPES[boss.archetype];
                        
                        // A) パリィ判定 (パリィ可能攻撃のみ)
                        if (player.state === 'parry' && player.parryWindow > 0 && pattern.parryable) {
                            boss.attackHasHit = true;
                            boss.attackActive = false;
                            boss.state = 'recovery';
                            boss.stateTimer = 60; // のけぞり延長
                            
                            // 体幹ダメージにアーキタイプ倍率を適用
                            const postureDmg = Math.round(35 * archetype.parryPostureMult);
                            boss.posture = Math.max(0, boss.posture - postureDmg);
                            
                            // パリィ成功でスタミナ回復
                            player.stamina = Math.min(player.maxStamina, player.stamina + 50);
                            
                            // パリィ反撃可能状態をアクティブに
                            player.parryCounterAvailable = true;
                            player.parryCounterTimer = 30; // 30フレーム猶予
                            
                            AudioEngine.playParry();
                            hitStops = 14;
                            screenShake = 14;
                            cameraTargetZoom = 1.2;
                            cameraZoomImpulse = 0.12; // ズームインパルス
                            vignetteColor = 'rgba(0, 229, 255, 0.6)'; // シアンビネット
                            vignetteOpacity = 0.85;
                            
                            spawnParryParticles(player.x + (boss.x - player.x)/2, player.y - 35);
                            spawnImpactRing(player.x + (boss.x - player.x)/2, player.y - 35, '#cc00ff', 125, 5, true);
                            triggerPopup('parryPopup', player.x, player.y - 25);

                            if (boss.posture <= 0) {
                                boss.state = 'stun';
                                boss.stateTimer = 240;
                                boss.attackActive = false;
                                addExplosion(boss.x, boss.y - 45, '#ffd700', 25);
                            }
                        } 
                        // B) ジャスト回避 (回避可能攻撃のみ)
                        else if (player.state === 'dash' && player.dashWindow > 0 && pattern.dodgeable) {
                            boss.attackHasHit = true;
                            slowMoTimer = 150;
                            player.dodgeCounterAvailable = true;
                            AudioEngine.playDodge();
                            cameraZoomImpulse = 0.08;
                            vignetteColor = 'rgba(255, 215, 0, 0.4)'; // 金色ビネット
                            vignetteOpacity = 0.6;
                            triggerPopup('dodgePopup', player.x, player.y - 25);
                            spawnDodgeParticles(player.x, player.y - 20);
                            spawnImpactRing(player.x, player.y - 20, '#ffd700', 80, 3);
                        } 
                        // C) 被弾 (非ダッシュ時、または回避不可攻撃での回避時)
                        else if ((player.state !== 'dash' || !pattern.dodgeable) && player.state !== 'hit') {
                            boss.attackHasHit = true;
                            player.state = 'hit';
                            player.stateTimer = 26;
                            player.vx = boss.facing * 4.5;
                            player.dodgeCounterAvailable = false;
                            player.parryCounterAvailable = false;
                            player.isCounter = false;
                            player.isParryCounter = false;
                            
                            inputBuffer.action = null;
                            inputBuffer.timer = 0;
                            
                            player.hp = Math.max(0, player.hp - pattern.damage);
                            AudioEngine.playHit();
                            screenShake = 9;
                            cameraZoomImpulse = -0.06; // 被弾時に少し画面を引く
                            vignetteColor = 'rgba(255, 0, 85, 0.7)'; // 深紅ビネット
                            vignetteOpacity = 0.95;
                            
                            addExplosion(player.x, player.y - 30, '#ff0055', 15);
                            spawnImpactRing(player.x, player.y - 30, '#ff0055', 90, 4);

                            if (player.hp <= 0) {
                                setTimeout(() => {
                                    player.hp = player.maxHp;
                                    player.lagHp = player.maxHp;
                                    boss.hp = archetype.maxHp;
                                    boss.lagHp = archetype.maxHp;
                                    boss.posture = archetype.maxPosture;
                                    boss.state = 'idle';
                                    boss.stateTimer = 90;
                                }, 1000);
                            }
                        }
                    }
                }

                // プレイヤー攻撃判定
                if (player.attackActive && !player.attackHasHit) {
                    const dist = Math.abs(player.x - boss.x);
                    const inFront = player.direction === 1 ? (boss.x >= player.x - 30) : (boss.x <= player.x + 30);
                    // カウンター攻撃/パリィカウンター攻撃はめくりも許可
                    const isCloseEnough = dist < 220 && (inFront || dist < 130 || player.isCounter || player.isParryCounter);

                    if (isCloseEnough) {
                        player.attackHasHit = true;
                        boss.hitTimer = 8;
                        const archetype = BOSS_ARCHETYPES[boss.archetype];
                        
                        if (boss.state === 'stun') {
                            // 致命の一撃：防御無視2000ダメージ
                            boss.hp = Math.max(0, boss.hp - 2000);
                            AudioEngine.playCritical();
                            hitStops = 20;
                            screenShake = 22;
                            cameraTargetZoom = 1.35;
                            cameraZoomImpulse = -0.18; // ぐっと引くスクリーンスクイーズ
                            vignetteColor = 'rgba(255, 0, 85, 0.8)';
                            vignetteOpacity = 1.0;

                            slashWaves.push({
                                x: player.x,
                                y: player.y - 30,
                                toRemove: false,
                                timer: 20
                            });

                            spawnCriticalParticles(boss.x, boss.y - 40);
                            spawnImpactRing(boss.x, boss.y - 40, '#ff0055', 180, 8);
                            triggerPopup('criticalPopup', boss.x, boss.y - 40);

                            if (boss.hp <= 0) {
                                setTimeout(() => {
                                    boss.hp = archetype.maxHp;
                                    boss.lagHp = archetype.maxHp;
                                    boss.posture = archetype.maxPosture;
                                    player.hp = player.maxHp;
                                    player.lagHp = player.maxHp;
                                    boss.state = 'idle';
                                    boss.stateTimer = 95;
                                }, 1500);
                            }
                        } else if (player.isParryCounter) {
                            // パリィ反撃 (Parry Counter)：防御無視600ダメージ ＋ 大量体幹削り
                            player.isParryCounter = false;
                            
                            const dmg = 600;
                            const postureDmg = Math.round(45 * archetype.parryPostureMult);
                            
                            boss.hp = Math.max(0, boss.hp - dmg);
                            boss.posture = Math.max(0, boss.posture - postureDmg);
                            player.stamina = Math.min(player.maxStamina, player.stamina + 60); // スタミナ60回復
                            
                            boss.facing = player.x < boss.x ? -1 : 1;
                            if (boss.state === 'recovery') {
                                  boss.stateTimer = Math.min(boss.stateTimer, 12);
                            }
                            
                            AudioEngine.playCritical();
                            hitStops = 14;
                            screenShake = 16;
                            cameraTargetZoom = 1.25;
                            cameraZoomImpulse = -0.12;
                            vignetteColor = 'rgba(0, 229, 255, 0.6)';
                            vignetteOpacity = 0.85;

                            slashWaves.push({
                                x: player.x,
                                y: player.y - 30,
                                toRemove: false,
                                timer: 20
                            });

                            spawnCriticalParticles(boss.x, boss.y - 40);
                            spawnImpactRing(boss.x, boss.y - 40, '#00e5ff', 160, 7);
                            triggerPopup('criticalPopup', boss.x, boss.y - 40);
                            const critPopup = document.getElementById('criticalPopup');
                            if (critPopup) {
                                critPopup.innerText = "PARRY COUNTER!";
                                critPopup.style.color = "#00e5ff";
                                critPopup.style.textShadow = "0 0 20px rgba(0,229,255,0.9)";
                                setTimeout(() => {
                                    critPopup.innerText = "CRITICAL STRIKE!";
                                    critPopup.style.color = "#ff0055";
                                    critPopup.style.textShadow = "0 0 20px rgba(255,0,85,0.85)";
                                }, 800);
                            }

                            if (boss.posture <= 0) {
                                boss.state = 'stun';
                                boss.stateTimer = 240;
                                boss.attackActive = false;
                                addExplosion(boss.x, boss.y - 45, '#ffd700', 25);
                            }
                        } else if (player.isCounter) {
                            // 回避反撃 (Dodge Counter)：防御力の影響を受け、体幹削りも少なめ
                            player.isCounter = false;
                            
                            const dmg = Math.round(400 * (1 - archetype.damageResist));
                            
                            // ガード時はヘックスシールド表示
                            if (archetype.damageResist > 0) {
                                boss.shieldPulse = 1.0;
                                boss.shieldPulseColor = '#cc00ff';
                            }
                            
                            const postureDmg = Math.round(20 * archetype.dodgePostureMult);
                            
                            boss.hp = Math.max(0, boss.hp - dmg);
                            boss.posture = Math.max(0, boss.posture - postureDmg);
                            
                            boss.facing = player.x < boss.x ? -1 : 1;
                            if (boss.state === 'recovery') {
                                boss.stateTimer = Math.min(boss.stateTimer, 12);
                            }
                            
                            AudioEngine.playCritical();
                            hitStops = 12;
                            screenShake = 14;
                            cameraTargetZoom = 1.2;
                            cameraZoomImpulse = 0.08;
                            vignetteColor = 'rgba(255, 215, 0, 0.5)';
                            vignetteOpacity = 0.7;

                            slashWaves.push({
                                x: player.x,
                                y: player.y - 30,
                                toRemove: false,
                                timer: 20
                            });

                            spawnCriticalParticles(boss.x, boss.y - 40);
                            spawnImpactRing(boss.x, boss.y - 40, archetype.damageResist > 0 ? '#00e5ff' : '#ffd700', 140, 6);
                            triggerPopup('criticalPopup', boss.x, boss.y - 40);
                            const critPopup = document.getElementById('criticalPopup');
                            if (critPopup) {
                                if (archetype.damageResist > 0) {
                                    critPopup.innerText = "SHIELDED (80% CUT)!";
                                    critPopup.style.color = "#a1a1aa";
                                    critPopup.style.textShadow = "0 0 10px rgba(255,255,255,0.3)";
                                } else {
                                    critPopup.innerText = "DODGE COUNTER!";
                                    critPopup.style.color = "#ffd700";
                                    critPopup.style.textShadow = "0 0 20px rgba(255,215,0,0.85)";
                                }
                                setTimeout(() => {
                                    critPopup.innerText = "CRITICAL STRIKE!";
                                    critPopup.style.color = "#ff0055";
                                    critPopup.style.textShadow = "0 0 20px rgba(255,0,85,0.85)";
                                }, 800);
                            }

                            if (boss.posture <= 0) {
                                boss.state = 'stun';
                                boss.stateTimer = 240;
                                boss.attackActive = false;
                                addExplosion(boss.x, boss.y - 45, '#ffd700', 25);
                            }
                        } else {
                            // 通常攻撃
                            const dmg = Math.round(50 * (1 - archetype.damageResist));
                            
                            // ガード時はヘックスシールド表示
                            if (archetype.damageResist > 0) {
                                boss.shieldPulse = 1.0;
                                boss.shieldPulseColor = '#cc00ff';
                            }
                            
                            boss.hp = Math.max(0, boss.hp - dmg);
                            boss.posture = Math.max(0, boss.posture - 8);
                            
                            boss.facing = player.x < boss.x ? -1 : 1;
                            if (boss.state === 'recovery') {
                                boss.stateTimer = Math.min(boss.stateTimer, 12);
                            }
                            
                            AudioEngine.playHit();
                            hitStops = 4;
                            screenShake = 3.5;
                            addExplosion(boss.x, boss.y - 40, archetype.damageResist > 0 ? '#64748b' : '#ffffff', 8);
                            spawnImpactRing(boss.x, boss.y - 40, archetype.damageResist > 0 ? '#00e5ff' : '#ffffff', 60, 3);

                            if (boss.posture <= 0) {
                                boss.state = 'stun';
                                boss.stateTimer = 240;
                                boss.attackActive = false;
                                addExplosion(boss.x, boss.y - 45, '#ffd700', 25);
                            }
                        }
                    }
                }

                // 斬撃エフェクト更新
                slashWaves.forEach(sw => {
                    sw.timer--;
                    if (sw.timer <= 0) sw.toRemove = true;
                });
                slashWaves = slashWaves.filter(sw => !sw.toRemove);

                // パーティクル更新
                particles.forEach(p => {
                    p.x += p.vx * speedFactor;
                    p.y += p.vy * speedFactor;
                    p.vy += 0.22 * speedFactor; 
                    p.alpha -= p.decay * speedFactor;
                });
                particles = particles.filter(p => p.alpha > 0);

                // UI更新
                const scoreVal = document.getElementById('scoreVal');
                if (scoreVal) scoreVal.innerText = score.toString().padStart(4, '0');
                const waveVal = document.getElementById('waveVal');
                if (waveVal) waveVal.innerText = wave;
                const circuitLvVal = document.getElementById('circuitLvVal');
                if (circuitLvVal) circuitLvVal.innerText = "BOSS FIGHT";
            }

            // --- パーティクル生成 ---
            function spawnParryParticles(x, y) {
                for (let i = 0; i < 25; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 10 + 4;
                    particles.push({
                        x: x, y: y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed - 1.5,
                        size: Math.random() * 2.5 + 1.5,
                        color: '#00e5ff',
                        alpha: 1,
                        decay: Math.random() * 0.025 + 0.015
                    });
                }
                for (let i = 0; i < 10; i++) {
                    particles.push({
                        x: x, y: y,
                        vx: (Math.random() - 0.5) * 12,
                        vy: (Math.random() - 0.5) * 12 - 2,
                        size: Math.random() * 3 + 1,
                        color: '#ffffff',
                        alpha: 1,
                        decay: 0.035
                    });
                }
            }

            function spawnDodgeParticles(x, y) {
                for (let i = 0; i < 12; i++) {
                    particles.push({
                        x: x, y: y,
                        vx: (Math.random() - 0.5) * 6 - player.direction * 4,
                        vy: (Math.random() - 0.5) * 1.5,
                        size: Math.random() * 2 + 1,
                        color: '#ffd700',
                        alpha: 0.8,
                        decay: 0.045
                    });
                }
            }

            // 紅蓮の致命火花
            function spawnCriticalParticles(x, y) {
                for (let i = 0; i < 40; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 14 + 5;
                    particles.push({
                        x: x, y: y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed - 4,
                        size: Math.random() * 4 + 2.5,
                        color: '#ff0055',
                        alpha: 1.0,
                        decay: Math.random() * 0.015 + 0.01
                    });
                }
                for (let i = 0; i < 15; i++) {
                    particles.push({
                        x: x, y: y,
                        vx: (Math.random() - 0.5) * 18,
                        vy: (Math.random() - 0.5) * 18 - 3,
                        size: Math.random() * 2.5 + 1.5,
                        color: '#ffd700',
                        alpha: 1.0,
                        decay: 0.025
                    });
                }
            }

            function addExplosion(x, y, color, count = 10) {
                for (let i = 0; i < count; i++) {
                    particles.push({
                        x: x, y: y,
                        vx: (Math.random() - 0.5) * 7,
                        vy: (Math.random() - 0.5) * 7 - 1,
                        size: Math.random() * 3 + 2,
                        color: color,
                        alpha: 1,
                        decay: Math.random() * 0.035 + 0.02
                    });
                }
            }

            // ヘックスシールド描画関数
            function drawHexShield(x, y, pulse, color) {
                ctx.save();
                ctx.translate(x, y);
                ctx.globalAlpha = pulse * 0.8;
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.shadowBlur = 10;
                ctx.shadowColor = color;
                
                const hexRadius = 16;
                const horizontalDist = hexRadius * 1.5;
                const verticalDist = hexRadius * Math.sqrt(3);
                
                const columns = 3;
                const rows = 4;
                
                function drawHexagon(hx, hy, r) {
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        let angle = (Math.PI / 3) * i;
                        let px = hx + r * Math.cos(angle);
                        let py = hy + r * Math.sin(angle);
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.stroke();
                    ctx.save();
                    ctx.globalAlpha = pulse * 0.08;
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.restore();
                }
                
                // プレイヤーのいる前面方向に少しずらす
                let dir = player.x < boss.x ? -1 : 1;
                ctx.translate(dir * 25, -boss.height / 2);
                
                for (let col = 0; col < columns; col++) {
                    for (let row = 0; row < rows; row++) {
                        let hx = (col - columns/2) * horizontalDist;
                        let hy = (row - rows/2) * verticalDist + (col % 2 === 0 ? 0 : verticalDist / 2);
                        
                        let distFromCenter = Math.sqrt(hx*hx + hy*hy);
                        if (distFromCenter < 55) {
                            drawHexagon(hx, hy, hexRadius * (1 - distFromCenter * 0.002));
                        }
                    }
                }
                ctx.restore();
            }

            // --- 描画 ---
            function draw() {
                // 1. カメラ適用外でベースの背景を黒塗りし、カメラが動いた時の隙間を防止
                ctx.fillStyle = '#020204';
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

                ctx.save();

                // 2Dターゲットカメラの適用 (ズームインパルスを加算)
                ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
                ctx.scale(cameraZoom + cameraZoomImpulse, cameraZoom + cameraZoomImpulse);
                ctx.translate(-cameraX, -cameraY);

                if (screenShake > 0) {
                    const dx = (Math.random() - 0.5) * screenShake;
                    const dy = (Math.random() - 0.5) * screenShake;
                    ctx.translate(dx, dy);
                }

                
                // --- アセットロード中のローディング画面 ---
                if (assetsLoaded < totalAssets) {
                    ctx.fillStyle = '#030306';
                    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                    
                    ctx.fillStyle = '#cc00ff';
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = '#cc00ff';
                    ctx.font = 'bold 24px Outfit';
                    ctx.textAlign = 'center';
                    ctx.fillText("LUNAIRE", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowBlur = 0;
                    ctx.font = '14px Outfit';
                    ctx.fillText("LOADING DREAMSCAPE ASSETS...", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);
                    
                    // 進行度バー
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.strokeRect(CANVAS_WIDTH / 2 - 100, CANVAS_HEIGHT / 2 + 30, 200, 8);
                    ctx.fillStyle = '#cc00ff';
                    ctx.fillRect(CANVAS_WIDTH / 2 - 100, CANVAS_HEIGHT / 2 + 30, (assetsLoaded / totalAssets) * 200, 8);
                    
                    ctx.fillStyle = '#64748b';
                    ctx.font = '11px Outfit';
                    ctx.fillText("Progress: " + assetsLoaded + " / " + totalAssets, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 55);
                    return; // 描画処理をここで中断してアセットのロードを待つ
                }

                // --- 背景画像のパララックス描画 ---
                ctx.save();
                let parallaxFactor = 0.12; // 12% カメラ追従で奥行きを出す
                let bgX = cameraX * parallaxFactor;
                let bgY = cameraY * parallaxFactor;
                ctx.translate(bgX, bgY);

                if (IMAGES['background'] && assetsLoaded === totalAssets) {
                    // パララックスがはみ出さないように、キャンバスサイズより少し大きめに描画 (850x420に対して930x460)
                    ctx.drawImage(IMAGES['background'], -40, -20, CANVAS_WIDTH + 80, CANVAS_HEIGHT + 40);
                } else {
                    ctx.fillStyle = '#050410';
                    ctx.fillRect(-40, -20, CANVAS_WIDTH + 80, CANVAS_HEIGHT + 40);
                }
                ctx.restore();
// 地面 (濡れた石畳)
                ctx.fillStyle = '#040308';
                ctx.fillRect(-1000, GROUND_Y, CANVAS_WIDTH + 2000, CANVAS_HEIGHT - GROUND_Y);
                
                // 石畳のタイル目地 (パースをかけた線)
                ctx.strokeStyle = 'rgba(153, 0, 255, 0.04)';
                ctx.lineWidth = 1.5;
                
                // 水平線 (奥ほど細かく)
                let tempY = GROUND_Y;
                let step = 8;
                while (tempY < CANVAS_HEIGHT + 200) {
                    ctx.beginPath();
                    ctx.moveTo(-1000, tempY);
                    ctx.lineTo(CANVAS_WIDTH + 1000, tempY);
                    ctx.stroke();
                    tempY += step;
                    step += 3.2; // 奥から手前に向けてパースをかける
                }
                
                // 垂直/斜めの目地 (バニシングポイントから放射状に描画)
                ctx.beginPath();
                for (let x = -800; x <= CANVAS_WIDTH + 1000; x += 120) {
                    ctx.moveTo(x, GROUND_Y);
                    // 手前側を広く広げる
                    ctx.lineTo(x + (x - CANVAS_WIDTH/2) * 0.8, CANVAS_HEIGHT + 200);
                }
                ctx.stroke();
                
                // 濡れた地面の反射光効果
                // 看板「夢想」と「星屑ホテル」のネオン位置に合わせた照り返しのグラデーション
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                
                // 紫ネオンの反射 (夢想看板の真下付近)
                let reflectGradPurple = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_HEIGHT);
                reflectGradPurple.addColorStop(0, 'rgba(153, 0, 255, 0.16)');
                reflectGradPurple.addColorStop(1, 'rgba(153, 0, 255, 0)');
                ctx.fillStyle = reflectGradPurple;
                ctx.fillRect(450, GROUND_Y, 400, CANVAS_HEIGHT - GROUND_Y);
                
                // ピンクネオンの反射 (星屑ホテル看板の真下付近)
                let reflectGradPink = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_HEIGHT);
                reflectGradPink.addColorStop(0, 'rgba(255, 0, 119, 0.14)');
                reflectGradPink.addColorStop(1, 'rgba(255, 0, 119, 0)');
                ctx.fillStyle = reflectGradPink;
                ctx.fillRect(720, GROUND_Y, 300, CANVAS_HEIGHT - GROUND_Y);
                
                ctx.restore();

                // 霧
                ctx.fillStyle = 'rgba(153, 0, 255, 0.03)';
                for (let i = 0; i < 4; i++) {
                    let fogX = (Date.now() / 80 + i * 220) % (CANVAS_WIDTH + 200) - 100;
                    ctx.fillRect(fogX, GROUND_Y - 15, 140, 8);
                }

                // インパクトリングの描画
                impactRings.forEach(ring => {
                    ctx.save();
                    ctx.strokeStyle = ring.color;
                    ctx.globalAlpha = ring.alpha;
                    ctx.lineWidth = 3 * (1 - ring.radius / ring.maxRadius);
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = ring.color;
                    
                    if (ring.isParry) {
                        // Draw a complex geometric magic circle / shield
                        let rad = ring.radius;
                        
                        // 1. Concentric circles
                        ctx.beginPath();
                        ctx.arc(ring.x, ring.y, rad, 0, Math.PI * 2);
                        ctx.stroke();
                        
                        ctx.beginPath();
                        ctx.arc(ring.x, ring.y, rad * 0.65, 0, Math.PI * 2);
                        ctx.stroke();
                        
                        ctx.beginPath();
                        ctx.arc(ring.x, ring.y, rad * 0.3, 0, Math.PI * 2);
                        ctx.stroke();
                        
                        // 2. Star / Polygon lines (e.g. overlapping triangles forming a hexagram)
                        ctx.save();
                        ctx.translate(ring.x, ring.y);
                        // Rotate slowly over time
                        ctx.rotate(rad * 0.05);
                        
                        // Hexagon structure
                        ctx.beginPath();
                        for (let j = 0; j < 6; j++) {
                            let angle = (Math.PI / 3) * j;
                            let px = rad * Math.cos(angle);
                            let py = rad * Math.sin(angle);
                            if (j === 0) ctx.moveTo(px, py);
                            else ctx.lineTo(px, py);
                        }
                        ctx.closePath();
                        ctx.stroke();
                        
                        // Inner star (lines connecting every second vertex)
                        ctx.beginPath();
                        for (let j = 0; j < 6; j++) {
                            let angle = (Math.PI / 3) * (j * 2);
                            let px = rad * 0.65 * Math.cos(angle);
                            let py = rad * 0.65 * Math.sin(angle);
                            if (j === 0) ctx.moveTo(px, py);
                            else ctx.lineTo(px, py);
                        }
                        ctx.closePath();
                        ctx.stroke();
                        
                        ctx.beginPath();
                        for (let j = 0; j < 6; j++) {
                            let angle = (Math.PI / 3) * (j * 2 + 1);
                            let px = rad * 0.65 * Math.cos(angle);
                            let py = rad * 0.65 * Math.sin(angle);
                            if (j === 0) ctx.moveTo(px, py);
                            else ctx.lineTo(px, py);
                        }
                        ctx.closePath();
                        ctx.stroke();
                        
                        // Tiny outer tick lines
                        for (let j = 0; j < 12; j++) {
                            let angle = (Math.PI / 6) * j;
                            ctx.beginPath();
                            ctx.moveTo(rad * 0.9 * Math.cos(angle), rad * 0.9 * Math.sin(angle));
                            ctx.lineTo(rad * 1.1 * Math.cos(angle), rad * 1.1 * Math.sin(angle));
                            ctx.stroke();
                        }
                        
                        ctx.restore();
                    } else {
                        // Standard ring for normal impacts
                        ctx.beginPath();
                        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                    ctx.restore();
                });

                // 1. 攻撃の突きエフェクト軌跡（ドリームランスの鋭い突き）
                if (player.state === 'slash' && player.attackActive) {
                    ctx.save();
                    ctx.translate(player.x, player.y - player.height/2);
                    ctx.scale(player.direction, 1);
                    
                    let pColor = '#ff0077'; // neon pink
                    let aColor = '#cc00ff'; // neon purple
                    
                    // Draw a sharp piercing beam
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = pColor;
                    ctx.strokeStyle = `rgba(255, 0, 119, 0.4)`;
                    ctx.lineWidth = 16;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(10, 0);
                    ctx.lineTo(140, 0);
                    ctx.stroke();
                    
                    // Core white beam
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 4;
                    ctx.stroke();
                    
                    // Draw neon spiral coils wrapping the spear thrust
                    ctx.strokeStyle = aColor;
                    ctx.shadowColor = aColor;
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    for (let x = 15; x <= 130; x += 3) {
                        let sinVal = Math.sin((x / 12) + (Date.now() / 25)) * 14;
                        let cosVal = Math.cos((x / 12) + (Date.now() / 25)) * 8; // perspective
                        if (x === 15) ctx.moveTo(x, sinVal);
                        else ctx.lineTo(x, sinVal);
                    }
                    ctx.stroke();
                    
                    // Draw spark rings along the thrust line
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(140, 0, 6, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.restore();
                }

                if (boss.state === 'attack_swing' && boss.attackActive) {
                    ctx.save();
                    // Shift the y position of swing based on harpy/hound
                    let swingY = boss.y - boss.height/2;
                    if (boss.archetype === 'harpy') {
                        swingY += Math.sin(Date.now() / 150) * 8 - 15;
                    }
                    ctx.translate(boss.x, swingY);
                    ctx.scale(boss.facing, 1);
                    
                    ctx.shadowBlur = 18;
                    const pattern = BOSS_PATTERNS[boss.currentPattern];
                    ctx.shadowColor = pattern.color;
                    ctx.lineWidth = 4;
                    ctx.lineCap = 'round';
                    
                    if (boss.archetype === 'hound') {
                        // Hound: Draw claw marks (three parallel paths)
                        const clawGap = 8;
                        ctx.strokeStyle = pattern.color === '#ff0055' ? 'rgba(255, 0, 85, 0.45)' : (pattern.color === '#ffd700' ? 'rgba(255, 215, 0, 0.45)' : 'rgba(0, 229, 255, 0.45)');
                        
                        for (let c = -1; c <= 1; c++) {
                            ctx.beginPath();
                            let offset = c * clawGap;
                            if (boss.currentPattern === 'overhead') {
                                // Downward vertical arc claw swipe
                                ctx.arc(10, offset, 95 + offset, -Math.PI * 0.55, Math.PI * 0.15);
                            } else if (boss.currentPattern === 'slash') {
                                // Horizontal sweep claw swipe
                                ctx.arc(0, offset, 115 + offset, -Math.PI * 0.25, Math.PI * 0.25);
                            } else { // thrust
                                // Linear charge claws
                                ctx.moveTo(0, offset);
                                ctx.lineTo(160, offset);
                            }
                            ctx.lineWidth = 7;
                            ctx.stroke();
                        }
                        
                        // Bright core of the claw marks
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                        ctx.lineWidth = 1.5;
                        for (let c = -1; c <= 1; c++) {
                            ctx.beginPath();
                            let offset = c * clawGap;
                            if (boss.currentPattern === 'overhead') {
                                ctx.arc(10, offset, 95 + offset, -Math.PI * 0.55, Math.PI * 0.15);
                            } else if (boss.currentPattern === 'slash') {
                                ctx.arc(0, offset, 115 + offset, -Math.PI * 0.25, Math.PI * 0.25);
                            } else {
                                ctx.moveTo(0, offset);
                                ctx.lineTo(160, offset);
                            }
                            ctx.stroke();
                        }
                    } else {
                        // Harpy: Draw wing blades / avian sweeps
                        ctx.strokeStyle = pattern.color === '#ff0055' ? 'rgba(255, 0, 119, 0.45)' : (pattern.color === '#ffd700' ? 'rgba(255, 215, 0, 0.45)' : 'rgba(0, 229, 255, 0.45)');
                        ctx.lineWidth = 15;
                        ctx.beginPath();
                        if (boss.currentPattern === 'overhead') {
                            // Wing dive slam sweep
                            ctx.arc(0, -10, 110, -Math.PI * 0.7, Math.PI * 0.25);
                        } else if (boss.currentPattern === 'slash') {
                            // Double wing sweep
                            ctx.arc(0, 0, 130, -Math.PI * 0.35, Math.PI * 0.35);
                        } else { // thrust
                            // Drill dive cone
                            ctx.moveTo(0, 0);
                            ctx.lineTo(170, 0);
                            ctx.moveTo(0, -15);
                            ctx.lineTo(170, 0);
                            ctx.moveTo(0, 15);
                            ctx.lineTo(170, 0);
                        }
                        ctx.stroke();
                        
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 4;
                        ctx.stroke();
                    }
                    ctx.restore();
                }

                // 2. ボス描画
                ctx.save();
                if (boss.state === 'stun') {
                    let stGlow = Math.sin(Date.now() / 80) * 0.25 + 0.35;
                    ctx.save();
                    ctx.translate(boss.x, boss.y);
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = '#00e5ff';
                    ctx.fillStyle = `rgba(0, 229, 255, ${stGlow})`;
                    ctx.fillRect(-boss.width/2 - 2, -boss.height - 2, boss.width + 4, boss.height + 4);
                    ctx.restore();
                }

                // ボス描画位置決定とブレ・アニメーション
                let bossDrawX = boss.x;
                let bossDrawY = boss.y;
                let bossRotation = 0;
                
                if (boss.archetype === 'harpy') {
                    // Harpy floats/hovers above the ground
                    let hoverOffset = Math.sin(Date.now() / 150) * 8 - 15;
                    bossDrawY += hoverOffset;
                    if (boss.state === 'walk') {
                        bossDrawY += Math.sin(Date.now() / 90) * 3.0;
                    }
                } else {
                    // Hound is on the ground
                    if (boss.state === 'walk') {
                        bossDrawY += Math.sin(Date.now() / 70) * 2.0;
                        bossRotation = boss.facing * 0.03;
                    } else if (boss.state === 'idle') {
                        bossDrawY += Math.sin(Date.now() / 250) * 1.0;
                    }
                }

                ctx.save();
                ctx.translate(bossDrawX, bossDrawY);
                ctx.rotate(bossRotation);

                const archetype = BOSS_ARCHETYPES[boss.archetype];
                let primaryColor = archetype.color;
                let neonColor = archetype.eyeColor;
                
                if (boss.state === 'stun') {
                    primaryColor = '#102030';
                    neonColor = '#00e5ff';
                }

                if (boss.archetype === 'hound') {
                    // --- DRAW DREAM HOUND (Mechanical Quadruped) ---
                    ctx.save();
                    ctx.scale(boss.facing, 1);

                    // ボスの状態別スプライト切り替え
                    let img = IMAGES['boss_hound_idle'];
                    if (boss.state === 'telegraph') {
                        img = IMAGES['boss_hound_telegraph'];
                    } else if (boss.state === 'attack_swing') {
                        img = IMAGES['boss_hound_charge'];
                    } else if (boss.state === 'stun') {
                        img = IMAGES['boss_hound_stun'];
                    }

                    if (img && assetsLoaded === totalAssets) {
                        let bScaleX = 1.0;
                        let bScaleY = 1.0;
                        
                        if (boss.state === 'idle') {
                            bScaleY = Math.sin(Date.now() / 300) * 0.015 + 0.985;
                            bScaleX = Math.cos(Date.now() / 300) * 0.005 + 0.995;
                        } else if (boss.state === 'telegraph') {
                            bScaleY = 0.86;
                            bScaleX = 1.08;
                        } else if (boss.state === 'attack_swing') {
                            bScaleX = 1.15;
                            bScaleY = 0.92;
                        }
                        
                        if (boss.state === 'stun') {
                            ctx.shadowBlur = 25;
                            ctx.shadowColor = '#00e5ff';
                        }
                        
                        // 高さを 135px にリサイズ
                        let bTargetHeight = 260;
                        let bScale = bTargetHeight / img.height;
                        ctx.scale(bScale * bScaleX, bScale * bScaleY);
                        
                        if (boss.hitTimer > 0) {
                            ctx.filter = 'brightness(3.0) saturate(0)';
                        }
                        
                        ctx.drawImage(img, -img.width / 2, -img.height);
                        
                        if (boss.hitTimer > 0) {
                            ctx.filter = 'none';
                        }
                    } else {
                        ctx.fillStyle = primaryColor;
                        ctx.fillRect(-boss.width/2, -boss.height, boss.width, boss.height);
                    }
                    ctx.restore();

                } else if (boss.archetype === 'harpy') {
                    // --- DRAW NEON HARPY (Mechanical Bird/Cyborg) ---
                    ctx.save();
                    ctx.scale(boss.facing, 1);

                    // ボスの状態別スプライト切り替え
                    let img = IMAGES['boss_harpy_idle'];
                    if (boss.state === 'telegraph') {
                        img = IMAGES['boss_harpy_telegraph'];
                    } else if (boss.state === 'attack_swing') {
                        img = IMAGES['boss_harpy_attack'];
                    } else if (boss.state === 'stun') {
                        img = IMAGES['boss_harpy_stun'];
                    }

                    if (img && assetsLoaded === totalAssets) {
                        let hScaleX = 1.0;
                        let hScaleY = 1.0;
                        
                        // 羽ばたき風の微小な縦揺れ・伸縮
                        if (boss.state === 'walk' || boss.state === 'idle') {
                            hScaleY = Math.sin(Date.now() / 100) * 0.02 + 0.98;
                        }
                        
                        // 高さを 120px にリサイズ
                        let hTargetHeight = 240;
                        let hScale = hTargetHeight / img.height;
                        ctx.scale(hScale * hScaleX, hScale * hScaleY);
                        
                        // 被弾フラッシュ (hitTimer)
                        if (boss.hitTimer > 0) {
                            ctx.filter = 'brightness(3.0) saturate(0)';
                        }
                        
                        // 空中ボスなので足元より少し上にオフセット
                        // スタン時は地面に伏せるのでオフセットなし、それ以外はホバリング用オフセット (+15)
                        let offsetY = (boss.state === 'stun') ? 0 : 15;
                        ctx.drawImage(img, -img.width / 2, -img.height + offsetY);
                        
                        if (boss.hitTimer > 0) {
                            ctx.filter = 'none';
                        }
                    } else {
                        ctx.fillStyle = primaryColor;
                        ctx.fillRect(-boss.width/2, -boss.height, boss.width, boss.height);
                    }
                    ctx.restore(); // scale/flip of restore
                }
                ctx.restore(); // ボス全体のsaveに対するrestore

                // 警告マーク & リズムサークル描画
                const pattern = BOSS_PATTERNS[boss.currentPattern];
                if (pattern && (boss.state === 'telegraph' || boss.state === 'attack_swing')) {
                    const totalFrames = pattern.telegraphTime + (pattern.attackTime - pattern.hitWindowStart);
                    let elapsed = 0;
                    if (boss.state === 'telegraph') {
                        elapsed = pattern.telegraphTime - boss.stateTimer;
                    } else if (boss.state === 'attack_swing') {
                        elapsed = pattern.telegraphTime + (pattern.attackTime - boss.stateTimer);
                    }
                    const progress = Math.min(1.0, elapsed / totalFrames);
                    
                    if (progress < 1.0) {
                        ctx.save();
                        ctx.translate(boss.x, boss.y);
                        
                        // 頭上「！」警告 (パリィ可否に応じた色)
                        ctx.fillStyle = boss.state === 'telegraph' ? pattern.tellColor : '#ffffff';
                        ctx.font = 'bold 24px Outfit';
                        ctx.textAlign = 'center';
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = pattern.tellColor;
                        ctx.fillText('!', 0, -boss.height - 35);
                        
                        // 収束するダッシュリング
                        const radius = 55 * (1 - progress) + 12;
                        let ringRgb = '255, 0, 85'; // 赤（デフォルト）
                        if (pattern.tellColor === '#ffd700') {
                            ringRgb = '255, 215, 0'; // 黄
                        } else if (pattern.tellColor === '#0088ff') {
                            ringRgb = '0, 136, 255'; // 青
                        }
                        ctx.strokeStyle = `rgba(${ringRgb}, ${0.35 + progress * 0.45})`;
                        ctx.lineWidth = 2.5 - progress * 1.0;
                        ctx.setLineDash([4, 2]);
                        ctx.beginPath();
                        ctx.arc(0, -boss.height / 2, radius, 0, Math.PI * 2);
                        ctx.stroke();
                        
                        // 内側同心円
                        ctx.setLineDash([]);
                        ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + progress * 0.15})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.arc(0, -boss.height / 2, radius - 4, 0, Math.PI * 2);
                        ctx.stroke();

                        ctx.restore();
                    } else if (boss.state === 'attack_swing' && boss.stateTimer >= pattern.hitWindowStart - 2) {
                        // ジャストタイミングの一瞬の閃光円
                        ctx.save();
                        ctx.translate(boss.x, boss.y);
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 4;
                        ctx.shadowBlur = 20;
                        ctx.shadowColor = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(0, -boss.height / 2, 12, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                    }
                }
                ctx.restore();

                // ボス前面のヘックスシールド描画
                if (boss.shieldPulse > 0) {
                    drawHexShield(boss.x, boss.y, boss.shieldPulse, boss.shieldPulseColor);
                }

                // 3. プレイヤー描画
                player.shadows.forEach(sh => {
                    drawPlayer(sh.x, sh.y, player.direction, 'dash', 0, sh.alpha, true);
                });
                drawPlayer(player.x, player.y, player.direction, player.state, player.stateTimer, 1.0, false);

                // パリィ反撃可能状態のインジケータ表示（プレイヤーの頭上に点滅表示）
                if (player.parryCounterAvailable) {
                    ctx.save();
                    ctx.translate(player.x, player.y - player.height - 25);
                    const glow = Math.sin(Date.now() / 80) * 0.15 + 0.85;
                    ctx.fillStyle = `rgba(0, 229, 255, ${glow})`;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#00e5ff';
                    ctx.font = 'bold 11px Outfit';
                    ctx.textAlign = 'center';
                    ctx.fillText('L [PARRY COUNTER]', 0, 0);
                    ctx.restore();
                }

                // 4. デバッグ当たり判定表示
                if (debugMode) {
                    // プレイヤーの本体・攻撃
                    ctx.save();
                    ctx.translate(player.x, player.y);
                    ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(-player.width/2, -player.height, player.width, player.height);
                    if (player.attackActive) {
                        ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
                        ctx.fillRect(player.direction === 1 ? -10 : -100, -player.height, 110, player.height);
                    }
                    ctx.restore();

                    // ボスの本体・攻撃
                    ctx.save();
                    ctx.translate(boss.x, boss.y);
                    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(-boss.width/2, -boss.height, boss.width, boss.height);
                    if (boss.attackActive) {
                        const reach = boss.currentPattern === 'thrust' ? 300 : (boss.currentPattern === 'slash' ? 250 : 180);
                        ctx.fillStyle = 'rgba(255, 0, 85, 0.2)';
                        ctx.fillRect(boss.facing === 1 ? -10 : -reach, -boss.height, reach + 10, boss.height);
                    }
                    ctx.restore();
                }

                // 3. 致命の斬撃エフェクト
                slashWaves.forEach(sw => {
                    ctx.save();
                    ctx.translate(sw.x, sw.y);
                    ctx.scale(player.direction, 1);
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = '#ff0055';
                    ctx.strokeStyle = '#ff0055';
                    ctx.lineWidth = 6;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    // 正面方向に描き、scaleで自動反転
                    ctx.arc(-40, 40, 75, -Math.PI*0.2, Math.PI*0.2);
                    ctx.stroke();
                    ctx.restore();
                });

                // 4. パーティクル
                particles.forEach(p => {
                    ctx.save();
                    ctx.globalAlpha = p.alpha;
                    ctx.shadowBlur = 6;
                    ctx.shadowColor = p.color;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
                    ctx.fill();
                    ctx.restore();
                });

                ctx.restore(); 

                // ビネット効果（カメラ適用外の最前面オーバーレイ）
                if (vignetteOpacity > 0) {
                    ctx.save();
                    let grad = ctx.createRadialGradient(
                        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.35,
                        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.65
                    );
                    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
                    let baseColor = vignetteColor.substring(0, vignetteColor.lastIndexOf(','));
                    let colorWithAlpha = `${baseColor}, ${vignetteOpacity})`;
                    grad.addColorStop(1, colorWithAlpha);
                    
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                    ctx.restore();
                }

                // 5. UI
                // ------------------ PLAYER HUD (LUNAIRE) ------------------
                // Draw avatar portrait (画像アセット版)
                ctx.save();
                ctx.beginPath();
                ctx.arc(55, 60, 24, 0, Math.PI*2);
                ctx.clip();
                if (IMAGES['lunaire_face'] && assetsLoaded === totalAssets) {
                    ctx.drawImage(IMAGES['lunaire_face'], 31, 36, 48, 48);
                } else {
                    ctx.fillStyle = '#0a081a';
                    ctx.fillRect(30, 35, 50, 50);
                }
                ctx.restore();
                
                // Draw portrait border
                ctx.strokeStyle = '#cc00ff';
                ctx.lineWidth = 2.5;
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#cc00ff';
                ctx.beginPath();
                ctx.arc(55, 60, 24, 0, Math.PI*2);
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Draw Name Tag
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 11px Outfit';
                ctx.fillText("LUNAIRE", 96, 36);

                // Draw Hearts for HP (Max 1000 HP, 5 hearts, each 200 HP)
                let hHp = player.hp;
                let hLag = player.lagHp;
                
                for (let i = 0; i < 5; i++) {
                    let heartX = 104 + i * 22;
                    let heartY = 48;
                    let size = 7;
                    
                    // HP ranges
                    let actualFill = Math.max(0, Math.min(1.0, (hHp - i * 200) / 200));
                    let lagFill = Math.max(0, Math.min(1.0, (hLag - i * 200) / 200));
                    
                    ctx.save();
                    ctx.translate(heartX, heartY);
                    
                    // Empty heart path outline
                    function pathHeartOutline(s) {
                        ctx.beginPath();
                        ctx.moveTo(0, -s * 0.3);
                        ctx.bezierCurveTo(-s * 0.5, -s * 0.8, -s * 1.0, -s * 0.3, -s * 1.0, s * 0.15);
                        ctx.bezierCurveTo(-s * 1.0, s * 0.6, -s * 0.3, s * 0.8, 0, s * 1.15);
                        ctx.bezierCurveTo(s * 0.3, s * 0.8, s * 1.0, s * 0.6, s * 1.0, s * 0.15);
                        ctx.bezierCurveTo(s * 1.0, -s * 0.3, s * 0.5, -s * 0.8, 0, -s * 0.3);
                        ctx.closePath();
                    }
                    
                    // Draw base glow
                    ctx.shadowBlur = 6;
                    ctx.shadowColor = '#ff0077';
                    ctx.fillStyle = 'rgba(255, 0, 119, 0.1)';
                    pathHeartOutline(size);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255, 0, 119, 0.35)';
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                    
                    // Draw Lag (dark crimson)
                    if (lagFill > 0) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(-size * 1.1, size * 1.2 - (lagFill * size * 2.2), size * 2.2, size * 2.2);
                        ctx.clip();
                        pathHeartOutline(size);
                        ctx.fillStyle = '#b91c1c';
                        ctx.fill();
                        ctx.restore();
                    }
                    
                    // Draw Actual HP (bright neon pink)
                    if (actualFill > 0) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(-size * 1.1, size * 1.2 - (actualFill * size * 2.2), size * 2.2, size * 2.2);
                        ctx.clip();
                        pathHeartOutline(size);
                        ctx.fillStyle = '#ff0077';
                        ctx.fill();
                        // White reflection shine
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                        ctx.restore();
                    }
                    ctx.restore();
                }

                // Draw Capsule-Segmented Stamina Bar (5 capsules, each 20 stamina)
                for (let c = 0; c < 5; c++) {
                    let capX = 96 + c * 18;
                    let capY = 62;
                    let capW = 14;
                    let capH = 7;
                    let rx = 3;
                    
                    let fill = Math.max(0, Math.min(1.0, (player.stamina - c * 20) / 20));
                    
                    ctx.save();
                    // Draw slot background
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.lineWidth = 1;
                    
                    // Round rect path helper
                    function pathRoundRect(x, y, w, h, r) {
                        ctx.beginPath();
                        ctx.moveTo(x + r, y);
                        ctx.arcTo(x + w, y, x + w, y + h, r);
                        ctx.arcTo(x + w, y + h, x, y + h, r);
                        ctx.arcTo(x, y + h, x, y, r);
                        ctx.arcTo(x, y, x + w, y, r);
                        ctx.closePath();
                    }
                    
                    pathRoundRect(capX, capY, capW, capH, rx);
                    ctx.fill();
                    ctx.stroke();
                    
                    if (fill > 0) {
                        // Draw fill
                        ctx.shadowBlur = 8;
                        let capColor = '#ffd700';
                        if (player.stamina < 30) {
                            let flash = Math.sin(Date.now() / 40) > 0;
                            capColor = flash ? '#ff0055' : '#ffd700';
                        }
                        ctx.shadowColor = capColor;
                        ctx.fillStyle = capColor;
                        
                        // Clip path for partial fill
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(capX, capY, capW * fill, capH);
                        ctx.clip();
                        
                        pathRoundRect(capX, capY, capW, capH, rx);
                        ctx.fill();
                        ctx.restore();
                    }
                    ctx.restore();
                }

                // ------------------ BOSS HUD (RIGHT SIDE) ------------------
                const config = BOSS_ARCHETYPES[boss.archetype];
                
                // Segmented Boss HP bar background
                ctx.fillStyle = 'rgba(255,255,255,0.04)';
                ctx.fillRect(CANVAS_WIDTH - 350, 40, 300, 12);
                
                // Boss HP Lag bar
                ctx.fillStyle = '#991b1b';
                ctx.fillRect(CANVAS_WIDTH - 350, 40, (boss.lagHp / boss.maxHp) * 300, 12);
                
                // Boss HP Real bar
                ctx.fillStyle = config.eyeColor; // Neon purple or pink matching boss archetype eyeColor
                ctx.shadowBlur = 10;
                ctx.shadowColor = config.eyeColor;
                ctx.fillRect(CANVAS_WIDTH - 350, 40, (boss.hp / boss.maxHp) * 300, 12);
                ctx.shadowBlur = 0;
                
                ctx.strokeStyle = 'rgba(255,255,255,0.15)';
                ctx.lineWidth = 1;
                ctx.strokeRect(CANVAS_WIDTH - 350, 40, 300, 12);
                
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 9px Outfit';
                ctx.fillText(config.name.toUpperCase() + " (BOSS)", CANVAS_WIDTH - 350, 32);

                // Boss Posture (segmented or sleek neon orange/yellow)
                ctx.fillStyle = 'rgba(255,255,255,0.03)';
                ctx.fillRect(CANVAS_WIDTH - 350, 56, 300, 5);
                ctx.fillStyle = boss.state === 'stun' ? '#00e5ff' : '#ffd700';
                ctx.fillRect(CANVAS_WIDTH - 350, 56, (boss.posture / boss.maxPosture) * 300, 5);
                ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                ctx.strokeRect(CANVAS_WIDTH - 350, 56, 300, 5);

                if (slowMoTimer > 0) {
                    ctx.fillStyle = 'rgba(0, 229, 255, 0.03)';
                    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                    ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                }

                // 操作デバッグ案内UI
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.font = '11px Outfit';
                ctx.textAlign = 'right';
                ctx.fillText("[T]キーで判定表示を切替", CANVAS_WIDTH - 50, 25);
            }

            // メインループ
            function loop() {
                update();
                draw();
                requestAnimationFrame(loop);
            }

            // 開始
            loop();
        });