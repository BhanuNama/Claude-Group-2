# Rare Disease Diagnostic Odyssey Solver 🧬

> **Multi-Agent GraphRAG Clinical Decision Support System for Rare Disease Diagnosis**  
> Combines structured biomedical ontologies (HPO, Orphanet) in **Neo4j** with a multi-specialist LLM debate panel orchestrated via **LangGraph**.

---

> ⚠️ **CLINICAL ADVISORY & DISCLAIMER**  
> This software is an investigational research prototype designed for clinical decision support and educational exploration. It is **not** a certified medical diagnostic device. All generated candidates, specialist findings, and recommendations must be critically reviewed and validated by licensed medical professionals.

---

## 🌟 Key Features

- **Automated Phenotype Extraction & Grounding**: LLM parses complex unstructured clinical notes, extracts positive and ruled-out findings with onset, and grounds them to Human Phenotype Ontology (HPO) terms via Neo4j fulltext Lucene search.
- **IC-Weighted GraphRAG Scoring**: Calculates Information Content (IC) weighted disease matching with penalty deductions for contradictory/negated phenotypes.
- **Multi-Specialist LLM Panel Debate**: Parallel specialist agents (Neurology, Genetics, Metabolic, Musculoskeletal, Sensory, Cardiology) argue for and against top candidate diseases.
- **Adversarial Medical Reviewer & CMO Synthesis**: An adversarial reviewer checks citations against the knowledge graph and challenges weak arguments before the Chief Medical Officer synthesizes the final composite ranking.
- **Interactive 3-Tier Knowledge Graph**: Visualizes patient phenotypes $\rightarrow$ candidate diseases $\rightarrow$ causative genes with manual zoom (`+` / `-` / `Reset`), pan dragging, and node metadata inspector.
- **SSE Streaming & Glassmorphic UI**: Real-time stage-by-stage pipeline streaming with dark/light clinical frosted glass aesthetic and zero emoji iconography (`lucide-react`).

---

## 🏗️ Architecture

```
                                  [ Unstructured Clinical Notes ]
                                                 │
                                                 ▼
                                        1. Extractor Node
                                (Extract & Ground to HPO via Neo4j)
                                                 │
                                                 ▼
                                        2. Retriever Node
                                (IC-Weighted Graph Candidate Scoring)
                                                 │
                                                 ▼
                                 3. Parallel Specialist Panel
                      ┌───────────────┬───────────────┬───────────────┐
                      │   Neurology   │   Genetics    │   Metabolic   │
                      ├───────────────┼───────────────┼───────────────┤
                      │Musculoskeletal│    Sensory    │  Cardiology   │
                      └───────────────┴───────────────┴───────────────┘
                                                 │
                                                 ▼
                                  4. Adversarial Reviewer Node
                                (Citation Validation & Challenge)
                                                 │
                                                 ▼
                                     5. CMO Synthesis Node
                               (Final Composite Scoring & Ranking)
                                                 │
                                                 ▼
                                     6. Plan Next Steps Node
                               (Suggest High-Yield Tests & Biopsies)
```

---

## 📋 Prerequisites

Ensure you have the following installed on your machine:

1. **Python 3.10+**
2. **Node.js 18+** and **npm**
3. **Neo4j Database**:
   - Option A (Recommended): [Neo4j AuraDB Free Cloud Instance](https://neo4j.com/cloud/aura/)
   - Option B: [Neo4j Desktop](https://neo4j.com/download/) or Docker (`neo4j:5.x`)
4. **LLM Provider API Key** (Any of the following):
   - **OpenRouter** (e.g., DeepSeek V3 `openai:deepseek/deepseek-chat`)
   - **Groq** (e.g., `groq:llama-3.3-70b-versatile`)
   - **OpenAI** (e.g., `openai:gpt-4o`)
   - **Anthropic** (e.g., `anthropic:claude-3-5-sonnet-20241022`)

---

## 🚀 Step-by-Step Installation & Setup

### Step 1: Clone the Repository

```bash
git clone -b Bhanu https://github.com/BhanuNama/Claude-Group-2.git
cd Claude-Group-2
```

---

### Step 2: Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell / Command Prompt)
   python -m venv venv
   .\venv\Scripts\activate

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   # Windows
   copy .env.example .env

   # macOS / Linux
   cp .env.example .env
   ```

5. Edit `backend/.env` with your credentials:
   ```env
   # ── Neo4j Connection ─────────────────────────
   NEO4J_URI=bolt://localhost:7687
   # If using Neo4j Aura Cloud:
   # NEO4J_URI=neo4j+ssc://<your-instance-id>.databases.neo4j.io
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=your_neo4j_password

   # ── LLM Configuration (OpenRouter Example) ──
   LLM_MODEL=openai:deepseek/deepseek-chat
   OPENAI_API_BASE=https://openrouter.ai/api/v1
   OPENAI_API_KEY=your_api_key_here
   ```

---

### Step 3: Populate the Neo4j Knowledge Graph (If using a fresh DB)

If your Neo4j instance is already populated, you can skip this step. Otherwise, download the raw ontology files into `backend/data/`:

1. **HPO Ontology**: Download `hp.obo` from [HPO Releases](https://hpo.jax.org/data/ontology) $\rightarrow$ save as `backend/data/hp.obo`.
2. **HPO Annotations**: Download `phenotype.hpoa` from [HPO Annotations](https://hpo.jax.org/data/annotations) $\rightarrow$ save as `backend/data/phenotype.hpoa`.
3. **Orphanet Genes**: Download `en_product6.xml` from [Orphadata Products](https://www.orphadata.com/genes/) $\rightarrow$ save as `backend/data/en_product6.xml`.

Run the ingestion scripts sequentially:
```bash
python -m loader.load_hpo
python -m loader.load_annotations
python -m loader.load_genes
python -m loader.compute_ic
python -m loader.setup_indexes
```

---

### Step 4: Start the Backend Server

```bash
uvicorn app.main:app --reload --port 8000
```
- The backend API will be live at: `http://localhost:8000`
- Interactive Swagger docs: `http://localhost:8000/docs`

---

### Step 5: Frontend Setup & Launch

1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

---

## 🧪 Sample Clinical Case for Testing

Paste the following clinical case into the input area in the UI:

```text
A 4-year-old male presents with progressive proximal muscle weakness and frequent falls since age 3.
The parents noticed he uses his hands to push himself up from the floor (Gowers sign).
Physical examination reveals prominent calf pseudohypertrophy.
Laboratory investigations show a markedly elevated serum creatine kinase (CK > 18,000 U/L).
Mild delayed speech and language development was noted during early childhood.
Audiometry reveals bilateral sensorineural hearing loss.
No history of seizures.
Echocardiogram shows normal left ventricular function with no cardiomyopathy at this time.
```

Click **Run Diagnostic Pipeline** to see the end-to-end extraction, specialist deliberation, and ranking.

---

## 🧭 UI & Interaction Guide

- **Overview & Differential Tab**:
  - **Horizontal Phenotype Grid**: Displays confirmed positive phenotypes (green) and ruled-out findings (red strikethrough) with system tags and onset metadata.
  - **Ranked Differential List**: Compact cards showing composite diagnostic scores ($0.7 \times \text{Graph} + 0.3 \times \text{Panel} - 0.1 \times \text{Objections}$), matching terms, and expandable specialist findings.
  - **Recommended Next Steps**: High-yield differential tests and unresolved patient features.
- **Specialist Debate Tab**:
  - Filterable by Medical Specialty (Neurology, Genetics, Musculoskeletal, etc.) or by Disease.
  - Shows supporting, opposing, and neutral clinical stances with HPO citations and reviewer objections.
- **Knowledge Graph Tab**:
  - **Manual Zoom Controls**: Use the **`+`**, **`-`**, and **`Reset`** buttons on the toolbar to zoom in/out with no wheel-scroll interference.
  - **Canvas Dragging**: Click and drag to pan across the 3-tier layout (Phenotypes $\rightarrow$ Diseases $\rightarrow$ Genes).
  - **Inspector Drawer**: Click any node card to view comprehensive metadata.

---

## 📡 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/v1/diagnose` | `POST` | Executes the complete diagnostic graph synchronously |
| `/v1/diagnose/stream` | `POST` | SSE stream yielding real-time node outputs & debate updates |
| `/v1/cases/{thread_id}` | `GET` | Retrieves saved diagnostic state and history |
| `/v1/health` | `GET` | Verifies connectivity to Neo4j and LLM provider |

---

## 📂 Project Structure

```
Claude-Group-2/
├── .gitignore
├── README.md
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application & SSE endpoints
│   │   ├── graph.py         # LangGraph state graph definition
│   │   ├── nodes.py         # 6 LangGraph agent nodes & prompt templates
│   │   ├── schemas.py       # Pydantic data models & state schemas
│   │   ├── queries.py       # Cypher queries for Neo4j
│   │   ├── scoring.py       # Deterministic scoring algorithms
│   │   ├── guardrails.py    # Citation verification & validation
│   │   └── config.py        # System configuration & weights
│   ├── loader/              # Neo4j data ingestion scripts
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx          # Root application layout & tabs
    │   ├── components/      # React components (GraphVisualization, SpecialistDebate, etc.)
    │   ├── hooks/           # useAnalysis SSE hook & state management
    │   ├── utils/           # API utilities & helpers
    │   └── index.css        # Clinical glassmorphism styling
    ├── package.json
    └── vite.config.js
```

---

## 📄 License & Citations

- **Human Phenotype Ontology (HPO)**: Available under the [HPO License](https://hpo.jax.org/).
- **Orphanet / Orphadata**: Freely accessible for non-commercial research with attribution.
