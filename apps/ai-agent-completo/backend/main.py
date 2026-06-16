"""
main.py — Entry point do backend Smart Kaits

Responsabilidades deste arquivo:
  - Criar e configurar a aplicação FastAPI
  - Registrar todos os routers dos domínios
  - Configurar middlewares (CORS, etc.)
  - Expor health check básico

NÃO coloque lógica de negócio aqui.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import settings
from realtime.router import router as realtime_router

# ── Routers dos domínios ───────────────────────────────────
from schools.router import router as schools_router
from agent_config.router import router as agent_config_router
from documents.router import router as documents_router
from ai.router import router as ai_router
from audit_router import router as audit_router
from webhooks import router as webhooks_router
from chatwoot.router import router as chatwoot_router
from whatsapp_api import router as whatsapp_router

import whatsapp_chat.models  # noqa: F401 — registo da tabela wa_chat_messages no metadata

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from core.startup_mitigations import ensure_auxiliary_schema, log_configuration_warnings
    from ai.client import ensure_collection_exists

    log_configuration_warnings()
    await ensure_auxiliary_schema()
    
    try:
        await ensure_collection_exists()
    except Exception as e:
        logger.warning("Não foi possível conectar ao Qdrant no startup: %s", e)
        
    yield


# ── Criação da App ─────────────────────────────────────────
app = FastAPI(
    title="Smart Kaits API",
    description=(
        "API multi-tenant para configuração de agentes de I.A. por escola. "
        "Cada escola é um tenant isolado com seu próprio perfil de agente."
    ),
    version="1.0.0",
    docs_url="/docs",       # Swagger UI
    redoc_url="/redoc",     # ReDoc
    lifespan=lifespan,
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if settings.is_production:
        logger.exception("Erro não tratado: %s", request.url.path)
    else:
        import traceback
        logger.error("Erro: %s", str(exc))
        traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Tive um problema para processar sua alteração. Edu já foi notificado."},
    )


# ── CORS: origens explícitas (não use * com cookies/credentials) ──
_cors = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
if not _cors:
    _cors = ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if not settings.is_production:

    @app.middleware("http")
    async def log_requests_dev(request: Request, call_next):
        response = await call_next(request)
        logger.debug("%s %s -> %s", request.method, request.url.path, response.status_code)
        return response


# ── Registro dos Routers ───────────────────────────────────
app.include_router(schools_router,      prefix="/api/v1")
app.include_router(agent_config_router, prefix="/api/v1")
app.include_router(documents_router,    prefix="/api/v1")
app.include_router(ai_router,           prefix="/api/v1")
app.include_router(audit_router,        prefix="/api/v1")
app.include_router(webhooks_router,     prefix="/api/v1")
app.include_router(chatwoot_router,     prefix="/api/v1")
app.include_router(whatsapp_router,     prefix="/api/v1")
app.include_router(realtime_router,     prefix="/api/v1")


# ── Health Check ───────────────────────────────────────────
@app.get("/health", tags=["Sistema"])
async def health_check():
    """
    Endpoint simples para confirmar que a API está de pé.
    Usado por load balancers, monitoramento e CI/CD.
    """
    return {
        "status": "ok",
        "version": app.version,
        "env": settings.environment,
        "chatwoot": {
            "widget_token_configurado": bool(
                (settings.chatwoot_website_token or "").strip()
            ),
            "identity_sso_configurado": bool(
                (settings.chatwoot_identity_token or "").strip()
            ),
            "base_url": settings.chatwoot_widget_url or None,
        },
    }


@app.get("/health/deps", tags=["Sistema"])
async def health_dependencies():
    """
    Verifica dependências externas (Evolution, Qdrant, chaves). Não exige autenticação.
    Útil para diagnosticar QR, RAG e webhooks sem olhar só o /health minimal.
    """
    import httpx

    from ai.client import qdrant_client
    from ai.config import OPENAI_API_KEY
    from evolution_service import _evo_url, _headers, evolution_configured

    out: dict = {
        "openai_configured": bool((OPENAI_API_KEY or "").strip()),
        "evolution_webhook_base_configured": bool(
            (settings.evolution_webhook_public_base or "").strip()
        ),
    }
    if evolution_configured():
        try:
            timeout = httpx.Timeout(10.0, connect=5.0)
            async with httpx.AsyncClient(timeout=timeout) as c:
                r = await c.get(_evo_url("/instance/fetchInstances"), headers=_headers())
            out["evolution_api_reachable"] = r.status_code == 200
            out["evolution_http_status"] = r.status_code
        except Exception as e:
            out["evolution_api_reachable"] = False
            out["evolution_error"] = str(e)[:240]
    else:
        out["evolution_api_reachable"] = None
        out["evolution_note"] = "EVOLUTION_API_URL / EVOLUTION_API_KEY não configurados."

    try:
        cols = await qdrant_client.get_collections()
        out["qdrant_ok"] = True
        out["qdrant_collections"] = len(cols.collections)
    except Exception as e:
        out["qdrant_ok"] = False
        out["qdrant_error"] = str(e)[:240]

    return out
