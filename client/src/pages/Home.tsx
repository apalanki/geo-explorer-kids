// Home.tsx — World Geography Explorer for Kids
// Design: Jungle Explorer — Fredoka One headings, Nunito body
// Shows topic grid ranked by importance, global progress, and star totals.
// Supports per-topic reset and full progress reset.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ALL_TOPICS, getTotalQuestions, type Topic } from "@/data/quizData";
import { useProgress } from "@/hooks/useProgress";
import QuizEngine from "@/components/QuizEngine";
import ScoreScreen from "@/components/ScoreScreen";
import MockExam, { getMockExamBest, loadExamHistory, type ExamHistoryEntry } from "@/components/MockExam";

type AppView =
  | { screen: "home" }
  | { screen: "quiz"; topic: Topic }
  | { screen: "score"; topic: Topic; starsEarned: number; totalQuestions: number }
  | { screen: "mockexam" };

const IMPORTANCE_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "🥇 Most Important", color: "text-yellow-700", bg: "bg-yellow-100 border-yellow-300" },
  2: { label: "🥈 Very Important", color: "text-orange-700", bg: "bg-orange-100 border-orange-300" },
  3: { label: "🥉 Important", color: "text-blue-700", bg: "bg-blue-100 border-blue-300" },
  4: { label: "⭐ Important", color: "text-green-700", bg: "bg-green-100 border-green-300" },
  5: { label: "📚 Good to Know", color: "text-purple-700", bg: "bg-purple-100 border-purple-300" },
  6: { label: "📚 Good to Know", color: "text-purple-700", bg: "bg-purple-100 border-purple-300" },
  7: { label: "💡 Bonus", color: "text-teal-700", bg: "bg-teal-100 border-teal-300" },
  8: { label: "💡 Bonus", color: "text-teal-700", bg: "bg-teal-100 border-teal-300" },
  9: { label: "🌟 Explorer", color: "text-pink-700", bg: "bg-pink-100 border-pink-300" },
  10: { label: "🌟 Explorer", color: "text-pink-700", bg: "bg-pink-100 border-pink-300" },
};

function TopicCard({
  topic,
  topicProgress,
  onStart,
  onReset,
  index,
  isWeakest,
}: {
  topic: Topic;
  topicProgress: ReturnType<ReturnType<typeof useProgress>["getTopicProgress"]>;
  onStart: () => void;
  onReset: () => void;
  index: number;
  isWeakest?: boolean;
}) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const totalQ = topic.questions.length;
  const answeredQ = topicProgress.questionsAnswered;
  const starsEarned = topicProgress.totalStars;
  const maxStars = totalQ * 3;
  const pct = totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0;
  const isComplete = answeredQ >= totalQ;
  const hasStarted = answeredQ > 0;
  const nextQ = answeredQ + 1; // 1-based next question number
  const imp = IMPORTANCE_LABELS[topic.importance] ?? IMPORTANCE_LABELS[10];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07 }}
      className="jungle-card overflow-hidden flex flex-col"
    >
      {/* Topic image */}
      <div className="relative h-36 overflow-hidden">
        <img
          src={topic.image}
          alt={topic.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {/* Importance badge */}
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-bold border ${imp.bg} ${imp.color}`}>
          {imp.label}
        </div>
        {/* Mascot */}
        <div className="absolute top-2 right-2 text-3xl float-anim">{topic.mascot}</div>
        {/* Title */}
        <div className="absolute bottom-2 left-3 right-3">
          <h3 className="font-display text-white text-xl leading-tight drop-shadow-lg" style={{ fontFamily: "'Fredoka One', cursive" }}>
            {topic.emoji} {topic.name}
          </h3>
        </div>
        {/* Complete badge */}
        {isComplete && (
          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
            <span className="text-5xl drop-shadow-lg">🏆</span>
          </div>
        )}
        {/* Weak topic badge */}
        {isWeakest && !isComplete && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, delay: 0.5 }}
            className="absolute bottom-2 right-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg"
            style={{ fontFamily: "'Fredoka One', cursive" }}
          >
            💪 Needs Practice!
          </motion.div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <p className="text-sm text-gray-600 font-semibold leading-snug">{topic.description}</p>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
            <span>{answeredQ}/{totalQ} questions</span>
            <span>{pct}% done</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <motion.div
              className="h-3 rounded-full"
              style={{ background: "linear-gradient(90deg, #16a34a, #84cc16)" }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, delay: index * 0.07 + 0.3 }}
            />
          </div>
        </div>

        {/* Stars */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-yellow-600">⭐ Stars earned</span>
            <span className="text-xs text-gray-500 font-bold">{starsEarned} / {maxStars}</span>
          </div>
          <div className="w-full bg-yellow-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{
                width: `${maxStars > 0 ? (starsEarned / maxStars) * 100 : 0}%`,
                background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
              }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={onStart}
            className="btn-jungle text-white flex-1 text-base py-3"
            style={{ background: isComplete ? "linear-gradient(135deg, #7c3aed, #5b21b6)" : "linear-gradient(135deg, #16a34a, #15803d)" }}
          >
            {isComplete
              ? "🔄 Replay All"
              : hasStarted
              ? `▶ Continue (Q ${nextQ}/${totalQ})`
              : "▶ Start Quiz"}
          </button>

          {hasStarted && (
            <div className="relative">
              {showResetConfirm ? (
                <div className="absolute bottom-full right-0 mb-2 bg-white border-2 border-red-300 rounded-2xl p-3 shadow-xl z-20 w-48">
                  <p className="text-xs font-bold text-gray-700 mb-2 text-center">Reset this topic?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { onReset(); setShowResetConfirm(false); }}
                      className="btn-jungle text-white text-xs flex-1 py-1.5"
                      style={{ background: "#ef4444" }}
                    >
                      Yes, Reset
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="btn-jungle text-gray-700 text-xs flex-1 py-1.5"
                      style={{ background: "#e5e7eb" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              <button
                onClick={() => setShowResetConfirm(true)}
                className="btn-jungle text-white px-3 py-3"
                style={{ background: "#6b7280" }}
                title="Reset topic progress"
              >
                🗑️
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const [view, setView] = useState<AppView>({ screen: "home" });
  const mockBest = getMockExamBest();
  const examHistory = loadExamHistory();
  const {
    progress,
    recordAnswer,
    resetTopic,
    resetAll,
    getTopicProgress,
    grandTotalStars,
    grandTotalAnswered,
  } = useProgress();
  const [showResetAll, setShowResetAll] = useState(false);

  const totalQuestions = getTotalQuestions();

  // ── Quiz completion handler ────────────────────
  const handleQuizComplete = (topic: Topic, starsEarned: number, totalQ: number) => {
    setView({ screen: "score", topic, starsEarned, totalQuestions: totalQ });
  };

  // ── Render ─────────────────────────────────────
  if (view.screen === "mockexam") {
    return <MockExam onHome={() => setView({ screen: "home" })} />;
  }

  if (view.screen === "quiz") {
    return (
      <QuizEngine
        topic={view.topic}
        onComplete={(stars, total) => handleQuizComplete(view.topic, stars, total)}
        onBack={() => setView({ screen: "home" })}
        recordAnswer={recordAnswer}
        getTopicProgress={getTopicProgress}
      />
    );
  }

  if (view.screen === "score") {
    return (
      <ScoreScreen
        topic={view.topic}
        starsEarned={view.starsEarned}
        totalQuestions={view.totalQuestions}
        onPlayAgain={() => setView({ screen: "quiz", topic: view.topic })}
        onHome={() => setView({ screen: "home" })}
      />
    );
  }

  // ── Home screen ────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #f0fdf4 0%, #fef9c3 40%, #eff6ff 100%)" }}>
      {/* Hero header */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #14532d 0%, #166534 40%, #15803d 70%, #16a34a 100%)" }}
      >
        {/* Decorative floating emojis */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {["🌍", "🌎", "🌏", "🗺️", "🧭", "⛰️", "🌊", "🦁", "🐼", "🦜", "🦘", "🐫"].map((emoji, i) => (
            <span
              key={i}
              className="absolute text-2xl opacity-20 float-anim"
              style={{
                left: `${(i * 8.5) % 100}%`,
                top: `${10 + (i * 13) % 70}%`,
                animationDelay: `${i * 0.4}s`,
                animationDuration: `${3 + (i % 3)}s`,
              }}
            >
              {emoji}
            </span>
          ))}
        </div>

        <div className="container relative z-10 py-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
          >
            <div className="text-6xl mb-2 float-anim">🌍</div>
            <h1
              className="text-white text-4xl md:text-5xl mb-2 drop-shadow-lg"
              style={{ fontFamily: "'Fredoka One', cursive" }}
            >
              World Explorer
            </h1>
            <p className="text-green-100 text-lg font-bold mb-4">
              Geography Bee Practice for Future Champions! 🏆
            </p>
          </motion.div>

          {/* Global stats bar */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-4 bg-white/15 backdrop-blur rounded-2xl px-5 py-3 flex-wrap justify-center"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">⭐</span>
              <div className="text-left">
                <div className="text-white font-display text-xl leading-none" style={{ fontFamily: "'Fredoka One', cursive" }}>
                  {grandTotalStars}
                </div>
                <div className="text-green-200 text-xs font-bold">Total Stars</div>
              </div>
            </div>
            <div className="w-px h-8 bg-white/30" />
            <div className="flex items-center gap-2">
              <span className="text-2xl">✅</span>
              <div className="text-left">
                <div className="text-white font-display text-xl leading-none" style={{ fontFamily: "'Fredoka One', cursive" }}>
                  {grandTotalAnswered}
                </div>
                <div className="text-green-200 text-xs font-bold">Questions Done</div>
              </div>
            </div>
            <div className="w-px h-8 bg-white/30" />
            <div className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <div className="text-left">
                <div className="text-white font-display text-xl leading-none" style={{ fontFamily: "'Fredoka One', cursive" }}>
                  {totalQuestions}
                </div>
                <div className="text-green-200 text-xs font-bold">Total Questions</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Mock Exam CTA */}
      <div className="bg-purple-50 border-b border-purple-200 py-4">
        <div className="container flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📋</span>
            <div>
              <p className="font-bold text-purple-800 text-base" style={{ fontFamily: "'Fredoka One', cursive" }}>Mock Exam — Simulate the Real Geography Bee!</p>
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-purple-600 text-sm font-semibold">30 questions · All topics · Timed · Full score report</p>
                {mockBest && (
                  <span className="bg-yellow-100 border border-yellow-400 text-yellow-800 text-xs font-bold px-2.5 py-1 rounded-full" style={{ fontFamily: "'Fredoka One', cursive" }}>
                    🏆 Best: {mockBest.correct}/{mockBest.total}
                  </span>
                )}
              </div>
              {/* Exam history trend */}
              {examHistory.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-purple-500 text-xs font-bold">Last {examHistory.length} exam{examHistory.length > 1 ? "s" : ""}:</span>
                  <div className="flex items-end gap-1">
                    {examHistory.map((entry: ExamHistoryEntry, i: number) => {
                      const h = Math.max(8, Math.round((entry.correct / entry.total) * 32));
                      const isLast = i === examHistory.length - 1;
                      const prev = i > 0 ? examHistory[i - 1] : null;
                      const trend = prev ? (entry.correct > prev.correct ? "↑" : entry.correct < prev.correct ? "↓" : "→") : null;
                      return (
                        <div key={i} className="flex flex-col items-center gap-0.5">
                          {trend && <span className={`text-[9px] font-bold leading-none ${trend === "↑" ? "text-green-600" : trend === "↓" ? "text-red-500" : "text-gray-400"}`}>{trend}</span>}
                          <div
                            className={`w-5 rounded-t transition-all ${
                              isLast ? "bg-purple-500" :
                              entry.correct / entry.total >= 0.7 ? "bg-green-400" :
                              entry.correct / entry.total >= 0.5 ? "bg-yellow-400" : "bg-red-400"
                            }`}
                            style={{ height: `${h}px` }}
                            title={`${entry.correct}/${entry.total} on ${new Date(entry.date).toLocaleDateString()}`}
                          />
                          <span className="text-[9px] text-purple-600 font-bold leading-none">{entry.correct}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setView({ screen: "mockexam" })}
            className="text-white font-bold text-lg px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", fontFamily: "'Fredoka One', cursive", boxShadow: "0 4px 16px rgba(147,51,234,0.35)" }}
          >
            🚀 Start Mock Exam
          </motion.button>
        </div>
      </div>

      {/* How it works banner */}
      <div className="bg-yellow-50 border-b border-yellow-200 py-3">
        <div className="container">
          <div className="flex items-center gap-3 flex-wrap justify-center text-sm font-bold text-yellow-800">
            <span>🔴 Hard clue = 3 ⭐⭐⭐</span>
            <span className="text-yellow-400">|</span>
            <span>🟠 Medium clue = 2 ⭐⭐</span>
            <span className="text-yellow-400">|</span>
            <span>🟢 Easy clue = 1 ⭐</span>
            <span className="text-yellow-400">|</span>
            <span>⏰ 20 seconds per clue!</span>
          </div>
        </div>
      </div>

      {/* Topic grid */}
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2
            className="text-gray-800 text-2xl"
            style={{ fontFamily: "'Fredoka One', cursive" }}
          >
            📚 Choose a Topic
          </h2>
          {grandTotalAnswered > 0 && (
            <div className="relative">
              {showResetAll ? (
                <div className="absolute top-full right-0 mt-2 bg-white border-2 border-red-300 rounded-2xl p-3 shadow-xl z-20 w-52">
                  <p className="text-xs font-bold text-gray-700 mb-2 text-center">Reset ALL progress?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { resetAll(); setShowResetAll(false); }}
                      className="btn-jungle text-white text-xs flex-1 py-1.5"
                      style={{ background: "#ef4444" }}
                    >
                      Yes, Reset All
                    </button>
                    <button
                      onClick={() => setShowResetAll(false)}
                      className="btn-jungle text-gray-700 text-xs flex-1 py-1.5"
                      style={{ background: "#e5e7eb" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              <button
                onClick={() => setShowResetAll(true)}
                className="btn-jungle text-white text-sm px-4 py-2"
                style={{ background: "#6b7280" }}
              >
                🗑️ Reset All Progress
              </button>
            </div>
          )}
        </div>

        {(() => {
          // Find the weakest started topic (lowest star % among topics with at least 1 answer)
          let weakestId: string | null = null;
          let lowestPct = Infinity;
          ALL_TOPICS.forEach((t) => {
            const tp = getTopicProgress(t.id);
            if (tp.questionsAnswered > 0 && tp.questionsAnswered < t.questions.length) {
              const starPct = t.questions.length > 0 ? tp.totalStars / (t.questions.length * 3) : 1;
              if (starPct < lowestPct) { lowestPct = starPct; weakestId = t.id; }
            }
          });
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {ALL_TOPICS.map((topic, index) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  topicProgress={getTopicProgress(topic.id)}
                  onStart={() => setView({ screen: "quiz", topic })}
                  onReset={() => resetTopic(topic.id)}
                  index={index}
                  isWeakest={topic.id === weakestId}
                />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Footer */}
      <div className="bg-green-900 text-green-200 text-center py-4 text-sm font-bold">
        🌍 World Explorer — Geography Bee Practice · {totalQuestions} questions across 10 topics · Your progress is saved automatically! 💾
      </div>
    </div>
  );
}
