// QuizEngine.tsx
// Jungle Explorer Design — Fredoka One headings, Nunito body
// Layout target: Fire HD 10 landscape (1280×800 CSS px) — NO SCROLL, everything in 100dvh
//
// Structure (landscape two-column):
//   ┌─────────────────────────────────────────────────────────────┐
//   │  HEADER (sticky, ~52px): Back | Topic name | ⭐ stars       │
//   │  PROGRESS BAR (4px)                                         │
//   ├──────────────────────────────┬──────────────────────────────┤
//   │  LEFT COLUMN                 │  RIGHT COLUMN                │
//   │  • Question counter          │  • 4 answer option buttons   │
//   │  • Clue card(s)              │  • Result panel (after ans.) │
//   │  • Stars hint / timer        │  • Next button               │
//   └──────────────────────────────┴──────────────────────────────┘

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
          className={`text-2xl transition-all duration-300 ${
            i <= count ? (animate ? "star-pop" : "opacity-100") : "opacity-20 grayscale"
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
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - seconds / total);
  const color = urgent ? "#ef4444" : seconds <= total * 0.5 ? "#f97316" : "#16a34a";

  return (
    <div className={`relative flex items-center justify-center flex-shrink-0 ${urgent ? "timer-urgent" : ""}`}>
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="34" cy="34" r={radius}
          fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 34 34)"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-xl font-bold" style={{ color, fontFamily: "'Fredoka One', cursive" }}>{seconds}</span>
        <span className="text-[10px] text-gray-400 font-semibold">sec</span>
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
            animationDelay: `${i * 0.05}s`,
            transform: `rotate(${i * 22}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default function QuizEngine({ topic, onComplete, onBack, recordAnswer, getTopicProgress }: QuizEngineProps) {
  const topicProgress = getTopicProgress(topic.id);
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

  const clueBadge: Record<1 | 2 | 3, { bg: string; text: string; border: string; label: string; icon: string }> = {
    1: { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-300",    label: "Hard Clue",   icon: "🔴" },
    2: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-300", label: "Medium Clue", icon: "🟠" },
    3: { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-300",  label: "Easy Clue",   icon: "🟢" },
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
        if (prev <= 1) { clearInterval(timerRef.current!); timerRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (timeLeft === 0 && phase === "clue") {
      if (clueLevel < 3) setClueLevel((p) => (p + 1) as 1 | 2 | 3);
      else setPhase("timeout");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  useEffect(() => {
    if (phase === "clue") startTimer();
    return stopTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clueLevel, qIndex]);

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
        if (clueLevel < 3) { setClueLevel((p) => (p + 1) as 1 | 2 | 3); setPhase("clue"); }
        else { recordAnswer(topic.id, currentQ.id, 0, 3); setPhase("timeout"); }
      }, 700);
    }
  };

  // ── Next question ──────────────────────────────
  const handleNext = () => {
    if (isLastQuestion) {
      onComplete(sessionStars.reduce((a, b) => a + b, 0), questions.length);
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

  // ── Render ─────────────────────────────────────
  // Outer shell: exactly 100dvh, no overflow, flex column
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        height: "100dvh",
        background: "linear-gradient(135deg, #f0fdf4 0%, #fef9c3 50%, #eff6ff 100%)",
      }}
    >
      {/* ── HEADER (fixed height ~52px) ── */}
      <div className="flex-shrink-0 bg-white/90 backdrop-blur border-b border-gray-100 shadow-sm z-30">
        <div className="flex items-center justify-between px-4 py-2 gap-3">
          <button
            onClick={onBack}
            className="btn-jungle text-white text-sm px-4 py-2 min-h-[40px] flex-shrink-0"
            style={{ background: "#6b7280" }}
          >
            ← Back
          </button>

          {/* Topic + question counter */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xl flex-shrink-0">{topic.emoji}</span>
            <span className="font-display text-base text-gray-800 truncate" style={{ fontFamily: "'Fredoka One', cursive" }}>
              {topic.name}
            </span>
            <span className="text-xs text-gray-400 font-bold flex-shrink-0">
              · Q {qIndex + 1}/{questions.length}
            </span>
          </div>

          {/* Stars */}
          <div className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1 flex-shrink-0">
            <span className="text-base">⭐</span>
            <span className="font-display text-yellow-700 text-sm font-bold" style={{ fontFamily: "'Fredoka One', cursive" }}>
              {totalStarsSoFar}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 h-1.5">
          <div
            className="h-1.5 transition-all duration-500"
            style={{
              width: `${(qIndex / questions.length) * 100}%`,
              background: "linear-gradient(90deg, #16a34a, #84cc16)",
            }}
          />
        </div>
      </div>

      {/* ── BODY: two columns, fills remaining height ── */}
      <div className="flex flex-1 min-h-0 gap-3 p-3">

        {/* ── LEFT COLUMN: clue card ── */}
        <div className="flex flex-col flex-1 min-w-0 gap-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={`q-${qIndex}`}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col h-full"
            >
              {/* Clue card — fills left column */}
              <div className="jungle-card flex flex-col flex-1 min-h-0 p-4 relative overflow-hidden">
                {showConfetti && <ConfettiBurst />}

                {/* Clue header: badge + timer/stars */}
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
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
                  {phase === "timeout" && (
                    <span className="text-2xl">⏰</span>
                  )}
                </div>

                {/* Clues revealed so far — scrollable within card if needed */}
                <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
                  {([1, 2, 3] as const).map((level) => {
                    const show = level <= clueLevel || isAnswered;
                    if (!show) return null;
                    const c = currentQ.clues[level - 1];
                    const lb = clueBadge[level];
                    return (
                      <motion.div
                        key={level}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className={`rounded-xl p-3 border-2 flex-shrink-0 ${lb.bg} ${lb.border}`}
                      >
                        <div className={`text-xs font-bold mb-0.5 ${lb.text}`}>{lb.icon} Clue {level}</div>
                        <p className="text-gray-800 font-semibold leading-snug text-sm">{c.text}</p>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Stars hint (during clue phase) */}
                {phase === "clue" && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold mt-2 flex-shrink-0">
                    <span>Answer now for</span>
                    {[1, 2, 3].map((i) => (
                      <span key={i} className={i <= STARS_PER_CLUE[clueLevel] ? "text-yellow-500" : "text-gray-300"}>⭐</span>
                    ))}
                    <span>({STARS_PER_CLUE[clueLevel]} {STARS_PER_CLUE[clueLevel] === 1 ? "star" : "stars"})</span>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── RIGHT COLUMN: answers + result + next ── */}
        <div className="flex flex-col w-[420px] flex-shrink-0 gap-2">

          {/* 4 answer buttons — equal height, fill available space */}
          <div
            key={shakeKey}
            className={`grid grid-cols-2 gap-2 flex-shrink-0 ${selectedOption && selectedOption !== currentQ.answer ? "shake" : ""}`}
          >
            {currentQ.options.map((option) => {
              let btnStyle = "bg-white border-2 border-gray-200 text-gray-800";
              if (isAnswered) {
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
                  className={`jungle-card p-3 text-left font-bold text-sm transition-all duration-200 active:scale-95 ${btnStyle}`}
                  style={{ fontFamily: "'Nunito', sans-serif", minHeight: "72px" }}
                >
                  {option === currentQ.answer && isAnswered && <span className="mr-1.5">✅</span>}
                  {option}
                </button>
              );
            })}
          </div>

          {/* Result panel — appears after answering, fills remaining space */}
          <AnimatePresence>
            {isAnswered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex flex-col flex-1 min-h-0 rounded-2xl p-3 ${
                  phase === "answered"
                    ? "bg-green-50 border-2 border-green-300"
                    : "bg-red-50 border-2 border-red-200"
                }`}
              >
                {/* Result headline */}
                <div className="flex-shrink-0 mb-2">
                  {phase === "answered" ? (
                    <>
                      <p className="font-display text-lg text-green-700 leading-tight" style={{ fontFamily: "'Fredoka One', cursive" }}>
                        🎉 Correct! {STARS_PER_CLUE[clueLevel]} {STARS_PER_CLUE[clueLevel] === 1 ? "star" : "stars"}!
                      </p>
                      {clueLevel === 1 && <p className="text-green-600 font-bold text-xs">🔥 Got it on the HARDEST clue!</p>}
                      {clueLevel === 2 && <p className="text-orange-600 font-bold text-xs">👍 Got it on the medium clue!</p>}
                      {clueLevel === 3 && <p className="text-blue-600 font-bold text-xs">💡 Keep practicing to get it earlier!</p>}
                    </>
                  ) : (
                    <div>
                      <p className="font-display text-lg text-red-600 leading-tight" style={{ fontFamily: "'Fredoka One', cursive" }}>
                        ⏰ Time's up!
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="font-display text-base text-green-700" style={{ fontFamily: "'Fredoka One', cursive" }}>
                          Answer: {currentQ.answer}
                        </p>
                        {currentQ.pronunciation && (
                          <PronounceButton word={currentQ.answer} phonetic={currentQ.pronunciation} size="sm" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Pronunciation for correct answer */}
                  {phase === "answered" && currentQ.pronunciation && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs text-gray-500 font-semibold">Say it:</span>
                      <PronounceButton word={currentQ.answer} phonetic={currentQ.pronunciation} size="sm" />
                    </div>
                  )}
                </div>

                {/* Fun fact — scrollable if very long */}
                <div className="bg-white/70 rounded-xl p-2.5 flex-1 min-h-0 overflow-y-auto mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-0.5">🌟 Fun Fact</p>
                  <p className="text-gray-700 font-semibold text-xs leading-snug">{currentQ.funFact}</p>
                </div>

                {/* Next button */}
                <button
                  onClick={handleNext}
                  className="btn-jungle text-white w-full text-base font-bold flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #16a34a, #15803d)",
                    fontFamily: "'Fredoka One', cursive",
                    minHeight: "52px",
                    borderRadius: "16px",
                  }}
                >
                  {isLastQuestion ? "🏆 See My Score!" : "Next Question →"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Placeholder when no result yet — keeps layout stable */}
          {!isAnswered && (
            <div className="flex-1 flex items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white/40">
              <p className="text-gray-400 text-sm font-bold text-center px-4" style={{ fontFamily: "'Fredoka One', cursive" }}>
                👆 Pick your answer!
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
