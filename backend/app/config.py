"""
Configuration and environment settings for the Rare Disease Solver.

All tuneable constants from the spec live here. Connection details
are read from environment variables so nothing is hard-coded.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Neo4j connection ─────────────────────────────────────────────
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER") or os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

# ── LLM provider ─────────────────────────────────────────────────
# Any LangChain-compatible model string, e.g.
#   groq:llama-3.3-70b-versatile
#   openai:gpt-4o
#   anthropic:claude-sonnet-4-20250514
LLM_MODEL = os.getenv("LLM_MODEL", "groq:llama-3.3-70b-versatile")

# ── Orchestration constants ──────────────────────────────────────
MAX_ROUNDS: int = 2                # Maximum specialist debate rounds
GRAPH_WEIGHT: float = 0.7          # Weight of graph score in final ranking
PANEL_WEIGHT: float = 0.3          # Weight of specialist panel consensus
MAJOR_PENALTY: float = 0.1         # Score deduction per major objection
CONTRADICTION_FACTOR: float = 0.6  # Multiplier per contradicted absent finding
CANDIDATES_KEPT: int = 10          # Shortlist size given to agents
RANKING_SIZE: int = 5              # Number of diseases in final output
FULLTEXT_CUTOFF: float = 1.0       # Minimum Neo4j full-text score to accept

# ── Body systems ─────────────────────────────────────────────────
BODY_SYSTEMS = [
    "neurology",
    "metabolic",
    "genetics",
    "cardiology",
    "musculoskeletal",
    "sensory",
    "other",
]
