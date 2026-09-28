"""
Base LLM Client Interface
=========================
Requirement 5: Make the LLM configurable so models/providers can be changed
without rewriting the application.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any


class BaseLLMClient(ABC):
    """Abstract base class for all LLM providers (Ollama, OpenAI-compatible, etc.)."""

    @abstractmethod
    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        Generate a text response given a prompt and optional system instructions.
        Must handle timeouts and empty responses gracefully.
        """
        pass

    @abstractmethod
    async def check_health(self) -> Dict[str, Any]:
        """
        Check connectivity to the LLM backend.
        Returns a dictionary with status, provider, model name, and error details if any.
        """
        pass
