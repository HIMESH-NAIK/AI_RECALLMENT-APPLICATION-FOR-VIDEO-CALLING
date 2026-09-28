"""
Hindsight Persistent Memory Service
===================================
Requirement 2: Integrate Hindsight as the persistent long-term memory layer.
Requirement 3: Run Hindsight locally/self-hosted. Do NOT use Hindsight Cloud.
Requirement 4: Configurable HINDSIGHT_URL via .env.
Requirement 17: Uses current official `hindsight-client` Python SDK.
Requirement 18: Explains where Hindsight retain and recall happen.
"""

import logging
from typing import List, Dict, Any, Optional
import httpx

from hindsight_client import Hindsight, RecallResponse, RetainResponse
from hindsight_client_api.exceptions import ApiException, ServiceException
from backend.app.config import settings
from backend.app.models.schemas import MemoryItem

logger = logging.getLogger(__name__)


class HindsightMemoryService:
    """
    Wrapper around the official Hindsight SDK to handle:
    - Retaining agent interactions and user preferences (Long-term memory)
    - Recalling relevant memories using Hindsight's 4-way retrieval (Dense, Sparse, Graph, Temporal)
    - Robust error handling when Hindsight is unavailable, times out, or reports errors
    """

    def __init__(self):
        self.base_url = settings.HINDSIGHT_URL.rstrip("/")
        self.api_key = settings.HINDSIGHT_API_KEY
        self.default_bank = settings.HINDSIGHT_DEFAULT_BANK

        # Initialize official Hindsight SDK client
        # Hindsight client connects directly to self-hosted Hindsight endpoint
        self.client = Hindsight(
            base_url=self.base_url,
            api_key=self.api_key,
            timeout=float(settings.HINDSIGHT_TIMEOUT_SECONDS)
        )
        logger.info(f"Initialized HindsightMemoryService targeting: {self.base_url}")

    def get_bank_id(self, user_id: Optional[str] = None, bank_id: Optional[str] = None) -> str:
        """
        Resolve the bank_id for memory isolation.
        Each user gets their own memory bank, or falls back to the default bank.
        """
        if bank_id:
            return bank_id
        if user_id:
            # Clean identifier for bank namespace
            clean_id = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in user_id)
            return f"bank_{clean_id}"
        return self.default_bank

    # ==========================================================================
    # HINDSIGHT RECALL INTEGRATION
    # Requirement 18: Explains where Hindsight recall happens
    # ==========================================================================
    async def recall_memories(
        self,
        query: str,
        bank_id: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 5
    ) -> Dict[str, Any]:
        """
        Recalls relevant memories from Hindsight using semantic + temporal + graph search.
        
        WHERE RECALL HAPPENS:
        This function queries the self-hosted Hindsight memory bank for facts,
        observations, and entities relevant to the given query.
        
        Requirement 9: We do NOT send full chat history to the LLM.
        Instead, we recall only relevant memory nuggets matching the current query.
        """
        target_bank = self.get_bank_id(user_id=user_id, bank_id=bank_id)
        logger.info("[MEMORY] Recall started (bank=%s, limit=%d)", target_bank, limit)

        try:
            # Call official Hindsight async recall API
            response: RecallResponse = await self.client.arecall(
                bank_id=target_bank,
                query=query,
                max_tokens=2048,
                budget="mid"
            )

            # Convert Hindsight RecallResult objects into standard MemoryItem schemas
            memories: List[MemoryItem] = []
            if response and response.results:
                for res in response.results[:limit]:
                    memories.append(
                        MemoryItem(
                            id=str(res.id) if res.id else None,
                            text=res.text,
                            context=res.context,
                            type=res.type,
                            occurred_start=str(res.occurred_start) if res.occurred_start else None,
                            mentioned_at=str(res.mentioned_at) if res.mentioned_at else None,
                            score=getattr(res.scores, "final", None) if res.scores else None
                        )
                    )

            # Generate prompt context string using official SDK to_prompt_string
            prompt_str = response.to_prompt_string() if response else ""
            logger.info("[MEMORY] Retrieved %d memories", len(memories))

            return {
                "success": True,
                "bank_id": target_bank,
                "query": query,
                "memories": memories,
                "prompt_context_string": prompt_str,
                "count": len(memories)
            }

        except (ApiException, ServiceException) as e:
            if getattr(e, "status", None) == 404:
                logger.info("[MEMORY] Bank does not exist yet; treating recall as empty")
                return {
                    "success": True,
                    "bank_id": target_bank,
                    "query": query,
                    "memories": [],
                    "prompt_context_string": "",
                    "count": 0
                }
            logger.warning("[MEMORY] Recall failed with Hindsight API status %s", e.status)
            return {
                "success": False,
                "bank_id": target_bank,
                "query": query,
                "memories": [],
                "prompt_context_string": "",
                "error": f"Hindsight API error: {str(e)}"
            }
        except httpx.ConnectError:
            logger.warning("[MEMORY] Recall failed: cannot connect to Hindsight at %s", self.base_url)
            return {
                "success": False,
                "bank_id": target_bank,
                "query": query,
                "memories": [],
                "prompt_context_string": "",
                "error": f"Hindsight unavailable at {self.base_url}"
            }
        except Exception as e:
            logger.warning("[MEMORY] Recall failed (%s); continuing without memory", type(e).__name__)
            return {
                "success": False,
                "bank_id": target_bank,
                "query": query,
                "memories": [],
                "prompt_context_string": "",
                "error": str(e)
            }

    # ==========================================================================
    # HINDSIGHT RETAIN INTEGRATION
    # Requirement 18: Explains where Hindsight retain happens
    # ==========================================================================
    async def retain_memory(
        self,
        content: str,
        bank_id: Optional[str] = None,
        user_id: Optional[str] = None,
        context: Optional[str] = None,
        retain_async: bool = False,
    ) -> Dict[str, Any]:
        """
        Retains an interaction or fact into the Hindsight memory system.
        
        WHERE RETAIN HAPPENS:
        Unlike simple key-value databases, Hindsight extracts entities, facts,
        and temporal relationships automatically during retain, updating the agent's
        internal mental models.
        """
        target_bank = self.get_bank_id(user_id=user_id, bank_id=bank_id)
        logger.info("[MEMORY] Retention started (bank=%s)", target_bank)

        try:
            # Call official Hindsight async retain API
            response: RetainResponse = await self.client.aretain(
                bank_id=target_bank,
                content=content,
                context=context,
                retain_async=retain_async,
            )

            accepted = bool(response and response.success)
            is_async = bool(response and response.var_async)
            logger.info(
                "[MEMORY] Retention %s (bank=%s)",
                "queued" if accepted and is_async else "successful" if accepted else "failed",
                target_bank,
            )
            return {
                "success": accepted,
                "async": is_async,
                "bank_id": target_bank,
                "message": "Memory accepted for background processing" if is_async else "Memory retained successfully in Hindsight",
                "operation_id": response.operation_id if response else None,
                "details": {
                    "items_count": getattr(response, "items_count", 1),
                    "bank_id": target_bank
                }
            }

        except (ApiException, ServiceException) as e:
            logger.warning("[MEMORY] Retention failed with Hindsight API status %s", e.status)
            return {
                "success": False,
                "bank_id": target_bank,
                "message": f"Hindsight API error: {str(e)}",
                "error": str(e)
            }

    async def get_operation_status(
        self,
        operation_id: str,
        user_id: Optional[str] = None,
        bank_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        target_bank = self.get_bank_id(user_id=user_id, bank_id=bank_id)
        try:
            response = await self.client.operations.get_operation_status(
                bank_id=target_bank,
                operation_id=operation_id,
                include_payload=False,
            )
            return {
                "success": True,
                "operation_id": operation_id,
                "bank_id": target_bank,
                "status": response.status,
                "error": response.error_message,
            }
        except Exception as exc:
            logger.warning("[MEMORY] Operation status lookup failed (%s)", type(exc).__name__)
            return {
                "success": False,
                "operation_id": operation_id,
                "bank_id": target_bank,
                "status": "unknown",
                "error": "Hindsight operation status is unavailable.",
            }
        except httpx.ConnectError:
            logger.warning("[MEMORY] Retention failed: cannot connect to Hindsight at %s", self.base_url)
            return {
                "success": False,
                "bank_id": target_bank,
                "message": f"Hindsight service unavailable at {self.base_url}",
                "error": "Connection refused"
            }
        except Exception as e:
            logger.warning("[MEMORY] Retention failed (%s)", type(e).__name__)
            return {
                "success": False,
                "bank_id": target_bank,
                "message": f"Failed to retain memory: {str(e)}",
                "error": str(e)
            }

    # ==========================================================================
    # HEALTH CHECK INTEGRATION
    # Requirement 8 & 13: GET /api/health connectivity verification
    # ==========================================================================
    async def check_health(self) -> Dict[str, Any]:
        """
        Checks connectivity to the self-hosted Hindsight instance.
        """
        try:
            # Try official get_version API endpoint
            version_resp = await self.client.aget_version()
            version_str = getattr(version_resp, "version", "online")
            return {
                "status": "connected",
                "url": self.base_url,
                "details": {
                    "version": version_str,
                    "default_bank": self.default_bank
                }
            }
        except Exception as e:
            # Fallback ping check
            try:
                async with httpx.AsyncClient(timeout=3.0) as http_client:
                    resp = await http_client.get(f"{self.base_url}/health")
                    if resp.status_code < 500:
                        return {
                            "status": "connected",
                            "url": self.base_url,
                            "details": {"ping": "ok"}
                        }
            except Exception:
                pass

            return {
                "status": "unavailable",
                "url": self.base_url,
                "error": f"Cannot reach Hindsight server at {self.base_url}. Ensure Hindsight Docker or binary is running.",
                "details": None
            }


# Singleton memory service
memory_service = HindsightMemoryService()
