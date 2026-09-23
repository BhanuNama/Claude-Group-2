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
      const updated = [
        {
          id: caseData.threadId || Date.now().toString(),
          timestamp: new Date().toISOString(),
          notesPreview: (caseData.notes || '').slice(0, 80),
          topDiagnosis: caseData.ranking?.[0]?.name || 'No results',
          phenotypeCount: caseData.phenotypes?.length || 0,
        },
        ...prev.filter(c => c.id !== caseData.threadId),
      ].slice(0, 20); // Keep last 20

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
