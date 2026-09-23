"""
Create Neo4j indexes for the Rare Disease Solver.

Creates:
  1. Full-text index 'phenotype_names' on Phenotype(name, synonyms)
     — used to map free-text phrases to HPO codes
  2. Property index on Phenotype(id) — fast lookups by HPO ID
  3. Property index on Disease(id)  — fast lookups by disease ID
"""

from __future__ import annotations

import sys
import logging
from pathlib import Path
from neo4j import GraphDatabase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_indexes(driver) -> None:
    """Create all required indexes."""
    with driver.session() as session:
        # 1. Full-text index for phenotype name matching
        logger.info("Creating full-text index 'phenotype_names'...")
        try:
            session.run(
                """
                CREATE FULLTEXT INDEX phenotype_names IF NOT EXISTS
                FOR (p:Phenotype)
                ON EACH [p.name, p.synonyms]
                """
            )
            logger.info("  Full-text index created (or already exists)")
        except Exception as e:
            logger.warning(f"  Full-text index creation: {e}")

        # 2. Property index on Phenotype.id
        logger.info("Creating property index on Phenotype(id)...")
        try:
            session.run(
                """
                CREATE INDEX phenotype_id IF NOT EXISTS
                FOR (p:Phenotype)
                ON (p.id)
                """
            )
            logger.info("  Phenotype(id) index created (or already exists)")
        except Exception as e:
            logger.warning(f"  Phenotype(id) index creation: {e}")

        # 3. Property index on Disease.id
        logger.info("Creating property index on Disease(id)...")
        try:
            session.run(
                """
                CREATE INDEX disease_id IF NOT EXISTS
                FOR (d:Disease)
                ON (d.id)
                """
            )
            logger.info("  Disease(id) index created (or already exists)")
        except Exception as e:
            logger.warning(f"  Disease(id) index creation: {e}")

        # 4. Property index on Gene.symbol
        logger.info("Creating property index on Gene(symbol)...")
        try:
            session.run(
                """
                CREATE INDEX gene_symbol IF NOT EXISTS
                FOR (g:Gene)
                ON (g.symbol)
                """
            )
            logger.info("  Gene(symbol) index created (or already exists)")
        except Exception as e:
            logger.warning(f"  Gene(symbol) index creation: {e}")

    # Verify indexes
    with driver.session() as session:
        result = session.run("SHOW INDEXES").data()
        logger.info(f"\nAll indexes ({len(result)}):")
        for idx in result:
            logger.info(f"  {idx.get('name', 'unnamed')} — "
                        f"type: {idx.get('type', '?')}, "
                        f"state: {idx.get('state', '?')}")


def main(uri: str, user: str, password: str):
    """Create all indexes."""
    logger.info(f"Connecting to Neo4j at {uri}")
    driver = GraphDatabase.driver(uri, auth=(user, password))

    try:
        create_indexes(driver)
        logger.info("Index setup complete!")
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
