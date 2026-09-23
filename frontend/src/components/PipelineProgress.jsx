import {
  FileText,
  Database,
  Users,
  Scale,
  Trophy,
  Compass,
  Check,
  AlertCircle,
  Loader2,
  Workflow
} from 'lucide-react';
import { PIPELINE_STAGES } from '../utils/constants';

const ICON_COMPONENTS = {
  FileText: FileText,
  Database: Database,
  Users: Users,
  Scale: Scale,
  Trophy: Trophy,
  Compass: Compass,
};

export default function PipelineProgress({ currentStage, completedStages, status, elapsed }) {
  const getStageStatus = (stageKey) => {
    if (status === 'error' && currentStage === stageKey) return 'error';
    if (currentStage === stageKey && status === 'running') return 'active';
    if (completedStages.includes(stageKey)) return 'complete';
    return 'pending';
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  if (status === 'idle') return null;

  return (
    <div className="section-card animate-fade-in" style={{ marginTop: 'var(--space-lg)' }}>
      <div className="section-header">
        <div className="section-title">
          <div className="section-title-icon">
            <Workflow size={18} className="text-primary" />
          </div>
          <span>Pipeline <em>Progress</em></span>
        </div>
        <div className="flex items-center gap-sm">
          {status === 'running' && (
            <div className="flex items-center gap-xs text-primary text-xs font-semibold">
              <Loader2 size={14} className="animate-spin" />
              <span>Analyzing</span>
            </div>
          )}
          <span className="text-xs text-mono text-muted">{formatTime(elapsed)}</span>
          {status === 'complete' && <span className="badge badge-green">Complete</span>}
          {status === 'error' && <span className="badge badge-red">Error</span>}
        </div>
      </div>

      <div className="section-body">
        <div className="pipeline">
          {PIPELINE_STAGES.map((stage, idx) => {
            const stageStatus = getStageStatus(stage.key);
            const IconComponent = ICON_COMPONENTS[stage.iconName] || FileText;

            return (
              <div className="pipeline-step" key={stage.key}>
                <div className="pipeline-node">
                  <div className={`pipeline-icon ${stageStatus}`}>
                    {stageStatus === 'complete' ? (
                      <Check size={16} strokeWidth={2.5} />
                    ) : stageStatus === 'error' ? (
                      <AlertCircle size={16} strokeWidth={2.5} />
                    ) : stageStatus === 'active' ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <IconComponent size={16} />
                    )}
                  </div>
                  <span className={`pipeline-label ${stageStatus}`}>
                    {stage.label}
                  </span>
                </div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div className={`pipeline-connector ${
                    stageStatus === 'complete' ? 'done' :
                    stageStatus === 'active' ? 'active' : ''
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
