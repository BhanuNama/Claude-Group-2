import { useState, useCallback, useRef } from 'react';
import { streamDiagnosis, submitDiagnosis } from '../utils/api';

/**
 * Hook for managing a diagnostic analysis session.
 * 
 * Supports both streaming (SSE) and non-streaming modes.
 * Returns progressive state updates as each pipeline stage completes.
 */
export function useAnalysis() {
  const [status, setStatus] = useState('idle'); // idle | running | complete | error
  const [currentStage, setCurrentStage] = useState(null);
  const [completedStages, setCompletedStages] = useState([]);
  const [phenotypes, setPhenotypes] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [nextSteps, setNextSteps] = useState(null);
  const [opinions, setOpinions] = useState([]);
  const [reviewInfo, setReviewInfo] = useState(null);
  const [error, setError] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setCurrentStage(null);
    setCompletedStages([]);
    setPhenotypes([]);
    setCandidates([]);
    setRanking([]);
    setNextSteps(null);
    setOpinions([]);
    setReviewInfo(null);
    setError(null);
    setThreadId(null);
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const analyze = useCallback(async (notes, useStreaming = true) => {
    reset();
    setStatus('running');
    setStartTime(Date.now());

    // Elapsed timer
    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    if (useStreaming) {
      // SSE streaming mode
      streamRef.current = streamDiagnosis(
        notes,
        null,
        // onEvent
        (data) => {
          const stage = data.stage;
          setCurrentStage(stage);

          // Mark previous stage as complete
          setCompletedStages(prev => {
            if (stage && !prev.includes(stage)) {
              return [...prev, stage];
            }
            return prev;
          });

          // Process stage-specific data
          if (stage === 'extract' && data.phenotypes) {
            setPhenotypes(data.phenotypes);
          }
          if (stage === 'retrieve') {
            setCandidates(prev => data.candidates_count || prev);
          }
          if (stage === 'specialist' && data.opinions) {
            setOpinions(data.opinions);
          }
          if (stage === 'reviewer') {
            setReviewInfo({
              needs_revision: data.needs_revision,
              round: data.round,
              objections: data.objections || [],
            });
          }
          if (stage === 'cmo' && data.ranking) {
            setRanking(data.ranking);
          }
          if (stage === 'plan_next' && data.next_steps) {
            setNextSteps(data.next_steps);
          }

          if (data.thread_id) setThreadId(data.thread_id);
        },
        // onError
        (err) => {
          setStatus('error');
          setError(err.message);
          if (timerRef.current) clearInterval(timerRef.current);
        },
        // onComplete
        (data) => {
          setStatus('complete');
          setCurrentStage(null);
          if (data?.thread_id) setThreadId(data.thread_id);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      );
    } else {
      // Non-streaming fallback
      try {
        const result = await submitDiagnosis(notes);
        setPhenotypes(result.phenotypes || []);
        setRanking(result.ranking || []);
        setNextSteps(result.next_steps || null);
        setOpinions(result.opinions || []);
        if (result.objections) {
          setReviewInfo({ objections: result.objections, round: 1, needs_revision: false });
        }
        setThreadId(result.thread_id);
        setStatus('complete');
        setCompletedStages(['extract', 'retrieve', 'specialist', 'reviewer', 'cmo', 'plan_next']);
      } catch (err) {
        setStatus('error');
        setError(err.message);
      } finally {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }
  }, [reset]);

  const cancel = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.abort();
    }
    setStatus('idle');
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return {
    status,
    currentStage,
    completedStages,
    phenotypes,
    candidates,
    ranking,
    nextSteps,
    opinions,
    reviewInfo,
    error,
    threadId,
    elapsed,
    analyze,
    cancel,
    reset,
  };
}
