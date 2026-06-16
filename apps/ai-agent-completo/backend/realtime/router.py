"""
WebSocket autenticado por JWT (query `token=`) — mesma origem da API.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError

from core.security import decode_access_token
from realtime.broadcast import manager

router = APIRouter(tags=["Tempo real"])


@router.websocket("/ws")
async def school_events_ws(
    websocket: WebSocket,
    token: str | None = Query(None, description="JWT Bearer (mesmo do login / embed)."),
):
    if not token:
        await websocket.close(code=4401)
        return
    try:
        payload = decode_access_token(token)
        school_id_str = payload.get("school_id")
        if not school_id_str:
            await websocket.close(code=4401)
            return
        school_id = UUID(school_id_str)
    except (JWTError, ValueError, TypeError):
        await websocket.close(code=4401)
        return

    await manager.connect(school_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(school_id, websocket)
