"""Ephemeral WebSocket signaling for peer-to-peer meeting rooms."""

import asyncio
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

MAX_ROOM_PARTICIPANTS = 8
MAX_CHAT_MESSAGE_LENGTH = 2000
MAX_SIGNAL_BYTES = 64_000


@dataclass
class RoomParticipant:
    participant_id: str
    display_name: str
    socket: WebSocket


class RoomHub:
    """Single-process room registry; media stays peer-to-peer in browsers."""

    def __init__(self) -> None:
        self._rooms: dict[str, dict[str, RoomParticipant]] = {}
        self._lock = asyncio.Lock()

    async def join(self, room_id: str, display_name: str, socket: WebSocket) -> str | None:
        participant_id = uuid4().hex
        await socket.accept()
        async with self._lock:
            room = self._rooms.setdefault(room_id, {})
            if len(room) >= MAX_ROOM_PARTICIPANTS:
                await socket.send_json({"type": "error", "message": "This meeting is full."})
                await socket.close(code=1008)
                return None
            existing = [
                {"id": participant.participant_id, "name": participant.display_name}
                for participant in room.values()
            ]
            participant = RoomParticipant(participant_id, display_name, socket)
            room[participant_id] = participant

        await socket.send_json({
            "type": "joined",
            "participant": {"id": participant_id, "name": display_name},
            "participants": existing,
        })
        await self.broadcast(room_id, {
            "type": "participant-joined",
            "participant": {"id": participant_id, "name": display_name},
        }, exclude=participant_id)
        return participant_id

    async def leave(self, room_id: str, participant_id: str) -> None:
        async with self._lock:
            room = self._rooms.get(room_id)
            participant = room.pop(participant_id, None) if room else None
            if room is not None and not room:
                self._rooms.pop(room_id, None)
        if participant is not None:
            await self.broadcast(room_id, {
                "type": "participant-left",
                "participant_id": participant_id,
            })

    async def relay_signal(self, room_id: str, sender_id: str, target_id: str, signal: dict[str, Any]) -> bool:
        async with self._lock:
            room = self._rooms.get(room_id, {})
            sender = room.get(sender_id)
            target = room.get(target_id)
        if sender is None or target is None:
            return False
        await target.socket.send_json({
            "type": "signal",
            "participant": {"id": sender.participant_id, "name": sender.display_name},
            "signal": signal,
        })
        return True

    async def broadcast(self, room_id: str, payload: dict[str, Any], exclude: str | None = None) -> None:
        async with self._lock:
            recipients = [
                participant.socket
                for participant in self._rooms.get(room_id, {}).values()
                if participant.participant_id != exclude
            ]
        for socket in recipients:
            try:
                await socket.send_json(payload)
            except (RuntimeError, WebSocketDisconnect):
                continue


room_hub = RoomHub()