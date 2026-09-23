"""
Seed demo knowledge graph data for the Rare Disease Solver.

Populates Neo4j with:
1. Curated rare diseases (Duchenne MD, Becker MD, Pompe disease, SMA, Rett syndrome, etc.)
2. HPO Phenotypes with official IDs, names, synonyms, and organ systems
3. IS_A ontological hierarchy
4. HAS_PHENOTYPE relationships
5. ASSOCIATED_WITH gene relationships
6. Information Content (IC) calculation
"""

import os
import sys
import math
import logging
from pathlib import Path
from dotenv import load_dotenv
from neo4j import GraphDatabase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Sample curated ontology & diseases dataset
PHENOTYPES = [
    # Neuromuscular / Musculoskeletal
    {"id": "HP:0003325", "name": "Progressive muscle weakness", "synonyms": ["Muscle weakness, progressive", "Proximal muscle weakness", "Loss of muscle strength"], "system": "musculoskeletal"},
    {"id": "HP:0003236", "name": "Elevated circulating creatine kinase concentration", "synonyms": ["Elevated serum creatine kinase", "High CK level", "Elevated CK", "HyperCKemia"], "system": "metabolic"},
    {"id": "HP:0003707", "name": "Calf muscle pseudohypertrophy", "synonyms": ["Calf pseudohypertrophy", "Enlarged calves", "Pseudohypertrophy of calves"], "system": "musculoskeletal"},
    {"id": "HP:0001263", "name": "Global developmental delay", "synonyms": ["Delayed milestones", "Developmental delay"], "system": "neurology"},
    {"id": "HP:0000750", "name": "Delayed speech and language development", "synonyms": ["Speech delay", "Language delay", "Delayed speech"], "system": "neurology"},
    {"id": "HP:0000407", "name": "Sensorineural hearing loss", "synonyms": ["Sensorineural deafness", "Nerve deafness", "Hearing impairment"], "system": "sensory"},
    {"id": "HP:0001250", "name": "Seizure", "synonyms": ["Seizures", "Epilepsy", "Convulsions"], "system": "neurology"},
    {"id": "HP:0001635", "name": "Cardiomyopathy", "synonyms": ["Heart muscle disease", "Dilated cardiomyopathy", "Cardiac involvement"], "system": "cardiology"},
    {"id": "HP:0001290", "name": "Generalized hypotonia", "synonyms": ["Floppy infant", "Muscle hypotonia", "Low muscle tone"], "system": "musculoskeletal"},
    {"id": "HP:0002015", "name": "Dysphagia", "synonyms": ["Difficulty swallowing", "Swallowing difficulty"], "system": "other"},
    {"id": "HP:0002093", "name": "Respiratory insufficiency", "synonyms": ["Breathing difficulty", "Respiratory failure", "Dyspnea"], "system": "other"},
    {"id": "HP:0002460", "name": "Distal muscle weakness", "synonyms": ["Weakness of distal muscles"], "system": "musculoskeletal"},
    {"id": "HP:0003701", "name": "Proximal muscle weakness", "synonyms": ["Limb girdle muscle weakness"], "system": "musculoskeletal"},
    {"id": "HP:0001252", "name": "Muscular hypotonia", "synonyms": ["Weak muscle tone"], "system": "musculoskeletal"},
    {"id": "HP:0001260", "name": "Dysarthria", "synonyms": ["Slurred speech", "Impaired articulation"], "system": "neurology"},
    {"id": "HP:0001324", "name": "Muscle weakness", "synonyms": ["Paresis", "Weakness"], "system": "musculoskeletal"},
    {"id": "HP:0000001", "name": "All", "synonyms": ["Root"], "system": "other"},
    {"id": "HP:0000118", "name": "Phenotypic abnormality", "synonyms": ["Abnormality"], "system": "other"},
]

IS_A_EDGES = [
    ("HP:0003325", "HP:0001324"),  # Progressive muscle weakness IS_A Muscle weakness
    ("HP:0003701", "HP:0001324"),  # Proximal muscle weakness IS_A Muscle weakness
    ("HP:0002460", "HP:0001324"),  # Distal muscle weakness IS_A Muscle weakness
    ("HP:0001324", "HP:0000118"),  # Muscle weakness IS_A Phenotypic abnormality
    ("HP:0003236", "HP:0000118"),
    ("HP:0003707", "HP:0000118"),
    ("HP:0001263", "HP:0000118"),
    ("HP:0000750", "HP:0001263"),  # Speech delay IS_A Global developmental delay
    ("HP:0000407", "HP:0000118"),
    ("HP:0001250", "HP:0000118"),
    ("HP:0001635", "HP:0000118"),
    ("HP:0001290", "HP:0000118"),
    ("HP:0002015", "HP:0000118"),
    ("HP:0002093", "HP:0000118"),
    ("HP:0000118", "HP:0000001"),
]

DISEASES = [
    {
        "id": "OMIM:310200",
        "name": "Duchenne muscular dystrophy",
        "genes": ["DMD"],
        "phenotypes": [
            ("HP:0003325", "VERY_FREQUENT"),  # Progressive muscle weakness
            ("HP:0003236", "OBLIGATE"),       # Very high CK
            ("HP:0003707", "FREQUENT"),       # Calf pseudohypertrophy
            ("HP:0000750", "OCCASIONAL"),     # Speech delay
            ("HP:0001635", "FREQUENT"),       # Cardiomyopathy
            ("HP:0003701", "FREQUENT"),       # Proximal weakness
        ]
    },
    {
        "id": "OMIM:300376",
        "name": "Becker muscular dystrophy",
        "genes": ["DMD"],
        "phenotypes": [
            ("HP:0003325", "FREQUENT"),
            ("HP:0003236", "VERY_FREQUENT"),
            ("HP:0003707", "OCCASIONAL"),
            ("HP:0001635", "FREQUENT"),
        ]
    },
    {
        "id": "OMIM:253300",
        "name": "Spinal muscular atrophy type 1",
        "genes": ["SMN1"],
        "phenotypes": [
            ("HP:0001290", "OBLIGATE"),       # Generalized hypotonia
            ("HP:0003325", "VERY_FREQUENT"),  # Muscle weakness
            ("HP:0002093", "VERY_FREQUENT"),  # Respiratory insufficiency
            ("HP:0002015", "FREQUENT"),       # Dysphagia
        ]
    },
    {
        "id": "OMIM:232300",
        "name": "Glycogen storage disease II (Pompe disease)",
        "genes": ["GAA"],
        "phenotypes": [
            ("HP:0003325", "VERY_FREQUENT"),
            ("HP:0003236", "FREQUENT"),
            ("HP:0001635", "VERY_FREQUENT"),
            ("HP:0001290", "FREQUENT"),
            ("HP:0002093", "FREQUENT"),
        ]
    },
    {
        "id": "OMIM:312750",
        "name": "Rett syndrome",
        "genes": ["MECP2"],
        "phenotypes": [
            ("HP:0001263", "OBLIGATE"),
            ("HP:0000750", "OBLIGATE"),
            ("HP:0001250", "FREQUENT"),
            ("HP:0001290", "FREQUENT"),
        ]
    },
    {
        "id": "OMIM:253550",
        "name": "Mitochondrial myopathy, encephalopathy, lactic acidosis, and stroke-like episodes (MELAS)",
        "genes": ["MT-TL1"],
        "phenotypes": [
            ("HP:0003325", "FREQUENT"),
            ("HP:0001250", "VERY_FREQUENT"),
            ("HP:0000407", "FREQUENT"),
            ("HP:0001635", "OCCASIONAL"),
            ("HP:0003236", "OCCASIONAL"),
        ]
    },
    {
        "id": "OMIM:154700",
        "name": "Marfan syndrome",
        "genes": ["FBN1"],
        "phenotypes": [
            ("HP:0001635", "FREQUENT"),
        ]
    }
]


def seed_database(driver):
    with driver.session() as session:
        logger.info("1. Loading Phenotype nodes...")
        for p in PHENOTYPES:
            session.run(
                """
                MERGE (node:Phenotype {id: $id})
                SET node.name = $name,
                    node.synonyms = $synonyms,
                    node.system = $system
                """,
                id=p["id"],
                name=p["name"],
                synonyms=p["synonyms"],
                system=p["system"]
            )
        logger.info(f"   Loaded {len(PHENOTYPES)} phenotypes.")

        logger.info("2. Loading IS_A hierarchy relationships...")
        for child, parent in IS_A_EDGES:
            session.run(
                """
                MATCH (c:Phenotype {id: $child})
                MATCH (p:Phenotype {id: $parent})
                MERGE (c)-[:IS_A]->(p)
                """,
                child=child,
                parent=parent
            )
        logger.info(f"   Loaded {len(IS_A_EDGES)} IS_A hierarchy edges.")

        logger.info("3. Loading Diseases, Genes, and Associations...")
        for d in DISEASES:
            session.run(
                """
                MERGE (disease:Disease {id: $id})
                SET disease.name = $name
                """,
                id=d["id"],
                name=d["name"]
            )

            # Genes
            for g in d["genes"]:
                session.run(
                    """
                    MERGE (gene:Gene {symbol: $symbol})
                    WITH gene
                    MATCH (disease:Disease {id: $did})
                    MERGE (disease)-[:ASSOCIATED_WITH]->(gene)
                    """,
                    symbol=g,
                    did=d["id"]
                )

            # Phenotypes
            for hpo_id, freq in d["phenotypes"]:
                session.run(
                    """
                    MATCH (disease:Disease {id: $did})
                    MATCH (pheno:Phenotype {id: $hpo_id})
                    MERGE (disease)-[r:HAS_PHENOTYPE]->(pheno)
                    SET r.frequency = $freq
                    """,
                    did=d["id"],
                    hpo_id=hpo_id,
                    freq=freq
                )
        logger.info(f"   Loaded {len(DISEASES)} diseases and associations.")

        logger.info("4. Computing Information Content (IC)...")
        total_diseases = len(DISEASES)
        for p in PHENOTYPES:
            res = session.run(
                """
                MATCH (p:Phenotype {id: $pid})
                OPTIONAL MATCH (p)<-[:IS_A*0..]-(desc:Phenotype)<-[:HAS_PHENOTYPE]-(d:Disease)
                RETURN count(DISTINCT d) as cnt
                """,
                pid=p["id"]
            ).single()
            cnt = res["cnt"] if res else 0
            ic = -math.log(cnt / total_diseases) if cnt > 0 else 3.5
            session.run(
                """
                MATCH (p:Phenotype {id: $pid})
                SET p.ic = $ic
                """,
                pid=p["id"],
                ic=round(ic, 4)
            )
        logger.info("   IC computation complete.")

        # Verification summary
        p_count = session.run("MATCH (p:Phenotype) RETURN count(p) as n").single()["n"]
        d_count = session.run("MATCH (d:Disease) RETURN count(d) as n").single()["n"]
        g_count = session.run("MATCH (g:Gene) RETURN count(g) as n").single()["n"]
        r_count = session.run("MATCH ()-[r]->() RETURN count(r) as n").single()["n"]

        logger.info("\n" + "="*50)
        logger.info("DATABASE SEEDING SUCCESSFUL!")
        logger.info(f"  • Phenotypes:    {p_count}")
        logger.info(f"  • Diseases:      {d_count}")
        logger.info(f"  • Genes:         {g_count}")
        logger.info(f"  • Relationships: {r_count}")
        logger.info("="*50)


def main():
    load_dotenv(Path(__file__).parent.parent / ".env")
    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    user = os.getenv("NEO4J_USER") or os.getenv("NEO4J_USERNAME", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "password")

    logger.info(f"Connecting to Neo4j at {uri} (User: {user})")
    driver = GraphDatabase.driver(uri, auth=(user, password))
    try:
        seed_database(driver)
    finally:
        driver.close()


if __name__ == "__main__":
    main()
