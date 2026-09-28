"""
OpenAI-Compatible LLM Client
============================
Requirement 5: Make the LLM configurable so models and providers can be changed
without rewriting the application (e.g. OpenAI, Groq, LM Studio, vLLM, DeepSeek).
"""

import logging
import httpx
from typing import Optional, Dict, Any
from backend.app.config import settings
from backend.app.services.llm.base import BaseLLMClient

logger = logging.getLogger(__name__)


class OpenAICompatibleClient(BaseLLMClient):
    """
    Connects to any OpenAI-compatible `/v1/chat/completions` endpoint.
    """

    def __init__(
        self,
        base_url: str = settings.OPENAI_API_BASE,
        api_key: Optional[str] = settings.OPENAI_API_KEY,
        model: str = settings.LLM_MODEL,
        timeout_seconds: int = settings.LLM_TIMEOUT_SECONDS
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout = timeout_seconds

    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        endpoint = f"{self.base_url}/chat/completions"

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.7
        }

        try:
            async with httpx.AsyncClient(timeout=float(self.timeout)) as client:
                response = await client.post(endpoint, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                choices = data.get("choices", [])
                if choices and "message" in choices[0]:
                    content = choices[0]["message"].get("content", "").strip()
                    if content:
                        return content
                return "Model returned an empty response."

        except httpx.ConnectError:
            return f"[LLM Error: Cannot connect to {self.base_url}]"
        except httpx.TimeoutException:
            return f"[LLM Error: Request timed out after {self.timeout}s]"
        except Exception as e:
            return f"[LLM Error: {str(e)}]"

    async def check_health(self) -> Dict[str, Any]:
        try:
            headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/models", headers=headers)
                if resp.status_code == 200:
                    return {
                        "status": "connected",
                        "provider": "openai_compatible",
                        "model": self.model,
                        "url": self.base_url
                    }
                return {
                    "status": "degraded",
                    "provider": "openai_compatible",
                    "error": f"HTTP {resp.status_code}"
                }
        except Exception as e:
            return {
                "status": "unavailable",
                "provider": "openai_compatible",
                "url": self.base_url,
                "error": str(e)
            }
