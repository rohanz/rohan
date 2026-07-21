// Audio player: one HTMLAudioElement per song, all routed through a single
// AudioContext + AnalyserNode. Context is created/resumed lazily on first
// toggle (autoplay policy). No browser APIs touched at import time.

export function createPlayer(songs) {
  const listeners = [];
  let currentIndex = null;

  let ctx = null;
  let analyser = null;
  let timeData = null;
  let masterGain = null;      // master volume, BEFORE the analyser so viz reacts
  let masterVolume = 1;       // remembered if set before the context exists
  let monoOn = false;
  let dimOn = false;          // -12 dB monitor dim
  let cutOn = false;          // hard mute
  let splitFeed = null;       // forces 2ch so the splitter sees L and R
  let analyserL = null;
  let analyserR = null;
  let timeL = null;
  let timeR = null;
  const gains = [];   // per-song GainNode
  const elements = songs.map((s) => {
    if (typeof Audio === 'undefined') return null;
    const el = new Audio(s.url);
    el.preload = 'metadata';
    return el;
  });

  function emit() {
    for (const cb of listeners) cb(currentIndex);
  }

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      timeData = new Float32Array(analyser.fftSize);
      analyser.connect(ctx.destination);
      // Master gain sits before the analyser: per-song gain -> master ->
      // analyser -> destination, so volume changes show in the visualizations.
      masterGain = ctx.createGain();
      masterGain.gain.value = effectiveGain();
      masterGain.connect(analyser);
      // Stereo metering taps: master -> (explicit 2ch feed) -> splitter ->
      // one analyser per side. Pure taps — nothing here reaches the
      // destination, so they never affect what is heard. The explicit
      // 2-channel feed upmixes a mono master (setMono) so both sides carry
      // the same signal, which is the correct converged reading.
      splitFeed = ctx.createGain();
      splitFeed.channelCount = 2;
      splitFeed.channelCountMode = 'explicit';
      const splitter = ctx.createChannelSplitter(2);
      masterGain.connect(splitFeed);
      splitFeed.connect(splitter);
      analyserL = ctx.createAnalyser();
      analyserR = ctx.createAnalyser();
      analyserL.fftSize = 1024;
      analyserR.fftSize = 1024;
      timeL = new Float32Array(analyserL.fftSize);
      timeR = new Float32Array(analyserR.fftSize);
      splitter.connect(analyserL, 0);
      splitter.connect(analyserR, 1);
      applyMono();
      elements.forEach((el, i) => {
        const src = ctx.createMediaElementSource(el);
        const g = ctx.createGain();
        src.connect(g).connect(masterGain);
        gains[i] = g;
      });
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function stop(i, fade) {
    const el = elements[i];
    const g = gains[i];
    if (fade && g && ctx) {
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.15);
      setTimeout(() => { el.pause(); el.currentTime = 0; }, 170);
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }

  function toggle(i) {
    ensureContext();
    if (currentIndex === i) {
      stop(i, false);
      currentIndex = null;
      emit();
      return;
    }
    if (currentIndex !== null) stop(currentIndex, true);
    currentIndex = i;
    const el = elements[i];
    const g = gains[i];
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.15);
    el.currentTime = 0;
    el.onended = () => {
      if (currentIndex === i) {
        currentIndex = null;
        emit();
      }
    };
    el.play();
    emit();
  }

  // Hard stop from navigation: fade the current song out and notify.
  function stopAll() {
    if (currentIndex === null) return;
    stop(currentIndex, true);
    currentIndex = null;
    emit();
  }

  function current() {
    return currentIndex;
  }

  // Playback position of the current element: { t, dur } in seconds.
  // { t: 0, dur: 0 } when nothing is playing (or duration is unknown).
  function position() {
    if (currentIndex === null) return { t: 0, dur: 0 };
    const el = elements[currentIndex];
    if (!el) return { t: 0, dur: 0 };
    const dur = Number.isFinite(el.duration) ? el.duration : 0;
    return { t: el.currentTime || 0, dur };
  }

  function level() {
    if (currentIndex === null || !analyser) return 0;
    analyser.getFloatTimeDomainData(timeData);
    let sum = 0;
    for (let k = 0; k < timeData.length; k++) sum += timeData[k] * timeData[k];
    const rms = Math.sqrt(sum / timeData.length);
    return Math.min(1, rms * 3); // scale RMS into a useful 0..1 range
  }

  function onChange(cb) {
    listeners.push(cb);
  }

  // Latest time-domain samples (Float32Array, length = fftSize) or null
  // before the AudioContext exists.
  function getTimeDomain() {
    if (!analyser) return null;
    analyser.getFloatTimeDomainData(timeData);
    return timeData;
  }

  let freqData = null;
  // Latest byte frequency data (Uint8Array, length = frequencyBinCount) or
  // null before the AudioContext exists.
  function getFrequency() {
    if (!analyser) return null;
    if (!freqData) freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);
    return freqData;
  }

  // Per-side RMS levels, 0..1 (same scaling as level()). Converges L===R
  // under setMono(true), which is the correct reading.
  function levelLR() {
    if (currentIndex === null || !analyserL) return { l: 0, r: 0 };
    analyserL.getFloatTimeDomainData(timeL);
    analyserR.getFloatTimeDomainData(timeR);
    let sl = 0, sr = 0;
    for (let k = 0; k < timeL.length; k++) {
      sl += timeL[k] * timeL[k];
      sr += timeR[k] * timeR[k];
    }
    return {
      l: Math.min(1, Math.sqrt(sl / timeL.length) * 3),
      r: Math.min(1, Math.sqrt(sr / timeR.length) * 3),
    };
  }

  // Latest per-side time-domain samples, or null before the context exists.
  function getTimeDomainLR() {
    if (!analyserL) return null;
    analyserL.getFloatTimeDomainData(timeL);
    analyserR.getFloatTimeDomainData(timeR);
    return { l: timeL, r: timeR };
  }

  // Composed monitor gain: volume, dim (-12 dB) and cut stack.
  function effectiveGain() {
    return masterVolume * (dimOn ? 0.25 : 1) * (cutOn ? 0 : 1);
  }

  function applyGain() {
    if (!masterGain || !ctx) return;
    const t = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value, t);
    masterGain.gain.linearRampToValueAtTime(effectiveGain(), t + 0.05);
  }

  // Master volume, 0..1. Short ramp to avoid zipper noise. Value is
  // remembered and applied when the context is created if called early.
  function setVolume(v) {
    masterVolume = Math.min(1, Math.max(0, v));
    applyGain();
  }

  // Monitor dim: -12 dB (×0.25) layered under the volume.
  let loopOn = false;
  function setLoop(on) {
    loopOn = !!on;
    elements.forEach((el) => { if (el) el.loop = loopOn; });
  }

  function setDim(on) {
    dimOn = !!on;
    applyGain();
  }

  // Monitor cut: hard mute (×0), layered over volume and dim.
  function setCut(on) {
    cutOn = !!on;
    applyGain();
  }

  // Mono: force the master gain to downmix its input to 1 channel
  // (channelCountMode 'explicit' + channelCount 1 sums L+R per the Web Audio
  // up/down-mix rules); the destination then upmixes that single channel to
  // both speakers, which is audibly mono. Stereo restores 'max' mode.
  function applyMono() {
    if (!masterGain) return;
    if (monoOn) {
      masterGain.channelCount = 1;
      masterGain.channelCountMode = 'explicit';
    } else {
      masterGain.channelCountMode = 'max';
      masterGain.channelCount = 2;
    }
  }

  function setMono(on) {
    monoOn = !!on;
    applyMono();
  }

  // Release the audio graph: pause every element and close the context so a
  // teardown (or the browser's pagehide) doesn't strand a live AudioContext.
  function dispose() {
    for (const el of elements) {
      if (!el) continue;
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    ctx?.close().catch(() => {});
    ctx = null;
  }
  window.addEventListener('pagehide', dispose);

  return {
    toggle, current, position, level, onChange, getTimeDomain, getFrequency,
    setVolume, setMono,
    levelLR, getTimeDomainLR, setDim, setCut, setLoop, stopAll, dispose,
  };
}
