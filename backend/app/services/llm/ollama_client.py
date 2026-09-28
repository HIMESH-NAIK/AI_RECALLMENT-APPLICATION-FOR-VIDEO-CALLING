"""
Ollama Local LLM Client
=======================
Requirement 6: Support local LLM through Ollama via:
  LLM_PROVIDER=ollama
  LLM_MODEL=<MODEL_NAME>
  OLLAMA_BASE_URL=http://localhost:11434

Requirement 13: Error handling for LLM unavailable, Timeout, and Empty response.
Requirement 18: Comments explaining where LLM integration happens.
"""

import logging
import httpx
from typing import Optional, Dict, Any
from backend.app.config import settings
from backend.app.services.llm.base import BaseLLMClient

logger = logging.getLogger(__name__)


class OllamaClient(BaseLLMClient):
    """
    Connects to a locally running Ollama instance (http://localhost:11434).
    Uses Ollama's native `/api/chat` or OpenAI-compatible `/v1/chat/completions`.
    """

    def __init__(
        self,
        base_url: str = settings.OLLAMA_BASE_URL,
        model: str = settings.LLM_MODEL,
        timeout_seconds: int = settings.LLM_TIMEOUT_SECONDS
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout_seconds
        logger.info(f"Initialized OllamaClient targeting model '{self.model}' at '{self.base_url}'")

    # ==========================================================================
    # LLM INTEGRATION - GENERATE RESPONSE
    # Requirement 18: Explains where LLM integration happens
    # ==========================================================================
    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        WHERE LLM INTEGRATION HAPPENS:
        Sends the user message along with recalled Hindsight memories to the local
        Ollama LLM and streams back the generated answer.
        """
        endpoint = f"{self.base_url}/api/chat"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.7
            }
        }

        try:
            async with httpx.AsyncClient(timeout=float(self.timeout)) as client:
                logger.info(f"[LLM REQUEST] Sending prompt to Ollama ({self.model})...")
                response = await client.post(endpoint, json=payload)

                if response.status_code == 404:
                    # Model not found or endpoint not found
                    return (
                        f"Error: Model '{self.model}' was not found in your local Ollama instance. "
                        f"Please run 'ollama pull {self.model}' in your terminal."
                    )

                response.raise_for_status()
                data = response.json()

                # Extract generated text from Ollama response
                generated_text = ""
                if "message" in data and "content" in data["message"]:
                    generated_text = data["message"]["content"].strip()
                elif "response" in data:
                    generated_text = data["response"].strip()

                # Requirement 13: Handle empty response
                if not generated_text:
                    logger.warning("[LLM WARNING] Ollama returned an empty response.")
                    return "I processed your request, but the local model produced an empty response. Please try rephrasing."

                return generated_text

        # Requirement 13: Handle LLM unavailable
        except httpx.ConnectError:
            error_msg = (
                f"[LLM Error: Ollama is unreachable at {self.base_url}] "
                f"Make sure Ollama is installed and running ('ollama serve')."
            )
            logger.error(error_msg)
            return error_msg

        # Requirement 13: Handle Timeout
        except httpx.TimeoutException:
            error_msg = (
                f"[LLM Error: Request timed out after {self.timeout}s] "
                f"The local model '{self.model}' is taking longer than expected. "
                f"Try using a smaller model (e.g., qwen2.5:3b or llama3.2:1b) or increase LLM_TIMEOUT_SECONDS."
            )
            logger.error(error_msg)
            return error_msg

        except Exception as e:
            error_msg = f"[LLM Error: Unexpected failure communicating with Ollama: {str(e)}]"
            logger.error(error_msg)
            return error_msg

    # ==========================================================================
    # LLM HEALTH CHECK
    # Requirement 8 & 13: Health endpoint LLM connectivity check
    # ==========================================================================
    async def check_health(self) -> Dict[str, Any]:
        """
        Verifies if Ollama is running and whether the selected model is pulled.
        """
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                # Query tags endpoint to list installed local models
                resp = await client.get(f"{self.base_url}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    models = [m.get("name", "") for m in data.get("models", [])]
                    model_found = any(self.model in m for m in models)
                    return {
                        "status": "connected",
                        "provider": "ollama",
                        "model": self.model,
                        "url": self.base_url,
                        "model_ready": model_found,
                        "available_models": models,
                        "details": f"Ollama online. Model '{self.model}' {'installed' if model_found else 'NOT found - run ollama pull ' + self.model}."
                    }
                return {
                    "status": "degraded",
                    "provider": "ollama",
                    "url": self.base_url,
                    "error": f"Ollama returned HTTP {resp.status_code}"
                }
        except httpx.ConnectError:
            return {
                "status": "unavailable",
                "provider": "ollama",
                "model": self.model,
                "url": self.base_url,
                "error": f"Cannot connect to Ollama at {self.base_url}. Start Ollama using 'ollama serve'."
            }
        except Exception as e:
            return {
                "status": "error",
                "provider": "ollama",
                "model": self.model,
                "url": self.base_url,
                "error": str(e)
            }
