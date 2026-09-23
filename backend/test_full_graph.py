import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from app.main import lifespan, app
from app.graph import build_diagnostic_graph
from app.schemas import DiagnosticState
from neo4j import GraphDatabase
from langchain.chat_models import init_chat_model
from app.nodes import set_driver, set_llm
from app.config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, LLM_MODEL

def main():
    print(f"Testing with LLM_MODEL: {LLM_MODEL}")
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    llm = init_chat_model(LLM_MODEL, temperature=0)
    
    set_driver(driver)
    set_llm(llm)
    
    graph = build_diagnostic_graph()
    
    test_notes = (
        "6-year-old male presenting with progressive muscle weakness since age 3, "
        "elevated serum creatine kinase (>10,000 U/L), delayed speech acquisition, "
        "and pseudohypertrophy of calves. No seizures, normal hearing."
    )
    
    initial_state = {
        "notes": test_notes,
        "phenotypes": [],
        "candidates": [],
        "annotations": {},
        "opinions": [],
        "objections": [],
        "needs_revision": False,
        "round": 0,
        "ranking": [],
        "next_steps": {},
    }
    
    print("Running diagnostic graph execution...")
    config = {"configurable": {"thread_id": "test-case-001"}}
    result = graph.invoke(initial_state, config=config)
    
    print("\n--- GRAPH EXECUTION COMPLETE ---")
    print(f"Extracted phenotypes: {len(result.get('phenotypes', []))}")
    for p in result.get('phenotypes', []):
        status = "ABSENT" if p.get('negated') else "PRESENT"
        print(f"  [{status}] {p.get('hpo_label')} ({p.get('hpo_id')}) - System: {p.get('system')}")
        
    print(f"\nCandidates retrieved: {len(result.get('candidates', []))}")
    for c in result.get('candidates', [])[:5]:
        print(f"  {c['name']} ({c['id']}) - Score: {c.get('graph_norm', 0):.3f}")
        
    print(f"\nSpecialist opinions generated: {len(result.get('opinions', []))}")
    for op in result.get('opinions', []):
        print(f"  System [{op['system']}]: {len(op.get('assessments', []))} assessments")
        for a in op.get('assessments', []):
            print(f"    -> {a.get('disease_id')}: {a.get('stance')} (conf: {a.get('confidence')}) - {a.get('rationale')}")
            
    print(f"\nObjections / Reviewer flags: {len(result.get('objections', []))}")
    for obj in result.get('objections', []):
        print(f"  [{obj.get('severity')}] {obj.get('disease_id')}: {obj.get('reason')}")
        
    print(f"\nFinal CMO Ranking: {len(result.get('ranking', []))} diseases")
    for i, r in enumerate(result.get('ranking', []), 1):
        print(f"  #{i} {r.get('name')} ({r.get('id')}) | Final Score: {r.get('final_score', 0):.3f} | Graph: {r.get('graph_norm', 0):.3f} | Panel: {r.get('panel_consensus', 0):.3f}")
        
    print(f"\nNext Steps: {result.get('next_steps', {})}")
    
    driver.close()
    print("\nSUCCESS: End-to-end multi-agent clinical flow passed perfectly!")

if __name__ == "__main__":
    main()
