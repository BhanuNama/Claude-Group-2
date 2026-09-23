"""
Compute Information Content (IC) for every Phenotype node in Neo4j.

IC(t) = -log(n(t) / N)

Where:
  - n(t) = number of diseases annotated with t or any descendant of t
  - N    = total number of diseases

Counting descendants is essential: a disease annotated with a specific
term must also count toward its broader parent terms.
"""

from __future__ import annotations

import math
import sys
import logging
from pathlib import Path
from neo4j import GraphDatabase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def compute_and_set_ic(driver, batch_size: int = 200) -> None:
    """
    Compute IC for every Phenotype and write it to the node.

    Strategy:
    1. Get total disease count N.
    2. For each phenotype, count diseases annotated with it or any descendant.
    3. IC = -log(n / N). If n = 0, set IC = max_ic (rarest possible).
    """
    with driver.session() as session:
        # Total diseases
        result = session.run("MATCH (d:Disease) RETURN count(d) AS n").single()
        total_diseases = result["n"]
        logger.info(f"Total diseases: {total_diseases}")

        if total_diseases == 0:
            logger.error("No diseases found. Load annotations first.")
            return

        # Get all phenotype IDs
        pheno_ids = [
            r["id"] for r in
            session.run("MATCH (p:Phenotype) RETURN p.id AS id").data()
        ]
        logger.info(f"Computing IC for {len(pheno_ids)} phenotypes...")

    # Process in batches
    total = len(pheno_ids)
    max_ic = -math.log(1 / total_diseases) if total_diseases > 1 else 10.0

    for i in range(0, total, batch_size):
        batch_ids = pheno_ids[i:i + batch_size]

        with driver.session() as session:
            # For each phenotype in the batch, count diseases that are annotated
            # with it or any of its descendants
            result = session.run(
                """
                UNWIND $ids AS pid
                MATCH (p:Phenotype {id: pid})
                OPTIONAL MATCH (p)<-[:IS_A*0..]-(desc:Phenotype)
                         <-[:HAS_PHENOTYPE]-(d:Disease)
                WITH pid, count(DISTINCT d) AS disease_count
                RETURN pid, disease_count
                """,
                ids=batch_ids,
            ).data()

            # Compute IC and update nodes
            updates = []
            for row in result:
                n = row["disease_count"]
                if n > 0:
                    ic = -math.log(n / total_diseases)
                else:
                    ic = max_ic  # Rarest possible
                updates.append({"id": row["pid"], "ic": round(ic, 4)})

            if updates:
                session.run(
                    """
                    UNWIND $batch AS row
                    MATCH (p:Phenotype {id: row.id})
                    SET p.ic = row.ic
                    """,
                    batch=updates,
                )

        logger.info(f"  Computed IC for {min(i + batch_size, total)} / {total} phenotypes")

    logger.info("IC computation complete!")


def main(uri: str, user: str, password: str):
    """Compute IC for all phenotypes."""
    logger.info(f"Connecting to Neo4j at {uri}")
    driver = GraphDatabase.driver(uri, auth=(user, password))

    try:
        compute_and_set_ic(driver)

        # Show some examples
        with driver.session() as session:
            result = session.run(
                """
                MATCH (p:Phenotype)
                WHERE p.ic IS NOT NULL
                RETURN p.name AS name, p.ic AS ic
                ORDER BY p.ic DESC
                LIMIT 5
                """
            ).data()
            logger.info("Top 5 rarest phenotypes (highest IC):")
            for r in result:
                logger.info(f"  {r['name']}: IC = {r['ic']}")

            result = session.run(
                """
                MATCH (p:Phenotype)
                WHERE p.ic IS NOT NULL
                RETURN p.name AS name, p.ic AS ic
                ORDER BY p.ic ASC
                LIMIT 5
                """
            ).data()
            logger.info("Top 5 most common phenotypes (lowest IC):")
            for r in result:
                logger.info(f"  {r['name']}: IC = {r['ic']}")

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
    )
