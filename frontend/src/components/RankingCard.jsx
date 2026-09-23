import { useState } from 'react';
import {
  ChevronDown,
  Dna,
  Tag,
  Layers,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Brain,
  Microscope,
  Heart,
  Activity,
  Eye,
  Percent,
  Check
} from 'lucide-react';

const SYSTEM_ICONS = {
  neurology: Brain,
  metabolic: Dna,
  genetics: Microscope,
  cardiology: Heart,
  musculoskeletal: Activity,
  sensory: Eye,
  other: Layers,
};

export default function RankingCard({ disease, rank }) {
  const [expanded, setExpanded] = useState(rank === 1);

  const scorePercent = Math.max(0, Math.min(100, (disease.final_score || 0) * 100));

  // Parse structured specialist note: "[system] (stance) rationale"
  const parseSpecialistNote = (note) => {
    const match = note.match(/^\[(.*?)\]\s*\((.*?)\)\s*(.*)$/);
    if (match) {
      return {
        system: match[1].toLowerCase(),
        stance: match[2].toLowerCase(),
        rationale: match[3],
      };
    }
    return {
      system: 'other',
      stance: 'neutral',
      rationale: note,
    };
  };

  const getStancePill = (stance) => {
    if (stance === 'support') {
      return (
        <span className="badge badge-green flex items-center gap-xs" style={{ fontSize: '0.65rem' }}>
          <CheckCircle2 size={10} />
          <span>SUPPORT</span>
        </span>
      );
    }
    if (stance === 'oppose') {
      return (
        <span className="badge badge-red flex items-center gap-xs" style={{ fontSize: '0.65rem' }}>
          <XCircle size={10} />
          <span>OPPOSE</span>
        </span>
      );
    }
    return (
      <span className="badge badge-neutral flex items-center gap-xs" style={{ fontSize: '0.65rem' }}>
        <MinusCircle size={10} />
        <span>NEUTRAL</span>
      </span>
    );
  };

  return (
    <div
      className={`ranking-card animate-fade-in ${rank === 1 ? 'top-result' : ''}`}
      style={{
        animationDelay: `${(rank - 1) * 50}ms`,
        borderRadius: 'var(--radius-lg)',
        border: rank === 1 ? '1.5px solid #4F6EF7' : '1px solid var(--border-subtle)',
        background: '#ffffff',
        overflow: 'hidden',
        boxShadow: rank === 1 ? '0 4px 20px rgba(79, 110, 247, 0.12)' : 'var(--shadow-xs)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header Bar */}
      <div
        className="ranking-card-header"
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        {/* Rank Badge */}
        <div
          className={`rank-number rank-${Math.min(rank, 5)}`}
          style={{
            width: 30,
            height: 30,
            borderRadius: 'var(--radius-sm)',
            fontWeight: 800,
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          #{rank}
        </div>

        {/* Info Column */}
        <div className="ranking-info" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 1 }}>
            {rank === 1 && (
              <span className="badge badge-primary-subtle" style={{ fontSize: '0.62rem', padding: '0px 5px' }}>
                <Sparkles size={9} style={{ marginRight: 2 }} />
                Leading Hypothesis
              </span>
            )}
            <span className="badge badge-teal" style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', padding: '0px 5px' }}>
              <Tag size={8} style={{ marginRight: 2 }} />
              {disease.id}
            </span>
            {disease.genes?.map(g => (
              <span key={g} className="badge badge-purple" style={{ fontSize: '0.62rem', padding: '0px 5px' }}>
                <Dna size={8} style={{ marginRight: 2 }} />
                {g}
              </span>
            ))}
          </div>

          <div
            style={{
              fontSize: '0.92rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            title={disease.name}
          >
            {disease.name}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
            <span className="text-xs text-muted" style={{ fontSize: '0.7rem' }}>
              {disease.matched_hpo?.length || 0} matched features
            </span>
          </div>
        </div>

        {/* Score Column */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.1rem',
              fontWeight: 800,
              color: 'var(--accent-primary)',
              lineHeight: 1
            }}
          >
            {(disease.final_score || 0).toFixed(3)}
          </div>
          <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginTop: 2 }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              {expanded ? 'Collapse' : 'Details'}
            </span>
            <ChevronDown size={12} className={`expand-chevron ${expanded ? 'expanded' : ''}`} />
          </div>
        </div>
      </div>

      {/* Score Progress Bar */}
      <div style={{ padding: '0 14px 8px' }}>
        <div className="score-bar" style={{ height: 3.5, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
          <div
            className="score-bar-fill"
            style={{
              width: `${scorePercent}%`,
              height: '100%',
              background: rank === 1 ? 'linear-gradient(90deg, #4F6EF7, #38bdf8)' : 'linear-gradient(90deg, #64748b, #94a3b8)',
              borderRadius: 2,
              transition: 'width 0.5s ease'
            }}
          />
        </div>
      </div>

      {/* Collapsible Expanded Details */}
      {expanded && (
        <div
          className="ranking-expanded"
          style={{
            padding: '16px 18px 20px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(248, 250, 255, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}
        >
          {/* 3-Score Breakdown Cards */}
          <div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider" style={{ marginBottom: 6 }}>
              Score Composition
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {(disease.graph_norm || 0).toFixed(3)}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Graph Match (70%)
                </span>
              </div>

              <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: (disease.panel_consensus || 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                  {(disease.panel_consensus || 0) >= 0 ? '+' : ''}{(disease.panel_consensus || 0).toFixed(3)}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Specialists (30%)
                </span>
              </div>

              <div style={{ background: '#eef2ff', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(79, 110, 247, 0.3)', textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#4F6EF7' }}>
                  {(disease.final_score || 0).toFixed(3)}
                </span>
                <span style={{ fontSize: '0.65rem', color: '#4F6EF7', fontWeight: 600, textTransform: 'uppercase' }}>
                  Composite Score
                </span>
              </div>
            </div>
          </div>

          {/* Matched Phenotypes */}
          {disease.matched_hpo?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wider" style={{ marginBottom: 6 }}>
                Matched Phenotype Terms ({disease.matched_hpo.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {disease.matched_hpo.map(code => (
                  <span key={code} className="badge badge-teal flex items-center gap-xs" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
                    <Check size={11} strokeWidth={2.5} />
                    <span>{code}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Specialist Findings */}
          {disease.specialist_notes?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wider" style={{ marginBottom: 6 }}>
                Specialist Assessments
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {disease.specialist_notes.map((note, i) => {
                  const parsed = parseSpecialistNote(note);
                  const Icon = SYSTEM_ICONS[parsed.system] || Layers;

                  return (
                    <div
                      key={i}
                      style={{
                        background: '#ffffff',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon size={12} className="text-primary" />
                          <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                            {parsed.system} Specialist
                          </span>
                        </div>
                        {getStancePill(parsed.stance)}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {parsed.rationale}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Open Objections / Flags */}
          {disease.open_objections?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wider" style={{ marginBottom: 6, color: '#b45309' }}>
                Reviewer Objections ({disease.open_objections.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {disease.open_objections.map((obj, i) => (
                  <div
                    key={i}
                    style={{
                      background: '#fffbeb',
                      border: '1px solid rgba(217, 119, 6, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      fontSize: '0.8rem',
                      color: '#92400e',
                      lineHeight: 1.4
                    }}
                  >
                    <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" style={{ marginTop: 2 }} />
                    <div style={{ flex: 1 }}>{obj}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
