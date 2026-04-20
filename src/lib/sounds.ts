/**
 * PayWatch Sound Engine — Web Audio API
 * Subtle, premium audio cues for voice calls
 */
class SoundEngine {
  private ctx: AudioContext | null = null;

  private getCtx() {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private playTone(freqs: number[], duration: number, volume = 0.12) {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05);

      const step = duration / freqs.length;
      freqs.forEach((f, i) => {
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * step);
      });

      gain.gain.setValueAtTime(volume, ctx.currentTime + duration - 0.1);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  /** Two ascending notes — call connecting */
  connecting() { this.playTone([523, 659], 0.5, 0.1); }

  /** Quick ascending triad — bill added successfully */
  billAdded() { this.playTone([440, 554, 659], 0.3, 0.1); }

  /** Gentle descending — call ended */
  callEnded() { this.playTone([659, 523], 0.45, 0.08); }

  /** Single soft note — message sent to chat */
  sentToChat() { this.playTone([587], 0.2, 0.06); }

  /** Error — low tone */
  error() { this.playTone([220, 196], 0.4, 0.08); }
}

export const sounds = new SoundEngine();
