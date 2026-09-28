"""WebSocket signaling for ephemeral peer-to-peer meeting rooms."""

import json
import logging
import re

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.app.config import settings
from backend.app.services.room_hub import (
    MAX_CHAT_MESSAGE_LENGTH,
    MAX_SIGNAL_BYTES,
    room_hub,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/rooms", tags=["Meeting Signaling"])
ROOM_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{8,80}$")


@router.websocket("/{room_id}/signal")
async def room_signaling(websocket: WebSocket, room_id: str):
    if not ROOM_ID_PATTERN.fullmatch(room_id):
        await websocket.close(code=1008, reason="Invalid meeting ID")
        return

    origin = websocket.headers.get("origin")
    allowed_origins = set(settings.allowed_origins)
    if origin and origin.rstrip("/") not in allowed_origins:
        await websocket.close(code=1008, reason="Origin not allowed")
        return

    display_name = websocket.query_params.get("display_name", "Guest")
    display_name = "".join(char for char in display_name if char.isprintable()).strip()[:60] or "Guest"
    participant_id = await room_hub.join(room_id, display_name, websocket)
    if participant_id is None:
        return

    logger.info("Meeting participant joined (room=%s, participant=%s)", room_id, participant_id)
    try:
        while True:
            raw_message = await websocket.receive_text()
            if len(raw_message) > MAX_SIGNAL_BYTES:
                await websocket.send_json({"type": "error", "message": "Meeting message is too large."})
                continue
            try:
                message = json.loads(raw_message)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid meeting message."})
                continue
            if not isinstance(message, dict):
                continue

            if message.get("type") == "signal":
                target_id = message.get("target_id")
                signal = message.get("signal")
                if isinstance(target_id, str) and isinstance(signal, dict):
                    await room_hub.relay_signal(room_id, participant_id, target_id, signal)
            elif message.get("type") == "chat":
                text = message.get("text")
                if isinstance(text, str) and text.strip():
                    await room_hub.broadcast(room_id, {
                        "type": "chat",
                        "participant": {"id": participant_id, "name": display_name},
                        "text": text.strip()[:MAX_CHAT_MESSAGE_LENGTH],
                    })
    except WebSocketDisconnect:
        pass
    finally:
        await room_hub.leave(room_id, participant_id)
        logger.info("Meeting participant left (room=%s, participant=%s)", room_id, participant_id)