import { useState, useEffect } from 'react';
import {
  Dna,
  Brain,
  Microscope,
  Heart,
  Pill,
  Stethoscope,
  Sparkles,
  FileText,
  Network,
  Users,
  Scale,
  ShieldCheck,
  Compass,
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  Database,
  Layers,
  Activity
} from 'lucide-react';

export default function LandingPage({ onLaunchApp }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="landing">
      {/* ── Navbar ─────────────────────────────────────── */}
      <nav className={`landing-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <div className="landing-brand-icon-box">
              <Dna className="landing-brand-icon" size={20} />
            </div>
            <span className="landing-brand-text">RDx Solver</span>
          </div>

          <ul className="landing-nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#architecture">Architecture</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>

          <button className="landing-btn landing-btn-primary" onClick={onLaunchApp}>
            Launch App
            <ArrowRight size={15} style={{ marginLeft: 6 }} />
          </button>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────── */}
      <section className="landing-hero">
        {/* Floating glassmorphic icon badges */}
        <div className="landing-float landing-float-1">
          <Brain size={22} className="text-indigo-500" />
        </div>
        <div className="landing-float landing-float-2">
          <Microscope size={22} className="text-blue-500" />
        </div>
        <div className="landing-float landing-float-3">
          <Heart size={22} className="text-rose-500" />
        </div>
        <div className="landing-float landing-float-4">
          <Dna size={22} className="text-violet-500" />
        </div>
        <div className="landing-float landing-float-5">
          <Activity size={22} className="text-teal-500" />
        </div>
        <div className="landing-float landing-float-6">
          <Stethoscope size={22} className="text-sky-500" />
        </div>

        <div className="landing-hero-content">
          <div className="landing-trust-badge">
            <Sparkles size={14} className="text-indigo-500" />
            <span>Built with HPO + Orphanet + Neo4j GraphRAG</span>
          </div>

          <h1 className="landing-hero-title">
            End the Diagnostic<br />
            <em>Odyssey</em> for Rare Diseases
          </h1>

          <p className="landing-hero-sub">
            AI-powered multi-agent reasoning over a medical knowledge graph.<br />
            Get a ranked differential diagnosis in minutes, not years.
          </p>

          <div className="landing-hero-actions">
            <button className="landing-btn landing-btn-primary landing-btn-lg" onClick={onLaunchApp}>
              <span>Get Started — It's Free</span>
              <ArrowRight size={18} />
            </button>
            <a href="#how-it-works" className="landing-btn landing-btn-ghost landing-btn-lg">
              <span>See How It Works</span>
              <ChevronDown size={18} />
            </a>
          </div>

          <div className="landing-hero-note">
            <ShieldAlert size={15} />
            <span>Research prototype — clinical decision support only, not a standalone diagnostic device</span>
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────── */}
      <section className="landing-stats">
        <div className="landing-container">
          <div className="landing-stats-grid">
            <div className="landing-stat-card">
              <div className="landing-stat-number">7,000+</div>
              <div className="landing-stat-label">Rare diseases in graph</div>
            </div>
            <div className="landing-stat-card">
              <div className="landing-stat-number">~18,000</div>
              <div className="landing-stat-label">HPO phenotype terms</div>
            </div>
            <div className="landing-stat-card">
              <div className="landing-stat-number">5–7 yrs</div>
              <div className="landing-stat-label">Avg diagnostic delay solved</div>
            </div>
            <div className="landing-stat-card">
              <div className="landing-stat-number">6 Agents</div>
              <div className="landing-stat-label">Specialist consensus panel</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────── */}
      <section className="landing-section" id="features">
        <div className="landing-container">
          <div className="landing-section-header">
            <div className="landing-badge-pill">Capabilities</div>
            <h2 className="landing-section-title">
              <em>Everything</em> You Need to Shorten<br />the Diagnostic Journey
            </h2>
            <p className="landing-section-sub">
              A complete decision support system combining deterministic graph scoring with agentic clinical debate.
            </p>
          </div>

          <div className="landing-features-grid">
            <div className="landing-feature-card">
              <div className="landing-feature-icon" style={{ background: '#EEF2FF', color: '#4F6EF7' }}>
                <FileText size={24} />
              </div>
              <h3>Symptom Extraction</h3>
              <p>Free-text clinical notes automatically parsed into structured HPO-coded phenotypes with negation and onset detection.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon" style={{ background: '#F0FDF4', color: '#16a34a' }}>
                <Network size={24} />
              </div>
              <h3>Knowledge Graph Scoring</h3>
              <p>Every disease scored deterministically using information-content-weighted matching across the HPO ontology hierarchy.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon" style={{ background: '#FFF7ED', color: '#ea580c' }}>
                <Users size={24} />
              </div>
              <h3>Multi-Agent Debate</h3>
              <p>Specialist AI agents argue for and against candidates from neurology, genetics, cardiology, and more — in parallel.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon" style={{ background: '#FEF2F2', color: '#dc2626' }}>
                <Scale size={24} />
              </div>
              <h3>Adversarial Review</h3>
              <p>A reviewer agent stress-tests conclusions, identifies contradictions, and can trigger deeper debate rounds.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon" style={{ background: '#F5F3FF', color: '#7c3aed' }}>
                <ShieldCheck size={24} />
              </div>
              <h3>Citation Guardrails</h3>
              <p>Every specialist claim is verified against graph ground truth. Hallucinated or unsupported evidence is scrubbed.</p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
                <Compass size={24} />
              </div>
              <h3>Actionable Next Steps</h3>
              <p>Suggests next clinical features to examine and highlights unexplained findings for differential discrimination.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────── */}
      <section className="landing-section landing-section-alt" id="how-it-works">
        <div className="landing-container">
          <div className="landing-section-header">
            <div className="landing-badge-pill">Workflow</div>
            <h2 className="landing-section-title">
              From Clinical Notes to<br /><em>Ranked Diagnoses</em>
            </h2>
            <p className="landing-section-sub">
              Six-stage pipeline orchestrated by LangGraph and powered by Neo4j graph traversal.
            </p>
          </div>

          <div className="landing-steps">
            <div className="landing-step">
              <div className="landing-step-num">01</div>
              <div className="landing-step-content">
                <h3>Extract &amp; Ground</h3>
                <p>Identifies every symptom, lab finding, and negative feature with onset timing and organ system classification.</p>
              </div>
            </div>
            <div className="landing-step">
              <div className="landing-step-num">02</div>
              <div className="landing-step-content">
                <h3>Ontology Grounding</h3>
                <p>Exact and synonym matching to official HPO identifiers via Neo4j full-text indexes. Hallucinated terms are discarded.</p>
              </div>
            </div>
            <div className="landing-step">
              <div className="landing-step-num">03</div>
              <div className="landing-step-content">
                <h3>Graph Candidate Retrieval</h3>
                <p>Information content (IC) weighted graph scoring ranks top candidates with contradiction penalties.</p>
              </div>
            </div>
            <div className="landing-step">
              <div className="landing-step-num">04</div>
              <div className="landing-step-content">
                <h3>Specialist Panel Debate</h3>
                <p>Parallel specialist sub-agents evaluate candidates, providing explicit evidence citations and confidence scores.</p>
              </div>
            </div>
            <div className="landing-step">
              <div className="landing-step-num">05</div>
              <div className="landing-step-content">
                <h3>Adversarial Review</h3>
                <p>Reviewer challenges onset discrepancies, verifies guardrails, and reconciles inter-specialist disagreements.</p>
              </div>
            </div>
            <div className="landing-step">
              <div className="landing-step-num">06</div>
              <div className="landing-step-content">
                <h3>Consensus Synthesis</h3>
                <p>Blends graph mathematics (70%) with specialist consensus (30%) into an explainable ranked differential.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Architecture ──────────────────────────────── */}
      <section className="landing-section" id="architecture">
        <div className="landing-container">
          <div className="landing-section-header">
            <div className="landing-badge-pill">Technology</div>
            <h2 className="landing-section-title">
              Built on <em>Proven</em><br />Open Standards
            </h2>
            <p className="landing-section-sub">
              No proprietary black boxes. Every finding links back to curated, publicly peer-reviewed medical ontologies.
            </p>
          </div>

          <div className="landing-arch-grid">
            <div className="landing-arch-card">
              <div className="landing-arch-logo">
                <Database size={28} className="text-indigo-600" />
              </div>
              <h3>Neo4j</h3>
              <p>High-performance graph database containing 7,000+ diseases, 18,000+ phenotypes, and associated gene relations.</p>
            </div>
            <div className="landing-arch-card">
              <div className="landing-arch-logo">
                <Layers size={28} className="text-indigo-600" />
              </div>
              <h3>LangGraph</h3>
              <p>Multi-agent cyclical graph state orchestration with parallel node branching and revision capabilities.</p>
            </div>
            <div className="landing-arch-card">
              <div className="landing-arch-logo">
                <Activity size={28} className="text-indigo-600" />
              </div>
              <h3>HPO Ontology</h3>
              <p>Human Phenotype Ontology providing standardized terminology and phenotypic hierarchy for clinical findings.</p>
            </div>
            <div className="landing-arch-card">
              <div className="landing-arch-logo">
                <Dna size={28} className="text-indigo-600" />
              </div>
              <h3>Orphanet Data</h3>
              <p>Curated rare disease nomenclature and gene associations maintained by international clinical consortia.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────── */}
      <section className="landing-cta">
        <div className="landing-container">
          <div className="landing-cta-card">
            <h2 className="landing-cta-title">
              Ready to Shorten the<br /><em>Diagnostic Odyssey?</em>
            </h2>
            <p className="landing-cta-sub">
              Enter clinical case notes to generate a fully substantiated differential diagnosis powered by GraphRAG.
            </p>
            <button className="landing-btn landing-btn-primary landing-btn-lg" onClick={onLaunchApp}>
              <span>Launch Diagnostic Workspace</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────── */}
      <section className="landing-section" id="faq">
        <div className="landing-container">
          <div className="landing-section-header">
            <div className="landing-badge-pill">FAQ</div>
            <h2 className="landing-section-title">
              Frequently Asked<br /><em>Questions</em>
            </h2>
          </div>

          <div className="landing-faq-list">
            <FaqItem
              q="Is this a diagnostic tool?"
              a="No. This is a research prototype for clinical decision support. All outputs must be reviewed by a qualified medical geneticist or physician. It produces hypothesis recommendations, not definitive diagnoses."
            />
            <FaqItem
              q="What data does the knowledge graph contain?"
              a="The graph combines HPO (Human Phenotype Ontology) for symptom terms and taxonomy, HPO annotations for disease-phenotype associations, and Orphanet for rare disease gene alignments. All datasets are free, peer-reviewed public resources."
            />
            <FaqItem
              q="Which LLM does it use?"
              a="Any LangChain-compatible model. You can connect Groq (Llama 3.3 70B), OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet), or local Ollama endpoints simply by configuring your environment variables."
            />
            <FaqItem
              q="How is scoring different from raw LLM prompts?"
              a="Scoring is deterministic and grounded — computed algorithmically over knowledge graph paths using Information Content (IC) metrics. The LLMs provide clinical deliberation, explanation, and critique without hallucinating scores."
            />
            <FaqItem
              q="Can it process whole exome / genome (VCF) data?"
              a="The current release focuses on clinical notes and phenotype profiling. Direct VCF / genomic variant pipeline integration is on our active technical roadmap."
            />
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer-grid">
            <div className="landing-footer-brand">
              <div className="landing-brand">
                <div className="landing-brand-icon-box">
                  <Dna className="landing-brand-icon" size={18} />
                </div>
                <span className="landing-brand-text">RDx Solver</span>
              </div>
              <p>Multi-agent GraphRAG decision support system for rare disease differential diagnosis. Research Prototype v0.2.</p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#how-it-works">How It Works</a></li>
                <li><a href="#architecture">Architecture</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4>Ontology &amp; Standards</h4>
              <ul>
                <li><a href="https://hpo.jax.org" target="_blank" rel="noreferrer">HPO Consortium</a></li>
                <li><a href="https://www.orphadata.com" target="_blank" rel="noreferrer">Orphadata</a></li>
                <li><a href="https://neo4j.com" target="_blank" rel="noreferrer">Neo4j Graph Database</a></li>
                <li><a href="https://langchain-ai.github.io/langgraph/" target="_blank" rel="noreferrer">LangGraph Framework</a></li>
              </ul>
            </div>
            <div>
              <h4>Resources</h4>
              <ul>
                <li><a href="https://github.com" target="_blank" rel="noreferrer">Documentation</a></li>
                <li><a href="https://hpo.jax.org/data/ontology" target="_blank" rel="noreferrer">HPO Ontology Data</a></li>
                <li><a href="https://www.orphadata.com/genes/" target="_blank" rel="noreferrer">Orphanet Genes</a></li>
              </ul>
            </div>
          </div>
          <div className="landing-footer-bottom">
            <span>© 2025 Rare Disease Diagnostic Odyssey Solver · Research Decision Support</span>
            <span>Intended for investigative and research decision support only.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── FAQ Accordion Item ─────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`landing-faq-item${open ? ' open' : ''}`} onClick={() => setOpen(!open)}>
      <div className="landing-faq-q">
        <span>{q}</span>
        <ChevronDown size={18} className={`landing-faq-chevron${open ? ' open' : ''}`} />
      </div>
      {open && <div className="landing-faq-a">{a}</div>}
    </div>
  );
}
