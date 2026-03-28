// ScoreScreen.tsx — Jungle Explorer Design
// Shown after completing a topic quiz

import { motion } from "framer-motion";
import type { Topic } from "@/data/quizData";

interface ScoreScreenProps {
  topic: Topic;
  starsEarned: number;
  totalQuestions: number;
  onPlayAgain: () => void;
  onHome: () => void;
}

function BigStar({ delay }: { delay: number }) {
  return (
    <motion.span
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ delay, type: "spring", stiffness: 300, damping: 12 }}
      className="text-5xl"
    >
      ⭐
    </motion.span>
  );
}

export default function ScoreScreen({ topic, starsEarned, totalQuestions, onPlayAgain, onHome }: ScoreScreenProps) {
  const maxStars = totalQuestions * 3;
  const pct = Math.round((starsEarned / maxStars) * 100);

  const rating =
    pct === 100 ? { emoji: "🏆", title: "PERFECT EXPLORER!", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-300" } :
    pct >= 70  ? { emoji: "🌟", title: "Super Star!", color: "text-green-600", bg: "bg-green-50 border-green-300" } :
    pct >= 40  ? { emoji: "👍", title: "Good Job!", color: "text-blue-600", bg: "bg-blue-50 border-blue-300" } :
                 { emoji: "💪", title: "Keep Practicing!", color: "text-orange-600", bg: "bg-orange-50 border-orange-300" };

  const starsToShow = Math.min(starsEarned, 3);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #fef9c3 50%, #eff6ff 100%)" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className={`jungle-card w-full max-w-md p-8 text-center border-2 ${rating.bg}`}
      >
        {/* Mascot + emoji */}
        <div className="text-7xl mb-2 float-anim">{rating.emoji}</div>
        <h2
          className={`text-3xl mb-1 ${rating.color}`}
          style={{ fontFamily: "'Fredoka One', cursive" }}
        >
          {rating.title}
        </h2>
        <p className="text-gray-500 font-semibold mb-6">
          You completed <span className="font-bold text-gray-700">{topic.emoji} {topic.name}</span>!
        </p>

        {/* Stars row */}
        <div className="flex justify-center gap-3 mb-4">
          {[0, 1, 2].map((i) => (
            <BigStar key={i} delay={0.2 + i * 0.15} />
          ))}
        </div>

        {/* Score */}
        <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
          <p className="text-5xl font-display mb-1" style={{ fontFamily: "'Fredoka One', cursive", color: "#f59e0b" }}>
            {starsEarned}
          </p>
          <p className="text-gray-500 font-semibold text-sm">out of {maxStars} possible stars ({pct}%)</p>

          {/* Breakdown hint */}
          <div className="mt-3 text-xs text-gray-400 space-y-1">
            <p>🔴 Answer on Clue 1 = 3 stars (hardest)</p>
            <p>🟠 Answer on Clue 2 = 2 stars</p>
            <p>🟢 Answer on Clue 3 = 1 star (easiest)</p>
          </div>
        </div>

        {/* Tip */}
        {pct < 100 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 text-sm text-blue-700 font-semibold">
            💡 Tip: Try to answer on Clue 1 for maximum stars — just like the real Geography Bee!
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onPlayAgain}
            className="btn-jungle text-white text-lg w-full"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
          >
            🔁 Play Again
          </button>
          <button
            onClick={onHome}
            className="btn-jungle text-white text-lg w-full"
            style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
          >
            🌍 Choose Another Topic
          </button>
        </div>
      </motion.div>
    </div>
  );
}
