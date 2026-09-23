"""
Pydantic models and TypedDict state for the Rare Disease Solver.

Three categories:
  1. LLM structured-output schemas (used with .with_structured_output)
  2. LangGraph shared state (TypedDict)
  3. API request / response models
"""

from __future__ import annotations

import operator
from typing import Annotated, Any, Optional
from typing_extensions import TypedDict

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════
# 1.  LLM STRUCTURED-OUTPUT SCHEMAS
# ═══════════════════════════════════════════════════════════════════

class ExtractedPhenotype(BaseModel):
    """A single clinical finding parsed from the notes."""
    text: str = Field(description="Original phrase from the notes")
    negated: bool = Field(description="True if the finding is explicitly absent, e.g. 'no seizures'")
    onset: str = Field(default="", description="Age or period of onset if mentioned, e.g. 'since age 3'")
    system: str = Field(default="other", description="Body system: neurology, metabolic, genetics, cardiology, musculoskeletal, sensory, or other")


class ExtractedPhenotypes(BaseModel):
    """All findings extracted from clinical notes by the LLM."""
    findings: list[ExtractedPhenotype] = Field(description="List of clinical findings with negation, onset, and body system")


class SpecialistAssessment(BaseModel):
    """Assessment of a single candidate disease by one specialist."""
    disease_id: str = Field(description="Orphanet or OMIM disease ID")
    stance: str = Field(description="One of: support, oppose, neutral")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence in the stance, 0 to 1")
    rationale: str = Field(description="Brief reasoning for the stance")
    cited_hpo_codes: list[str] = Field(default_factory=list, description="HPO codes cited as evidence")


class SpecialistOpinion(BaseModel):
    """Full opinion from one specialist agent."""
    system: str = Field(description="Body system this specialist covers")
    assessments: list[SpecialistAssessment] = Field(description="Assessment for each candidate disease")


class SpecialistPanel(BaseModel):
    """Opinions from multiple specialist body systems."""
    opinions: list[SpecialistOpinion] = Field(description="List of specialist opinions by system")


class ReviewObjection(BaseModel):
    """A single objection raised by the reviewer."""
    disease_id: str = Field(description="Disease being challenged")
    severity: str = Field(description="minor or major")
    reason: str = Field(description="What is wrong or unsupported")


class Review(BaseModel):
    """Output from the reviewer agent."""
    objections: list[ReviewObjection] = Field(default_factory=list, description="Objections to specialist conclusions")
    needs_revision: bool = Field(description="Whether another specialist round would materially improve the result")
    summary: str = Field(default="", description="Overall critique summary")


# ═══════════════════════════════════════════════════════════════════
# 2.  LANGGRAPH SHARED STATE
# ═══════════════════════════════════════════════════════════════════

class GroundedPhenotype(TypedDict):
    """A phenotype that has been matched to an HPO code."""
    text: str
    hpo_id: str
    hpo_label: str
    negated: bool
    onset: str
    system: str


class CandidateDisease(TypedDict):
    """A disease from the graph shortlist."""
    id: str
    name: str
    score: float
    graph_norm: float
    matched_hpo: list[str]
    genes: list[str]


class RankedDisease(TypedDict):
    """A disease in the final ranking."""
    id: str
    name: str
    genes: list[str]
    final_score: float
    graph_norm: float
    panel_consensus: float
    matched_hpo: list[str]
    open_objections: list[str]
    specialist_notes: list[str]


class NextSteps(TypedDict):
    """Suggestions for what to examine next."""
    examine_next: list[str]
    still_unexplained: list[str]
    note: str


class DiagnosticState(TypedDict):
    """Shared state flowing through the LangGraph pipeline."""
    # Input
    notes: str
    # After extraction
    phenotypes: list[GroundedPhenotype]
    # After retrieval
    candidates: list[CandidateDisease]
    annotations: dict[str, list[dict]]        # disease_id → annotated phenotypes
    # After specialists (uses operator.add to merge parallel results)
    opinions: Annotated[list[dict], operator.add]
    # After reviewer
    objections: list[dict]
    needs_revision: bool
    round: int
    # After CMO
    ranking: list[RankedDisease]
    # After plan_next
    next_steps: NextSteps


# ═══════════════════════════════════════════════════════════════════
# 3.  API REQUEST / RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════

class DiagnoseRequest(BaseModel):
    """POST /v1/diagnose request body."""
    notes: str = Field(description="Free-text clinical notes")
    thread_id: Optional[str] = Field(default=None, description="Optional case identifier for state persistence")


class PhenotypeOut(BaseModel):
    """A grounded phenotype in the API response."""
    text: str
    hpo_id: str
    hpo_label: str
    negated: bool
    onset: str
    system: str


class RankedDiseaseOut(BaseModel):
    """A ranked disease in the API response."""
    id: str
    name: str
    genes: list[str]
    final_score: float
    graph_norm: float
    panel_consensus: float
    matched_hpo: list[str]
    open_objections: list[str]
    specialist_notes: list[str]


class NextStepsOut(BaseModel):
    """Next steps in the API response."""
    examine_next: list[str]
    still_unexplained: list[str]
    note: str


class DiagnoseResponse(BaseModel):
    """POST /v1/diagnose response body."""
    phenotypes: list[PhenotypeOut]
    ranking: list[RankedDiseaseOut]
    next_steps: NextStepsOut
    thread_id: str
    opinions: list[dict] = []
    objections: list[dict] = []


class HealthResponse(BaseModel):
    """GET /v1/health response."""
    api: str = "ok"
    neo4j: str = "unknown"
    llm: str = "unknown"
