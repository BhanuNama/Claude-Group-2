import { Clock, Trash2, ChevronRight, FolderOpen, FileText } from 'lucide-react';

export default function CaseHistory({ cases, onSelect, activeId, onClear }) {
  if (cases.length === 0) {
    return (
      <div className="case-history-empty">
        <FolderOpen size={24} className="text-muted" style={{ margin: '0 auto 6px' }} />
        <p className="text-xs text-muted" style={{ textAlign: 'center' }}>
          No previous cases saved
        </p>
      </div>
    );
  }

  return (
    <div className="case-history-wrapper">
      <div className="flex items-center justify-between mb-sm" style={{ padding: '0 0.25rem' }}>
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">
          Recent Cases
        </span>
        {cases.length > 0 && (
          <button className="btn btn-ghost btn-xs flex items-center gap-xs" onClick={onClear} title="Clear history">
            <Trash2 size={11} />
            <span>Clear</span>
          </button>
        )}
      </div>
      <div className="case-history-list">
        {cases.map(c => {
          const time = new Date(c.timestamp);
          const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

          return (
            <div
              key={c.id}
              className={`case-item ${c.id === activeId ? 'active' : ''}`}
              onClick={() => onSelect(c)}
            >
              <div className="case-item-icon-box">
                <FileText size={13} className="text-primary" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="case-item-text">{c.topDiagnosis || 'Case Analysis'}</div>
                <div className="text-xs text-muted" style={{ marginTop: 1 }}>
                  {c.phenotypeCount} phenotypes
                </div>
              </div>
              <div className="flex items-center gap-xs">
                <span className="case-item-time">{timeStr}</span>
                <ChevronRight size={12} className="text-muted" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
