import {
  Compass,
  Search,
  HelpCircle,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Stethoscope
} from 'lucide-react';

export default function NextStepsPanel({ nextSteps }) {
  if (!nextSteps) return null;

  return (
    <div className="section-card animate-fade-in" style={{ borderRadius: 'var(--radius-lg)' }}>
      {/* Header */}
      <div className="section-header">
        <div className="section-title">
          <div className="section-title-icon">
            <Compass size={18} className="text-primary" />
          </div>
          <span>Targeted Diagnostic <em>Next Steps</em></span>
        </div>
        <span className="badge badge-primary-subtle flex items-center gap-xs">
          <Stethoscope size={12} />
          <span>Decision Support</span>
        </span>
      </div>

      <div className="section-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {/* Recommended Features to Examine */}
        {nextSteps.examine_next?.length > 0 && (
          <div>
            <div className="flex items-center gap-xs" style={{ marginBottom: 4 }}>
              <Search size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                Recommended Differentiating Phenotypes to Examine
              </span>
            </div>
            <p className="text-xs text-muted" style={{ marginBottom: 8, lineHeight: 1.4 }}>
              Key differentiating features of the top candidate that are absent in runner-ups and not yet documented in the patient:
            </p>
            <div className="flex flex-col gap-xs">
              {nextSteps.examine_next.map((item, i) => (
                <div
                  key={i}
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)'
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(79, 110, 247, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-primary)',
                      flexShrink: 0
                    }}
                  >
                    <ArrowRight size={13} />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unexplained Findings */}
        {nextSteps.still_unexplained?.length > 0 && (
          <div>
            <div className="flex items-center gap-xs" style={{ marginBottom: 4 }}>
              <HelpCircle size={14} className="text-amber-600" />
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                Unexplained Clinical Findings ({nextSteps.still_unexplained.length})
              </span>
            </div>
            <p className="text-xs text-muted" style={{ marginBottom: 8, lineHeight: 1.4 }}>
              Patient phenotypes not accounted for by the leading hypothesis (suggesting potential dual pathology or atypical presentation):
            </p>
            <div className="flex flex-col gap-xs">
              {nextSteps.still_unexplained.map((item, i) => (
                <div
                  key={i}
                  style={{
                    background: '#fffbeb',
                    border: '1px solid rgba(217, 119, 6, 0.25)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#92400e'
                  }}
                >
                  <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clinical Advisory Banner */}
        {nextSteps.note && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 14px',
              background: 'rgba(240, 244, 255, 0.8)',
              border: '1px solid rgba(79, 110, 247, 0.2)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.4
            }}
          >
            <ShieldAlert size={16} className="text-primary flex-shrink-0" style={{ marginTop: 2 }} />
            <div>
              <strong>Clinical Decision Support Note:</strong> {nextSteps.note}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
