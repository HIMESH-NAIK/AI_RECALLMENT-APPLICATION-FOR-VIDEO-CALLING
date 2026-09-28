"""
Mock LLM Client for Development and Testing
==========================================
Enables zero-dependency local testing of the agent memory flow even when
Ollama or heavy models are not yet pulled.
"""

import logging
from typing import Optional, Dict, Any
from backend.app.services.llm.base import BaseLLMClient

logger = logging.getLogger(__name__)


class MockDevClient(BaseLLMClient):
    """
    Simulation client for fast offline testing and hackathon sanity testing.
    Reacts dynamically to memories present in the prompt.
    """

    def __init__(self, model: str = "mock-agent-v1"):
        self.model = model

    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        logger.info("[MOCK LLM] Simulating response...")

        # Detect if Hindsight recalled memories were injected into the prompt
        has_memories = "RECALLED LONG-TERM MEMORIES" in prompt or "<memories>" in prompt or "FACTS:" in prompt

        # Extract user message line from prompt
        user_line = "your query"
        for line in prompt.splitlines():
            if line.startswith("User Message:"):
                user_line = line.replace("User Message:", "").strip()
                break

        if has_memories:
            return (
                f"[Agent with Hindsight Memory Active]: I remember our previous interactions! "
                f"Based on what you previously shared, I have tailored my response to your background. "
                f"Your query was: '{user_line}'"
            )
        else:
            return (
                f"[Agent Fresh Interaction]: Hello! I am your AI assistant running locally. "
                f"I don't have any specific past memories about this query yet, but I'm ready to learn! "
                f"Your query was: '{user_line}'"
            )

    async def check_health(self) -> Dict[str, Any]:
        return {
            "status": "connected",
            "provider": "mock_dev",
            "model": self.model,
            "url": "local-in-process",
            "details": "Mock LLM client active for rapid prototyping and testing."
        }
