import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'rds_case_history';

/**
 * Hook for managing case history in localStorage.
 */
export function useCases() {
  const [cases, setCases] = useState([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCases(JSON.parse(stored));
      }
    } catch {
      setCases([]);
    }
  }, []);

  // Save case
  const saveCase = useCallback((caseData) => {
    setCases(prev => {
      const caseId = caseData.threadId || Date.now().toString();
      const newEntry = {
        id: caseId,
        threadId: caseId,
        timestamp: new Date().toISOString(),
        notes: caseData.notes || '',
        notesPreview: (caseData.notes || '').slice(0, 80),
        topDiagnosis: caseData.ranking?.[0]?.name || 'Diagnostic Analysis',
        phenotypeCount: caseData.phenotypes?.length || 0,
        phenotypes: caseData.phenotypes || [],
        ranking: caseData.ranking || [],
        opinions: caseData.opinions || [],
        reviewInfo: caseData.reviewInfo || null,
        nextSteps: caseData.nextSteps || null,
      };

      const updated = [
        newEntry,
        ...prev.filter(c => c.id !== caseId && c.threadId !== caseId),
      ].slice(0, 20); // Keep last 20

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('LocalStorage save failed:', err);
      }
      return updated;
    });
  }, []);

  // Delete case
  const deleteCase = useCallback((caseId) => {
    setCases(prev => {
      const updated = prev.filter(c => c.id !== caseId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Clear all
  const clearCases = useCallback(() => {
    setCases([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { cases, saveCase, deleteCase, clearCases };
}
