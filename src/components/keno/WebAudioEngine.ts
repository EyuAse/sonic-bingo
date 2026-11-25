/**
 * Atlas-V Fast Keno - Zero-Bandwidth Web Audio API Sound Engine
 * Synthesizes all casino SFX locally in browser RAM (0 KB external download)
 * 100% Ship-Ready for Sonic Bingo (src/services/kenoAudioEngine.ts)
 */

export class WebAudioEngine {
  private static instance: WebAudioEngine | null = null;
  private ctx: AudioContext | null = null;
  // Permanently muted per user requirement (All Keno audio disabled; Bingo audio 100% preserved)
  private isMuted: boolean = true;
  public static readonly MASTER_KENO_MUTE: boolean = true;

  private constructor() {
    // Keno audio is permanently disabled
  }

  public static getInstance(): WebAudioEngine {
    if (!WebAudioEngine.instance) {
      WebAudioEngine.instance = new WebAudioEngine();
    }
    return WebAudioEngine.instance;
  }

  private initContext(): AudioContext | null {
    if (WebAudioEngine.MASTER_KENO_MUTE || this.isMuted) return null;
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    } catch {
      // AudioContext unavailable
    }
    return this.ctx;
  }

  public resume(): void {
    // No-op: Keno audio disabled
  }

  public toggleMute(): boolean {
    return true; // Always muted
  }

  public setMuted(_muted: boolean): void {
    this.isMuted = true; // Always muted
  }

  /**
   * Snappy mechanical clock tick during final 3 seconds - MUTED
   */
  public playTick(): void {
    // Disabled
  }

  /**
   * Snappy ball extraction pop when a ball is launched from the tumbler - MUTED
   */
  public playBallPop(): void {
    // Disabled
  }

  /**
   * Harmonic ascending chime when drawn ball matches player's pick - MUTED
   */
  public playMatchChime(_hitIndex: number = 1): void {
    // Disabled
  }

  /**
   * Celebratory casino fanfare chord for winning rounds - MUTED
   */
  public playWinFanfare(): void {
    // Disabled
  }

  /**
   * Snappy click on chip or button - MUTED
   */
  public playClick(): void {
    // Disabled
  }

  public playChip(): void {
    // Disabled
  }
}

export const kenoAudio = WebAudioEngine.getInstance();

