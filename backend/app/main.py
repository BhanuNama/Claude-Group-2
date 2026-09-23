"""
FastAPI server for the Rare Disease Diagnostic Odyssey Solver.

Endpoints:
  POST /v1/diagnose         Submit clinical notes, get ranked diagnoses
  GET  /v1/cases/{thread_id} Retrieve saved state for a case
  GET  /v1/health            Check API, Neo4j, and LLM connectivity
"""

from __future__ import annotations

import json
import logging
import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain.chat_models import init_chat_model
from neo4j import GraphDatabase

from app.config import LLM_MODEL, NEO4J_PASSWORD, NEO4J_URI, NEO4J_USER
from app.graph import build_diagnostic_graph
from app.nodes import set_driver, set_llm
from app.schemas import (
    DiagnoseRequest,
    DiagnoseResponse,
    HealthResponse,
    NextStepsOut,
    PhenotypeOut,
    RankedDiseaseOut,
)

# ── Logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── Global references (set during startup) ────────────────────────
_neo4j_driver = None
_diagnostic_graph = None
_llm = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage Neo4j driver and LLM lifecycle."""
    global _neo4j_driver, _diagnostic_graph, _llm

    # Startup
    logger.info(f"Connecting to Neo4j at {NEO4J_URI}")
    _neo4j_driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

    logger.info(f"Initializing LLM: {LLM_MODEL}")
    try:
        _llm = init_chat_model(LLM_MODEL, temperature=0)
    except Exception as e:
        logger.warning(f"LLM init failed (will retry on first request): {e}")
        _llm = None

    # Inject into nodes module
    set_driver(_neo4j_driver)
    if _llm:
        set_llm(_llm)

    # Build the graph
    _diagnostic_graph = build_diagnostic_graph()
    logger.info("Diagnostic graph ready")

    yield

    # Shutdown
    if _neo4j_driver:
        _neo4j_driver.close()
        logger.info("Neo4j connection closed")


# ── FastAPI app ────────────────────────────────────────────────────
app = FastAPI(
    title="Rare Disease Diagnostic Odyssey Solver",
    description="Multi-agent GraphRAG decision support for rare disease diagnosis",
    version="0.2",
    lifespan=lifespan,
)

# CORS — allow the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.post("/v1/diagnose", response_model=DiagnoseResponse)
def diagnose(request: DiagnoseRequest):
    """
    Submit clinical notes and receive a ranked differential diagnosis.

    The pipeline runs all 6 stages:
    extract → retrieve → specialists → reviewer → CMO → plan_next
    """
    if not _diagnostic_graph:
        raise HTTPException(status_code=503, detail="Diagnostic graph not initialized")

    thread_id = request.thread_id or str(uuid.uuid4())

    logger.info(f"Starting diagnosis for thread {thread_id}")
    logger.info(f"Notes length: {len(request.notes)} chars")

    try:
        result = _diagnostic_graph.invoke(
            {"notes": request.notes},
            config={"configurable": {"thread_id": thread_id}},
        )
    except Exception as e:
        logger.error(f"Pipeline error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")

    # Build response
    phenotypes = [
        PhenotypeOut(**p) for p in result.get("phenotypes", [])
    ]

    ranking = [
        RankedDiseaseOut(**r) for r in result.get("ranking", [])
    ]

    next_steps_data = result.get("next_steps", {})
    next_steps = NextStepsOut(
        examine_next=next_steps_data.get("examine_next", []),
        still_unexplained=next_steps_data.get("still_unexplained", []),
        note=next_steps_data.get("note", "Decision support only."),
    )

    logger.info(f"Diagnosis complete for thread {thread_id}: {len(ranking)} results")
    return DiagnoseResponse(
        phenotypes=phenotypes,
        ranking=ranking,
        next_steps=next_steps,
        thread_id=thread_id,
        opinions=result.get("opinions", []),
        objections=result.get("objections", []),
    )


@app.post("/v1/diagnose/stream")
def diagnose_stream(request: DiagnoseRequest):
    """
    Stream pipeline progress as Server-Sent Events.

    Each event has a 'stage' field and partial results.
    """
    if not _diagnostic_graph:
        raise HTTPException(status_code=503, detail="Diagnostic graph not initialized")

    thread_id = request.thread_id or str(uuid.uuid4())

    def event_generator():
        try:
            # Stream events from the graph
            for event in _diagnostic_graph.stream(
                {"notes": request.notes},
                config={"configurable": {"thread_id": thread_id}},
                stream_mode="updates",
            ):
                for node_name, node_output in event.items():
                    data = {
                        "stage": node_name,
                        "thread_id": thread_id,
                    }

                    # Include relevant output per stage
                    if node_name == "extract" and "phenotypes" in node_output:
                        data["phenotypes"] = node_output["phenotypes"]
                    elif node_name == "retrieve" and "candidates" in node_output:
                        data["candidates"] = node_output.get("candidates", [])
                        data["candidates_count"] = len(node_output.get("candidates", []))
                    elif node_name == "specialist" and "opinions" in node_output:
                        data["opinions"] = node_output.get("opinions", [])
                        data["opinions_count"] = len(node_output.get("opinions", []))
                    elif node_name == "reviewer":
                        data["objections"] = node_output.get("objections", [])
                        data["needs_revision"] = node_output.get("needs_revision", False)
                        data["round"] = node_output.get("round", 0)
                    elif node_name == "cmo" and "ranking" in node_output:
                        data["ranking"] = node_output["ranking"]
                    elif node_name == "plan_next" and "next_steps" in node_output:
                        data["next_steps"] = node_output["next_steps"]

                    yield f"data: {json.dumps(data)}\n\n"

            # Final complete event
            yield f"data: {json.dumps({'stage': 'complete', 'thread_id': thread_id})}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}", exc_info=True)
            error_data = {"stage": "error", "detail": str(e), "thread_id": thread_id}
            yield f"data: {json.dumps(error_data)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@app.get("/v1/cases/{thread_id}")
def get_case(thread_id: str):
    """Retrieve saved state for a previous case."""
    if not _diagnostic_graph:
        raise HTTPException(status_code=503, detail="Graph not initialized")

    try:
        state = _diagnostic_graph.get_state(
            config={"configurable": {"thread_id": thread_id}}
        )
        if not state or not state.values:
            raise HTTPException(status_code=404, detail="Case not found")
        return state.values
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/health", response_model=HealthResponse)
async def health():
    """Check API, Neo4j, and LLM connectivity."""
    response = HealthResponse()

    # Check Neo4j
    try:
        if _neo4j_driver:
            _neo4j_driver.verify_connectivity()
            response.neo4j = "ok"
        else:
            response.neo4j = "not configured"
    except Exception as e:
        response.neo4j = f"error: {str(e)}"

    # Check LLM
    try:
        if _llm:
            response.llm = "ok"
        else:
            response.llm = "not configured"
    except Exception:
        response.llm = "error"

    return response


# ── Run directly ─────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
