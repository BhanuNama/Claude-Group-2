"""
Load HPO disease-phenotype annotations into Neo4j.

Parses the phenotype.hpoa file and creates:
  - Disease nodes with id, name
  - HAS_PHENOTYPE relationships with frequency property

Download from: https://hpo.jax.org/data/annotations
Expected location: backend/data/phenotype.hpoa
"""

from __future__ import annotations

import csv
import sys
import logging
from pathlib import Path
from neo4j import GraphDatabase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
ANNOTATION_FILE = DATA_DIR / "phenotype.hpoa"


def parse_annotations(filepath: Path) -> tuple[list[dict], list[dict]]:
    """
    Parse the HPO annotation file (phenotype.hpoa).

    Returns:
        (diseases, annotations)
        diseases: list of dicts with keys: id, name
        annotations: list of dicts with keys: disease_id, hpo_id, frequency
    """
    diseases: dict[str, str] = {}
    annotations: list[dict] = []

    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        for row in reader:
            # Skip comment lines
            if not row or row[0].startswith("#"):
                continue

            # Expected columns (may vary by version):
            # 0: database_id (OMIM, ORPHA, DECIPHER)
            # 1: disease_name
            # 2: qualifier (NOT if negated)
            # 3: hpo_id
            # 4: reference
            # 5: evidence
            # 6: onset
            # 7: frequency
            # 8: sex
            # 9: modifier
            # 10: aspect
            # 11: biocuration

            if len(row) < 4:
                continue

            disease_id = row[0].strip()
            disease_name = row[1].strip()
            qualifier = row[2].strip() if len(row) > 2 else ""
            hpo_id = row[3].strip()
            frequency = row[7].strip() if len(row) > 7 else ""

            # Skip negated annotations (qualifier = NOT)
            if qualifier.upper() == "NOT":
                continue

            # Only include HP: terms
            if not hpo_id.startswith("HP:"):
                continue

            # Track diseases
            if disease_id not in diseases:
                diseases[disease_id] = disease_name

            annotations.append({
                "disease_id": disease_id,
                "hpo_id": hpo_id,
                "frequency": frequency,
            })

    disease_list = [{"id": k, "name": v} for k, v in diseases.items()]
    logger.info(f"Parsed {len(disease_list)} diseases and {len(annotations)} annotations")
    return disease_list, annotations


def load_diseases(driver, diseases: list[dict], batch_size: int = 500) -> None:
    """Create Disease nodes in batches."""
    total = len(diseases)
    for i in range(0, total, batch_size):
        batch = diseases[i:i + batch_size]
        with driver.session() as session:
            session.run(
                """
                UNWIND $batch AS row
                MERGE (d:Disease {id: row.id})
                SET d.name = row.name
                """,
                batch=batch,
            )
        logger.info(f"  Loaded diseases {i + 1}–{min(i + batch_size, total)} of {total}")


def load_has_phenotype(driver, annotations: list[dict], batch_size: int = 500) -> None:
    """Create HAS_PHENOTYPE relationships in batches."""
    total = len(annotations)
    for i in range(0, total, batch_size):
        batch = annotations[i:i + batch_size]
        with driver.session() as session:
            session.run(
                """
                UNWIND $batch AS row
                MATCH (d:Disease {id: row.disease_id})
                MATCH (p:Phenotype {id: row.hpo_id})
                MERGE (d)-[r:HAS_PHENOTYPE]->(p)
                SET r.frequency = row.frequency
                """,
                batch=batch,
            )
        logger.info(f"  Loaded annotations {i + 1}–{min(i + batch_size, total)} of {total}")


def main(uri: str, user: str, password: str, filepath: str | None = None):
    """Load annotation data into Neo4j."""
    ann_path = Path(filepath) if filepath else ANNOTATION_FILE

    if not ann_path.exists():
        logger.error(f"Annotation file not found: {ann_path}")
        logger.error("Download from: https://hpo.jax.org/data/annotations")
        sys.exit(1)

    logger.info(f"Parsing {ann_path}...")
    diseases, annotations = parse_annotations(ann_path)

    logger.info(f"Connecting to Neo4j at {uri}")
    driver = GraphDatabase.driver(uri, auth=(user, password))

    try:
        logger.info("Loading Disease nodes...")
        load_diseases(driver, diseases)

        logger.info("Loading HAS_PHENOTYPE relationships...")
        load_has_phenotype(driver, annotations)

        # Verify
        with driver.session() as session:
            result = session.run("MATCH (d:Disease) RETURN count(d) AS n").single()
            logger.info(f"Total Disease nodes: {result['n']}")
            result = session.run("MATCH ()-[r:HAS_PHENOTYPE]->() RETURN count(r) AS n").single()
            logger.info(f"Total HAS_PHENOTYPE edges: {result['n']}")

        logger.info("Annotation load complete!")

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
