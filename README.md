# Local AI Agent with Self-Hosted Hindsight Memory

A full-stack, 100% local AI Agent memory system built for **HackwithHyderabad 3.0**.  
This project connects a **Local LLM (via Ollama)** with **Self-Hosted Hindsight Memory** using a **Python FastAPI** backend and an interactive **Frontend Chat & Memory Inspector**.

---

## 🏛️ Architecture Overview

```
Frontend (Web UI + Inspector)
        ↓  (HTTP REST)
FastAPI Backend (Orchestrator)
        ├── Application Database (SQLite: Sessions, Interaction Counter, Logs)
        ↓
AI Agent Flow:
 1. User Message arrives
 2. Recall relevant memories from Hindsight (Dense + Sparse + Graph + Temporal)
 3. Compose prompt: [Relevant Memories + Current Message]
 4. Generate response via Local LLM (Ollama)
 5. Retain new interaction in Hindsight (Facts & mental models synthesized)
 6. Return response + recalled memory audit to Frontend
```

### Key Highlights
- **Biomimetic Long-Term Memory:** Integrates self-hosted **Hindsight** (`ghcr.io/vectorize-io/hindsight`) — not a flat RAG database.
- **Selective Memory Retrieval (Requirement 9):** Does **NOT** dump full conversation history into the LLM context window. Only relevant memories are retrieved and injected.
- **Strict Separation of Concerns (Requirement 10):** Transactional state (sessions, counters, audit logs) lives in the application SQLite database, while semantic long-term memory is managed strictly by Hindsight.
- **Pluggable LLM Engine (Requirement 5 & 6):** Configurable between local Ollama (`llama3.2`, `mistral`, `qwen2.5`), any OpenAI-compatible provider (LM Studio, vLLM, DeepSeek), or an in-process mock client.
- **Demonstration Mode (Requirement 12):** Built-in demo runner showcasing Interaction 1 (generic), Interaction 5 (personalized), and Interaction 20 (accumulated synthesis).
- **Graceful Error Handling (Requirement 13):** Clean degradation and actionable diagnostics if Ollama or Hindsight is temporarily offline.

---

## 📁 Directory Structure

```
local-ai-agent-hindsight/
├── backend/
│   └── app/
│       ├── config.py                 # Pydantic BaseSettings (.env loader)
│       ├── main.py                   # FastAPI app & static file server
│       ├── db/
│       │   └── session_store.py      # Relational app store (SQLite) - separate from Hindsight
│       ├── models/
│       │   └── schemas.py            # Pydantic models for chat, retain, recall, health
│       ├── routes/
│       │   └── api.py                # REST endpoints (/api/chat, retain, recall, health, demo)
│       └── services/
│           ├── agent_service.py      # Core agent orchestration (Recall -> LLM -> Retain)
│           ├── hindsight_service.py  # Hindsight SDK integration (arecall, aretain, health)
│           └── llm/
│               ├── base.py           # BaseLLMClient interface
│               ├── factory.py        # Dynamic LLM provider factory
│               ├── mock_client.py    # Zero-dependency development mock
│               ├── ollama_client.py  # Local Ollama client (HTTP /api/chat)
│               └── openai_client.py  # OpenAI-compatible client
├── frontend/
│   ├── index.html                    # Chat UI, Live Memory Inspector & Demo Modal
│   ├── style.css                     # Modern dark theme styles
│   └── app.js                        # Frontend state, API caller, and demo runner
├── tests/
│   ├── test_flow.py                  # API endpoints and error handling test suite
│   └── test_memory_injection.py      # Memory injection & personalization verification
├── docker-compose.yml                # Docker configuration for self-hosted Hindsight & Ollama
├── requirements.txt                  # Python dependencies
├── .env.example                      # Template environment variables
└── README.md                         # Complete step-by-step setup and user guide
```

---

## 🛠️ Step-by-Step Installation & Setup

### 1. Prerequisites
- **Python 3.10+** (Tested on Python 3.13)
- **Ollama** installed on your laptop ([Download Ollama](https://ollama.com/download))
- **Docker Desktop** installed on your laptop (for running local Hindsight)

---

### 2. Setup Python Virtual Environment & Dependencies

Open a terminal (PowerShell or Bash) in the project directory:

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

### 3. Install & Start Ollama (Local LLM)

1. **Install Ollama:**
   - Download and run the installer from [ollama.com](https://ollama.com/download).
2. **Start Ollama service:**
   ```bash
   ollama serve
   ```
3. **Download your chosen local model:**
   In another terminal window, download a fast, lightweight local model (such as `llama3.2` or `qwen2.5:3b`):
   ```bash
   ollama pull llama3.2
   ```
4. **Verify Ollama is running:**
   ```bash
   curl http://localhost:11434/api/tags
   ```

---

### 4. Start Self-Hosted Hindsight Memory Engine

Hindsight runs locally via Docker. You can launch it using either `docker-compose` or `docker run`:

#### Option A: Using Docker Compose
```bash
docker compose up -d hindsight
```

#### Option B: Using `docker run` directly
```bash
docker run -d --name hindsight -p 8888:8888 -p 9999:9999 \
  -e HINDSIGHT_API_LLM_PROVIDER=openai \
  -e HINDSIGHT_API_LLM_BASE_URL=http://host.docker.internal:11434/v1 \
  -e HINDSIGHT_API_LLM_MODEL=llama3.2 \
  -v hindsight-data:/home/hindsight/.pg0 \
  ghcr.io/vectorize-io/hindsight:latest
```

- **Hindsight API:** `http://localhost:8888`
- **Hindsight UI Dashboard:** `http://localhost:9999`

---

### 5. Configure Environment Variables

Create `.env` from the provided `.env.example`:

```bash
cp .env.example .env
```

Your `.env` file should contain:

```env
# Hindsight Persistent Memory Settings
HINDSIGHT_URL=http://localhost:8888
HINDSIGHT_API_KEY=
HINDSIGHT_DEFAULT_BANK=hackathon_agent
HINDSIGHT_TIMEOUT_SECONDS=300

# Local LLM Configuration
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434

# LLM Timeout
LLM_TIMEOUT_SECONDS=180

# FastAPI CORS origin (the deployed frontend origin)
FRONTEND_URL=http://localhost:5173

# FastAPI Server Settings
APP_HOST=0.0.0.0
APP_PORT=8000
DEBUG=true
# PORT, when set by a hosting platform, takes precedence over APP_PORT.
```

*(Tip: If running without Ollama or Docker during quick offline development, you can set `LLM_PROVIDER=mock_dev` in `.env` to test the full flow immediately!)*

---

### 6. Start the FastAPI Backend & Frontend

Start the server using the configured host and port:

```bash
python -m backend.app.main
```

- **Frontend Chat & Memory Inspector:** `http://localhost:8000`
- **Interactive Swagger API Documentation:** `http://localhost:8000/docs`

---

## Production Deployment

Deploy the React frontend as static files and FastAPI as a separate service, or place both behind a reverse proxy. The frontend calls only the configured FastAPI URL. LLM and Hindsight credentials belong in backend/platform secrets, never in `VITE_*` variables.

### Backend Environment Variables

| Variable | Configure |
| --- | --- |
| `APP_HOST` | Set to `0.0.0.0`. |
| `PORT` | Use the port injected by the hosting platform. If unset, FastAPI falls back to `APP_PORT` (default `8000`). |
| `FRONTEND_URL` | Exact browser origin, e.g. `https://recallmeet.example.com` (scheme and host, no path). |
| `DEBUG` | Set to `false`. |
| `HINDSIGHT_URL` | Reachable production Hindsight base URL. |
| `HINDSIGHT_API_KEY` | Backend secret, only if Hindsight API authentication is enabled. |
| `HINDSIGHT_DEFAULT_BANK` | Production default memory bank. |
| `HINDSIGHT_TIMEOUT_SECONDS` | Optional; defaults to `300`. |
| `LLM_PROVIDER` | `ollama` or `openai_compatible` (existing backend-supported providers). |
| `LLM_MODEL` | Model identifier configured on the selected provider. |
| `OLLAMA_BASE_URL` | Required for Ollama; must be reachable from FastAPI. |
| `OPENAI_API_BASE` | Required for an OpenAI-compatible provider. |
| `OPENAI_API_KEY` | Backend secret required for authenticated OpenAI-compatible providers. |
| `LLM_TIMEOUT_SECONDS` | Optional; defaults to `180`. |
| `APP_PORT` | Optional fallback when `PORT` is unset; defaults to `8000`. |

If the included Compose file runs Hindsight, configure `HINDSIGHT_API_LLM_API_KEY` for the LLM provider used internally by Hindsight. This is separate from the backend-to-Hindsight `HINDSIGHT_API_KEY`. Do not expose Hindsight's administrative port `9999` publicly.

### Start FastAPI

From the project root, install dependencies and start the production server. The Python entry point binds to `0.0.0.0`, uses `PORT` when present, and falls back to `APP_PORT`:

```bash
python -m pip install -r requirements.txt
python -m backend.app.main
```

Equivalent explicit Uvicorn command for a platform that provides `PORT`:

```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port "${PORT:-${APP_PORT:-8000}}"
```

Set `DEBUG=false` for production. Do not use `--reload`.

### Build and Deploy the Frontend

`VITE_API_BASE_URL` is injected at frontend build time and is public. Set it to the deployed FastAPI origin, with no trailing slash, then publish `frontend/dist`:

```bash
cd frontend
npm ci
VITE_API_BASE_URL=https://api.example.com npm run build
```

PowerShell equivalent:

```powershell
Set-Location frontend
npm ci
$env:VITE_API_BASE_URL = "https://api.example.com"
npm run build
```

Never set `OPENAI_API_KEY`, `HINDSIGHT_API_KEY`, or provider credentials in the frontend build environment. Set backend `FRONTEND_URL` to the exact deployed frontend origin; FastAPI does not use wildcard CORS.

### Production Smoke Checks

Run these against the deployed API after configuring its environment:

```bash
export API_URL=https://api.example.com
curl --fail-with-body "$API_URL/api/health"
curl --fail-with-body -X POST "$API_URL/api/chat" -H 'Content-Type: application/json' -d '{"user_id":"deploy-check","message":"Remember that this is a deployment smoke test."}'
curl --fail-with-body -X POST "$API_URL/api/memory/retain" -H 'Content-Type: application/json' -d '{"user_id":"deploy-check","content":"RecallMeet deployment retain check."}'
curl --fail-with-body -X POST "$API_URL/api/memory/recall" -H 'Content-Type: application/json' -d '{"user_id":"deploy-check","query":"What was the RecallMeet deployment retain check?","limit":5}'
```

`/api/health` returns HTTP 200 with per-service status; unavailable dependencies are reported in its JSON response. Chat and direct retain/recall continue to use the existing configured LLM and Hindsight services.

---

## 🧪 Testing the Memory Functionality

### Run Automated Tests
```bash
python tests/test_flow.py
python tests/test_memory_injection.py
```

---

## 🎯 Proving Agent Memory: Step-by-Step Test Scenario

This scenario proves that the agent **remembers past user preferences across interactions without resending the entire chat history**:

### Step 1: Interaction 1 (Teach the Agent Facts)
**User Input:**
> *"Hi, I am Arjun from Hyderabad. I'm building an AI agent project using Python and FastAPI for the HackwithHyderabad hackathon."*

**What Happens Behind the Scenes:**
1. Hindsight queries memory bank `bank_user_dev` (0 previous memories found).
2. The agent gives a friendly, generic greeting.
3. Hindsight **retains** the interaction, automatically extracting:
   - Entity: `Arjun` (Location: `Hyderabad`, Project: `AI agent`)
   - Facts: Tech stack (`Python`, `FastAPI`), Event (`HackwithHyderabad`)
4. The memory inspector in the UI highlights: `💾 Retained in Hindsight`.

---

### Step 2: Unrelated Casual Chat (Interaction 2-4)
**User Input:**
> *"What is the weather usually like in September?"*

**What Happens:**
- Agent answers neutrally about September weather. Full past conversation history is **not** re-injected.

---

### Step 3: Interaction 5 (Test Personalization & Memory Recall)
**User Input (Notice: No tech stack or location is mentioned!):**
> *"What database or cache should I choose for storing high-frequency user telemetry in my project?"*

**What Happens Behind the Scenes:**
1. Agent invokes `Hindsight.recall(bank_id="bank_user_dev", query="What database or cache should I choose...")`.
2. Hindsight performs a 4-way search (Dense, Sparse, Graph, Temporal) and retrieves:
   - *Arjun is building an AI agent project using Python and FastAPI for HackwithHyderabad.*
3. Only this relevant fact is injected into the LLM prompt.
4. **Agent Response:**
   > *"Given that you're building a Python and FastAPI backend for HackwithHyderabad, I recommend Redis for in-memory telemetry caching paired with PostgreSQL or SQLite for persistent application data..."*
5. The UI displays **🧠 Recalled 1 memory: Arjun is building an AI agent with Python & FastAPI**.

---

### Step 4: Interaction 20 (Deep Accumulated Memory Synthesis)
**User Input:**
> *"Can you give me a pitch summary for my hackathon submission highlighting my profile?"*

**What Happens Behind the Scenes:**
1. Hindsight recalls all accumulated facts about Arjun, his stack, his architectural choices, and his location.
2. The agent produces a complete, personalized pitch synthesized from multiple past conversations.

---

## 📡 REST API Reference

### 1. `POST /api/chat`
Execute memory-augmented agent chat.

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "arjun",
    "message": "Hi, I am Arjun from Hyderabad building with FastAPI."
  }'
```

### 2. `POST /api/memory/retain`
Manually store a memory or fact directly in Hindsight.

```bash
curl -X POST http://localhost:8000/api/memory/retain \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "arjun",
    "content": "Arjun prefers dark mode and uses PyTorch for deep learning."
  }'
```

### 3. `POST /api/memory/recall`
Directly query memories using Hindsight's 4-way search.

```bash
curl -X POST http://localhost:8000/api/memory/recall \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "arjun",
    "query": "What are Arjun\u0027s tech preferences?",
    "limit": 5
  }'
```

### 4. `GET /api/health`
Check connectivity across Backend, Local LLM, and Self-Hosted Hindsight.

```bash
curl http://localhost:8000/api/health
```

---

## ⚖️ License
Built for **HackwithHyderabad 3.0**. Open-source under the MIT License.
