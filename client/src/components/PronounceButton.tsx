// PronounceButton.tsx
// A "🔊 Hear it!" button that speaks the ACTUAL word aloud — slowly and clearly.
// The phonetic spelling (e.g. "suh-HAR-uh") is shown as a VISUAL guide only,
// never passed to the speech engine (which would spell it out letter-by-letter).

import { useSpeech } from "@/hooks/useSpeech";

interface PronounceButtonProps {
  /** The real word to speak aloud, e.g. "Sahara Desert" */
  word: string;
  /** Optional phonetic guide shown visually below the button, e.g. "suh-HAR-uh" */
  phonetic?: string;
  size?: "sm" | "md";
}

export default function PronounceButton({ word, phonetic, size = "md" }: PronounceButtonProps) {
  const { speak, speaking, supported } = useSpeech();

  if (!supported) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // ALWAYS speak the actual word — never the phonetic spelling
    speak(word);
  };

  const sizeClasses =
    size === "sm"
      ? "text-xs px-2.5 py-1 gap-1 min-h-[36px]"
      : "text-sm px-4 py-2 gap-1.5 min-h-[44px]";

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleClick}
        title={`Tap to hear how to say "${word}"`}
        className={`inline-flex items-center font-bold rounded-full border-2 transition-all duration-150 select-none active:scale-95
          ${speaking
            ? "bg-blue-500 border-blue-600 text-white"
            : "bg-blue-50 border-blue-300 text-blue-700 active:bg-blue-100"
          } ${sizeClasses}`}
        style={{ fontFamily: "'Nunito', sans-serif" }}
      >
        <span className={`text-base ${speaking ? "animate-pulse" : ""}`}>
          {speaking ? "🔊" : "🔈"}
        </span>
        <span>{speaking ? "Playing…" : "Hear it!"}</span>
      </button>
      {/* Show phonetic as a visual reading guide only — not spoken */}
      {phonetic && (
        <span className="text-xs text-gray-500 italic pl-1 font-semibold">
          Say it like: <span className="text-blue-600">{phonetic}</span>
        </span>
      )}
    </span>
  );
}
