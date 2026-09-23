import { useState, useMemo } from 'react';
import {
  Users,
  Brain,
  Heart,
  Dna,
  Microscope,
  Activity,
  Eye,
  Layers,
  Scale,
  Tag,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  Stethoscope,
  Filter
} from 'lucide-react';
import { SYSTEM_ABBREVIATIONS } from '../utils/constants';

const SYSTEM_ICON_COMPONENTS = {
  neurology: Brain,
  metabolic: Dna,
  genetics: Microscope,
  cardiology: Heart,
  musculoskeletal: Activity,
  sensory: Eye,
  other: Layers,
  reviewer: Scale,
};

export default function SpecialistDebate({ opinions = [], reviewInfo = null, ranking = [] }) {
  const [viewMode, setViewMode] = useState('disease'); // 'disease' | 'specialty'
  const [selectedSystem, setSelectedSystem] = useState('all');

  // Disease lookup map for names
  const diseaseNameMap = useMemo(() => {
    const map = {};
    (ranking || []).forEach(r => {
      map[r.id] = r.name;
    });
    return map;
  }, [ranking]);

  // Aggregate assessments from explicit opinions OR extract from ranking specialist_notes as fallback
  const allAssessments = useMemo(() => {
    const list = [];
    
    if (opinions && opinions.length > 0) {
      opinions.forEach(op => {
        const sys = (op.system || 'other').toLowerCase();
        (op.assessments || []).forEach(a => {
          list.push({
            ...a,
            system: sys,
            disease_name: diseaseNameMap[a.disease_id] || a.disease_id,
          });
        });
      });
    } else if (ranking && ranking.length > 0) {
      // Fallback: parse from ranking specialist_notes
      ranking.forEach(r => {
        (r.specialist_notes || []).forEach(note => {
          // Format: "[neurology] (support) Rationale text..."
          const match = note.match(/^\[(.*?)\]\s*\((.*?)\)\s*(.*)$/);
          if (match) {
            const sys = match[1].toLowerCase();
            const stance = match[2].toLowerCase();
            const rationale = match[3];
            list.push({
              disease_id: r.id,
              disease_name: r.name,
              system: sys,
              stance: stance,
              confidence: stance === 'support' ? 0.9 : stance === 'oppose' ? 0.85 : 0.5,
              rationale: rationale,
              cited_hpo_codes: [],
            });
          }
        });
      });
    }
    return list;
  }, [opinions, ranking, diseaseNameMap]);

  // Group assessments by disease
  const diseaseGroups = useMemo(() => {
    const groups = {};
    allAssessments.forEach(item => {
      if (!groups[item.disease_id]) {
        groups[item.disease_id] = {
          id: item.disease_id,
          name: item.disease_name || item.disease_id,
          assessments: [],
        };
      }
      groups[item.disease_id].assessments.push(item);
    });
    return Object.values(groups);
  }, [allAssessments]);

  // Group assessments by specialty system
  const systemGroups = useMemo(() => {
    const groups = {};
    allAssessments.forEach(item => {
      const sys = item.system;
      if (!groups[sys]) {
        groups[sys] = {
          system: sys,
          assessments: [],
        };
      }
      groups[sys].assessments.push(item);
    });
    return Object.values(groups);
  }, [allAssessments]);

  // Available unique systems for filtering
  const availableSystems = useMemo(() => {
    const set = new Set(allAssessments.map(a => a.system));
    return Array.from(set);
  }, [allAssessments]);

  const getStanceIcon = (stance) => {
    if (stance === 'support') return <CheckCircle2 size={13} style={{ marginRight: 4 }} />;
    if (stance === 'oppose') return <XCircle size={13} style={{ marginRight: 4 }} />;
    return <MinusCircle size={13} style={{ marginRight: 4 }} />;
  };

  if (allAssessments.length === 0) {
    return (
      <div className="section-card animate-fade-in">
        <div className="section-header">
          <div className="section-title">
            <div className="section-title-icon">
              <Users size={18} className="text-primary" />
            </div>
            <span>Specialist Panel <em>Debate</em></span>
          </div>
        </div>
        <div className="section-body">
          <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
            <Stethoscope size={36} className="text-muted" style={{ margin: '0 auto 12px' }} />
            <div className="text-sm text-secondary">
              Specialist deliberations will appear here once candidates are evaluated across body systems.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredAssessments = selectedSystem === 'all'
    ? allAssessments
    : allAssessments.filter(a => a.system === selectedSystem);

  return (
    <div className="section-card animate-fade-in">
      {/* Header */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
        <div className="section-title">
          <div className="section-title-icon">
            <Users size={18} className="text-primary" />
          </div>
          <span>Multidisciplinary <em>Specialist Deliberation</em></span>
        </div>
        
        <div className="flex items-center gap-sm" style={{ flexWrap: 'wrap' }}>
          {/* View Mode Toggle */}
          <div className="tabs" style={{ marginBottom: 0, padding: 2, background: 'rgba(235, 240, 250, 0.8)' }}>
            <button
              className={`tab ${viewMode === 'disease' ? 'active' : ''}`}
              onClick={() => setViewMode('disease')}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              By Disease
            </button>
            <button
              className={`tab ${viewMode === 'specialty' ? 'active' : ''}`}
              onClick={() => setViewMode('specialty')}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              By Specialty
            </button>
          </div>

          <span className="badge badge-primary-subtle flex items-center gap-xs">
            <Users size={12} />
            <span>{availableSystems.length} Medical Specialties</span>
          </span>

          {reviewInfo && (
            <span className="badge badge-amber flex items-center gap-xs">
              <Scale size={12} />
              <span>
                Round {reviewInfo.round || 1}
                {reviewInfo.needs_revision ? ' (Revision)' : ' (Consensus)'}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Specialty Filter Pills */}
      {availableSystems.length > 1 && (
        <div style={{ padding: '8px var(--space-lg)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '6px', overflowX: 'auto', alignItems: 'center' }}>
          <span className="text-xs text-muted flex items-center gap-xs" style={{ marginRight: 4 }}>
            <Filter size={12} /> Filter:
          </span>
          <button
            className={`badge ${selectedSystem === 'all' ? 'badge-primary' : 'badge-neutral'}`}
            onClick={() => setSelectedSystem('all')}
            style={{ cursor: 'pointer', border: 'none' }}
          >
            All ({allAssessments.length})
          </button>
          {availableSystems.map(sys => {
            const count = allAssessments.filter(a => a.system === sys).length;
            const Icon = SYSTEM_ICON_COMPONENTS[sys] || Layers;
            return (
              <button
                key={sys}
                className={`badge ${selectedSystem === sys ? 'badge-primary' : 'badge-neutral'} flex items-center gap-xs`}
                onClick={() => setSelectedSystem(sys)}
                style={{ cursor: 'pointer', border: 'none', textTransform: 'capitalize' }}
              >
                <Icon size={11} />
                <span>{sys} ({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Body */}
      <div className="section-body">
        {/* REVIEWER OBJECTIONS BANNER (IF ANY) */}
        {reviewInfo?.objections?.length > 0 && (
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="objection-card major" style={{ marginBottom: 'var(--space-md)' }}>
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" style={{ marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4, color: '#92400e' }}>
                  Adversarial Reviewer Findings ({reviewInfo.objections.length} flags identified)
                </div>
                <div className="flex flex-col gap-xs">
                  {reviewInfo.objections.map((obj, i) => (
                    <div key={i} className="text-xs" style={{ color: '#78350f', lineHeight: 1.4 }}>
                      • <strong>[{obj.severity?.toUpperCase()}]</strong> {obj.disease_id ? `${obj.disease_id}: ` : ''}{obj.reason}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BY DISEASE VIEW */}
        {viewMode === 'disease' && (
          <div className="flex flex-col gap-lg">
            {diseaseGroups.map(group => {
              const matchedAssessments = group.assessments.filter(a =>
                selectedSystem === 'all' || a.system === selectedSystem
              );
              if (matchedAssessments.length === 0) return null;

              return (
                <div key={group.id} className="debate-group">
                  <div className="debate-group-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: 8 }}>
                        {group.name}
                      </span>
                      <span className="font-mono text-primary text-xs">({group.id})</span>
                    </div>
                    <span className="text-xs text-muted">
                      {matchedAssessments.length} specialist evaluations
                    </span>
                  </div>

                  <div className="flex flex-col gap-md">
                    {matchedAssessments.map((assessment, idx) => {
                      const SystemIcon = SYSTEM_ICON_COMPONENTS[assessment.system] || Layers;
                      return (
                        <div className="debate-entry" key={idx}>
                          <div className={`debate-avatar ${assessment.system}`}>
                            {SYSTEM_ABBREVIATIONS[assessment.system] || assessment.system?.slice(0, 3).toUpperCase()}
                          </div>

                          <div className="debate-body">
                            <div className="debate-header">
                              <div className="debate-system flex items-center gap-xs">
                                <SystemIcon size={14} className="text-primary" />
                                <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                                  {assessment.system} Specialist
                                </span>
                              </div>
                              <span className={`debate-stance ${assessment.stance} flex items-center`}>
                                {getStanceIcon(assessment.stance)}
                                <span style={{ textTransform: 'uppercase' }}>{assessment.stance}</span>
                              </span>
                            </div>

                            <div className="debate-rationale">{assessment.rationale}</div>

                            <div className="debate-confidence">
                              <span className="text-xs text-muted">Confidence:</span>
                              <div className="confidence-bar" style={{ width: 100 }}>
                                <div
                                  className="confidence-fill"
                                  style={{ width: `${Math.round((assessment.confidence || 0) * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {(assessment.confidence || 0).toFixed(2)}
                              </span>
                            </div>

                            {assessment.cited_hpo_codes?.length > 0 && (
                              <div className="flex flex-wrap gap-xs" style={{ marginTop: 8 }}>
                                {assessment.cited_hpo_codes.map(code => (
                                  <span key={code} className="badge badge-teal flex items-center gap-xs" style={{ fontSize: '0.65rem' }}>
                                    <Tag size={9} />
                                    <span>{code}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* BY SPECIALTY VIEW */}
        {viewMode === 'specialty' && (
          <div className="flex flex-col gap-lg">
            {systemGroups.map(group => {
              if (selectedSystem !== 'all' && group.system !== selectedSystem) return null;
              const SystemIcon = SYSTEM_ICON_COMPONENTS[group.system] || Layers;

              return (
                <div key={group.system} className="debate-group">
                  <div className="debate-group-title flex items-center gap-sm">
                    <div className={`debate-avatar ${group.system}`} style={{ width: 28, height: 28, fontSize: '0.7rem' }}>
                      {SYSTEM_ABBREVIATIONS[group.system] || group.system?.slice(0, 3).toUpperCase()}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {group.system} Department
                      </span>
                      <span className="text-xs text-muted" style={{ marginLeft: 8 }}>
                        ({group.assessments.length} candidate assessments)
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-md">
                    {group.assessments.map((assessment, idx) => (
                      <div className="debate-entry" key={idx}>
                        <div className="debate-body" style={{ width: '100%' }}>
                          <div className="debate-header">
                            <div className="flex items-center gap-xs">
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {assessment.disease_name}
                              </span>
                              <span className="font-mono text-muted text-xs">({assessment.disease_id})</span>
                            </div>
                            <span className={`debate-stance ${assessment.stance} flex items-center`}>
                              {getStanceIcon(assessment.stance)}
                              <span style={{ textTransform: 'uppercase' }}>{assessment.stance}</span>
                            </span>
                          </div>

                          <div className="debate-rationale">{assessment.rationale}</div>

                          <div className="debate-confidence">
                            <span className="text-xs text-muted">Confidence:</span>
                            <div className="confidence-bar" style={{ width: 100 }}>
                              <div
                                className="confidence-fill"
                                style={{ width: `${Math.round((assessment.confidence || 0) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-mono font-semibold">
                              {(assessment.confidence || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
