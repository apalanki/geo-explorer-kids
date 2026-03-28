// TopicCard.tsx — Jungle Explorer Design
// Displays a topic with image, emoji, name, importance badge, and star count

import { motion } from "framer-motion";
import type { Topic } from "@/data/quizData";

interface TopicCardProps {
  topic: Topic;
  starsEarned: number;
  maxStars: number;
  onClick: () => void;
  index: number;
}

const IMPORTANCE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "⭐ Must Know!", color: "bg-red-500 text-white" },
  2: { label: "🔥 Very Important", color: "bg-orange-500 text-white" },
  3: { label: "🔥 Very Important", color: "bg-orange-500 text-white" },
  4: { label: "📚 Important", color: "bg-yellow-500 text-white" },
  5: { label: "📚 Important", color: "bg-yellow-500 text-white" },
  6: { label: "📚 Important", color: "bg-yellow-500 text-white" },
  7: { label: "💡 Good to Know", color: "bg-blue-500 text-white" },
  8: { label: "💡 Good to Know", color: "bg-blue-500 text-white" },
  9: { label: "💡 Good to Know", color: "bg-blue-500 text-white" },
  10: { label: "🌟 Bonus Topic", color: "bg-purple-500 text-white" },
};

export default function TopicCard({ topic, starsEarned, maxStars, onClick, index }: TopicCardProps) {
  const imp = IMPORTANCE_LABELS[topic.importance] || IMPORTANCE_LABELS[10];
  const pct = maxStars > 0 ? (starsEarned / maxStars) * 100 : 0;
  const completed = starsEarned > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07 }}
      onClick={onClick}
      className="jungle-card cursor-pointer overflow-hidden group"
    >
      {/* Image */}
      <div className="relative h-36 overflow-hidden">
        <img
          src={topic.image}
          alt={topic.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {/* Importance badge */}
        <div className={`absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-full ${imp.color}`}>
          {imp.label}
        </div>
        {/* Completed badge */}
        {completed && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            ✅ Done!
          </div>
        )}
        {/* Topic name on image */}
        <div className="absolute bottom-2 left-3 right-3">
          <h3
            className="text-white text-xl leading-tight drop-shadow-lg"
            style={{ fontFamily: "'Fredoka One', cursive" }}
          >
            {topic.emoji} {topic.name}
          </h3>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        <p className="text-gray-600 text-sm font-semibold mb-3 leading-snug">{topic.description}</p>

        {/* Star progress */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-yellow-500 text-sm font-bold">⭐ {starsEarned}/{maxStars} stars</span>
          <span className="text-gray-400 text-xs">· {topic.questions.length} questions</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-2.5 rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: pct === 100
                ? "linear-gradient(90deg, #16a34a, #84cc16)"
                : "linear-gradient(90deg, #f59e0b, #fbbf24)",
            }}
          />
        </div>

        {/* Play button */}
        <button
          className="btn-jungle text-white w-full mt-4 text-base"
          style={{ background: `linear-gradient(135deg, ${topic.shadowColor}dd, ${topic.shadowColor})` }}
        >
          {completed ? "🔁 Play Again" : "▶ Start Quiz"}
        </button>
      </div>
    </motion.div>
  );
}
