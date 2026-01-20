import { useEffect, useMemo } from 'react';
import './RarityCelebration.css';

const PARTICLE_COUNT = 18;

const getToneForTier = (tier) => {
  if (tier === 'legendary') return { type: 'triangle', freq: 880, duration: 0.28 };
  if (tier === 'epic') return { type: 'sine', freq: 660, duration: 0.22 };
  return null;
};

const playTone = (tier) => {
  if (typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const tone = getToneForTier(tier);
  if (!tone) return;

  try {
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = tone.type;
    oscillator.frequency.value = tone.freq;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + tone.duration);
    oscillator.onended = () => {
      ctx.close().catch(() => null);
    };
  } catch (err) {
    // Ignore audio failures (autoplay restrictions, etc.)
  }
};

export default function RarityCelebration({ tier, stamp, onComplete }) {
  const particles = useMemo(
    () => Array.from({ length: PARTICLE_COUNT }, (_, idx) => idx),
    []
  );

  useEffect(() => {
    if (!tier) return undefined;
    playTone(tier);
    const timer = setTimeout(() => {
      onComplete?.();
    }, 1400);
    return () => clearTimeout(timer);
  }, [tier, stamp, onComplete]);

  if (!tier) return null;

  return (
    <div className={`rarity-celebration rarity-${tier}`} aria-hidden="true">
      <div className="rarity-burst">
        {particles.map((idx) => (
          <span key={`${tier}-${stamp}-${idx}`} className="rarity-particle" />
        ))}
      </div>
      <div className="rarity-wave" />
    </div>
  );
}
