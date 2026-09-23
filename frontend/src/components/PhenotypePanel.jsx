import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  Brain,
  Dna,
  Microscope,
  Heart,
  Activity,
  Eye,
  Layers,
  Tag,
  Quote
} from 'lucide-react';

const SYSTEM_ICON_COMPONENTS = {
  neurology: Brain,
  metabolic: Dna,
  genetics: Microscope,
  cardiology: Heart,
  musculoskeletal: Activity,
  sensory: Eye,
  other: Layers,
};

export default function PhenotypePanel({ phenotypes = [] }) {
  if (!phenotypes || phenotypes.length === 0) return null;

  const present = phenotypes.filter(p => !p.negated);
  const absent = phenotypes.filter(p => p.negated);

  return (
    <div className="section-card animate-fade-in" style={{ borderRadius: 'var(--radius-lg)' }}>
      {/* Horizontal Bar Header */}
      <div className="section-header" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="section-title">
          <div className="section-title-icon" style={{ width: 30, height: 30 }}>
            <ClipboardList size={16} className="text-primary" />
          </div>
          <span style={{ fontSize: '1.05rem' }}>Extracted <em>Phenotypes</em></span>
        </div>
        <div className="flex gap-xs">
          <span className="badge badge-green flex items-center gap-xs" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
            <CheckCircle2 size={11} />
            <span>{present.length} Present</span>
          </span>
          {absent.length > 0 && (
            <span className="badge badge-red flex items-center gap-xs" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
              <XCircle size={11} />
              <span>{absent.length} Absent</span>
            </span>
          )}
        </div>
      </div>

      {/* Horizontal Chips / Cards Scroll Container */}
      <div className="section-body" style={{ padding: '14px 18px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '10px'
          }}
        >
          {phenotypes.map((p, idx) => {
            const SystemIcon = SYSTEM_ICON_COMPONENTS[p.system] || Layers;
            const isAbsent = p.negated;

            return (
              <div
                key={idx}
                className="phenotype-chip animate-fade-in"
                style={{
                  background: isAbsent ? 'rgba(254, 242, 242, 0.7)' : '#ffffff',
                  border: isAbsent ? '1px solid rgba(220, 38, 38, 0.25)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  boxShadow: 'var(--shadow-xs)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                {/* Title and ID Row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span
                      className={`phenotype-indicator ${isAbsent ? 'absent' : 'present'}`}
                      style={{ marginTop: 0, width: 7, height: 7, flexShrink: 0 }}
                    />
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.84rem',
                        color: isAbsent ? 'var(--text-secondary)' : 'var(--text-primary)',
                        textDecoration: isAbsent ? 'line-through' : 'none',
                        lineHeight: 1.3,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={p.hpo_label || p.text}
                    >
                      {p.hpo_label || p.text}
                    </span>
                  </div>

                  <span
                    className={`badge ${isAbsent ? 'badge-red' : 'badge-teal'}`}
                    style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', padding: '1px 5px', flexShrink: 0 }}
                  >
                    {isAbsent ? 'RULED OUT' : p.hpo_id}
                  </span>
                </div>

                {/* Metadata Row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                  <span className="badge badge-neutral flex items-center gap-xs" style={{ fontSize: '0.65rem', padding: '1px 6px', textTransform: 'capitalize' }}>
                    <SystemIcon size={10} />
                    <span>{p.system}</span>
                  </span>

                  {p.onset && (
                    <span className="badge badge-purple flex items-center gap-xs" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                      <Clock size={9} />
                      <span>{p.onset}</span>
                    </span>
                  )}

                  {!isAbsent && p.text && p.text !== p.hpo_label && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 140
                      }}
                      title={p.text}
                    >
                      "{p.text}"
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
