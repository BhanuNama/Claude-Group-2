"""
Disease scoring logic for the Rare Disease Solver.

All scoring is deterministic — the graph ranks, LLMs explain.
Implements a simplified Resnik-style IC-weighted phenotype matching
with contradiction penalties for absent findings.
"""

from __future__ import annotations

import math
from typing import Any

from neo4j import Driver

from app.config import (
    CANDIDATES_KEPT,
    CONTRADICTION_FACTOR,
    GRAPH_WEIGHT,
    MAJOR_PENALTY,
    PANEL_WEIGHT,
)
from app.queries import EXCLUDE_QUERY, SCORE_QUERY


def score_diseases(
    present_ids: list[str],
    absent_ids: list[str],
    driver: Driver,
    k: int = CANDIDATES_KEPT,
) -> list[dict]:
    """
    Score every disease in the graph against the patient's symptoms.

    1. Run SCORE_QUERY to get raw IC-weighted scores and matched terms.
    2. Run EXCLUDE_QUERY to find diseases annotated with absent findings.
    3. Apply contradiction penalty: raw_score × 0.6^(number of contradictions).
    4. Normalize so the best candidate equals 1.0.
    5. Return the top k candidates.

    Returns a list of dicts with keys:
        id, name, score, graph_norm, matched_hpo, genes
    """
    if not present_ids:
        return []

    # Step 1 — raw scores from the graph
    with driver.session() as session:
        raw_results = session.run(SCORE_QUERY, ids=present_ids, k=k * 3).data()

    if not raw_results:
        return []

    # Build a lookup: disease_id → raw record
    disease_map: dict[str, dict] = {}
    for row in raw_results:
        disease_map[row["id"]] = {
            "id": row["id"],
            "name": row["name"],
            "raw_score": row["score"],
            "matched_hpo": row["matched"],
            "genes": row["genes"] or [],
            "contradictions": 0,
        }

    # Step 2 — contradiction check
    if absent_ids:
        with driver.session() as session:
            exclude_results = session.run(EXCLUDE_QUERY, ids=absent_ids).data()

        for row in exclude_results:
            did = row["id"]
            if did in disease_map:
                disease_map[did]["contradictions"] = row["n"]

    # Step 3 — apply contradiction penalty
    for entry in disease_map.values():
        c = entry["contradictions"]
        if c > 0:
            entry["raw_score"] *= math.pow(CONTRADICTION_FACTOR, c)

    # Step 4 — normalize to [0, 1]
    max_score = max(e["raw_score"] for e in disease_map.values()) if disease_map else 1.0
    if max_score <= 0:
        max_score = 1.0

    candidates = []
    for entry in disease_map.values():
        candidates.append({
            "id": entry["id"],
            "name": entry["name"],
            "score": entry["raw_score"],
            "graph_norm": round(entry["raw_score"] / max_score, 4),
            "matched_hpo": entry["matched_hpo"],
            "genes": entry["genes"],
        })

    # Step 5 — sort and keep top k
    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates[:k]


def compute_panel_consensus(opinions: list[dict], disease_id: str) -> float:
    """
    Average specialist opinion for a disease.

    sign: support = +1, neutral = 0, oppose = -1
    panel = average(sign × confidence) across specialists

    Returns a value in [-1, 1].
    """
    stance_sign = {"support": 1.0, "neutral": 0.0, "oppose": -1.0}
    values = []

    for opinion in opinions:
        for assessment in opinion.get("assessments", []):
            if assessment.get("disease_id") == disease_id:
                sign = stance_sign.get(assessment.get("stance", "neutral"), 0.0)
                conf = float(assessment.get("confidence", 0.5))
                values.append(sign * conf)

    if not values:
        return 0.0
    return sum(values) / len(values)


def compute_final_score(
    graph_norm: float,
    panel_consensus: float,
    major_objection_count: int,
) -> float:
    """
    Final ranking score combining graph and panel.

    final = 0.7 × graph_norm
          + 0.3 × (panel_consensus + 1) / 2
          - 0.1 × major_objection_count

    Returns a float (can go negative with many objections).
    """
    panel_scaled = (panel_consensus + 1.0) / 2.0
    score = (
        GRAPH_WEIGHT * graph_norm
        + PANEL_WEIGHT * panel_scaled
        - MAJOR_PENALTY * major_objection_count
    )
    return round(score, 4)


def build_final_ranking(
    candidates: list[dict],
    opinions: list[dict],
    objections: list[dict],
    ranking_size: int = 5,
) -> list[dict]:
    """
    Build the final ranked list of diseases.

    For each candidate:
      1. Compute panel consensus from specialist opinions.
      2. Count major objections from the reviewer.
      3. Compute the final composite score.
      4. Collect specialist notes and open objections.
    """
    ranking = []

    for candidate in candidates:
        did = candidate["id"]

        # Panel consensus
        panel = compute_panel_consensus(opinions, did)

        # Count major objections for this disease
        disease_objections = [
            obj for obj in objections
            if obj.get("disease_id") == did
        ]
        major_count = sum(
            1 for obj in disease_objections
            if obj.get("severity") == "major"
        )

        # Collect specialist notes
        specialist_notes = []
        for opinion in opinions:
            system = opinion.get("system", "unknown")
            for assessment in opinion.get("assessments", []):
                if assessment.get("disease_id") == did:
                    stance = assessment.get("stance", "neutral")
                    rationale = assessment.get("rationale", "")
                    if rationale:
                        specialist_notes.append(
                            f"[{system}] ({stance}) {rationale}"
                        )

        # Open objection texts
        open_obj_texts = [obj.get("reason", "") for obj in disease_objections]

        # Final composite score
        final = compute_final_score(
            candidate["graph_norm"],
            panel,
            major_count,
        )

        ranking.append({
            "id": did,
            "name": candidate["name"],
            "genes": candidate.get("genes", []),
            "final_score": final,
            "graph_norm": candidate["graph_norm"],
            "panel_consensus": round(panel, 4),
            "matched_hpo": candidate.get("matched_hpo", []),
            "open_objections": open_obj_texts,
            "specialist_notes": specialist_notes,
        })

    ranking.sort(key=lambda x: x["final_score"], reverse=True)
    return ranking[:ranking_size]
