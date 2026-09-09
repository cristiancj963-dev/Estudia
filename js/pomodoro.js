/**
 * CRONÓMETRO POMODORO DE ALTO RENDIMIENTO
 * 35 Minutos de Enfoque Profundo + Alerta en Pico de Rendimiento + Web Audio API
 */

class PomodoroTimer {
  constructor(options = {}) {
    this.focusDuration = options.focusDuration || 35 * 60; // 35 min
    this.breakDuration = options.breakDuration || 5 * 60;   // 5 min
    this.timeRemaining = this.focusDuration;
    this.mode = "focus"; // "focus" | "break"
    this.isRunning = false;
    this.timerId = null;
    this.peakNotified = false;

    this.onTick = options.onTick || (() => {});
    this.onModeChange = options.onModeChange || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onPeak = options.onPeak || (() => {});

    // Audio context sintético (sin archivos externos)
    this.audioCtx = null;
  }

  initAudio() {
    if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
  }

  playTone(freq = 440, type = "sine", duration = 0.15, vol = 0.1) {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Audio not supported or blocked", e);
    }
  }

  playPeakAlert() {
    this.playTone(587.33, "sine", 0.15); // D5
    setTimeout(() => this.playTone(880, "sine", 0.25), 180); // A5
  }

  playFinishChime() {
    this.playTone(523.25, "triangle", 0.2); // C5
    setTimeout(() => this.playTone(659.25, "triangle", 0.2), 200); // E5
    setTimeout(() => this.playTone(783.99, "triangle", 0.3), 400); // G5
  }

  start() {
    if (this.isRunning) return;
    this.initAudio();
    this.isRunning = true;
    this.playTone(520, "sine", 0.1);

    this.timerId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    clearInterval(this.timerId);
    this.timerId = null;
    this.onTick(this.getTimeData());
  }

  toggle() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  }

  reset() {
    this.pause();
    this.mode = "focus";
    this.timeRemaining = this.focusDuration;
    this.peakNotified = false;
    this.onTick(this.getTimeData());
    this.onModeChange(this.mode);
  }

  tick() {
    if (this.timeRemaining > 0) {
      this.timeRemaining--;

      // Alerta de pico de rendimiento a los 30 minutos (cuando quedan 5 minutos de foco)
      if (this.mode === "focus" && this.timeRemaining === 5 * 60 && !this.peakNotified) {
        this.peakNotified = true;
        this.playPeakAlert();
        this.onPeak();
      }

      this.onTick(this.getTimeData());
    } else {
      this.completeSession();
    }
  }

  completeSession() {
    this.pause();
    this.playFinishChime();

    if (this.mode === "focus") {
      this.mode = "break";
      this.timeRemaining = this.breakDuration;
      this.peakNotified = false;
      this.onComplete("focus");
    } else {
      this.mode = "focus";
      this.timeRemaining = this.focusDuration;
      this.peakNotified = false;
      this.onComplete("break");
    }
    this.onModeChange(this.mode);
    this.onTick(this.getTimeData());
  }

  getTimeData() {
    const minutes = Math.floor(this.timeRemaining / 60);
    const seconds = this.timeRemaining % 60;
    const totalDuration = this.mode === "focus" ? this.focusDuration : this.breakDuration;
    const progress = ((totalDuration - this.timeRemaining) / totalDuration) * 100;

    return {
      minutes,
      seconds,
      formatted: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      timeRemaining: this.timeRemaining,
      progress,
      mode: this.mode,
      isRunning: this.isRunning
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PomodoroTimer };
}
