"""
Load the Human Phenotype Ontology (HPO) into Neo4j.

Parses the hp.obo file and creates:
  - Phenotype nodes with id, name, synonyms
  - IS_A relationships (child → parent)

Download hp.obo from: https://hpo.jax.org/data/ontology
Expected location: backend/data/hp.obo
"""

from __future__ import annotations

import re
import sys
import logging
from pathlib import Path
from neo4j import GraphDatabase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Default data path
DATA_DIR = Path(__file__).parent.parent / "data"
HPO_FILE = DATA_DIR / "hp.obo"


def parse_obo(filepath: Path) -> tuple[list[dict], list[dict]]:
    """
    Parse an OBO file and extract Phenotype terms and IS_A relationships.

    Returns:
        (terms, is_a_edges)
        terms: list of dicts with keys: id, name, synonyms, is_obsolete
        is_a_edges: list of dicts with keys: child, parent
    """
    terms = []
    is_a_edges = []
    current: dict | None = None

    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()

            if line == "[Term]":
                current = {
                    "id": "",
                    "name": "",
                    "synonyms": [],
                    "is_obsolete": False,
                }
            elif line == "" and current is not None:
                # End of term block
                if current["id"].startswith("HP:") and not current["is_obsolete"]:
                    terms.append(current)
                current = None
            elif current is not None:
                if line.startswith("id: "):
                    current["id"] = line[4:]
                elif line.startswith("name: "):
                    current["name"] = line[6:]
                elif line.startswith("synonym: "):
                    # Extract synonym text from quotes
                    match = re.search(r'"([^"]*)"', line)
                    if match:
                        current["synonyms"].append(match.group(1))
                elif line.startswith("is_a: "):
                    parent_id = line[6:].split("!")[0].strip()
                    if parent_id.startswith("HP:"):
                        is_a_edges.append({
                            "child": current["id"],
                            "parent": parent_id,
                        })
                elif line == "is_obsolete: true":
                    current["is_obsolete"] = True

    # Handle last term if file doesn't end with blank line
    if current and current.get("id", "").startswith("HP:") and not current.get("is_obsolete"):
        terms.append(current)

    logger.info(f"Parsed {len(terms)} HPO terms and {len(is_a_edges)} IS_A edges")
    return terms, is_a_edges


def load_phenotypes(driver, terms: list[dict], batch_size: int = 500) -> None:
    """Create Phenotype nodes in batches using UNWIND."""
    total = len(terms)
    for i in range(0, total, batch_size):
        batch = terms[i:i + batch_size]
        params = [
            {
                "id": t["id"],
                "name": t["name"],
                "synonyms": " | ".join(t.get("synonyms", [])),
            }
            for t in batch
        ]
        with driver.session() as session:
            session.run(
                """
                UNWIND $batch AS row
                MERGE (p:Phenotype {id: row.id})
                SET p.name = row.name,
                    p.synonyms = row.synonyms
                """,
                batch=params,
            )
        logger.info(f"  Loaded phenotypes {i + 1}–{min(i + batch_size, total)} of {total}")


def load_is_a_edges(driver, edges: list[dict], batch_size: int = 500) -> None:
    """Create IS_A relationships in batches using UNWIND."""
    total = len(edges)
    for i in range(0, total, batch_size):
        batch = edges[i:i + batch_size]
        with driver.session() as session:
            session.run(
                """
                UNWIND $batch AS row
                MATCH (child:Phenotype {id: row.child})
                MATCH (parent:Phenotype {id: row.parent})
                MERGE (child)-[:IS_A]->(parent)
                """,
                batch=batch,
            )
        logger.info(f"  Loaded IS_A edges {i + 1}–{min(i + batch_size, total)} of {total}")


def main(uri: str, user: str, password: str, filepath: str | None = None):
    """Load HPO data into Neo4j."""
    obo_path = Path(filepath) if filepath else HPO_FILE

    if not obo_path.exists():
        logger.error(f"HPO file not found: {obo_path}")
        logger.error("Download from: https://hpo.jax.org/data/ontology")
        sys.exit(1)

    logger.info(f"Parsing {obo_path}...")
    terms, edges = parse_obo(obo_path)

    logger.info(f"Connecting to Neo4j at {uri}")
    driver = GraphDatabase.driver(uri, auth=(user, password))

    try:
        logger.info("Loading Phenotype nodes...")
        load_phenotypes(driver, terms)

        logger.info("Loading IS_A relationships...")
        load_is_a_edges(driver, edges)

        # Verify
        with driver.session() as session:
            result = session.run("MATCH (p:Phenotype) RETURN count(p) AS n").single()
            logger.info(f"Total Phenotype nodes: {result['n']}")
            result = session.run("MATCH ()-[r:IS_A]->() RETURN count(r) AS n").single()
            logger.info(f"Total IS_A edges: {result['n']}")

        logger.info("HPO load complete!")

    finally:
        driver.close()


if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")

    main(
        uri=os.getenv("NEO4J_URI", "bolt://localhost:7687"),
        user=os.getenv("NEO4J_USER", "neo4j"),
        password=os.getenv("NEO4J_PASSWORD", "password"),
        filepath=sys.argv[1] if len(sys.argv) > 1 else None,
    )
