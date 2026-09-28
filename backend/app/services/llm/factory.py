"""
LLM Factory
===========
Requirement 5: Make the LLM configurable so models and providers can be changed
without rewriting the application.
"""

import logging
from backend.app.config import settings
from backend.app.services.llm.base import BaseLLMClient
from backend.app.services.llm.ollama_client import OllamaClient
from backend.app.services.llm.openai_client import OpenAICompatibleClient
from backend.app.services.llm.mock_client import MockDevClient

logger = logging.getLogger(__name__)


def get_llm_client() -> BaseLLMClient:
    """
    Returns the configured LLM client instance according to LLM_PROVIDER in settings.
    """
    provider = settings.LLM_PROVIDER.lower().strip()

    if provider == "ollama":
        return OllamaClient(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.LLM_MODEL,
            timeout_seconds=settings.LLM_TIMEOUT_SECONDS
        )
    elif provider in ("openai", "openai_compatible"):
        return OpenAICompatibleClient(
            base_url=settings.OPENAI_API_BASE,
            api_key=settings.OPENAI_API_KEY,
            model=settings.LLM_MODEL,
            timeout_seconds=settings.LLM_TIMEOUT_SECONDS
        )
    elif provider in ("mock", "mock_dev"):
        return MockDevClient(model=settings.LLM_MODEL)
    else:
        logger.warning(f"Unknown LLM_PROVIDER '{provider}'. Defaulting to OllamaClient.")
        return OllamaClient(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.LLM_MODEL,
            timeout_seconds=settings.LLM_TIMEOUT_SECONDS
        )
