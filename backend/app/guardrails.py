"""
Guardrails for the Rare Disease Solver.

These are deterministic code checks that enforce evidence quality:
  1. Citation validation — remove claims citing codes the graph doesn't link.
  2. Contradiction detection — flag diseases annotated with absent findings.
  3. Unexplained findings detection — flag candidates that leave most findings unexplained.
"""

from __future__ import annotations

from typing import Any


def validate_citations(
    opinions: list[dict],
    annotations: dict[str, list[dict]],
) -> list[dict]:
    """
    Check every specialist assessment's cited HPO codes against the graph.

    For each assessment:
      - Get the set of HPO codes the disease is annotated with.
      - Keep only cited_hpo_codes that appear in that set or the patient's matched set.
      - If a non-neutral stance has zero valid citations after filtering, remove it.

    Returns the cleaned opinions list (same structure, invalid citations removed).
    """
    cleaned_opinions = []

    for opinion in opinions:
        cleaned_assessments = []
        for assessment in opinion.get("assessments", []):
            disease_id = assessment.get("disease_id", "")
            cited_codes = assessment.get("cited_hpo_codes", [])
            stance = assessment.get("stance", "neutral")

            # Build the valid set: all HPO codes linked to this disease
            disease_annotations = annotations.get(disease_id, [])
            valid_codes = {ann.get("hpo_id", "") for ann in disease_annotations}

            # Filter citations
            valid_cited = [c for c in cited_codes if c in valid_codes]

            # If non-neutral stance has no valid citations, remove it
            if stance != "neutral" and len(valid_cited) == 0 and len(cited_codes) > 0:
                continue  # Drop this assessment entirely

            cleaned_assessment = {**assessment, "cited_hpo_codes": valid_cited}
            cleaned_assessments.append(cleaned_assessment)

        cleaned_opinion = {**opinion, "assessments": cleaned_assessments}
        cleaned_opinions.append(cleaned_opinion)

    return cleaned_opinions


def check_contradictions(
    candidates: list[dict],
    phenotypes: list[dict],
    annotations: dict[str, list[dict]],
) -> list[dict]:
    """
    Flag candidates annotated with findings the patient explicitly doesn't have.

    Returns a list of flag dicts:
        {"disease_id": ..., "severity": "major", "reason": ...}
    """
    absent_ids = {
        p["hpo_id"] for p in phenotypes
        if p.get("negated", False) and p.get("hpo_id")
    }
    if not absent_ids:
        return []

    flags = []
    for candidate in candidates:
        did = candidate["id"]
        disease_annotations = annotations.get(did, [])
        annotated_ids = {ann.get("hpo_id", "") for ann in disease_annotations}

        contradicted = absent_ids & annotated_ids
        if contradicted:
            codes_str = ", ".join(sorted(contradicted))
            flags.append({
                "disease_id": did,
                "severity": "major",
                "reason": (
                    f"Disease {candidate['name']} is annotated with "
                    f"findings the patient explicitly lacks: {codes_str}"
                ),
            })

    return flags


def check_unexplained(
    candidates: list[dict],
    phenotypes: list[dict],
    annotations: dict[str, list[dict]],
    top_n: int = 5,
) -> list[dict]:
    """
    Flag top candidates that leave more than half the patient's findings unexplained.

    Only checks the top_n candidates.

    Returns a list of flag dicts:
        {"disease_id": ..., "severity": "minor", "reason": ...}
    """
    present_ids = {
        p["hpo_id"] for p in phenotypes
        if not p.get("negated", False) and p.get("hpo_id")
    }
    if not present_ids:
        return []

    flags = []
    for candidate in candidates[:top_n]:
        did = candidate["id"]
        matched = set(candidate.get("matched_hpo", []))
        unexplained = present_ids - matched

        if len(unexplained) > len(present_ids) / 2:
            flags.append({
                "disease_id": did,
                "severity": "minor",
                "reason": (
                    f"Disease {candidate['name']} leaves {len(unexplained)} of "
                    f"{len(present_ids)} findings unexplained"
                ),
            })

    return flags


def generate_next_steps(
    ranking: list[dict],
    annotations: dict[str, list[dict]],
    phenotypes: list[dict],
) -> dict:
    """
    Generate examination suggestions using graph facts only.

    1. examine_next: Features of rank-1 disease that rank-2 lacks and patient hasn't shown.
    2. still_unexplained: Patient findings that rank-1 doesn't match.
    """
    present_ids = {
        p["hpo_id"] for p in phenotypes
        if not p.get("negated", False) and p.get("hpo_id")
    }

    examine_next = []
    still_unexplained = []

    if len(ranking) >= 1:
        top = ranking[0]
        top_ann_ids = {
            ann.get("hpo_id", "") for ann in annotations.get(top["id"], [])
        }
        top_matched = set(top.get("matched_hpo", []))

        # Still unexplained: patient findings not matched by the top disease
        unexplained_ids = present_ids - top_matched
        # Map IDs back to labels
        id_to_label = {p["hpo_id"]: p.get("hpo_label", p["hpo_id"]) for p in phenotypes}
        still_unexplained = [
            id_to_label.get(uid, uid) for uid in sorted(unexplained_ids)
        ]

        if len(ranking) >= 2:
            runner = ranking[1]
            runner_ann_ids = {
                ann.get("hpo_id", "") for ann in annotations.get(runner["id"], [])
            }

            # Features that top has and runner lacks, and patient hasn't shown yet
            differentiating = top_ann_ids - runner_ann_ids - present_ids
            # Get labels from annotations
            ann_id_to_label = {}
            for ann in annotations.get(top["id"], []):
                ann_id_to_label[ann.get("hpo_id", "")] = ann.get("hpo_label", ann.get("hpo_id", ""))

            examine_next = [
                ann_id_to_label.get(fid, fid) for fid in sorted(differentiating)
            ][:10]  # Limit to 10 suggestions

    return {
        "examine_next": examine_next,
        "still_unexplained": still_unexplained,
        "note": "Decision support only. Confirm with a clinical geneticist.",
    }
