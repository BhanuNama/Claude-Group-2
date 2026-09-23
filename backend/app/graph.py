"""
LangGraph orchestration graph for the Rare Disease Solver.

Builds a StateGraph with six nodes connected as:

  extract → retrieve → [if no candidates → END]
                      → specialists (parallel via Send)
                      → reviewer → [if needs_revision and round < MAX → specialists]
                                 → cmo → plan_next → END

Uses MemorySaver for in-memory state persistence (per thread_id).
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from langgraph.checkpoint.memory import MemorySaver
from langgraph.constants import Send
from langgraph.graph import END, StateGraph

from app.config import BODY_SYSTEMS, MAX_ROUNDS
from app.nodes import (
    cmo_node,
    extract_node,
    plan_next_node,
    retrieve_node,
    reviewer_node,
    specialist_node,
)
from app.schemas import DiagnosticState

logger = logging.getLogger(__name__)


# ── Routing functions ─────────────────────────────────────────────

def route_after_retrieve(state: DiagnosticState) -> str:
    """
    After retrieval, either proceed to specialist panel or end if no candidates.
    """
    candidates = state.get("candidates", [])
    if not candidates:
        logger.info("No candidates found — ending early")
        return END
    return "specialist"


def route_after_reviewer(state: DiagnosticState) -> Literal["specialist", "cmo"]:
    """
    After review, loop back to specialists if revision is needed, otherwise go to CMO.
    """
    needs_revision = state.get("needs_revision", False)
    current_round = state.get("round", 0)

    if needs_revision and current_round < MAX_ROUNDS:
        logger.info(f"Reviewer requested revision — starting round {current_round + 1}")
        return "specialist"
    else:
        logger.info("Moving to CMO for final ranking")
        return "cmo"


# ── Graph builder ─────────────────────────────────────────────────

def build_diagnostic_graph() -> StateGraph:
    """
    Build and compile the LangGraph diagnostic workflow.

    Returns the compiled graph with an in-memory checkpointer.
    """
    workflow = StateGraph(DiagnosticState)

    # Add nodes
    workflow.add_node("extract", extract_node)
    workflow.add_node("retrieve", retrieve_node)
    workflow.add_node("specialist", specialist_node)
    workflow.add_node("reviewer", reviewer_node)
    workflow.add_node("cmo", cmo_node)
    workflow.add_node("plan_next", plan_next_node)

    # Set entry point
    workflow.set_entry_point("extract")

    # Add edges
    workflow.add_edge("extract", "retrieve")

    # After retrieve: conditionally dispatch specialists or end
    workflow.add_conditional_edges(
        "retrieve",
        route_after_retrieve,
        ["specialist", END],
    )

    # After specialist: always go to reviewer
    workflow.add_edge("specialist", "reviewer")

    # After reviewer: loop to specialist or proceed to CMO
    workflow.add_conditional_edges(
        "reviewer",
        route_after_reviewer,
        {
            "specialist": "specialist",
            "cmo": "cmo",
        },
    )

    # CMO → plan_next → END
    workflow.add_edge("cmo", "plan_next")
    workflow.add_edge("plan_next", END)

    # Compile with in-memory checkpointer
    checkpointer = MemorySaver()
    graph = workflow.compile(checkpointer=checkpointer)

    logger.info("Diagnostic graph compiled successfully")
    return graph
