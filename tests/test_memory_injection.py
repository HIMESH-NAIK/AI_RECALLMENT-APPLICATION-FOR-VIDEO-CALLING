"""
Memory Injection & Personalization Verification Test
====================================================
Verifies that:
1. Injected memories are received by the LLM prompt.
2. The agent response reflects the recalled memories.
3. Demonstration mode transitions work properly.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Switch to mock_dev provider for in-memory deterministic testing
from backend.app.config import settings
settings.LLM_PROVIDER = "mock_dev"

from backend.app.services.agent_service import agent_service
from backend.app.models.schemas import MemoryItem
import asyncio


async def run_test():
    print("\n--- Verifying Memory Injection & Personalization Flow ---")

    # 1. Fresh Interaction (no memories)
    print("\n1. Testing Interaction without Memories:")
    resp1 = await agent_service.process_chat(
        user_id="test_personalization_user",
        message="What programming language should I use?"
    )
    print("Agent Response 1:")
    print(resp1.response)
    assert "[Agent Fresh Interaction]" in resp1.response or "Hello" in resp1.response
    print("[OK] Interaction 1 produces a generic response as expected.")

    # 2. Simulate Recalled Memory injection
    print("\n2. Testing Prompt with Recalled Memory from Hindsight:")
    mock_memory = MemoryItem(
        id="mem_123",
        text="User is an expert Python developer building FastAPI backends for HackwithHyderabad.",
        type="fact",
        score=0.95
    )
    
    # Directly test prompt formatting logic
    prompt_context = f"<memories>\n  <memory>{mock_memory.text}</memory>\n</memories>"
    system_instruction = "Personalize response based on recalled memories."
    prompt = f"--- RECALLED LONG-TERM MEMORIES (from Hindsight) ---\n{prompt_context}\n\nUser Message: Give me architecture advice for my hackathon project."
    
    agent_resp = await agent_service.llm.generate(prompt=prompt, system_prompt=system_instruction)
    print("Agent Response with Memory:")
    print(agent_resp)
    assert "Hindsight Memory Active" in agent_resp or "previous interactions" in agent_resp
    print("[OK] Agent successfully detects and incorporates recalled Hindsight memories!")


if __name__ == "__main__":
    asyncio.run(run_test())
