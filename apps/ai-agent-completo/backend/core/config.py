"""
core/config.py — Configurações globais da aplicação

Usa pydantic-settings para ler variáveis do arquivo .env automaticamente.
O objeto `settings` é um singleton importado em toda a aplicação.

Uso:
    from core.config import settings
    print(settings.secret_key)
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """
    Todas as configurações da aplicação.
    Lidas automaticamente do arquivo .env na raiz do backend/.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Banco de Dados ─────────────────────────────────────
    database_url: str = Field(
        ...,
        description="String de conexão PostgreSQL com asyncpg. "
                    "Formato: postgresql+asyncpg://user:pass@host:port/db",
    )

    # ── Redis ──────────────────────────────────────────────
    redis_host: str = Field(
        default="localhost",
        description="Host do servidor Redis.",
    )
    redis_port: int = Field(
        default=6379,
        description="Porta do servidor Redis.",
    )

    # ── Qdrant ─────────────────────────────────────────────
    qdrant_host: str = Field(
        default="localhost",
        description="Host do servidor Qdrant.",
    )
    qdrant_port: int = Field(
        default=6333,
        description="Porta do servidor Qdrant.",
    )

    # ── Segurança / JWT ────────────────────────────────────
    secret_key: str = Field(
        ...,
        description="Chave secreta para assinar JWTs. "
                    "Gere com: python -c \"import secrets; print(secrets.token_hex(32))\"",
    )
    jwt_algorithm: str = Field(default="HS256")
    jwt_expire_minutes: int = Field(
        default=10080,   # 7 dias
        description=(
            "Validade do JWT em minutos após o login. Ex.: 300=5h, 1440=24h, "
            "10080=7d, 43200≈30d (útil em demo/apresentação; reduza em produção)."
        ),
    )

    auth_store_sessions_in_db: bool = Field(
        default=False,
        description=(
            "Se true, cada login grava uma linha em login_sessions e cada request "
            "autenticada exige sessão ativa no banco (permite revogar sem mudar SECRET_KEY). "
            "Exige executar backend/sql/001_login_sessions.sql antes."
        ),
    )

    # ── Embed / portal (KAITS) — handshake sem senha no iframe ──
    embed_trust_secret: str = Field(
        default="",
        description=(
            "Segredo compartilhado com o servidor que embute o iframe. "
            "Usado em POST /auth/embed-handshake (HMAC). Vazio = endpoint desativado."
        ),
    )
    embed_hmac_ttl_seconds: int = Field(
        default=600,
        description="Janela máxima |agora - ts| aceita no handshake embed (segundos).",
    )

    # ── Demo / simulação Smart Kaits (não altera SWG/SSO real) ──
    mock_login_auto_provision_school: bool = Field(
        default=True,
        description=(
            "Se true: POST /auth/login com slug inexistente cria escola + AgentConfig padrão. "
            "Cada escola nova usa instância Evolution separada (sk_<uuid>) no primeiro connect. "
            "Embed-handshake inalterado. Em produção fechada defina false."
        ),
    )

    # ── Ambiente ───────────────────────────────────────────
    environment: str = Field(
        default="development",
        description="Ambiente atual: development | production",
    )

    # ── CORS ───────────────────────────────────────────────
    allowed_origins: str = Field(
        default="http://localhost:5173",
        description=(
            "Origens permitidas no browser (CORS), separadas por vírgula. "
            "Inclua a URL exata do front (Vite/produção) e, se aplicável, do portal que chama a API. "
            "Não use '*' com credenciais."
        ),
    )

    # ── Upload de Arquivos ─────────────────────────────────
    upload_dir: str = Field(
        default="uploads",
        description="Diretório para salvar arquivos enviados (relativo ao backend/).",
    )
    max_upload_mb: int = Field(
        default=10,
        description="Tamanho máximo de upload por arquivo em MB.",
    )

    # ── Chatwoot SSO ───────────────────────────────────────
    chatwoot_identity_token: str = Field(
        default="",
        description="identity_validation_token do inbox Website do Chatwoot. "
                    "Gerado em Settings → Inboxes → (seu inbox) → Configuration.",
    )
    chatwoot_widget_url: str = Field(
        default="https://chat.techfala.com.br",
        description="URL base do Chatwoot (sem trailing slash).",
    )
    chatwoot_website_token: str = Field(
        default="",
        description="Website token do inbox Website do Chatwoot (diferente do identity token).",
    )

    # ── Evolution API (WhatsApp) ────────────────────────────
    evolution_api_url: str = Field(
        default="",
        description="URL base da Evolution API v2 (sem barra final). Ex.: http://localhost:8080",
    )
    evolution_api_key: str = Field(
        default="",
        description="AUTHENTICATION_API_KEY da Evolution (header apikey nas chamadas).",
    )
    evolution_webhook_public_base: str = Field(
        default="",
        description=(
            "URL pública HTTPS do Smart Kaits API (sem /api/v1), acessível pela Evolution. "
            "Ex.: https://aiagent.sanjaworks.com — usado para registrar POST .../webhooks/evolution."
        ),
    )
    evolution_webhook_secret: str = Field(
        default="",
        description="Se preenchido, o webhook Evolution deve enviar header X-Smart-Kaits-Webhook-Secret com o mesmo valor.",
    )
    evolution_connect_number: str = Field(
        default="",
        description=(
            "Opcional: número com DDI (só dígitos) para query `?number=` em GET /instance/connect "
            "(doc Evolution — pode ajudar pairing/QR)."
        ),
    )

    # ── Propriedades computadas ────────────────────────────
    @property
    def allowed_origins_list(self) -> list[str]:
        """Converte a string de origens em lista para o middleware CORS."""
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    @property
    def max_upload_bytes(self) -> int:
        """Converte MB para bytes para validação de upload."""
        return self.max_upload_mb * 1024 * 1024

    @property
    def is_production(self) -> bool:
        """Atalho para verificar se está em produção."""
        return self.environment.lower() == "production"


# ── Instância global ───────────────────────────────────────
# Importe `settings` diretamente em vez de instanciar Settings() novamente.
settings = Settings()
