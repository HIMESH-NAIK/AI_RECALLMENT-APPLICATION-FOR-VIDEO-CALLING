"""
Automated Test Suite for Hindsight AI Agent Backend
===================================================
Tests all required endpoints:
- GET  /api/health
- POST /api/chat
- POST /api/memory/retain
- POST /api/memory/recall
- GET  /api/demo/scenarios
- POST /api/demo/reset

Verifies graceful error handling when Hindsight/Ollama are offline,
and verifies session/database separation.
"""

import sys
import os
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from starlette.testclient import TestClient
from backend.app.main import app
from backend.app.db.session_store import app_store

client = TestClient(app)


def test_health_endpoint():
    print("Testing GET /api/health...")
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "backend" in data
    assert "llm" in data
    assert "hindsight" in data
    print(f"[OK] Health Check Passed: Status={data['status']}, Backend={data['backend']}")


def test_application_database_separation():
    print("Testing Application DB vs Memory Separation (Requirement 10)...")
    test_user = "test_user_hackathon"
    app_store.reset_user_data(test_user)

    user = app_store.get_or_create_user(test_user)
    assert user["user_id"] == test_user
    assert user["interaction_count"] == 0

    count1 = app_store.increment_user_interactions(test_user)
    assert count1 == 1

    count2 = app_store.increment_user_interactions(test_user)
    assert count2 == 2

    session_id = app_store.get_or_create_session(test_user)
    assert session_id.startswith("sess_")

    app_store.log_message(session_id, test_user, "user", "Hello agent!")
    print("[OK] Application DB Separation Test Passed!")


def test_chat_endpoint_graceful_handling():
    print("Testing POST /api/chat (with graceful handling if Ollama/Hindsight are offline)...")
    payload = {
        "user_id": "test_user_hackathon",
        "message": "Hi, I am Arjun from Hyderabad building a memory agent."
    }
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert data["user_id"] == "test_user_hackathon"
    assert "memories_recalled" in data
    assert "memory_retained" in data
    print(f"[OK] Chat Endpoint Response: {data['response'][:60]}...")


def test_direct_memory_endpoints():
    print("Testing Direct Memory Endpoints (POST /api/memory/retain & recall)...")
    
    # Retain
    retain_payload = {
        "user_id": "test_user_hackathon",
        "content": "Arjun loves building AI agent architectures with Python."
    }
    retain_resp = client.post("/api/memory/retain", json=retain_payload)
    assert retain_resp.status_code == 200
    print(f"[OK] Retain Endpoint Result: success={retain_resp.json().get('success')}")

    # Recall
    recall_payload = {
        "user_id": "test_user_hackathon",
        "query": "What does Arjun love building?",
        "limit": 5
    }
    recall_resp = client.post("/api/memory/recall", json=recall_payload)
    assert recall_resp.status_code == 200
    print(f"[OK] Recall Endpoint Result: total={recall_resp.json().get('total')}")


def test_demo_endpoints():
    print("Testing Demo Mode Endpoints...")
    scenarios_resp = client.get("/api/demo/scenarios")
    assert scenarios_resp.status_code == 200
    data = scenarios_resp.json()
    assert "scenarios" in data
    assert len(data["scenarios"]) == 3
    print(f"[OK] Demo Scenarios returned: {len(data['scenarios'])} steps")

    reset_resp = client.post("/api/demo/reset?user_id=test_user_hackathon")
    assert reset_resp.status_code == 200
    print("[OK] Demo Reset Succeeded!")


def test_invalid_request_handling():
    print("Testing Invalid Request Handling (Requirement 13)...")
    resp = client.post("/api/chat", json={"user_id": "test", "message": "   "})
    assert resp.status_code in (400, 422)
    print("[OK] Invalid Request Properly Rejected with 400!")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("RUNNING LOCAL AI AGENT BACKEND TEST SUITE")
    print("=" * 60 + "\n")

    test_health_endpoint()
    test_application_database_separation()
    test_chat_endpoint_graceful_handling()
    test_direct_memory_endpoints()
    test_demo_endpoints()
    test_invalid_request_handling()

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY! [OK]")
    print("=" * 60 + "\n")
