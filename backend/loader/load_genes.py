"""
Load Orphanet and HPO gene-disease associations into Neo4j.

Parses:
  1. Orphadata XML (en_product6.xml) for Orphanet gene-disease relationships.
  2. HPO genes_to_disease.txt for OMIM and Orphanet gene-disease relationships.

Creates:
  - Gene nodes with symbol
  - CAUSED_BY and ASSOCIATED_WITH relationships (Disease → Gene)
"""

from __future__ import annotations

import os
import sys
import logging
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from neo4j import GraphDatabase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
ORPHA_XML = DATA_DIR / "en_product6.xml"
HPO_GENE_FILE = DATA_DIR / "genes_to_disease.txt"
HPO_GENE_URL = "https://purl.obolibrary.org/obo/hp/hpoa/genes_to_disease.txt"


def ensure_hpo_genes_file() -> Path:
    """Download genes_to_disease.txt if not present."""
    if not HPO_GENE_FILE.exists():
        logger.info(f"Downloading HPO gene-disease associations from {HPO_GENE_URL}...")
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(HPO_GENE_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp, open(HPO_GENE_FILE, "wb") as f:
            f.write(resp.read())
        logger.info(f"Downloaded {HPO_GENE_FILE.stat().st_size} bytes")
    return HPO_GENE_FILE


def parse_hpo_gene_file(filepath: Path) -> list[dict]:
    """Parse HPO genes_to_disease.txt."""
    associations = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            parts = line.strip().split("\t")
            if len(parts) >= 4 and parts[0] != "ncbi_gene_id":
                gene_symbol = parts[1].strip()
                disease_id = parts[3].strip()
                if gene_symbol and disease_id:
                    associations.append({
                        "disease_id": disease_id,
                        "gene_symbol": gene_symbol,
                    })
    logger.info(f"Parsed {len(associations)} gene-disease associations from {filepath.name}")
    return associations


def parse_gene_xml(filepath: Path) -> list[dict]:
    """Parse Orphadata gene-disease XML."""
    associations = []
    tree = ET.parse(filepath)
    root = tree.getroot()

    for disorder in root.iter("Disorder"):
        orpha_code = None
        for orpha_elem in disorder.iter("OrphaCode"):
            orpha_code = f"ORPHA:{orpha_elem.text}"
            break

        if not orpha_code:
            continue

        for assoc in disorder.iter("DisorderGeneAssociation"):
            for gene in assoc.iter("Gene"):
                for symbol_elem in gene.iter("Symbol"):
                    gene_symbol = symbol_elem.text
                    if gene_symbol:
                        associations.append({
                            "disease_id": orpha_code,
                            "gene_symbol": gene_symbol.strip(),
                        })
                    break

    logger.info(f"Parsed {len(associations)} gene-disease associations from {filepath.name}")
    return associations


def load_genes(driver, associations: list[dict], batch_size: int = 1000) -> None:
    """Create Gene nodes and CAUSED_BY/ASSOCIATED_WITH relationships in batches."""
    # Deduplicate associations
    unique_pairs = {(a["disease_id"], a["gene_symbol"]) for a in associations}
    associations = [{"disease_id": did, "gene_symbol": sym} for did, sym in unique_pairs]

    # Create unique Gene nodes
    gene_symbols = list({a["gene_symbol"] for a in associations})
    total_genes = len(gene_symbols)

    logger.info(f"Creating {total_genes} unique Gene nodes...")
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

    # Create relationships (both CAUSED_BY and ASSOCIATED_WITH for seamless query matching)
    total = len(associations)
    logger.info(f"Creating {total} gene-disease relationships...")
    for i in range(0, total, batch_size):
        batch = associations[i:i + batch_size]
        with driver.session() as session:
            session.run(
                """
                UNWIND $batch AS row
                MATCH (d:Disease {id: row.disease_id})
                MATCH (g:Gene {symbol: row.gene_symbol})
                MERGE (d)-[:CAUSED_BY]->(g)
                MERGE (d)-[:ASSOCIATED_WITH]->(g)
                """,
                batch=batch,
            )
        if (i // batch_size) % 5 == 0 or (i + batch_size) >= total:
            logger.info(f"  Loaded relationships {i + 1}–{min(i + batch_size, total)} of {total}")


def main(uri: str, user: str, password: str):
    """Load complete gene data into Neo4j."""
    associations = []

    # 1. Orphadata XML
    if ORPHA_XML.exists():
        logger.info(f"Parsing Orphanet XML: {ORPHA_XML}")
        associations.extend(parse_gene_xml(ORPHA_XML))

    # 2. HPO genes_to_disease.txt
    hpo_file = ensure_hpo_genes_file()
    if hpo_file.exists():
        associations.extend(parse_hpo_gene_file(hpo_file))

    logger.info(f"Total raw gene-disease pairs collected: {len(associations)}")
    logger.info(f"Connecting to Neo4j at {uri}...")
    driver = GraphDatabase.driver(uri, auth=(user, password))

    try:
        load_genes(driver, associations)

        # Verify
        with driver.session() as session:
            g_count = session.run("MATCH (g:Gene) RETURN count(g) AS n").single()["n"]
            cb_count = session.run("MATCH ()-[r:CAUSED_BY]->() RETURN count(r) AS n").single()["n"]
            aw_count = session.run("MATCH ()-[r:ASSOCIATED_WITH]->() RETURN count(r) AS n").single()["n"]
            logger.info(f"Verification: Total Gene nodes: {g_count}")
            logger.info(f"Verification: Total CAUSED_BY edges: {cb_count}")
            logger.info(f"Verification: Total ASSOCIATED_WITH edges: {aw_count}")

            # Check sample OMIM and ORPHA diseases
            sample = session.run(
                """
                MATCH (d:Disease)-[:ASSOCIATED_WITH]->(g:Gene)
                WHERE d.id IN ['OMIM:310200', 'OMIM:300376', 'ORPHA:585']
                RETURN d.id AS id, d.name AS name, collect(g.symbol) AS genes
                """
            ).data()
            for s in sample:
                logger.info(f"  Sample verification: {s['name']} ({s['id']}) -> Genes: {s['genes']}")

        logger.info("Gene dataset loading complete!")

    finally:
        driver.close()


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")

    main(
        uri=os.getenv("NEO4J_URI", "bolt://localhost:7687"),
        user=os.getenv("NEO4J_USER", "neo4j"),
        password=os.getenv("NEO4J_PASSWORD", "password"),
    )
