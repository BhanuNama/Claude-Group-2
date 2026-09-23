"""
LangGraph node functions for the Rare Disease Solver.

Six nodes that each read from and write to the shared DiagnosticState:
  1. extract_node   — LLM extracts phenotypes, code grounds them to HPO
  2. retrieve_node  — Code scores diseases in the graph
  3. specialist_node — LLM argues for/against candidates (runs in parallel)
  4. reviewer_node  — Code + LLM critiques specialist reasoning
  5. cmo_node       — Code builds the final ranking
  6. plan_next_node — Code generates next examination steps
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from typing import Any

from langchain.chat_models import init_chat_model
from neo4j import Driver

from app.config import (
    BODY_SYSTEMS,
    CANDIDATES_KEPT,
    FULLTEXT_CUTOFF,
    LLM_MODEL,
    MAX_ROUNDS,
    RANKING_SIZE,
)
from app.guardrails import (
    check_contradictions,
    check_unexplained,
    generate_next_steps,
    validate_citations,
)
from app.queries import ANNOTATION_QUERY, HPO_LOOKUP_QUERY
from app.schemas import (
    DiagnosticState,
    ExtractedPhenotypes,
    Review,
    SpecialistOpinion,
)
from app.scoring import build_final_ranking, score_diseases

logger = logging.getLogger(__name__)

# ── Lazy LLM and driver references (set at graph build time) ─────
_driver: Driver | None = None
_llm: Any = None


def set_driver(driver: Driver) -> None:
    """Inject the Neo4j driver for use by all nodes."""
    global _driver
    _driver = driver


def set_llm(llm: Any) -> None:
    """Inject the LLM instance for use by all nodes."""
    global _llm
    _llm = llm


def get_llm() -> Any:
    """Get or lazily create the LLM."""
    global _llm
    if _llm is None:
        _llm = init_chat_model(LLM_MODEL, temperature=0)
    return _llm


def get_driver() -> Driver:
    """Get the Neo4j driver."""
    if _driver is None:
        raise RuntimeError("Neo4j driver not set. Call set_driver() first.")
    return _driver


def _safe_structured_call(llm: Any, schema: type, prompt: str, max_retries: int = 3) -> Any:
    """Invoke LLM with direct JSON output instructions and Pydantic validation."""
    import time
    import re

    schema_json = json.dumps(schema.model_json_schema(), indent=2)
    full_prompt = (
        f"{prompt}\n\n"
        f"IMPORTANT: Return ONLY a valid JSON object matching the schema below. Do not wrap in markdown or conversational text.\n"
        f"JSON Schema:\n{schema_json}"
    )

    for attempt in range(max_retries):
        try:
            response = llm.invoke(full_prompt)
            content = response.content if hasattr(response, "content") else str(response)
            
            if isinstance(content, list):
                text_parts = []
                for item in content:
                    if isinstance(item, dict) and "text" in item:
                        text_parts.append(item["text"])
                    elif isinstance(item, str):
                        text_parts.append(item)
                    else:
                        text_parts.append(str(item))
                content = "\n".join(text_parts)
            elif not isinstance(content, str):
                content = str(content)

            # Strip markdown codeblocks if present
            content_clean = content.strip()
            if content_clean.startswith("```json"):
                content_clean = content_clean[7:]
            elif content_clean.startswith("```"):
                content_clean = content_clean[3:]
            if content_clean.endswith("```"):
                content_clean = content_clean[:-3]
            content_clean = content_clean.strip()

            # Extract JSON block
            match = re.search(r"\{.*\}", content_clean, re.DOTALL)
            if match:
                raw_json = match.group(0)
            else:
                raw_json = content_clean

            parsed = json.loads(raw_json)
            return schema.model_validate(parsed)
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "Rate limit" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                wait_time = 4 * (attempt + 1)
                logger.warning(f"Rate limit hit. Backing off for {wait_time}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(wait_time)
                continue
            
            logger.warning(f"JSON parsing error on attempt {attempt + 1}: {e}")
            if attempt == max_retries - 1:
                # If all else fails, try with_structured_output as final resort
                try:
                    return llm.with_structured_output(schema).invoke(prompt)
                except Exception:
                    raise e
            time.sleep(1)
    raise RuntimeError("Failed structured call after maximum retries")


# ═══════════════════════════════════════════════════════════════════
# NODE 1: EXTRACT
# ═══════════════════════════════════════════════════════════════════

EXTRACTION_PROMPT = """You are a clinical phenotyping expert. Read the following clinical notes
and extract every observable clinical finding or symptom mentioned.

For each finding:
- Record the exact phrase from the notes
- Mark whether it is PRESENT or ABSENT (negated). Examples of negation:
  "no seizures", "without hearing loss", "denies chest pain"
- Record the age or period of onset if mentioned
- Assign a body system: neurology, metabolic, genetics, cardiology,
  musculoskeletal, sensory, or other

Extract ALL findings, including normal/absent ones. Be thorough.

Clinical notes:
{notes}
"""


def extract_node(state: DiagnosticState) -> dict:
    """
    Extract phenotypes from clinical notes and ground them to HPO codes.

    1. LLM parses notes → structured list of findings.
    2. Each finding phrase is matched to an HPO code via Neo4j full-text index.
    3. Unmatched findings are dropped.
    """
    notes = state["notes"]
    llm = get_llm()
    driver = get_driver()

    # Step 1 — LLM extraction
    prompt = EXTRACTION_PROMPT.format(notes=notes)
    extracted: ExtractedPhenotypes = _safe_structured_call(llm, ExtractedPhenotypes, prompt)

    # Step 2 — Ground each phrase to HPO
    import re
    grounded = []
    with driver.session() as session:
        for finding in extracted.findings:
            # Clean the phrase for Lucene full-text search
            clean_phrase = re.sub(r'[\+\-\&\|\!\(\)\{\}\[\]\^\"~*\?:\/\\><\=]', ' ', finding.text)
            clean_phrase = " ".join(clean_phrase.split()).strip()
            if not clean_phrase:
                continue

            try:
                result = session.run(
                    HPO_LOOKUP_QUERY,
                    q=clean_phrase,
                    cutoff=FULLTEXT_CUTOFF,
                ).data()

                if result:
                    best = result[0]
                    grounded.append({
                        "text": finding.text,
                        "hpo_id": best["id"],
                        "hpo_label": best["label"],
                        "negated": finding.negated,
                        "onset": finding.onset,
                        "system": finding.system,
                    })
                else:
                    logger.info(f"No HPO match for: '{finding.text}' (clean: '{clean_phrase}') (dropped)")
            except Exception as ex:
                logger.warning(f"HPO lookup query failed for '{clean_phrase}': {ex}")

    logger.info(f"Extracted {len(extracted.findings)} findings, grounded {len(grounded)}")
    return {"phenotypes": grounded}


# ═══════════════════════════════════════════════════════════════════
# NODE 2: RETRIEVE
# ═══════════════════════════════════════════════════════════════════

def retrieve_node(state: DiagnosticState) -> dict:
    """
    Score diseases against the patient's phenotypes.

    1. Separate present vs absent HPO ids.
    2. Call score_diseases (handles IC weighting and contradiction penalty).
    3. Fetch the full annotation set for each candidate.
    """
    phenotypes = state["phenotypes"]
    driver = get_driver()

    present_ids = [p["hpo_id"] for p in phenotypes if not p.get("negated", False)]
    absent_ids = [p["hpo_id"] for p in phenotypes if p.get("negated", False)]

    if not present_ids:
        return {"candidates": [], "annotations": {}}

    # Score diseases
    candidates = score_diseases(present_ids, absent_ids, driver, k=CANDIDATES_KEPT)

    if not candidates:
        return {"candidates": [], "annotations": {}}

    # Fetch annotations for the shortlisted diseases
    disease_ids = [c["id"] for c in candidates]
    annotations: dict[str, list[dict]] = defaultdict(list)

    with driver.session() as session:
        ann_results = session.run(ANNOTATION_QUERY, disease_ids=disease_ids).data()
        for row in ann_results:
            annotations[row["disease_id"]].append({
                "hpo_id": row["hpo_id"],
                "hpo_label": row["hpo_label"],
                "frequency": row.get("frequency", ""),
            })

    logger.info(f"Retrieved {len(candidates)} candidate diseases")
    return {
        "candidates": candidates,
        "annotations": dict(annotations),
    }


# ═══════════════════════════════════════════════════════════════════
# NODE 3: SPECIALIST
SPECIALIST_PANEL_PROMPT = """You are a multidisciplinary clinical consensus panel reviewing a rare disease case.
Relevant specialty perspectives to provide: {systems_list}

PATIENT FINDINGS:
{findings_text}

TOP CANDIDATE DISEASES:
{candidates_text}

{objections_text}

For EACH specialty listed above ({systems_list}), provide that specialist's assessment for the top candidates:
1. stance: support, oppose, or neutral
2. confidence: 0.0 to 1.0
3. rationale: concise reasoning from that specialty's vantage point
4. cited_hpo_codes: HPO codes from the disease annotation set supporting the stance
"""


def specialist_node(state: DiagnosticState) -> dict:
    """
    Multidisciplinary specialist panel reviews all candidates across active body systems.
    Runs as a single efficient LLM call to respect API rate limits.
    """
    phenotypes = state.get("phenotypes", [])
    candidates = state.get("candidates", [])
    annotations = state.get("annotations", {})
    prior_objections = state.get("objections", [])
    llm = get_llm()

    # Determine active body systems from patient phenotypes + genetics
    pheno_systems = {p.get("system", "other") for p in phenotypes}
    active_systems = sorted(list((pheno_systems | {"genetics"}) & set(BODY_SYSTEMS)))
    systems_list = ", ".join(active_systems)

    # Build findings text
    findings_lines = []
    for p in phenotypes:
        status = "ABSENT" if p.get("negated") else "PRESENT"
        onset = f" (onset: {p['onset']})" if p.get("onset") else ""
        findings_lines.append(
            f"  [{status}] {p['hpo_label']} ({p['hpo_id']}){onset} — {p['system']}"
        )
    findings_text = "\n".join(findings_lines)

    # Build candidates text
    candidates_lines = []
    for i, c in enumerate(candidates[:6], 1):
        genes = ", ".join(c.get("genes", [])) or "no known genes"
        matched = ", ".join(c.get("matched_hpo", []))
        candidates_lines.append(
            f"{i}. {c['name']} ({c['id']}) — genes: [{genes}], matched HPO: [{matched}]"
        )
    candidates_text = "\n".join(candidates_lines)

    # Build prior objections text
    objections_text = ""
    if prior_objections:
        obj_lines = ["PRIOR REVIEWER OBJECTIONS:"]
        for obj in prior_objections:
            obj_lines.append(f"  - [{obj.get('severity', 'unknown')}] {obj.get('disease_id', '')}: {obj.get('reason', '')}")
        objections_text = "\n".join(obj_lines)

    # Call LLM for structured SpecialistPanel
    prompt = SPECIALIST_PANEL_PROMPT.format(
        systems_list=systems_list,
        findings_text=findings_text,
        candidates_text=candidates_text,
        objections_text=objections_text,
    )
    from app.schemas import SpecialistPanel
    panel: SpecialistPanel = _safe_structured_call(llm, SpecialistPanel, prompt)

    opinions_list = []
    for op in panel.opinions:
        opinions_list.append({
            "system": op.system.lower(),
            "assessments": [a.model_dump() for a in op.assessments],
        })

    # Apply citation guardrails
    cleaned = validate_citations(opinions_list, annotations)
    logger.info(f"Specialist panel generated opinions across {len(cleaned)} body systems")
    return {"opinions": cleaned}


# ═══════════════════════════════════════════════════════════════════
# NODE 4: REVIEWER
# ═══════════════════════════════════════════════════════════════════

REVIEWER_PROMPT = """You are a critical reviewer of rare disease differential diagnoses.

PATIENT FINDINGS:
{findings_text}

TOP CANDIDATES WITH SPECIALIST OPINIONS:
{assessment_summary}

CODE-GENERATED FLAGS:
{code_flags}

Your task:
1. Look for contradictions between specialist stances
2. Identify onset or progression mismatches
3. Flag unsupported or overly confident claims
4. Determine if another specialist round would MATERIALLY improve the ranking
   (only set needs_revision=true if there is a real issue that re-deliberation can fix)
"""


def reviewer_node(state: DiagnosticState) -> dict:
    """
    Review specialist opinions and generate objections.

    1. Code checks: contradictions and unexplained findings.
    2. LLM critique: reasoning quality, onset mismatches, unsupported claims.
    3. Decide if another round is needed.
    """
    phenotypes = state["phenotypes"]
    candidates = state["candidates"]
    opinions = state.get("opinions", [])
    annotations = state.get("annotations", {})
    current_round = state.get("round", 0)
    llm = get_llm()

    # Step 1 — Code checks
    contradiction_flags = check_contradictions(candidates, phenotypes, annotations)
    unexplained_flags = check_unexplained(candidates, phenotypes, annotations)
    code_flags = contradiction_flags + unexplained_flags

    # Build findings text
    findings_lines = []
    for p in phenotypes:
        status = "ABSENT" if p.get("negated") else "PRESENT"
        findings_lines.append(f"[{status}] {p['hpo_label']} ({p['hpo_id']}) — {p['system']}")
    findings_text = "\n".join(findings_lines)

    # Build assessment summary
    assessment_lines = []
    for candidate in candidates[:5]:
        did = candidate["id"]
        assessment_lines.append(f"\n--- {candidate['name']} ({did}) | graph_norm: {candidate['graph_norm']} ---")
        for opinion in opinions:
            for a in opinion.get("assessments", []):
                if a.get("disease_id") == did:
                    assessment_lines.append(
                        f"  [{opinion['system']}] {a['stance']} (conf: {a['confidence']}) — {a['rationale']}"
                    )
    assessment_summary = "\n".join(assessment_lines)

    # Build code flags text
    code_flags_text = "\n".join(
        f"  [{f['severity']}] {f['disease_id']}: {f['reason']}"
        for f in code_flags
    ) or "  No issues detected."

    # Step 2 — LLM critique
    prompt = REVIEWER_PROMPT.format(
        findings_text=findings_text,
        assessment_summary=assessment_summary,
        code_flags=code_flags_text,
    )
    review: Review = _safe_structured_call(llm, Review, prompt)

    # Merge code flags with LLM objections
    all_objections = code_flags + [obj.model_dump() for obj in review.objections]

    # Decide if revision is needed (only if LLM says so AND rounds remain)
    needs_revision = review.needs_revision and (current_round + 1) < MAX_ROUNDS

    logger.info(
        f"Reviewer: {len(all_objections)} objections, "
        f"needs_revision={needs_revision}, round={current_round + 1}"
    )
    return {
        "objections": all_objections,
        "needs_revision": needs_revision,
        "round": current_round + 1,
    }


# ═══════════════════════════════════════════════════════════════════
# NODE 5: CHIEF MEDICAL OFFICER
# ═══════════════════════════════════════════════════════════════════

def cmo_node(state: DiagnosticState) -> dict:
    """
    Build the final ranking by combining graph score, panel opinion, and objections.

    This is deterministic code, not an LLM call.
    """
    candidates = state["candidates"]
    opinions = state.get("opinions", [])
    objections = state.get("objections", [])

    ranking = build_final_ranking(
        candidates=candidates,
        opinions=opinions,
        objections=objections,
        ranking_size=RANKING_SIZE,
    )

    logger.info(f"CMO final ranking: {[r['name'] for r in ranking]}")
    return {"ranking": ranking}


# ═══════════════════════════════════════════════════════════════════
# NODE 6: PLAN NEXT STEPS
# ═══════════════════════════════════════════════════════════════════

def plan_next_node(state: DiagnosticState) -> dict:
    """
    Generate next examination steps using graph facts only.

    This is deterministic code, not an LLM call.
    """
    ranking = state.get("ranking", [])
    annotations = state.get("annotations", {})
    phenotypes = state.get("phenotypes", [])

    next_steps = generate_next_steps(ranking, annotations, phenotypes)

    logger.info(f"Next steps: {len(next_steps.get('examine_next', []))} to examine, "
                f"{len(next_steps.get('still_unexplained', []))} unexplained")
    return {"next_steps": next_steps}
