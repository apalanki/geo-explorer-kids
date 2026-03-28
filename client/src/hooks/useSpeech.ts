// useSpeech.ts
// Browser Web Speech API hook for pronouncing geography names.
// Works on Amazon Silk (Fire tablet), Chrome, Safari, Firefox.
//
// Key fix: always speaks the ACTUAL word (not phonetic spelling).
// Picks the clearest available English voice, speaks slowly for kids.

import { useCallback, useEffect, useRef, useState } from "react";

/** Pick the best available English voice for a child to understand */
function pickBestVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Priority order: prefer clear, natural-sounding en-US voices
  const preferred = [
    "Google US English",
    "Microsoft Zira",
    "Microsoft David",
    "Samantha",
    "Karen",
    "Daniel",
    "Alex",
  ];

  for (const name of preferred) {
    const v = voices.find((v) => v.name === name);
if (v) return v;
  }

  // Fall back to any en-US voice
  const enUS = voices.find((v) => v.lang === "en-US");
  if (enUS) return enUS;

  // Fall back to any English voice
  const en = voices.find((v) => v.lang.startsWith("en"));
  if (en) return en;

  return voices[0] ?? null;
}

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  // Track when voices are loaded (async on some browsers)
  const [voicesReady, setVoicesReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);

    // Voices may load asynchronously (especially on Chrome/Silk)
    const loadVoices = () => {
      if (window.speechSynthesis.getVoices().length > 0) {
        setVoicesReady(true);
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback(
    (word: string, _options?: { rate?: number; pitch?: number }) => {
      if (!supported) return;

      // Always cancel any ongoing speech first
      window.speechSynthesis.cancel();

      // Small delay to let cancel() take effect (needed on some browsers)
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(word);

        // Slow, clear rate for a 6-year-old — 0.65 is noticeably slower than normal
        utterance.rate = 0.65;
        utterance.pitch = 1.0;   // neutral pitch — sounds more natural
        utterance.volume = 1.0;
        utterance.lang = "en-US";

        // Pick the best available voice
        if (voicesReady) {
          const best = pickBestVoice();
          if (best) utterance.voice = best;
        }

        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      }, 80);
    },
    [supported, voicesReady]
  );

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { speak, stop, speaking, supported };
}
