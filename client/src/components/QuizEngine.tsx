// QuizEngine.tsx
// Jungle Explorer Design — Fredoka One headings, Nunito body
// Core quiz mechanic: 3 clues (hardest→easiest), 20s timer per clue,
// 3 stars for clue 1, 2 for clue 2, 1 for clue 3.
// Integrates localStorage progress persistence and TTS pronunciation.
// Touch-optimized for Fire tablet (large tap targets, no hover-only interactions).
// Layout: left/center = question card, right = big sticky Next button (active only after answering)

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CLUE_TIMER_SECONDS, STARS_PER_CLUE, type QuizQuestion, type Topic } from "@/data/quizData";
import type { TopicProgress } from "@/hooks/useProgress";
import PronounceButton from "./PronounceButton";

interface QuizEngineProps {
  topic: Topic;
  onComplete: (totalStars: number, totalQuestions: number) => void;
  onBack: () => void;
  recordAnswer: (topicId: string, questionId: string, starsEarned: number, clueUsed: 1 | 2 | 3) => void;
  getTopicProgress: (topicId: string) => TopicProgress;
}

type Phase = "clue" | "answered" | "timeout";

function StarDisplay({ count, animate }: { count: number; animate?: boolean }) {
  return (
    <div className="flex gap-1 justify-center">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`text-3xl transition-all duration-300 ${
            i <= count
              ? animate ? "star-pop" : "opacity-100"
              : "opacity-20 grayscale"
          }`}
          style={animate && i <= count ? { animationDelay: `${(i - 1) * 0.12}s` } : {}}
        >
          ⭐
        </span>
      ))}
    </div>
  );
}

function TimerRing({ seconds, total, urgent }: { seconds: number; total: number; urgent: boolean }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds / total;
  const dashOffset = circumference * (1 - progress);
  const color = urgent ? "#ef4444" : seconds <= total * 0.5 ? "#f97316" : "#16a34a";

  return (
    <div className={`relative flex items-center justify-center ${urgent ? "timer-urgent" : ""}`}>
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="7" />
        <circle
          cx="44" cy="44" r={radius}
          fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 44 44)"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-2xl leading-none" style={{ color, fontFamily: "'Fredoka One', cursive" }}>
          {seconds}
        </span>
        <span className="text-xs text-gray-400 font-semibold">sec</span>
      </div>
    </div>
  );
}

function ConfettiBurst() {
  const colors = ["#f94144", "#f9c74f", "#43aa8b", "#4cc9f0", "#f3722c", "#90be6d"];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          className="confetti-piece absolute w-3 h-3 rounded-sm"
          style={{
            backgroundColor: colors[i % colors.length],
            left: `${10 + (i * 5.5) % 80}%`,
            top: `${10 + (i * 3.7) % 40}%`,
            animationDelay: `${(i * 0.05)}s`,
            transform: `rotate(${i * 22}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default function QuizEngine({ topic, onComplete, onBack, recordAnswer, getTopicProgress }: QuizEngineProps) {
  const topicProgress = getTopicProgress(topic.id);

  // Build question queue: unanswered first, then already-answered (for replay)
  const allQuestions = topic.questions;
  const unanswered = allQuestions.filter((q) => !topicProgress.questions[q.id]?.answered);
  const answered = allQuestions.filter((q) => topicProgress.questions[q.id]?.answered);
  const questions: QuizQuestion[] = unanswered.length > 0 ? unanswered : answered;

  const [qIndex, setQIndex] = useState(0);
  const [clueLevel, setClueLevel] = useState<1 | 2 | 3>(1);
  const [timeLeft, setTimeLeft] = useState(CLUE_TIMER_SECONDS);
  const [phase, setPhase] = useState<Phase>("clue");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [sessionStars, setSessionStars] = useState<number[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentQ = questions[qIndex];
  const isLastQuestion = qIndex === questions.length - 1;

  const clueBadge: Record<1 | 2 | 3, { bg: string; text: string; label: string; icon: string }> = {
    1: { bg: "bg-red-100", text: "text-red-700", label: "Hard Clue", icon: "🔴" },
    2: { bg: "bg-orange-100", text: "text-orange-700", label: "Medium Clue", icon: "🟠" },
    3: { bg: "bg-green-100", text: "text-green-700", label: "Easy Clue", icon: "🟢" },
  };

  // ── Timer ──────────────────────────────────────
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const startTimer = () => {
    stopTimer();
    setTimeLeft(CLUE_TIMER_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // When timer hits 0, advance clue or timeout
  useEffect(() => {
    if (timeLeft === 0 && phase === "clue") {
      if (clueLevel < 3) {
        setClueLevel((prev) => (prev + 1) as 1 | 2 | 3);
      } else {
        setPhase("timeout");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // Restart timer when clue level changes or new question
  useEffect(() => {
    if (phase === "clue") startTimer();
    return stopTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clueLevel, qIndex]);

  // Stop timer when phase changes away from "clue"
  useEffect(() => {
    if (phase !== "clue") stopTimer();
  }, [phase]);

  // ── Answer handler ─────────────────────────────
  const handleAnswer = (option: string) => {
    if (phase !== "clue") return;
    stopTimer();
    setSelectedOption(option);
    const correct = option === currentQ.answer;
    if (correct) {
      const stars = STARS_PER_CLUE[clueLevel];
      setSessionStars((prev) => [...prev, stars]);
      recordAnswer(topic.id, currentQ.id, stars, clueLevel);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 900);
      setPhase("answered");
    } else {
      setShakeKey((k) => k + 1);
      setTimeout(() => {
        setSelectedOption(null);
        if (clueLevel < 3) {
          setClueLevel((prev) => (prev + 1) as 1 | 2 | 3);
          setPhase("clue");
        } else {
          // All clues used, wrong answer → timeout/reveal
          recordAnswer(topic.id, currentQ.id, 0, 3);
          setPhase("timeout");
        }
      }, 700);
    }
  };

  // ── Next question ──────────────────────────────
  const handleNext = () => {
    if (isLastQuestion) {
      const total = sessionStars.reduce((a, b) => a + b, 0);
      onComplete(total, questions.length);
    } else {
      setQIndex((i) => i + 1);
      setClueLevel(1);
      setSelectedOption(null);
      setPhase("clue");
    }
  };

  const badge = clueBadge[clueLevel];
  const urgent = timeLeft <= 5;
  const totalStarsSoFar = sessionStars.reduce((a, b) => a + b, 0);
  const isAnswered = phase === "answered" || phase === "timeout";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #fef9c3 50%, #eff6ff 100%)" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="container flex items-center justify-between py-3 gap-3">
          <button
            onClick={onBack}
            className="btn-jungle text-white text-sm px-4 py-2.5 min-h-[44px]"
            style={{ background: "#6b7280" }}
          >
            ← Back
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl flex-shrink-0">{topic.emoji}</span>
            <span className="font-display text-lg text-gray-800 truncate" style={{ fontFamily: "'Fredoka One', cursive" }}>
              {topic.name}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1.5 flex-shrink-0">
            <span className="text-lg">⭐</span>
            <span className="font-display text-yellow-700 text-base" style={{ fontFamily: "'Fredoka One', cursive" }}>
              {totalStarsSoFar}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 h-2.5">
        <div
          className="h-2.5 transition-all duration-500"
          style={{
            width: `${(qIndex / questions.length) * 100}%`,
            background: "linear-gradient(90deg, #16a34a, #84cc16)",
          }}
        />
      </div>

      {/* Question counter */}
      <div className="container pt-4 pb-1">
        <p className="text-sm font-bold text-gray-500 text-center">
          Question {qIndex + 1} of {questions.length}
          {unanswered.length > 0 && unanswered.length < allQuestions.length && (
            <span className="ml-2 text-green-600">({allQuestions.length - unanswered.length} already completed)</span>
          )}
        </p>
      </div>

      {/* Main layout: question card + right-side Next button */}
      <div className="container flex-1 flex flex-row items-start justify-center pb-8 gap-4 pt-2">

        {/* Left/center: question content */}
        <div className="flex-1 min-w-0 max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={`q-${qIndex}`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.35 }}
              className="w-full"
            >
              {/* Clue card */}
              <div className="jungle-card p-5 mb-4 relative overflow-hidden">
                {showConfetti && <ConfettiBurst />}

                {/* Clue header row */}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${badge.bg} ${badge.text}`}>
                    <span>{badge.icon}</span>
                    <span>{badge.label}</span>
                    <span className="opacity-60">({clueLevel}/3)</span>
                  </div>
                  {phase === "clue" && (
                    <TimerRing seconds={timeLeft} total={CLUE_TIMER_SECONDS} urgent={urgent} />
                  )}
                  {phase === "answered" && (
                    <div className="bounce-in">
                      <StarDisplay count={STARS_PER_CLUE[clueLevel]} animate />
                    </div>
                  )}
                </div>

                {/* Clues revealed so far */}
                <div className="space-y-3 mb-4">
                  {([1, 2, 3] as const).map((level) => {
                    const shouldShow =
                      level <= clueLevel ||
                      phase === "timeout" ||
                      phase === "answered";
                    if (!shouldShow) return null;
                    const c = currentQ.clues[level - 1];
                    const lb = clueBadge[level];
                    return (
                      <motion.div
                        key={level}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`rounded-xl p-3 border-2 ${
                          level === 1 ? "border-red-300 bg-red-50" :
                          level === 2 ? "border-orange-300 bg-orange-50" :
                          "border-green-300 bg-green-50"
                        }`}
                      >
                        <div className={`text-xs font-bold mb-1 ${lb.text}`}>
                          {lb.icon} Clue {level}
                        </div>
                        <p className="text-gray-800 font-semibold leading-relaxed text-base">
                          {c.text}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Stars hint */}
                {phase === "clue" && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold">
                    <span>Answer now for</span>
                    {[1, 2, 3].map((i) => (
                      <span key={i} className={i <= STARS_PER_CLUE[clueLevel] ? "text-yellow-500" : "text-gray-300"}>⭐</span>
                    ))}
                    <span>({STARS_PER_CLUE[clueLevel]} {STARS_PER_CLUE[clueLevel] === 1 ? "star" : "stars"})</span>
                  </div>
                )}
              </div>

              {/* Answer options — big touch targets */}
              {(phase === "clue" || phase === "answered" || phase === "timeout") && (
                <div
                  key={shakeKey}
                  className={`grid grid-cols-2 gap-3 ${selectedOption && selectedOption !== currentQ.answer ? "shake" : ""}`}
                >
                  {currentQ.options.map((option) => {
                    let btnStyle = "bg-white border-2 border-gray-200 text-gray-800";
                    if (phase === "answered" || phase === "timeout") {
                      if (option === currentQ.answer) btnStyle = "bg-green-500 border-2 border-green-600 text-white";
                      else if (option === selectedOption) btnStyle = "bg-red-100 border-2 border-red-400 text-red-700";
                      else btnStyle = "bg-gray-50 border-2 border-gray-200 text-gray-400 opacity-60";
                    } else if (selectedOption === option) {
                      btnStyle = "bg-red-100 border-2 border-red-400 text-red-700";
                    }

                    return (
                      <button
                        key={option}
                        onClick={() => handleAnswer(option)}
                        disabled={phase !== "clue"}
                        className={`jungle-card p-4 text-left font-bold text-base transition-all duration-200 min-h-[64px] active:scale-95 ${btnStyle}`}
                        style={{ fontFamily: "'Nunito', sans-serif" }}
                      >
                        {option === currentQ.answer && (phase === "answered" || phase === "timeout") && (
                          <span className="mr-2">✅</span>
                        )}
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Result panel */}
              <AnimatePresence>
                {(phase === "answered" || phase === "timeout") && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`mt-4 rounded-2xl p-5 text-center ${
                      phase === "answered" ? "bg-green-50 border-2 border-green-300" : "bg-red-50 border-2 border-red-200"
                    }`}
                  >
                    {phase === "answered" ? (
                      <>
                        <p className="font-display text-2xl text-green-700 mb-1" style={{ fontFamily: "'Fredoka One', cursive" }}>
                          🎉 Correct! You earned {STARS_PER_CLUE[clueLevel]} {STARS_PER_CLUE[clueLevel] === 1 ? "star" : "stars"}!
                        </p>
                        {clueLevel === 1 && <p className="text-green-600 font-bold text-sm mb-2">🔥 Amazing! You got it on the HARDEST clue!</p>}
                        {clueLevel === 2 && <p className="text-orange-600 font-bold text-sm mb-2">👍 Great job! You got it on the medium clue!</p>}
                        {clueLevel === 3 && <p className="text-blue-600 font-bold text-sm mb-2">💡 Good work! Keep practicing to get it earlier!</p>}
                      </>
                    ) : (
                      <>
                        <p className="font-display text-2xl text-red-600 mb-1" style={{ fontFamily: "'Fredoka One', cursive" }}>
                          ⏰ Time's up!
                        </p>
                        <div className="flex items-center justify-center gap-3 mb-2">
                          <p className="font-display text-2xl text-green-700" style={{ fontFamily: "'Fredoka One', cursive" }}>
                            The answer was: {currentQ.answer}
                          </p>
                          {currentQ.pronunciation && (
                            <PronounceButton word={currentQ.answer} phonetic={currentQ.pronunciation} size="md" />
                          )}
                        </div>
                      </>
                    )}

                    {/* Pronunciation for correct answer too */}
                    {phase === "answered" && currentQ.pronunciation && (
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="text-sm text-gray-500 font-semibold">How to say it:</span>
                        <PronounceButton word={currentQ.answer} phonetic={currentQ.pronunciation} size="md" />
                      </div>
                    )}

                    {/* Fun fact */}
                    <div className="bg-white/70 rounded-xl p-3 mt-2 text-left">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-1">🌟 Fun Fact</p>
                      <p className="text-gray-700 font-semibold text-sm">{currentQ.funFact}</p>
                    </div>

                    {/* Mobile-only inline Next button (shown below result on small screens) */}
                    <button
                      onClick={handleNext}
                      className="btn-jungle text-white mt-4 w-full text-lg min-h-[52px] lg:hidden"
                      style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
                    >
                      {isLastQuestion ? "🏆 See My Score!" : "Next Question →"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right-side sticky Next button — visible on all screen sizes */}
        <div className="flex-shrink-0 self-start sticky top-24 hidden lg:flex flex-col items-center gap-3">
          <AnimatePresence>
            {isAnswered && (
              <motion.button
                key="next-btn"
                initial={{ opacity: 0, scale: 0.7, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.7, x: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={handleNext}
                className="btn-jungle text-white flex flex-col items-center justify-center gap-2 shadow-2xl"
                style={{
                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                  width: "120px",
                  height: "120px",
                  borderRadius: "24px",
                  fontSize: "14px",
                  fontFamily: "'Fredoka One', cursive",
                  lineHeight: "1.2",
                }}
              >
                <span style={{ fontSize: "36px" }}>{isLastQuestion ? "🏆" : "➡️"}</span>
                <span>{isLastQuestion ? "My Score!" : "Next"}</span>
              </motion.button>
            )}
          </AnimatePresence>
          {!isAnswered && (
            <div
              className="flex flex-col items-center justify-center gap-2 opacity-25"
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "24px",
                border: "3px dashed #9ca3af",
                background: "#f9fafb",
                fontSize: "14px",
                fontFamily: "'Fredoka One', cursive",
                color: "#9ca3af",
                lineHeight: "1.2",
              }}
            >
              <span style={{ fontSize: "32px" }}>➡️</span>
              <span style={{ textAlign: "center" }}>Answer first!</span>
            </div>
          )}
        </div>

        {/* Mobile sticky bottom Next button — shown on small/medium screens after answering */}
        <AnimatePresence>
          {isAnswered && (
            <motion.div
              key="mobile-next"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed bottom-0 left-0 right-0 z-40 p-4 lg:hidden"
              style={{ background: "linear-gradient(to top, rgba(255,255,255,0.98) 70%, transparent)" }}
            >
              <button
                onClick={handleNext}
                className="btn-jungle text-white w-full text-xl min-h-[64px] shadow-2xl"
                style={{
                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                  fontFamily: "'Fredoka One', cursive",
                  borderRadius: "20px",
                }}
              >
                {isLastQuestion ? "🏆 See My Score!" : "Next Question →"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
