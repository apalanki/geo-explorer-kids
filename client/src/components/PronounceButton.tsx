// PronounceButton.tsx
// A small "🔊 Hear it!" button that speaks a word/phrase aloud.
// Shown next to any geography name that is hard to pronounce.

import { useSpeech } from "@/hooks/useSpeech";

interface PronounceButtonProps {
  word: string;
  /** Optional phonetic hint shown as tooltip / subtitle */
  phonetic?: string;
  size?: "sm" | "md";
}

export default function PronounceButton({ word, phonetic, size = "md" }: PronounceButtonProps) {
  const { speak, speaking, supported } = useSpeech();

  if (!supported) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Speak the phonetic version if provided (better TTS result), else the raw word
    speak(phonetic ?? word, { rate: 0.8 });
  };

  const sizeClasses =
    size === "sm"
      ? "text-xs px-2 py-0.5 gap-1"
      : "text-sm px-3 py-1 gap-1.5";

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        onClick={handleClick}
        title={`Hear how to say "${word}"`}
        className={`inline-flex items-center font-bold rounded-full border-2 transition-all duration-150 select-none
          ${speaking
            ? "bg-blue-500 border-blue-600 text-white scale-95"
            : "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 hover:border-blue-400"
          } ${sizeClasses}`}
        style={{ fontFamily: "'Nunito', sans-serif" }}
      >
        <span className={speaking ? "animate-pulse" : ""}>{speaking ? "🔊" : "🔈"}</span>
        <span>{speaking ? "Playing…" : "Hear it!"}</span>
      </button>
      {phonetic && (
        <span className="text-xs text-gray-400 italic pl-1">{phonetic}</span>
      )}
    </span>
  );
}
