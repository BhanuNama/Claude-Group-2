import { useState } from 'react';
import { FileText, Sparkles, Play, X, CornerDownLeft } from 'lucide-react';
import { EXAMPLE_CASE } from '../utils/constants';

export default function CaseInput({ onSubmit, isRunning, onCancel, notes: externalNotes, onNotesChange }) {
  const [internalNotes, setInternalNotes] = useState('');
  const notes = externalNotes !== undefined ? externalNotes : internalNotes;
  const setNotes = (val) => {
    if (onNotesChange) onNotesChange(val);
    else setInternalNotes(val);
  };

  const handleSubmit = () => {
    if (notes.trim() && !isRunning) {
      onSubmit(notes.trim());
    }
  };

  const handleExample = () => {
    setNotes(EXAMPLE_CASE);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="glass-card elevated">
      <div className="flex items-center justify-between mb-md">
        <div>
          <div className="flex items-center gap-xs">
            <FileText size={18} className="text-primary" />
            <h3 className="card-section-title">
              Patient Clinical <em>Notes</em>
            </h3>
          </div>
          <p className="text-sm text-secondary" style={{ marginTop: 2 }}>
            Input unstructured clinical notes, signs, lab values, onset timeline, and family history
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleExample}
          disabled={isRunning}
        >
          <Sparkles size={14} style={{ marginRight: 6 }} />
          <span>Load Example Case</span>
        </button>
      </div>

      <textarea
        className="textarea"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`Enter patient clinical notes here...\n\nExample:\n6-year-old boy. Progressive muscle weakness since age 3, very high CK level (markedly elevated creatine kinase), delayed speech and language development, sensorineural hearing loss in both ears. Calf pseudohypertrophy noted on examination. No seizures. No cardiac involvement at this time. Family history: maternal uncle had similar symptoms, wheelchair-bound by age 12.`}
        disabled={isRunning}
        rows={6}
      />

      <div className="flex items-center justify-between" style={{ marginTop: 'var(--space-md)' }}>
        <div className="flex items-center gap-md">
          <span className="text-xs text-muted">
            {notes.length} characters
          </span>
          <span className="text-xs text-muted flex items-center gap-xs">
            <kbd className="kbd-shortcut">Ctrl</kbd> + <kbd className="kbd-shortcut">Enter</kbd> to run
          </span>
        </div>

        <div className="flex gap-sm">
          {isRunning ? (
            <button className="btn btn-secondary" onClick={onCancel}>
              <X size={16} style={{ marginRight: 6 }} />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              className="btn btn-primary btn-lg"
              onClick={handleSubmit}
              disabled={!notes.trim()}
            >
              <Play size={16} fill="currentColor" style={{ marginRight: 6 }} />
              <span>Analyze Case</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
