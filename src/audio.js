export class Soundscape {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.nextMusic = 0;
    this.noteIndex = 0;
    this.lastStep = 0;
    this.waterStep = -1;
    this.lastVoice = 0;
  }
  async start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.ambience = this.ctx.createGain();
      this.ambience.gain.value = 0.035;
      this.ambience.connect(this.master);
      const buffer = this.ctx.createBuffer(
          1,
          this.ctx.sampleRate * 4,
          this.ctx.sampleRate,
        ),
        data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + Math.random() * 0.035 - 0.0175) * 0.993;
        data[i] = last;
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 620;
      source.connect(filter).connect(this.ambience);
      source.start();
      this.splashBuffer = this.ctx.createBuffer(
        1,
        Math.floor(this.ctx.sampleRate * 0.32),
        this.ctx.sampleRate,
      );
      const splash = this.splashBuffer.getChannelData(0);
      for (let i = 0; i < splash.length; i++) splash[i] = Math.random() * 2 - 1;
      // Load once after the audio gesture; quiet noise covers the brief download.
      this.waterReady = fetch(
        new URL('./assets/water-steps.wav', import.meta.url),
      )
        .then((response) => {
          if (!response.ok) throw new Error('Water audio unavailable');
          return response.arrayBuffer();
        })
        .then((bytes) => this.ctx.decodeAudioData(bytes))
        .then((buffer) => {
          this.waterBuffer = buffer;
        })
        .catch(() => {});
      this.nextMusic = this.ctx.currentTime + 0.5;
    }
    await this.ctx.resume();
    this.apply();
  }
  apply() {
    if (this.master)
      this.master.gain.setTargetAtTime(
        this.settings.sound ? this.settings.volume * 0.65 : 0,
        this.ctx.currentTime,
        0.08,
      );
  }
  tone(freq, duration = 0.4, volume = 0.1, type = 'sine', delay = 0) {
    if (!this.ctx || !this.settings.sound) return;
    const now = this.ctx.currentTime + delay,
      osc = this.ctx.createOscillator(),
      gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }
  success() {
    [523.25, 659.25, 783.99, 1046.5].forEach((n, i) =>
      this.tone(n, 0.8, 0.09, 'sine', i * 0.12),
    );
  }
  fail() {
    this.tone(220, 0.22, 0.06, 'sine');
    this.tone(196, 0.35, 0.055, 'sine', 0.12);
  }
  pickup() {
    this.tone(880, 0.4, 0.055);
    this.tone(1174.66, 0.5, 0.04, 'sine', 0.08);
  }
  voice(penguin = false) {
    if (!this.ctx || this.ctx.currentTime - this.lastVoice < 0.085) return;
    this.lastVoice = this.ctx.currentTime;
    this.tone(
      (penguin ? 360 : 490) + Math.random() * 150,
      0.075,
      0.033,
      'sine',
    );
  }
  footstep(wading = false, sprint = false) {
    if (
      !this.ctx ||
      !this.settings.sound ||
      this.ctx.currentTime - this.lastStep < (sprint ? 0.23 : 0.3)
    )
      return;
    this.lastStep = this.ctx.currentTime;
    if (wading) {
      const now = this.ctx.currentTime,
        source = this.ctx.createBufferSource(),
        filter = this.ctx.createBiquadFilter(),
        gain = this.ctx.createGain();
      const recorded = !!this.waterBuffer,
        rate = 0.96 + Math.random() * 0.08,
        duration = recorded ? 0.48 / rate : 0.3;
      source.buffer = this.waterBuffer || this.splashBuffer;
      source.playbackRate.value = recorded ? rate : 1;
      filter.type = 'lowpass';
      filter.Q.value = 0.5;
      filter.frequency.value = recorded ? 5500 : 1100;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(recorded ? 0.22 : 0.045, now + 0.012);
      gain.gain.setValueAtTime(recorded ? 0.22 : 0.045, now + duration * 0.65);
      gain.gain.linearRampToValueAtTime(0, now + duration);
      source.connect(filter).connect(gain).connect(this.master);
      // Four different splashes, never the same one twice in a row.
      this.waterStep = (this.waterStep + 1 + Math.floor(Math.random() * 3)) % 4;
      source.start(now, recorded ? this.waterStep * 0.5 : 0);
      source.stop(now + duration);
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      return;
    }
    this.tone(100 + Math.random() * 30, 0.055, 0.025, 'triangle');
  }
  update() {
    if (!this.ctx || !this.settings.music || !this.settings.sound) return;
    const now = this.ctx.currentTime;
    if (now > this.nextMusic) {
      const melody = [
        392, 493.88, 587.33, 740, 659.25, 587.33, 493.88, 440, 392, 329.63, 392,
        493.88, 440, 392, 329.63, 293.66,
      ];
      const i = this.noteIndex++ % melody.length;
      this.tone(melody[i], 2.5, 0.039);
      this.tone(melody[i] * 2, 1, 0.006);
      if (i % 4 === 0) {
        this.tone([196, 164.81, 146.83, 164.81][Math.floor(i / 4)], 4, 0.04);
        this.tone([293.66, 246.94, 220, 246.94][Math.floor(i / 4)], 3, 0.017);
      }
      this.nextMusic = now + 1.3 + (i % 4 === 3 ? 0.7 : 0);
    }
  }
  suspend() {
    this.ctx?.suspend();
  }
  resume() {
    this.ctx?.resume();
  }
}
