import { useState, useCallback, useEffect } from 'react';
import {
  Dna,
  Layers,
  Users,
  Network,
  AlertCircle,
  FileText,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import LandingPage from './components/LandingPage';
import Layout from './components/Layout';
import CaseInput from './components/CaseInput';
import PipelineProgress from './components/PipelineProgress';
import PhenotypePanel from './components/PhenotypePanel';
import RankingList from './components/RankingList';
import NextStepsPanel from './components/NextStepsPanel';
import SpecialistDebate from './components/SpecialistDebate';
import GraphVisualization from './components/GraphVisualization';
import { useAnalysis } from './hooks/useAnalysis';
import { useCases } from './hooks/useCases';

export default function App() {
  const [showApp, setShowApp] = useState(false);
  const [inputNotes, setInputNotes] = useState('');
  const analysis = useAnalysis();
  const { cases, saveCase, clearCases } = useCases();
  const [activeTab, setActiveTab] = useState('overview');

  const handleSubmit = useCallback((notes) => {
    setInputNotes(notes);
    analysis.analyze(notes, true);
  }, [analysis]);

  // Save case when analysis completes
  useEffect(() => {
    if (analysis.status === 'complete' && analysis.ranking.length > 0) {
      saveCase({
        threadId: analysis.threadId,
        notes: inputNotes,
        ranking: analysis.ranking,
        phenotypes: analysis.phenotypes,
        opinions: analysis.opinions,
        reviewInfo: analysis.reviewInfo,
        nextSteps: analysis.nextSteps,
      });
    }
  }, [
    analysis.status,
    analysis.ranking,
    analysis.threadId,
    analysis.phenotypes,
    analysis.opinions,
    analysis.reviewInfo,
    analysis.nextSteps,
    inputNotes,
    saveCase,
  ]);

  const handleSelectCase = useCallback((selectedCase) => {
    if (!selectedCase) return;
    if (selectedCase.notes) {
      setInputNotes(selectedCase.notes);
    }
    analysis.loadSavedSession(selectedCase);
    setActiveTab('overview');
  }, [analysis]);

  const handleNewCase = useCallback(() => {
    analysis.reset();
    setInputNotes('');
    setActiveTab('overview');
  }, [analysis]);

  const handleLaunchApp = () => {
    setShowApp(true);
  };

  const handleBackToLanding = () => {
    setShowApp(false);
  };

  // Show landing page if not in app mode
  if (!showApp) {
    return <LandingPage onLaunchApp={handleLaunchApp} />;
  }

  const hasResults = analysis.status === 'complete' && analysis.ranking.length > 0;

  return (
    <Layout
      cases={cases}
      onSelectCase={handleSelectCase}
      activeCaseId={analysis.threadId}
      onClearCases={clearCases}
      onNewCase={handleNewCase}
      onBackToLanding={handleBackToLanding}
    >
      {/* Case Input */}
      <CaseInput
        notes={inputNotes}
        onNotesChange={setInputNotes}
        onSubmit={handleSubmit}
        isRunning={analysis.status === 'running'}
        onCancel={analysis.cancel}
      />

      {/* Pipeline Progress */}
      <PipelineProgress
        currentStage={analysis.currentStage}
        completedStages={analysis.completedStages}
        status={analysis.status}
        elapsed={analysis.elapsed}
      />

      {/* Error display */}
      {analysis.status === 'error' && (
        <div className="section-card animate-fade-in" style={{ marginTop: 'var(--space-lg)' }}>
          <div className="section-body">
            <div className="objection-card major">
              <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
              <div className="objection-text">
                <strong>Analysis Error:</strong> {analysis.error}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {(analysis.phenotypes.length > 0 || hasResults) && (
        <>
          {hasResults && (
            <div style={{ marginTop: 'var(--space-lg)' }}>
              <div className="tabs">
                <button
                  className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  <Layers size={14} style={{ marginRight: 6 }} />
                  <span>Overview &amp; Differential</span>
                  {analysis.ranking?.length > 0 && (
                    <span className="badge badge-neutral" style={{ marginLeft: 6, fontSize: '0.65rem', padding: '1px 6px' }}>
                      {analysis.ranking.length}
                    </span>
                  )}
                </button>
                <button
                  className={`tab ${activeTab === 'debate' ? 'active' : ''}`}
                  onClick={() => setActiveTab('debate')}
                >
                  <Users size={14} style={{ marginRight: 6 }} />
                  <span>Specialist Debate</span>
                  {analysis.opinions?.length > 0 && (
                    <span className="badge badge-primary-subtle" style={{ marginLeft: 6, fontSize: '0.65rem', padding: '1px 6px' }}>
                      {analysis.opinions.length}
                    </span>
                  )}
                </button>
                <button
                  className={`tab ${activeTab === 'graph' ? 'active' : ''}`}
                  onClick={() => setActiveTab('graph')}
                >
                  <Network size={14} style={{ marginRight: 6 }} />
                  <span>Knowledge Graph</span>
                </button>
              </div>
            </div>
          )}

          {(activeTab === 'overview' || !hasResults) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', marginTop: 'var(--space-lg)' }}>
              {/* 1. Top: Full-Width Horizontal Extracted Phenotypes */}
              <PhenotypePanel phenotypes={analysis.phenotypes} />

              {/* 2. Bottom: Differential Diagnosis + Next Steps */}
              {hasResults && (
                <div className="differential-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 'var(--space-lg)', alignItems: 'start' }}>
                  <div>
                    <RankingList ranking={analysis.ranking} />
                  </div>
                  <div>
                    <NextStepsPanel nextSteps={analysis.nextSteps} />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'debate' && hasResults && (
            <div style={{ marginTop: 'var(--space-lg)' }}>
              <SpecialistDebate
                opinions={analysis.opinions}
                reviewInfo={analysis.reviewInfo}
                ranking={analysis.ranking}
              />
            </div>
          )}

          {activeTab === 'graph' && hasResults && (
            <div style={{ marginTop: 'var(--space-lg)' }}>
              <GraphVisualization
                phenotypes={analysis.phenotypes}
                ranking={analysis.ranking}
              />
            </div>
          )}
        </>
      )}

      {analysis.status === 'idle' && analysis.phenotypes.length === 0 && (
        <div className="empty-state" style={{ marginTop: 'var(--space-xl)' }}>
          <div className="empty-state-icon-box">
            <Dna size={32} className="text-primary" />
          </div>
          <h3 className="empty-state-title">
            Enter clinical notes to initiate <em>multi-agent reasoning</em>
          </h3>
          <p className="empty-state-text">
            Describe patient phenotype findings, symptom onset, and family history above.
            The system will extract structured HPO terms, query the Neo4j knowledge graph,
            and convene parallel specialist agents to synthesize a ranked differential diagnosis.
          </p>
        </div>
      )}
    </Layout>
  );
}
