/**
 * Signal quality calculation utilities
 */

export function dbmToPercent(dbm: number): number {
  if (dbm >= -50) return 100;
  if (dbm <= -100) return 0;
  return Math.round(2 * (dbm + 100));
}

export interface SignalStatus {
  percent: number;
  label: 'Отличный' | 'Хороший' | 'Удовлетворительный' | 'Слабый' | 'Критический';
  color: string;
  badgeBg: string;
  badgeText: string;
  description: string;
}

export function getSignalStatus(dbm: number): SignalStatus {
  const percent = dbmToPercent(dbm);

  if (dbm >= -55) {
    return {
      percent,
      label: 'Отличный',
      color: '#10b981', // emerald-500
      badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
      badgeText: 'text-emerald-600 dark:text-emerald-400',
      description: 'Максимальная скорость, минимальный пинг. Идеально для 4K/8K и киберспорта.',
    };
  }

  if (dbm >= -67) {
    return {
      percent,
      label: 'Хороший',
      color: '#06b6d4', // cyan-500
      badgeBg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400',
      badgeText: 'text-cyan-600 dark:text-cyan-400',
      description: 'Стандарт для качественного видеостриминга (1080p/4K) и видеозвонков Zoom/Teams.',
    };
  }

  if (dbm >= -75) {
    return {
      percent,
      label: 'Удовлетворительный',
      color: '#f59e0b', // amber-500
      badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
      badgeText: 'text-amber-600 dark:text-amber-400',
      description: 'Серфинг и почта работают нормально, но при скачивании или играх возможен джиттер.',
    };
  }

  if (dbm >= -85) {
    return {
      percent,
      label: 'Слабый',
      color: '#f97316', // orange-500
      badgeBg: 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400',
      badgeText: 'text-orange-600 dark:text-orange-400',
      description: 'Нестабильная связь, пакеты могут теряться. Рекомендуется репитер или сдвинуть роутер.',
    };
  }

  return {
    percent,
    label: 'Критический',
    color: '#ef4444', // red-500
    badgeBg: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
    badgeText: 'text-red-600 dark:text-red-400',
    description: 'На грани разрыва соединения. Мертвая зона для Wi-Fi.',
  };
}

/**
 * Free-Space Path Loss approximate distance in meters
 */
export function estimateDistanceMeters(dbm: number, freqMHz: number = 2412): number {
  if (dbm >= -30) return 0.5;
  // Free space formula: FSPL(dB) = 20log10(d) + 20log10(f) - 27.55
  // Indoor exponent ~2.8 to 3.2 due to walls
  const exp = 3.0;
  const ratio = (-35 - dbm) / (10 * exp);
  const distance = Math.pow(10, ratio);
  return Math.max(0.5, Math.round(distance * 10) / 10);
}

/**
 * Audio beep feedback using Web Audio API for signal walking locator
 */
let audioCtx: AudioContext | null = null;
export function playSignalBeep(dbm: number) {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    // Map dBm (-90 to -35) to frequency (300Hz to 1200Hz)
    const norm = Math.max(0, Math.min(1, (dbm + 90) / 55));
    const freq = 350 + norm * 850;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch {
    // Ignore audio autoplay restrictions
  }
}
