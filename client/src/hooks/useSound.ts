// useSound.ts
// Lightweight hook that preloads CDN audio clips and exposes a play() function.
// Uses the Web Audio API for low-latency playback on tablets.
// Silently no-ops if the browser blocks autoplay or the fetch fails.

import { useEffect, useRef } from "react";

const CORRECT_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663316541527/CaP4ZSUWoQ6JEAwnCo6XnP/correct_d10384a0.wav";
const WRONG_URL   = "https://d2xsxph8kpxj0f.cloudfront.net/310519663316541527/CaP4ZSUWoQ6JEAwnCo6XnP/wrong_7e06a517.wav";

type SoundKey = "correct" | "wrong";

async function fetchBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  } catch {
    return null;
  }
}

export function useSound() {
  const ctxRef    = useRef<AudioContext | null>(null);
  const buffers   = useRef<Record<SoundKey, AudioBuffer | null>>({ correct: null, wrong: null });
  const loaded    = useRef(false);

  // Preload both clips lazily on first user interaction
  const ensureLoaded = async () => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const [c, w] = await Promise.all([
        fetchBuffer(ctx, CORRECT_URL),
        fetchBuffer(ctx, WRONG_URL),
      ]);
      buffers.current.correct = c;
      buffers.current.wrong   = w;
    } catch {
      // silently ignore — sound is enhancement only
    }
  };

  useEffect(() => {
    // Preload on mount (browsers may defer until user gesture)
    ensureLoaded();
    return () => {
      ctxRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = async (key: SoundKey, volume = 0.7) => {
    await ensureLoaded();
    const ctx = ctxRef.current;
    const buf = buffers.current[key];
    if (!ctx || !buf) return;
    try {
      if (ctx.state === "suspended") await ctx.resume();
      const src  = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = volume;
      src.buffer = buf;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch {
      // ignore playback errors
    }
  };

  return { play };
}
