// MockExam — Geography Bee Exam Simulation
// 30 questions drawn evenly from all 10 topics (3 per topic), shuffled.
// Same two-column Fire HD 10 landscape layout as QuizEngine.
// No topic progress is recorded — exam is session-only.
// Shows a detailed score report at the end.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ALL_TOPICS, CLUE_TIMER_SECONDS, STARS_PER_CLUE, type QuizQuestion } from "@/data/quizData";
import PronounceButton from "./PronounceButton";
import { useSound } from "@/hooks/useSound";

// ── helpers ────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildExamQuestions(): QuizQuestion[] {
  const PER_TOPIC = 3;
  const questions: QuizQuestion[] = [];
  for (const topic of ALL_TOPICS) {
    const pool = shuffle(topic.questions).slice(0, PER_TOPIC);
    questions.push(...pool);
  }
  return shuffle(questions);
}

// ── Reaction pools ─────────────────────────────────────────────────────────
const CORRECT_REACTIONS = [
  { emoji: "🎉", text: "WOOHOO!", color: "#16a34a", bg: "#dcfce7" },
  { emoji: "🧠", text: "GENIUS!!", color: "#7c3aed", bg: "#ede9fe" },
  { emoji: "🔥", text: "ON FIRE!!", color: "#ea580c", bg: "#ffedd5" },
  { emoji: "💥", text: "BOOM!!", color: "#dc2626", bg: "#fee2e2" },
  { emoji: "🚀", text: "BLAST OFF!!", color: "#0284c7", bg: "#e0f2fe" },
  { emoji: "🏆", text: "CHAMPION!!", color: "#ca8a04", bg: "#fef9c3" },
  { emoji: "🌟", text: "SUPERSTAR!!", color: "#9333ea", bg: "#f3e8ff" },
];
const WRONG_REACTIONS = [
  { emoji: "😱", text: "OH NOOOO!!", color: "#dc2626", bg: "#fee2e2" },
  { emoji: "🙈", text: "YIKES!!", color: "#9a3412", bg: "#ffedd5" },
  { emoji: "🤦", text: "WHOOPSIE!!", color: "#7c3aed", bg: "#ede9fe" },
  { emoji: "🫠", text: "I AM MELTING!!", color: "#0369a1", bg: "#e0f2fe" },
  { emoji: "🐔", text: "BAWK BAWK!!", color: "#ca8a04", bg: "#fef9c3" },
];

function pickRandom<T>(arr: T[], lastIdx: number): [T, number] {
  let idx = Math.floor(Math.random() * arr.length);
  if (idx === lastIdx && arr.length > 1) idx = (idx + 1) % arr.length;
  return [arr[idx], idx];
}

// ── Sub-components ─────────────────────────────────────────────────────────
function ReactionOverlay({ emoji, text, color, bg, visible }: { emoji: string; text: string; color: string; bg: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={text}
          initial={{ scale: 0.3, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: -20 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          className="absolute inset-0 flex flex-col items-center justify-center z-50 rounded-2xl pointer-events-none"
          style={{ background: bg + "ee" }}
        >
          <motion.span
            initial={{ rotate: -20, scale: 0.5 }}
            animate={{ rotate: [-20, 15, -10, 8, 0], scale: [0.5, 1.4, 1.1, 1.2, 1] }}
            transition={{ duration: 0.5, times: [0, 0.3, 0.5, 0.7, 1] }}
            style={{ fontSize: "5rem", lineHeight: 1 }}
          >{emoji}</motion.span>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            style={{ fontFamily: "'Fredoka One', cursive", fontSize: "2rem", color, textAlign: "center", lineHeight: 1.1 }}
          >{text}</motion.p>
        </motion.div>
      )}
    </AnimatePresence>
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
        <circle cx="34" cy="34" r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset}
          transform="rotate(-90 34 34)" style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }} />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-xl font-bold" style={{ color, fontFamily: "'Fredoka One', cursive" }}>{seconds}</span>
        <span className="text-[10px] text-gray-400 font-semibold">sec</span>
      </div>
    </div>
  );
}

// ── Score Report ───────────────────────────────────────────────────────────
interface ExamResult { question: QuizQuestion; correct: boolean; starsEarned: number; clueUsed: 1 | 2 | 3 | "timeout" }

function ExamScoreReport({ results, onRetry, onHome }: { results: ExamResult[]; onRetry: () => void; onHome: () => void }) {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const totalStars = results.reduce((a, r) => a + r.starsEarned, 0);
  const maxStars = total * 3;
  const pct = Math.round((correct / total) * 100);

  const rating =
    pct === 100 ? { label: "PERFECT EXPLORER! 🌍", color: "#16a34a", bg: "#dcfce7" } :
    pct >= 80   ? { label: "GEOGRAPHY CHAMPION! 🏆", color: "#ca8a04", bg: "#fef9c3" } :
    pct >= 60   ? { label: "GREAT EXPLORER! 🚀", color: "#0284c7", bg: "#e0f2fe" } :
    pct >= 40   ? { label: "GOOD EFFORT! 💪", color: "#7c3aed", bg: "#ede9fe" } :
                  { label: "KEEP PRACTICING! 📚", color: "#dc2626", bg: "#fee2e2" };

  // Group wrong answers by topic for review
  const wrongByTopic: Record<string, ExamResult[]> = {};
  results.filter((r) => !r.correct).forEach((r) => {
    const tid = r.question.topicId;
    if (!wrongByTopic[tid]) wrongByTopic[tid] = [];
    wrongByTopic[tid].push(r);
  });

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "100dvh", background: "linear-gradient(135deg, #f0fdf4 0%, #fef9c3 50%, #eff6ff 100%)" }}
    >
      {/* Header */}
      <div className="flex-shrink-0 bg-white/90 backdrop-blur border-b border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
        <span className="text-2xl font-bold text-gray-800" style={{ fontFamily: "'Fredoka One', cursive" }}>
          📋 Mock Exam Results
        </span>
        <button
          onClick={onHome}
          className="btn-jungle text-white text-base px-4 py-2"
          style={{ background: "#6b7280" }}
        >
          🏠 Home
        </button>
      </div>

      <div className="flex flex-1 min-h-0 gap-4 p-4 overflow-hidden">
        {/* Left: Score summary */}
        <div className="flex flex-col gap-3 w-72 flex-shrink-0">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="jungle-card p-5 flex flex-col items-center gap-2 text-center"
            style={{ background: rating.bg, border: `2px solid ${rating.color}` }}
          >
            <p className="text-3xl font-bold" style={{ fontFamily: "'Fredoka One', cursive", color: rating.color }}>
              {rating.label}
            </p>
            <p className="text-5xl font-bold mt-1" style={{ fontFamily: "'Fredoka One', cursive", color: rating.color }}>
              {correct}/{total}
            </p>
            <p className="text-lg text-gray-600 font-semibold">questions correct</p>
            <div className="w-full bg-gray-200 rounded-full h-3 mt-1">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                className="h-3 rounded-full"
                style={{ background: `linear-gradient(90deg, ${rating.color}, ${rating.color}aa)` }}
              />
            </div>
            <p className="text-sm text-gray-500 font-bold">{pct}% accuracy</p>
          </motion.div>

          <div className="jungle-card p-4 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-semibold">⭐ Stars earned</span>
              <span className="font-bold text-yellow-600" style={{ fontFamily: "'Fredoka One', cursive" }}>{totalStars} / {maxStars}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-semibold">✅ Correct</span>
              <span className="font-bold text-green-600">{correct}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-semibold">❌ Missed</span>
              <span className="font-bold text-red-500">{total - correct}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-semibold">🎯 Questions</span>
              <span className="font-bold text-gray-700">{total}</span>
            </div>
          </div>

          <button
            onClick={onRetry}
            className="btn-jungle text-white text-lg font-bold py-3 w-full"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", fontFamily: "'Fredoka One', cursive", borderRadius: "16px" }}
          >
            🔄 Try Again!
          </button>
        </div>

        {/* Right: Question-by-question breakdown */}
        <div className="flex-1 min-w-0 flex flex-col">
          <p className="text-base font-bold text-gray-600 mb-2 flex-shrink-0" style={{ fontFamily: "'Fredoka One', cursive" }}>
            📝 Question Breakdown
          </p>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
            {results.map((r, i) => {
              const topicObj = ALL_TOPICS.find((t) => t.id === r.question.topicId);
              return (
                <motion.div
                  key={r.question.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 border-2 ${
                    r.correct ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                  }`}
                >
                  <span className="text-xl flex-shrink-0">{r.correct ? "✅" : "❌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm truncate">
                      {topicObj?.emoji} {r.question.answer}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{topicObj?.name}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {r.correct ? (
                      <span className="text-xs font-bold text-yellow-600">
                        {"⭐".repeat(r.starsEarned)} {r.starsEarned}★
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-gray-400">0★</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main MockExam component ────────────────────────────────────────────────
interface MockExamProps {
  onHome: () => void;
}

type Phase = "clue" | "answered" | "timeout";

export default function MockExam({ onHome }: MockExamProps) {
  const [questions] = useState<QuizQuestion[]>(() => buildExamQuestions());
  const [qIndex, setQIndex] = useState(0);
  const [clueLevel, setClueLevel] = useState<1 | 2 | 3>(1);
  const [timeLeft, setTimeLeft] = useState(CLUE_TIMER_SECONDS);
  const [phase, setPhase] = useState<Phase>("clue");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [streak, setStreak] = useState(0);
  const [showStreakBurst, setShowStreakBurst] = useState(false);
  const [done, setDone] = useState(false);

  const [reaction, setReaction] = useState<(typeof CORRECT_REACTIONS)[0] | null>(null);
  const [showReaction, setShowReaction] = useState(false);
  const lastCorrectIdx = useRef(-1);
  const lastWrongIdx = useRef(-1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { play } = useSound();

  const safeIndex = Math.min(qIndex, Math.max(0, questions.length - 1));
  const currentQ = questions[safeIndex];
  const isLastQuestion = safeIndex === questions.length - 1;
  const isAnswered = phase === "answered" || phase === "timeout";

  const clueBadge: Record<1 | 2 | 3, { bg: string; text: string; border: string; label: string; icon: string }> = {
    1: { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-300",    label: "Hard Clue",   icon: "🔴" },
    2: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-300", label: "Medium Clue", icon: "🟠" },
    3: { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-300",  label: "Easy Clue",   icon: "🟢" },
  };

  // ── Timer ──────────────────────────────────────────────────────────
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
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

  // ── Reactions ──────────────────────────────────────────────────────
  const triggerReaction = (pool: typeof CORRECT_REACTIONS, lastRef: React.MutableRefObject<number>) => {
    const [r, idx] = pickRandom(pool, lastRef.current);
    lastRef.current = idx;
    setReaction(r);
    setShowReaction(true);
    setTimeout(() => setShowReaction(false), 1100);
  };

  // ── Answer handler ─────────────────────────────────────────────────
  const handleAnswer = (option: string) => {
    if (phase !== "clue") return;
    stopTimer();
    setSelectedOption(option);
    const correct = option === currentQ.answer;
    if (correct) {
      const stars = STARS_PER_CLUE[clueLevel];
      setResults((prev) => [...prev, { question: currentQ, correct: true, starsEarned: stars, clueUsed: clueLevel }]);
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
      setStreak(0);
      triggerReaction(WRONG_REACTIONS, lastWrongIdx);
      play("wrong");
      setTimeout(() => {
        setSelectedOption(null);
        if (clueLevel < 3) { setClueLevel((p) => (p + 1) as 1 | 2 | 3); setPhase("clue"); }
        else {
          setResults((prev) => [...prev, { question: currentQ, correct: false, starsEarned: 0, clueUsed: "timeout" }]);
          setPhase("timeout");
        }
      }, 900);
    }
  };

  // ── Timeout handler ────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "timeout" && results.length === safeIndex) {
      // already recorded in handleAnswer for wrong; record for pure timeout
    }
  }, [phase]);

  // ── Next question ──────────────────────────────────────────────────
  const handleNext = () => {
    if (isLastQuestion) {
      setDone(true);
    } else {
      setQIndex((i) => i + 1);
      setClueLevel(1);
      setSelectedOption(null);
      setPhase("clue");
      setShowReaction(false);
    }
  };

  const handleRetry = () => {
    // Reload page to get fresh shuffled questions
    window.location.reload();
  };

  const badge = clueBadge[clueLevel];
  const urgent = timeLeft <= 5;
  const totalStarsSoFar = results.reduce((a, r) => a + r.starsEarned, 0);

  // ── Guard ──────────────────────────────────────────────────────────
  if (!currentQ || !currentQ.clues || currentQ.clues.length < 3) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-2xl font-bold text-gray-600" style={{ fontFamily: "'Fredoka One', cursive" }}>
          🎉 Exam Complete!
        </p>
        <button onClick={() => setDone(true)} className="btn-jungle text-white text-lg font-bold px-8 py-3"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", fontFamily: "'Fredoka One', cursive", borderRadius: "16px" }}>
          📋 See Results
        </button>
      </div>
    );
  }

  if (done) {
    return <ExamScoreReport results={results} onRetry={handleRetry} onHome={onHome} />;
  }

  const topicObj = ALL_TOPICS.find((t) => t.id === currentQ.topicId);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "100dvh", background: "linear-gradient(135deg, #fdf4ff 0%, #fef9c3 50%, #eff6ff 100%)" }}
    >
      {/* ── HEADER ── */}
      <div className="flex-shrink-0 bg-white/90 backdrop-blur border-b border-gray-100 shadow-sm z-30">
        <div className="flex items-center justify-between px-4 py-2 gap-3">
          <button
            onClick={onHome}
            className="btn-jungle text-white text-base px-4 py-2 min-h-[44px] flex-shrink-0"
            style={{ background: "#6b7280" }}
          >
            ✕ Exit
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-2xl flex-shrink-0">📋</span>
            <span className="font-display text-lg text-gray-800 truncate" style={{ fontFamily: "'Fredoka One', cursive" }}>
              Mock Exam
            </span>
            <span className="text-sm text-gray-400 font-bold flex-shrink-0">· Q {qIndex + 1}/{questions.length}</span>
            {topicObj && (
              <span className="text-sm bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                {topicObj.emoji} {topicObj.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {streak >= 2 && (
              <div className={`flex items-center gap-1 rounded-full px-3 py-1 border ${showStreakBurst ? "bg-orange-100 border-orange-400 scale-110" : "bg-orange-50 border-orange-200"} transition-all duration-300`}>
                <span className="text-lg">🔥</span>
                <span className="font-bold text-orange-600 text-base" style={{ fontFamily: "'Fredoka One', cursive" }}>{streak}</span>
              </div>
            )}
            <div className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1">
              <span className="text-lg">⭐</span>
              <span className="font-bold text-yellow-700 text-base" style={{ fontFamily: "'Fredoka One', cursive" }}>{totalStarsSoFar}</span>
            </div>
          </div>
        </div>
        <div className="w-full bg-gray-100 h-1.5">
          <div
            className="h-1.5 transition-all duration-500"
            style={{ width: `${(qIndex / questions.length) * 100}%`, background: "linear-gradient(90deg, #9333ea, #7c3aed)" }}
          />
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 min-h-0 gap-3 p-3">

        {/* LEFT: clue card */}
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
                {showConfetti && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className="confetti-piece absolute w-3 h-3 rounded-sm"
                        style={{ backgroundColor: ["#f94144","#f9c74f","#43aa8b","#4cc9f0","#f3722c","#90be6d"][i % 6], left: `${5 + (i * 4.8) % 90}%`, top: `${5 + (i * 3.7) % 50}%`, animationDelay: `${i * 0.04}s`, transform: `rotate(${i * 22}deg)` }} />
                    ))}
                  </div>
                )}

                {reaction && <ReactionOverlay {...reaction} visible={showReaction} />}

                {/* Clue header */}
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${badge.bg} ${badge.text}`}>
                    <span>{badge.icon}</span>
                    <span>{badge.label}</span>
                    <span className="opacity-60">({clueLevel}/3)</span>
                  </div>
                  {phase === "clue" && <TimerRing seconds={timeLeft} total={CLUE_TIMER_SECONDS} urgent={urgent} />}
                  {phase === "answered" && (
                    <div className="flex gap-1 justify-center bounce-in">
                      {[1,2,3].map((i) => (
                        <span key={i} className={`text-2xl transition-all duration-300 ${i <= STARS_PER_CLUE[clueLevel] ? "star-pop opacity-100" : "opacity-20 grayscale"}`}
                          style={i <= STARS_PER_CLUE[clueLevel] ? { animationDelay: `${(i-1)*0.12}s` } : {}}>⭐</span>
                      ))}
                    </div>
                  )}
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
                      <motion.div key={level} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                        className={`rounded-xl p-3 border-2 flex-shrink-0 ${lb.bg} ${lb.border}`}>
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
                    {[1,2,3].map((i) => <span key={i} className={`text-base ${i <= STARS_PER_CLUE[clueLevel] ? "opacity-100" : "opacity-25 grayscale"}`}>⭐</span>)}
                    <span className="ml-1 text-yellow-600 font-bold">{STARS_PER_CLUE[clueLevel]} star{STARS_PER_CLUE[clueLevel] !== 1 ? "s" : ""}!</span>
                  </div>
                )}

                {/* Result panel (left side) */}
                {isAnswered && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                    className="mt-3 flex-shrink-0">
                    {phase === "answered" ? (
                      <div className="rounded-xl bg-green-50 border-2 border-green-300 p-3">
                        <p className="text-green-700 font-bold text-base">✅ Correct! The answer is <span className="text-green-800">{currentQ.answer}</span></p>
                        {currentQ.pronunciation && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-500 italic">({currentQ.pronunciation})</span>
                            <PronounceButton word={currentQ.answer} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-red-50 border-2 border-red-300 p-3">
                        <p className="text-red-700 font-bold text-base">⏰ The answer was <span className="text-red-800">{currentQ.answer}</span></p>
                        {currentQ.pronunciation && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-500 italic">({currentQ.pronunciation})</span>
                            <PronounceButton word={currentQ.answer} />
                          </div>
                        )}
                      </div>
                    )}
                    {currentQ.funFact && (
                      <p className="text-sm text-gray-500 italic mt-2 leading-snug">💡 {currentQ.funFact}</p>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* RIGHT: answer buttons + next */}
        <div className="flex flex-col w-[340px] flex-shrink-0 gap-3">
          <div className="grid grid-cols-2 gap-2 flex-1">
            {currentQ.options.map((opt) => {
              const isSelected = selectedOption === opt;
              const isCorrect = opt === currentQ.answer;
              let btnStyle = "bg-white border-2 border-gray-200 text-gray-800 hover:border-purple-400 hover:bg-purple-50";
              if (isAnswered) {
                if (isCorrect) btnStyle = "bg-green-100 border-2 border-green-500 text-green-800";
                else if (isSelected) btnStyle = "bg-red-100 border-2 border-red-400 text-red-700";
                else btnStyle = "bg-gray-50 border-2 border-gray-200 text-gray-400 opacity-60";
              }
              return (
                <motion.button
                  key={opt}
                  whileHover={!isAnswered ? { scale: 1.02 } : {}}
                  whileTap={!isAnswered ? { scale: 0.97 } : {}}
                  onClick={() => handleAnswer(opt)}
                  disabled={isAnswered}
                  className={`${btnStyle} rounded-2xl px-3 py-3 font-bold text-base leading-tight transition-all duration-200 flex items-center justify-center text-center min-h-[80px] shadow-sm`}
                  style={{ fontFamily: "'Nunito', sans-serif" }}
                >
                  {isAnswered && isCorrect && <span className="mr-1.5">✅</span>}
                  {isAnswered && isSelected && !isCorrect && <span className="mr-1.5">❌</span>}
                  {opt}
                </motion.button>
              );
            })}
          </div>

          {/* Next button */}
          <AnimatePresence>
            {isAnswered ? (
              <motion.button
                key="next-active"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                onClick={handleNext}
                className="w-full text-white font-bold text-xl py-5 rounded-2xl shadow-lg flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #9333ea, #7c3aed)",
                  fontFamily: "'Fredoka One', cursive",
                  boxShadow: "0 6px 20px rgba(147,51,234,0.4)",
                }}
              >
                {isLastQuestion ? "📋 See Results!" : "Next →"}
              </motion.button>
            ) : (
              <div className="w-full rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center py-5 opacity-50">
                <span className="text-gray-400 font-bold text-base" style={{ fontFamily: "'Fredoka One', cursive" }}>
                  Answer to continue →
                </span>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
