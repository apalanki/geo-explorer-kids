// useProgress.ts
// Persists quiz progress in localStorage so sessions can be resumed.
// Tracks: stars earned per question, which questions have been answered,
// and total stars per topic.

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "geo_explorer_progress_v2";

export interface QuestionProgress {
  answered: boolean;
  starsEarned: number;
  clueUsed: 1 | 2 | 3; // which clue level they answered on
}

export interface TopicProgress {
  totalStars: number;
  questionsAnswered: number;
  questions: Record<string, QuestionProgress>; // keyed by question id
  lastPlayed: string; // ISO date string
}

export type AllProgress = Record<string, TopicProgress>; // keyed by topic id

function loadProgress(): AllProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as AllProgress;
  } catch {
    return {};
  }
}

function saveProgress(data: AllProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

export function useProgress() {
  const [progress, setProgress] = useState<AllProgress>(() => loadProgress());

  // Persist to localStorage whenever progress changes
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  /** Record a completed question answer */
  const recordAnswer = useCallback(
    (topicId: string, questionId: string, starsEarned: number, clueUsed: 1 | 2 | 3) => {
      setProgress((prev) => {
        const existing = prev[topicId] ?? {
          totalStars: 0,
          questionsAnswered: 0,
          questions: {},
          lastPlayed: new Date().toISOString(),
        };

        const alreadyAnswered = existing.questions[questionId]?.answered ?? false;
        const prevStars = existing.questions[questionId]?.starsEarned ?? 0;

        // Only add the delta if re-playing (allow improvement)
        const starDelta = starsEarned - prevStars;

        const updatedQuestions: Record<string, QuestionProgress> = {
          ...existing.questions,
          [questionId]: {
            answered: true,
            starsEarned,
            clueUsed,
          },
        };

        return {
          ...prev,
          [topicId]: {
            totalStars: Math.max(0, existing.totalStars + (alreadyAnswered ? starDelta : starsEarned)),
            questionsAnswered: alreadyAnswered
              ? existing.questionsAnswered
              : existing.questionsAnswered + 1,
            questions: updatedQuestions,
            lastPlayed: new Date().toISOString(),
          },
        };
      });
    },
    []
  );

  /** Reset progress for a single topic */
  const resetTopic = useCallback((topicId: string) => {
    setProgress((prev) => {
      const updated = { ...prev };
      delete updated[topicId];
      return updated;
    });
  }, []);

  /** Reset ALL progress */
  const resetAll = useCallback(() => {
    setProgress({});
  }, []);

  /** Get progress for a specific topic */
  const getTopicProgress = useCallback(
    (topicId: string): TopicProgress => {
      return (
        progress[topicId] ?? {
          totalStars: 0,
          questionsAnswered: 0,
          questions: {},
          lastPlayed: "",
        }
      );
    },
    [progress]
  );

  /** Get stars earned for a specific question */
  const getQuestionStars = useCallback(
    (topicId: string, questionId: string): number => {
      return progress[topicId]?.questions[questionId]?.starsEarned ?? 0;
    },
    [progress]
  );

  /** Total stars across all topics */
  const grandTotalStars = Object.values(progress).reduce(
    (sum, t) => sum + t.totalStars,
    0
  );

  /** Total questions answered across all topics */
  const grandTotalAnswered = Object.values(progress).reduce(
    (sum, t) => sum + t.questionsAnswered,
    0
  );

  return {
    progress,
    recordAnswer,
    resetTopic,
    resetAll,
    getTopicProgress,
    getQuestionStars,
    grandTotalStars,
    grandTotalAnswered,
  };
}
