"""
API Endpoints Router
====================
Requirement 8:
  POST /api/chat           - Core memory-augmented chat flow
  POST /api/memory/retain  - Manual memory retention
  POST /api/memory/recall  - Manual memory search / recall
  GET  /api/health         - Complete connectivity health check

Requirement 12:
  Demonstration mode support endpoints
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any

from backend.app.models.schemas import (
    ChatRequest,
    ChatResponse,
    RetainRequest,
    RetainResponse,
    RecallRequest,
    RecallResponse,
    MemorySuggestionRequest,
    MemorySuggestionResponse,
    MemoryOperationStatusResponse,
    HealthResponse,
    ServiceHealth,
    MemoryItem
)
from backend.app.services.agent_service import agent_service
from backend.app.services.hindsight_service import memory_service
from backend.app.services.llm.factory import get_llm_client
from backend.app.db.session_store import app_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Agent & Memory"])


# ==============================================================================
# 1. POST /api/chat (Requirement 8)
# ==============================================================================
@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Main conversational agent endpoint:
    1. Recalls relevant memories from Hindsight
    2. Builds augmented prompt
    3. Generates LLM response
    4. Retains interaction in Hindsight
    5. Returns response with recalled & retained memory inspection
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    try:
        response = await agent_service.process_chat(
            user_id=request.user_id,
            message=request.message,
            session_id=request.session_id
        )
        return response
    except Exception as e:
        logger.error("Error processing chat (%s)", type(e).__name__, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal agent error")


# ==============================================================================
# 2. POST /api/memory/retain (Requirement 8)
# ==============================================================================
@router.post("/memory/retain", response_model=RetainResponse)
async def retain_memory_endpoint(request: RetainRequest):
    """
    Manually retain a memory / experience directly into Hindsight.
    Useful for onboarding, setting user preferences, or debugging memory banks.
    """
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="Memory content cannot be empty.")

    result = await memory_service.retain_memory(
        content=request.content,
        bank_id=request.bank_id,
        user_id=request.user_id,
        context=request.context
    )

    if not result.get("success"):
        return RetainResponse(
            success=False,
            bank_id=result.get("bank_id", ""),
            message=result.get("message", "Failed to retain memory"),
            details=result.get("details")
        )

    return RetainResponse(
        success=True,
        bank_id=result.get("bank_id", ""),
        message="Memory successfully stored in Hindsight",
        operation_id=result.get("operation_id"),
        details=result.get("details")
    )


# ==============================================================================
# 3. POST /api/memory/recall (Requirement 8)
# ==============================================================================
@router.post("/memory/recall", response_model=RecallResponse)
async def recall_memory_endpoint(request: RecallRequest):
    """
    Search and retrieve relevant memories from Hindsight memory bank.
    Uses Hindsight multi-strategy search (Dense + Sparse + Graph + Temporal).
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty.")

    result = await memory_service.recall_memories(
        query=request.query,
        bank_id=request.bank_id,
        user_id=request.user_id,
        limit=request.limit
    )

    return RecallResponse(
        bank_id=result.get("bank_id", ""),
        query=request.query,
        memories=result.get("memories", []),
        total=len(result.get("memories", [])),
        prompt_context_string=result.get("prompt_context_string")
    )


@router.post("/memory/suggestions", response_model=MemorySuggestionResponse)
async def memory_suggestions_endpoint(request: MemorySuggestionRequest):
    """Extract candidate facts from meeting notes; nothing is retained until confirmed."""
    try:
        suggestions = await agent_service.extract_memory_suggestions(
            meeting_title=request.meeting_title,
            notes=request.notes,
        )
        return MemorySuggestionResponse(success=True, suggestions=suggestions)
    except Exception as exc:
        logger.warning("Memory suggestion extraction failed (%s)", type(exc).__name__)
        return MemorySuggestionResponse(
            success=False,
            message="Memory suggestions could not be generated. Your notes were not stored.",
        )


@router.get("/memory/operations/{operation_id}", response_model=MemoryOperationStatusResponse)
async def memory_operation_status_endpoint(operation_id: str, user_id: str = "user_dev"):
    result = await memory_service.get_operation_status(operation_id=operation_id, user_id=user_id)
    return MemoryOperationStatusResponse(**result)


# ==============================================================================
# 4. GET /api/health (Requirement 8 & 13)
# ==============================================================================
@router.get("/health", response_model=HealthResponse)
async def health_check_endpoint():
    """
    Performs comprehensive connectivity checks:
    - Backend API status
    - Local LLM (Ollama or OpenAI-compatible) status and loaded models
    - Self-hosted Hindsight persistent memory status
    """
    llm_client = get_llm_client()
    llm_health_raw = await llm_client.check_health()
    hindsight_health_raw = await memory_service.check_health()

    llm_details = llm_health_raw.get("details")
    if isinstance(llm_details, str):
        llm_details = {"message": llm_details}
    elif not isinstance(llm_details, dict):
        llm_details = {"model": llm_health_raw.get("model")}

    llm_health = ServiceHealth(
        status=llm_health_raw.get("status", "unknown"),
        provider=llm_health_raw.get("provider"),
        url=llm_health_raw.get("url"),
        details=llm_details,
        error=llm_health_raw.get("error")
    )

    hindsight_health = ServiceHealth(
        status=hindsight_health_raw.get("status", "unknown"),
        provider="hindsight",
        url=hindsight_health_raw.get("url"),
        details=hindsight_health_raw.get("details"),
        error=hindsight_health_raw.get("error")
    )

    # Calculate overall system status
    overall_status = "healthy"
    if llm_health.status != "connected" or hindsight_health.status != "connected":
        overall_status = "degraded"
    if llm_health.status != "connected" and hindsight_health.status != "connected":
        overall_status = "unhealthy"

    return HealthResponse(
        status=overall_status,
        backend="online",
        llm=llm_health,
        hindsight=hindsight_health
    )


# ==============================================================================
# 5. DEMONSTRATION MODE SCENARIOS (Requirement 12)
# ==============================================================================
@router.get("/demo/scenarios")
async def get_demo_scenarios():
    """
    Requirement 12 Demonstration Mode:
    - Interaction 1  → generic response (First meeting: user shares facts & preferences)
    - Interaction 5  → personalized response (Agent recalls early preferences)
    - Interaction 20 → accumulated memories (Agent synthesizes multiple accumulated memories)
    """
    return {
        "scenarios": [
            {
                "step": 1,
                "label": "Interaction 1: First Meeting (Generic)",
                "description": "User introduces themselves, tech stack, and location. Agent gives a generic helpful response and retains facts in Hindsight.",
                "user_message": "Hi, I am Arjun from Hyderabad. I'm building an AI agent project using Python, FastAPI, and Docker for the HackwithHyderabad hackathon."
            },
            {
                "step": 5,
                "label": "Interaction 5: Personalized Response",
                "description": "User asks for recommendations or debugging advice. The agent recalls Arjun's location, tech stack (Python/FastAPI), and hackathon goal without needing it repeated.",
                "user_message": "What database or architectural pattern should I choose for storing high-frequency user telemetry in my project?"
            },
            {
                "step": 20,
                "label": "Interaction 20: Deep Accumulated Memory",
                "description": "After multiple interactions, user asks a synthesis question. Agent leverages accumulated memories of past constraints, preferences, and project context.",
                "user_message": "Can you summarize everything we've planned for my hackathon submission and give me a pitch summary highlighting my profile?"
            }
        ]
    }


@router.post("/demo/reset")
async def reset_demo_endpoint(user_id: str = Query(default="user_dev")):
    """
    Resets application data and logs for the given user so demo mode can be tested repeatedly.
    """
    app_store.reset_user_data(user_id=user_id)
    return {"success": True, "message": f"Demo state reset for user '{user_id}'"}
