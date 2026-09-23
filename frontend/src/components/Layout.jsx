import { Dna, Plus, ArrowLeft, Shield, Sparkles } from 'lucide-react';
import HealthStatus from './HealthStatus';
import CaseHistory from './CaseHistory';

export default function Layout({ children, cases, onSelectCase, activeCaseId, onClearCases, onNewCase, onBackToLanding }) {
  return (
    <div className="app-layout">
      <div className="bg-mesh" />

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon-box">
              <Dna className="logo-icon-svg" size={22} />
            </div>
            <div>
              <h1 className="sidebar-title">
                RDx <em>Solver</em>
              </h1>
              <div className="sidebar-subtitle">GraphRAG Decision Support</div>
            </div>
          </div>
        </div>

        <div className="sidebar-content">
          <button
            className="btn btn-primary w-full"
            onClick={onNewCase}
            style={{ marginBottom: 'var(--space-sm)' }}
          >
            <Plus size={16} style={{ marginRight: 6 }} />
            <span>New Case</span>
          </button>

          {onBackToLanding && (
            <button
              className="btn btn-ghost w-full"
              onClick={onBackToLanding}
              style={{ marginBottom: 'var(--space-md)', fontSize: '0.82rem' }}
            >
              <ArrowLeft size={14} style={{ marginRight: 6 }} />
              <span>Back to Overview</span>
            </button>
          )}

          <CaseHistory
            cases={cases}
            onSelect={onSelectCase}
            activeId={activeCaseId}
            onClear={onClearCases}
          />
        </div>

        <div className="sidebar-footer">
          <HealthStatus />
          <div className="sidebar-version-badge">
            <Shield size={12} style={{ marginRight: 4, color: 'var(--accent-primary)' }} />
            <span>v0.2 · Clinical Decision Support</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <header className="main-header">
          <div className="flex items-center gap-sm">
            <Sparkles size={16} className="text-primary" />
            <h2 className="main-header-title">
              Diagnostic <em>Workspace</em>
            </h2>
          </div>
          <div className="flex items-center gap-md">
            <span className="badge badge-primary-subtle">
              Multi-Agent GraphRAG
            </span>
            <span className="text-xs text-muted">
              Research Prototype · Clinician Review Required
            </span>
          </div>
        </header>

        <div className="main-body">
          {children}
        </div>
      </main>
    </div>
  );
}
