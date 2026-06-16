"""
Salas WebSocket por escola (school_id). Eventos leves para atualizar o front sem recarregar.
"""

from __future__ import annotations

import logging
from typing import Dict
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: Dict[str, set[WebSocket]] = {}

    async def connect(self, school_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        key = str(school_id)
        if key not in self._rooms:
            self._rooms[key] = set()
        self._rooms[key].add(websocket)

    def disconnect(self, school_id: UUID, websocket: WebSocket) -> None:
        key = str(school_id)
        room = self._rooms.get(key)
        if not room:
            return
        room.discard(websocket)
        if not room:
            del self._rooms[key]

    async def broadcast_school(
        self, school_id: UUID, message: dict, *, exclude: WebSocket | None = None
    ) -> None:
        key = str(school_id)
        room = self._rooms.get(key)
        if not room:
            return
        stale: list[WebSocket] = []
        for ws in list(room):
            if ws is exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            room.discard(ws)
        if room is self._rooms.get(key) and not room:
            del self._rooms[key]


manager = ConnectionManager()


async def notify_school_change(
    school_id: UUID, event_type: str, detail: dict | None = None
) -> None:
    """Dispara atualização para outros browsers na mesma escola (melhor esforço)."""
    try:
        await manager.broadcast_school(
            school_id,
            {"type": event_type, "detail": detail or {}},
        )
    except Exception:
        logger.debug("Falha ao notificar WebSocket", exc_info=True)
