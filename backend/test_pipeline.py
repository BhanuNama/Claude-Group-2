import os
import json
import re
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from app.schemas import SpecialistPanel, ExtractedPhenotypes, Review

load_dotenv()
llm = ChatGroq(
    model="openai/gpt-oss-20b",
    api_key=os.getenv("GROQ_API_KEY"),
    max_tokens=4096,
    temperature=0.0
)

# Test 1: Phenotype Extraction
prompt_extract = """You are a clinical phenotyping expert. Extract symptoms from notes.
Return ONLY a valid JSON object in the exact format:
{
  "findings": [
    {
      "text": "progressive muscle weakness",
      "negated": false,
      "onset": "age 3",
      "system": "musculoskeletal"
    }
  ]
}

Clinical Notes: 6yo boy with progressive muscle weakness since age 3, very high CK, delayed speech, calf pseudohypertrophy. No seizures.
"""

res = llm.invoke(prompt_extract).content
m = re.search(r"\{.*\}", res, re.DOTALL)
extracted = ExtractedPhenotypes.model_validate_json(m.group(0))
print("1. Extraction SUCCESS:", len(extracted.findings), "findings")

# Test 2: Specialist Panel
prompt_specialists = """You are a multidisciplinary clinical panel reviewing candidate diseases for this patient.
Return ONLY a valid JSON object in the exact format:
{
  "opinions": [
    {
      "system": "neurology",
      "assessments": [
        {
          "disease_id": "OMIM:310200",
          "stance": "support",
          "confidence": 0.95,
          "rationale": "Matches speech delay and weakness pattern",
          "cited_hpo_codes": ["HP:0000750"]
        }
      ]
    }
  ]
}

Candidates:
1. Duchenne muscular dystrophy (OMIM:310200)
2. Becker muscular dystrophy (OMIM:300376)
"""

res2 = llm.invoke(prompt_specialists).content
m2 = re.search(r"\{.*\}", res2, re.DOTALL)
panel = SpecialistPanel.model_validate_json(m2.group(0))
print("2. Specialist Panel SUCCESS:", len(panel.opinions), "specialist opinions")
