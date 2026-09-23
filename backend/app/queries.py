"""
Named Cypher queries for the Rare Disease Solver.

Each constant is a query string with named parameters (prefixed with $).
Queries are referenced from nodes.py and scoring.py.
"""

# ── Map a free-text phrase to an HPO code ──────────────────────────
# Parameters: $q (search phrase)
HPO_LOOKUP_QUERY = """
CALL db.index.fulltext.queryNodes('phenotype_names', $q)
YIELD node, score
WHERE score >= $cutoff
RETURN node.id    AS id,
       node.name  AS label,
       score
LIMIT 1
"""

# ── Score diseases against the patient's present symptoms ─────────
# For each patient HPO code, walk up the IS_A hierarchy, find diseases
# annotated with any ancestor, and take the highest IC match.
# Parameters: $ids (list of present HPO ids), $k (number of results)
SCORE_QUERY = """
UNWIND $ids AS qid
MATCH (q:Phenotype {id: qid})-[:IS_A*0..]->(a:Phenotype)
      <-[:HAS_PHENOTYPE]-(d:Disease)
WITH d, qid, max(a.ic) AS best
WITH d, collect(qid) AS matched, sum(best) AS score
OPTIONAL MATCH (d)-[:CAUSED_BY|ASSOCIATED_WITH]->(g:Gene)
RETURN d.id                         AS id,
       d.name                       AS name,
       score,
       matched,
       collect(DISTINCT g.symbol)   AS genes
ORDER BY score DESC
LIMIT $k
"""

# ── Find diseases annotated with an absent finding ─────────────────
# Used to apply the contradiction penalty.
# Parameters: $ids (list of absent/negated HPO ids)
EXCLUDE_QUERY = """
UNWIND $ids AS nid
MATCH (n:Phenotype {id: nid})<-[:IS_A*0..]-(c:Phenotype)
      <-[:HAS_PHENOTYPE]-(d:Disease)
RETURN d.id                     AS id,
       collect(DISTINCT nid)    AS contradicted,
       count(DISTINCT nid)      AS n
"""

# ── Fetch the full phenotype annotation set for candidate diseases ─
# Parameters: $disease_ids (list of disease IDs)
ANNOTATION_QUERY = """
UNWIND $disease_ids AS did
MATCH (d:Disease {id: did})-[r:HAS_PHENOTYPE]->(p:Phenotype)
RETURN d.id         AS disease_id,
       p.id         AS hpo_id,
       p.name       AS hpo_label,
       r.frequency  AS frequency
"""

# ── Fetch genes associated with candidate diseases ─────────────────
# Parameters: $disease_ids (list of disease IDs)
GENE_QUERY = """
UNWIND $disease_ids AS did
MATCH (d:Disease {id: did})-[:CAUSED_BY|ASSOCIATED_WITH]->(g:Gene)
RETURN d.id         AS disease_id,
       g.symbol     AS gene
"""
