(function (root, factory) {
  'use strict';
  const audio = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = audio;
  if (root) root.GameAudio = audio;
})(typeof window === 'object' ? window : null, function (root) {
  'use strict';

  const STORE_KEY = 'slow-growing-bgm';
  const styles = [
    { id: 'white', name: '白噪音' },
    { id: 'rain', name: '雨声' },
    { id: 'wave', name: '海浪' },
    { id: 'music', name: '八音盒' },
    { id: 'forest', name: '森林晨间' }
  ];
  const styleIds = styles.map(s => s.id);
  const DEFAULT = { enabled: false, style: 'rain', volume: 0.6 };

  function validatePref(raw) {
    const p = { ...DEFAULT };
    if (raw && typeof raw === 'object') {
      if (typeof raw.enabled === 'boolean') p.enabled = raw.enabled;
      if (styleIds.includes(raw.style)) p.style = raw.style;
      const v = Number(raw.volume);
      if (Number.isFinite(v)) p.volume = Math.min(1, Math.max(0, v));
    }
    return p;
  }

  function shouldPlay(pref, careRunning) {
    return !!(pref && pref.enabled && careRunning);
  }

  let pref = validatePref(null);
  let ctx = null;
  let master = null;
  let current = null;
  let ok = true;

  function readStore() {
    try {
      const raw = root.localStorage ? root.localStorage.getItem(STORE_KEY) : null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeStore() {
    try {
      if (root.localStorage) root.localStorage.setItem(STORE_KEY, JSON.stringify(pref));
      return true;
    } catch {
      return false;
    }
  }

  function loadPref() {
    pref = validatePref(readStore());
    return pref;
  }

  function fade(gain, to, seconds) {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, to), t + seconds);
  }

  function teardown(c, fadeSeconds) {
    if (!c) return;
    (c.timers || []).forEach(clearTimeout);
    try { fade(c.bus, 0.0001, fadeSeconds); } catch { /* handled below */ }
    setTimeout(() => {
      try {
        c.sources.forEach(s => { try { s.stop(); } catch { /* already stopped */ } });
        c.bus.disconnect();
      } catch { /* node already released */ }
    }, fadeSeconds * 1000 + 120);
  }

  function noiseBuffer(kind) {
    const rate = ctx.sampleRate;
    const len = rate * 2;
    const buffer = ctx.createBuffer(1, len, rate);
    const data = buffer.getChannelData(0);
    if (kind === 'white') {
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } else if (kind === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
    }
    return buffer;
  }

  function noiseSource(kind) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(kind);
    src.loop = true;
    return src;
  }

  function lfo(hz, depth, param) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = hz;
    gain.gain.value = depth;
    osc.connect(gain);
    gain.connect(param);
    return osc;
  }

  const builders = {
    white(bus, sources) {
      const src = noiseSource('white');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5000;
      const gain = ctx.createGain();
      gain.gain.value = 0.12;
      src.connect(lp); lp.connect(gain); gain.connect(bus);
      sources.push(src);
      src.start();
    },
    rain(bus, sources) {
      const src = noiseSource('pink');
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 400;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1500;
      const gain = ctx.createGain();
      gain.gain.value = 0.4;
      src.connect(hp); hp.connect(lp); lp.connect(gain); gain.connect(bus);
      sources.push(src, lfo(0.11, 0.1, gain.gain));
      src.start();
      sources[sources.length - 1].start();
    },
    wave(bus, sources) {
      const src = noiseSource('brown');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500;
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      src.connect(lp); lp.connect(gain); gain.connect(bus);
      sources.push(src, lfo(0.07, 0.42, gain.gain));
      src.start();
      sources[sources.length - 1].start();
    },
    music(bus, sources, timers) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.42;
      const fb = ctx.createGain();
      fb.gain.value = 0.3;
      delay.connect(fb); fb.connect(delay); delay.connect(bus);
      const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
      let step = 3;
      function pluck() {
        const t = ctx.currentTime;
        step = Math.max(0, Math.min(notes.length - 1, step + Math.floor(Math.random() * 3) - 1));
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = notes[step];
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8 + Math.random() * 0.7);
        osc.connect(g); g.connect(bus); g.connect(delay);
        osc.start(t);
        osc.stop(t + 2.8);
        timers.push(setTimeout(pluck, 1200 + Math.random() * 1200));
      }
      pluck();
    },
    forest(bus, sources, timers) {
      const wind = noiseSource('pink');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 400;
      const gain = ctx.createGain();
      gain.gain.value = 0.06;
      wind.connect(lp); lp.connect(gain); gain.connect(bus);
      sources.push(wind, lfo(0.05, 0.03, gain.gain));
      wind.start();
      sources[sources.length - 1].start();
      function chirp() {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const base = 2200 + Math.random() * 1800;
        osc.frequency.setValueAtTime(base, t);
        osc.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), t + 0.08);
        osc.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.16);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        let pan = null;
        osc.connect(g);
        if (ctx.createStereoPanner) { pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan); pan.connect(bus); }
        else g.connect(bus);
        osc.start(t);
        osc.stop(t + 0.3);
        timers.push(setTimeout(chirp, 2000 + Math.random() * 4000));
      }
      chirp();
    }
  };

  function ensureCtx() {
    if (!ok) return false;
    try {
      if (!ctx) {
        const Ctor = root.AudioContext || root.webkitAudioContext;
        if (!Ctor) { ok = false; return false; }
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = pref.volume * 0.5;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') {
        const resume = ctx.resume();
        if (resume && typeof resume.catch === 'function') resume.catch(() => {});
      }
      return true;
    } catch {
      ok = false;
      return false;
    }
  }

  function build(styleId) {
    const bus = ctx.createGain();
    bus.gain.value = 0.0001;
    bus.connect(master);
    const sources = [];
    const timers = [];
    builders[styleId](bus, sources, timers);
    return { bus, sources, timers };
  }

  function play() {
    if (!shouldPlay(pref, true)) return false;
    if (current && current.styleId === pref.style) return true;
    if (!ensureCtx()) return false;
    if (current) teardown(current, 0.4);
    try {
      current = build(pref.style);
      current.styleId = pref.style;
      fade(current.bus, 1, 0.8);
      return true;
    } catch {
      current = null;
      ok = false;
      return false;
    }
  }

  function stop() {
    if (!current) return;
    teardown(current, 1);
    current = null;
  }

  function setEnabled(value) {
    pref.enabled = !!value;
    return writeStore();
  }

  function setStyle(id) {
    if (!styleIds.includes(id)) return false;
    pref.style = id;
    if (current && current.styleId !== id) {
      teardown(current, 0.4);
      current = null;
      if (ensureCtx()) {
        try {
          current = build(id);
          current.styleId = id;
          fade(current.bus, 1, 0.6);
        } catch {
          current = null;
          ok = false;
        }
      }
    }
    return writeStore();
  }

  function setVolume(value) {
    const v = Number(value);
    pref.volume = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT.volume;
    if (ctx && master) {
      try { fade(master, pref.volume * 0.5, 0.2); } catch { /* keep previous level */ }
    }
    return writeStore();
  }

  function stylesHtml(selected) {
    return styles.map(s => `<option value="${s.id}"${s.id === selected ? ' selected' : ''}>${s.name}</option>`).join('');
  }

  return Object.freeze({
    styles, validatePref, shouldPlay, loadPref, play, stop,
    setEnabled, setStyle, setVolume, stylesHtml,
    get pref() { return validatePref(pref); },
    get active() { return !!current; },
    get ok() { return ok; }
  });
});
