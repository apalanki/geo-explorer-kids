// QuizEngine.tsx
// Jungle Explorer Design — Fredoka One headings, Nunito body
// Layout target: Fire HD 10 landscape (1280×800 CSS px) — NO SCROLL, everything in 100dvh
//
// Structure (landscape two-column):
//   ┌─────────────────────────────────────────────────────────────┐
//   │  HEADER (~52px): Back | Topic name | ⭐ stars               │
//   │  PROGRESS BAR (1.5px)                                       │
//   ├──────────────────────────────┬──────────────────────────────┤
//   │  LEFT COLUMN                 │  RIGHT COLUMN                │
//   │  • Clue card(s) + timer      │  • 4 answer option buttons   │
//   │  • Stars hint                │  • Result panel + Next btn   │
//   └──────────────────────────────┴──────────────────────────────┘
//
// Funny reactions: random pool of silly messages + big emoji overlay
// on both correct and wrong answers, cycling through each time.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CLUE_TIMER_SECONDS, STARS_PER_CLUE, type QuizQuestion, type Topic } from "@/data/quizData";
import type { TopicProgress } from "@/hooks/useProgress";
import PronounceButton from "./PronounceButton";
import { useSound } from "@/hooks/useSound";

interface QuizEngineProps {
  topic: Topic;
  onComplete: (totalStars: number, totalQuestions: number) => void;
  onBack: () => void;
  recordAnswer: (topicId: string, questionId: string, starsEarned: number, clueUsed: 1 | 2 | 3) => void;
  getTopicProgress: (topicId: string) => TopicProgress;
}

type Phase = "clue" | "answered" | "timeout";

// ── Reaction pools ─────────────────────────────────────────────────
const CORRECT_REACTIONS = [
  { emoji: "🎉", text: "WOOHOO!", color: "#16a34a", bg: "#dcfce7" },
  { emoji: "🧠", text: "GENIUS!!", color: "#7c3aed", bg: "#ede9fe" },
  { emoji: "🔥", text: "ON FIRE!!", color: "#ea580c", bg: "#ffedd5" },
  { emoji: "💥", text: "BOOM!!", color: "#dc2626", bg: "#fee2e2" },
  { emoji: "🦁", text: "ROAR!! YOU ROCK!", color: "#b45309", bg: "#fef3c7" },
  { emoji: "🚀", text: "BLAST OFF!!", color: "#0284c7", bg: "#e0f2fe" },
  { emoji: "🏆", text: "CHAMPION!!", color: "#ca8a04", bg: "#fef9c3" },
  { emoji: "🌟", text: "SUPERSTAR!!", color: "#9333ea", bg: "#f3e8ff" },
  { emoji: "🎸", text: "ROCK STAR!!", color: "#be185d", bg: "#fce7f3" },
  { emoji: "🦸", text: "SUPERHERO!!", color: "#1d4ed8", bg: "#dbeafe" },
  { emoji: "🐉", text: "DRAGON POWER!!", color: "#15803d", bg: "#dcfce7" },
  { emoji: "🍕", text: "YOU'RE PIZZA-MAZING!!", color: "#c2410c", bg: "#ffedd5" },
];

const WRONG_REACTIONS = [
  { emoji: "😱", text: "OH NOOOO!!", color: "#dc2626", bg: "#fee2e2" },
  { emoji: "🙈", text: "YIKES!!", color: "#9a3412", bg: "#ffedd5" },
  { emoji: "🤦", text: "WHOOPSIE!!", color: "#7c3aed", bg: "#ede9fe" },
  { emoji: "😬", text: "OOPSIE DAISY!!", color: "#b45309", bg: "#fef3c7" },
  { emoji: "🫠", text: "I AM MELTING!!", color: "#0369a1", bg: "#e0f2fe" },
  { emoji: "🙃", text: "UPSIDE DOWN BRAIN!!", color: "#be185d", bg: "#fce7f3" },
  { emoji: "🐔", text: "BAWK BAWK!!", color: "#ca8a04", bg: "#fef9c3" },
  { emoji: "💨", text: "WHOOOOSH... MISSED IT!", color: "#0f766e", bg: "#ccfbf1" },
  { emoji: "🥴", text: "MY BRAIN IS DIZZY!!", color: "#7c3aed", bg: "#ede9fe" },
  { emoji: "🦆", text: "QUACK QUACK WRONG!!", color: "#0369a1", bg: "#e0f2fe" },
];

// Pick a random item from an array, avoiding the last used index
function pickRandom<T>(arr: T[], lastIdx: number): [T, number] {
  let idx = Math.floor(Math.random() * arr.length);
  if (idx === lastIdx && arr.length > 1) idx = (idx + 1) % arr.length;
  return [arr[idx], idx];
}

// ── Reaction toast (subtle top-right banner) ──────────────────────
interface ReactionOverlayProps {
  emoji: string;
  text: string;
  color: string;
  bg: string;
  visible: boolean;
}

function ReactionOverlay({ emoji, text, color, bg, visible }: ReactionOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={text}
          initial={{ opacity: 0, y: -12, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 420, damping: 26 }}
          className="fixed top-4 right-4 z-50 pointer-events-none flex items-center gap-2 px-4 py-2 rounded-2xl shadow-lg border-2"
          style={{
            background: bg,
            borderColor: color + "66",
            boxShadow: `0 4px 16px ${color}33`,
          }}
        >
          <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>{emoji}</span>
          <span
            style={{
              fontFamily: "'Fredoka One', cursive",
              fontSize: "1.1rem",
              color,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}
          >
            {text}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Confetti burst ─────────────────────────────────────────────────
function ConfettiBurst() {
  const colors = ["#f94144", "#f9c74f", "#43aa8b", "#4cc9f0", "#f3722c", "#90be6d"];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="confetti-piece absolute w-3 h-3 rounded-sm"
          style={{
            backgroundColor: colors[i % colors.length],
            left: `${5 + (i * 4.8) % 90}%`,
            top: `${5 + (i * 3.7) % 50}%`,
            animationDelay: `${i * 0.04}s`,
            transform: `rotate(${i * 22}deg)`,
          }}
        />
      ))}
    </div>
  );
}

// ── Star display ───────────────────────────────────────────────────
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

// ── Timer ring ─────────────────────────────────────────────────────
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

// ── Main component ─────────────────────────────────────────────────
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
  const [streak, setStreak] = useState(0);
  const [showStreakBurst, setShowStreakBurst] = useState(false);

  // Reaction state
  const [reaction, setReaction] = useState<(typeof CORRECT_REACTIONS)[0] | null>(null);
  const [showReaction, setShowReaction] = useState(false);
  const lastCorrectIdx = useRef(-1);
  const lastWrongIdx = useRef(-1);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { play } = useSound();

  // Clamp qIndex so it never exceeds the array length
  const safeIndex = Math.min(qIndex, Math.max(0, questions.length - 1));
  const currentQ = questions[safeIndex];
  const isLastQuestion = safeIndex === questions.length - 1;

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

  // ── Show reaction overlay briefly ─────────────
  const triggerReaction = (pool: typeof CORRECT_REACTIONS, lastRef: React.MutableRefObject<number>) => {
    const [r, idx] = pickRandom(pool, lastRef.current);
    lastRef.current = idx;
    setReaction(r);
    setShowReaction(true);
    setTimeout(() => setShowReaction(false), 1100);
  };

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
      triggerReaction(CORRECT_REACTIONS, lastCorrectIdx);
      play("correct");
      setPhase("answered");
      setStreak((s) => {
        const next = s + 1;
        if (next >= 3) { setShowStreakBurst(true); setTimeout(() => setShowStreakBurst(false), 1200); }
        return next;
      });
    } else {
      setShakeKey((k) => k + 1);
      triggerReaction(WRONG_REACTIONS, lastWrongIdx);
      play("wrong");
      setStreak(0);
      setTimeout(() => {
        setSelectedOption(null);
        if (clueLevel < 3) { setClueLevel((p) => (p + 1) as 1 | 2 | 3); setPhase("clue"); }
        else { recordAnswer(topic.id, currentQ.id, 0, 3); setPhase("timeout"); }
      }, 900);
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
      setShowReaction(false);
    }
  };

  const badge = clueBadge[clueLevel];
  const urgent = timeLeft <= 5;
  const totalStarsSoFar = sessionStars.reduce((a, b) => a + b, 0);
  const isAnswered = phase === "answered" || phase === "timeout";

  // ── Guard: if questions array is empty or currentQ is somehow undefined ──
  if (!currentQ || !currentQ.clues || currentQ.clues.length < 3) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-2xl font-bold text-gray-600" style={{ fontFamily: "'Fredoka One', cursive" }}>
          🎉 All done! Great work!
        </p>
        <button
          onClick={() => onComplete(sessionStars.reduce((a, b) => a + b, 0), questions.length)}
          className="btn-jungle text-white text-lg font-bold px-8 py-3"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", fontFamily: "'Fredoka One', cursive", borderRadius: "16px" }}
        >
          🏆 See My Score!
        </button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        height: "100dvh",
        background: "linear-gradient(135deg, #f0fdf4 0%, #fef9c3 50%, #eff6ff 100%)",
      }}
    >
      {/* ── HEADER ── */}
      <div className="flex-shrink-0 bg-white/90 backdrop-blur border-b border-gray-100 shadow-sm z-30">
        <div className="flex items-center justify-between px-4 py-2 gap-3">
          <button
            onClick={onBack}
            className="btn-jungle text-white text-base px-4 py-2 min-h-[44px] flex-shrink-0"
            style={{ background: "#6b7280" }}
          >
            ← Back
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-2xl flex-shrink-0">{topic.emoji}</span>
            <span className="font-display text-lg text-gray-800 truncate" style={{ fontFamily: "'Fredoka One', cursive" }}>
              {topic.name}
            </span>
            <span className="text-sm text-gray-400 font-bold flex-shrink-0">· Q {qIndex + 1}/{questions.length}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {streak >= 2 && (
              <div className={`flex items-center gap-1 rounded-full px-3 py-1 border ${showStreakBurst ? 'bg-orange-100 border-orange-400 scale-110' : 'bg-orange-50 border-orange-200'} transition-all duration-300`}>
                <span className="text-lg">🔥</span>
                <span className="font-bold text-orange-600 text-base" style={{ fontFamily: "'Fredoka One', cursive" }}>{streak}</span>
              </div>
            )}
            <div className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1">
              <span className="text-lg">⭐</span>
              <span className="font-display text-yellow-700 text-base font-bold" style={{ fontFamily: "'Fredoka One', cursive" }}>
                {totalStarsSoFar}
              </span>
            </div>
          </div>
        </div>
        <div className="w-full bg-gray-100 h-1.5">
          <div
            className="h-1.5 transition-all duration-500"
            style={{ width: `${(qIndex / questions.length) * 100}%`, background: "linear-gradient(90deg, #16a34a, #84cc16)" }}
          />
        </div>
      </div>

      {/* ── BODY: two columns ── */}
      <div className="flex flex-1 min-h-0 gap-3 p-3">

        {/* ── LEFT COLUMN: clue card ── */}
        <div className="flex flex-col flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={`q-${qIndex}`}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col h-full"
            >
              <div className="jungle-card flex flex-col flex-1 min-h-0 p-4 relative overflow-hidden">
                {showConfetti && <ConfettiBurst />}

                {/* Clue header */
                /* ReactionOverlay is rendered at fixed position outside this card */}
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${badge.bg} ${badge.text}`}>
                    <span>{badge.icon}</span>
                    <span>{badge.label}</span>
                    <span className="opacity-60">({clueLevel}/3)</span>
                  </div>
                  {phase === "clue" && <TimerRing seconds={timeLeft} total={CLUE_TIMER_SECONDS} urgent={urgent} />}
                  {phase === "answered" && <div className="bounce-in"><StarDisplay count={STARS_PER_CLUE[clueLevel]} animate /></div>}
                  {phase === "timeout" && <span className="text-2xl">⏰</span>}
                </div>

                {/* Clues */}
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
                        <div className={`text-sm font-bold mb-1 ${lb.text}`}>{lb.icon} Clue {level}</div>
                        <p className="text-gray-800 font-semibold leading-snug text-base">{c.text}</p>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Stars hint */}
                {phase === "clue" && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-400 font-semibold mt-2 flex-shrink-0">
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

        {/* ── RIGHT COLUMN: answers + result ── */}
        <div className="flex flex-col w-[420px] flex-shrink-0 gap-2">

          {/* Answer buttons — with reaction overlay on top */}
          <div className="relative flex-shrink-0">
            <div
              key={shakeKey}
              className={`grid grid-cols-2 gap-2 ${selectedOption && selectedOption !== currentQ.answer ? "shake" : ""}`}
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
                    className={`jungle-card p-3 text-left font-bold text-base transition-all duration-200 active:scale-95 ${btnStyle}`}
                    style={{ fontFamily: "'Nunito', sans-serif", minHeight: "80px" }}
                  >
                    {option === currentQ.answer && isAnswered && <span className="mr-1.5">✅</span>}
                    {option}
                  </button>
                );
              })}
            </div>

            {/* Reaction overlay — floats over the answer grid */}
            {reaction && (
              <ReactionOverlay
                emoji={reaction.emoji}
                text={reaction.text}
                color={reaction.color}
                bg={reaction.bg}
                visible={showReaction}
              />
            )}
          </div>

          {/* Result panel */}
          <AnimatePresence>
            {isAnswered && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className={`flex flex-col flex-1 min-h-0 rounded-2xl p-3 ${
                  phase === "answered" ? "bg-green-50 border-2 border-green-300" : "bg-red-50 border-2 border-red-200"
                }`}
              >
                <div className="flex-shrink-0 mb-2">
                  {phase === "answered" ? (
                    <>
                      <p className="font-display text-xl text-green-700 leading-tight" style={{ fontFamily: "'Fredoka One', cursive" }}>
                        🎉 Correct! {STARS_PER_CLUE[clueLevel]} {STARS_PER_CLUE[clueLevel] === 1 ? "star" : "stars"}!
                      </p>
                      {clueLevel === 1 && <p className="text-green-600 font-bold text-sm">🔥 Got it on the HARDEST clue!</p>}
                      {clueLevel === 2 && <p className="text-orange-600 font-bold text-sm">👍 Got it on the medium clue!</p>}
                      {clueLevel === 3 && <p className="text-blue-600 font-bold text-sm">💡 Keep practicing to get it earlier!</p>}
                    </>
                  ) : (
                    <div>
                      <p className="font-display text-xl text-red-600 leading-tight" style={{ fontFamily: "'Fredoka One', cursive" }}>
                        ⏰ Time's up!
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="font-display text-lg text-green-700" style={{ fontFamily: "'Fredoka One', cursive" }}>
                          Answer: {currentQ.answer}
                        </p>
                        {currentQ.pronunciation && (
                          <PronounceButton word={currentQ.answer} phonetic={currentQ.pronunciation} size="sm" />
                        )}
                      </div>
                    </div>
                  )}
                  {phase === "answered" && currentQ.pronunciation && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-sm text-gray-500 font-semibold">Say it:</span>
                      <PronounceButton word={currentQ.answer} phonetic={currentQ.pronunciation} size="sm" />
                    </div>
                  )}
                </div>

                <div className="bg-white/70 rounded-xl p-2.5 flex-1 min-h-0 overflow-y-auto mb-2">
                  <p className="text-sm font-bold text-gray-500 uppercase mb-1">🌟 Fun Fact</p>
                  <p className="text-gray-700 font-semibold text-sm leading-snug">{currentQ.funFact}</p>
                </div>

                <button
                  onClick={handleNext}
                  className="btn-jungle text-white w-full text-lg font-bold flex-shrink-0"
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

          {/* Placeholder before answering */}
          {!isAnswered && (
            <div className="flex-1 flex items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white/40">
              <p className="text-gray-400 text-base font-bold text-center px-4" style={{ fontFamily: "'Fredoka One', cursive" }}>
                👆 Pick your answer!
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
