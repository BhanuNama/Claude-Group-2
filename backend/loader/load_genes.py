"""
Load Orphanet gene-disease associations into Neo4j.

Parses the Orphadata XML file for gene-disease relationships and creates:
  - Gene nodes with symbol
  - CAUSED_BY relationships (Disease → Gene)

Download from: https://www.orphadata.com/genes/
Expected location: backend/data/en_product6.xml
"""

from __future__ import annotations

import sys
import logging
import xml.etree.ElementTree as ET
from pathlib import Path
from neo4j import GraphDatabase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
GENE_FILE = DATA_DIR / "en_product6.xml"


def parse_gene_xml(filepath: Path) -> list[dict]:
    """
    Parse Orphadata gene-disease XML.

    Returns a list of dicts with keys: disease_id, gene_symbol
    """
    associations = []

    tree = ET.parse(filepath)
    root = tree.getroot()

    # Navigate the XML structure
    # Typical structure: JDBOR > DisorderList > Disorder > DisorderGeneAssociationList
    for disorder in root.iter("Disorder"):
        # Get Orphanet ID
        orpha_code = None
        for orpha_elem in disorder.iter("OrphaCode"):
            orpha_code = f"ORPHA:{orpha_elem.text}"
            break

        if not orpha_code:
            continue

        # Get gene associations
        for assoc in disorder.iter("DisorderGeneAssociation"):
            for gene in assoc.iter("Gene"):
                for symbol_elem in gene.iter("Symbol"):
                    gene_symbol = symbol_elem.text
                    if gene_symbol:
                        associations.append({
                            "disease_id": orpha_code,
                            "gene_symbol": gene_symbol.strip(),
                        })
                    break  # Take first Symbol

    logger.info(f"Parsed {len(associations)} gene-disease associations")
    return associations


def parse_gene_json(filepath: Path) -> list[dict]:
    """
    Alternative parser for JSON format from Orphadata.

    Returns a list of dicts with keys: disease_id, gene_symbol
    """
    import json

    associations = []

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Navigate JSON structure (varies by version)
    disorders = data.get("JDBOR", [{}])
    if isinstance(disorders, dict):
        disorders = disorders.get("DisorderList", {}).get("Disorder", [])

    for disorder in disorders:
        orpha_code = disorder.get("OrphaCode")
        if not orpha_code:
            continue
        disease_id = f"ORPHA:{orpha_code}"

        gene_assocs = disorder.get("DisorderGeneAssociationList", {}).get(
            "DisorderGeneAssociation", []
        )
        if isinstance(gene_assocs, dict):
            gene_assocs = [gene_assocs]

        for assoc in gene_assocs:
            gene = assoc.get("Gene", {})
            symbol = gene.get("Symbol")
            if symbol:
                associations.append({
                    "disease_id": disease_id,
                    "gene_symbol": symbol.strip(),
                })

    logger.info(f"Parsed {len(associations)} gene-disease associations")
    return associations


def load_genes(driver, associations: list[dict], batch_size: int = 500) -> None:
    """Create Gene nodes and CAUSED_BY relationships in batches."""
    # First, create unique Gene nodes
    gene_symbols = list({a["gene_symbol"] for a in associations})
    total_genes = len(gene_symbols)

    for i in range(0, total_genes, batch_size):
        batch = [{"symbol": s} for s in gene_symbols[i:i + batch_size]]
        with driver.session() as session:
            session.run(
                """
                UNWIND $batch AS row
                MERGE (g:Gene {symbol: row.symbol})
                """,
                batch=batch,
            )
    logger.info(f"  Created {total_genes} Gene nodes")

    # Then create CAUSED_BY relationships
    total = len(associations)
    for i in range(0, total, batch_size):
        batch = associations[i:i + batch_size]
        with driver.session() as session:
            session.run(
                """
                UNWIND $batch AS row
                MATCH (d:Disease {id: row.disease_id})
                MATCH (g:Gene {symbol: row.gene_symbol})
                MERGE (d)-[:CAUSED_BY]->(g)
                """,
                batch=batch,
            )
        logger.info(f"  Loaded gene associations {i + 1}–{min(i + batch_size, total)} of {total}")


def main(uri: str, user: str, password: str, filepath: str | None = None):
    """Load gene data into Neo4j."""
    gene_path = Path(filepath) if filepath else GENE_FILE

    if not gene_path.exists():
        # Try JSON alternative
        json_path = DATA_DIR / "en_product6.json"
        if json_path.exists():
            gene_path = json_path
        else:
            logger.error(f"Gene file not found: {gene_path}")
            logger.error("Download from: https://www.orphadata.com/genes/")
            sys.exit(1)

    logger.info(f"Parsing {gene_path}...")
    if gene_path.suffix == ".json":
        associations = parse_gene_json(gene_path)
    else:
        associations = parse_gene_xml(gene_path)

    logger.info(f"Connecting to Neo4j at {uri}")
    driver = GraphDatabase.driver(uri, auth=(user, password))

    try:
        logger.info("Loading Gene nodes and CAUSED_BY relationships...")
        load_genes(driver, associations)

        # Verify
        with driver.session() as session:
            result = session.run("MATCH (g:Gene) RETURN count(g) AS n").single()
            logger.info(f"Total Gene nodes: {result['n']}")
            result = session.run("MATCH ()-[r:CAUSED_BY]->() RETURN count(r) AS n").single()
            logger.info(f"Total CAUSED_BY edges: {result['n']}")

        logger.info("Gene load complete!")

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
