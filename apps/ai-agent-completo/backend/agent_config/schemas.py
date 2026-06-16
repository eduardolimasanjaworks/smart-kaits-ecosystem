"""
agent_config/schemas.py — Schemas Pydantic para AgentConfig

O schema `AgentConfigData` reflete exatamente o objeto `agentConfig`
gerenciado pelo frontend Vue. Qualquer novo campo no frontend
deve ser adicionado aqui também.

Variáveis de template suportadas nas mensagens de handover:
  {whatsapp_cliente}  → Número do cliente sendo atendido
  {resumo_conversa}   → Sumário automático da conversa
  {nome_atendente}    → Nome do atendente que receberá a transferência
"""

from datetime import datetime
from typing import Any
import uuid

from pydantic import BaseModel, Field


# ── Sub-schemas ────────────────────────────────────────────

class TeamMember(BaseModel):
    id: int | float
    name: str = ""
    phone: str = ""


class ScriptRule(BaseModel):
    id: int | float
    trigger: str = ""
    response: str = ""


class FaqItem(BaseModel):
    id: int | float
    question: str = ""
    answer: str = ""
    notify_to: list[int | float] = Field(default_factory=list, alias="notifyTo")
    action_type: str = Field(default="respond", alias="actionType")
    notify_message: str = Field(default="", alias="notifyMessage")
    pause_ai: bool = Field(default=False, alias="pauseAi")

    model_config = {"populate_by_name": True}


class DocItem(BaseModel):
    id: float
    name: str = ""
    size: str = ""
    ext: str = ""


class ToolsConfig(BaseModel):
    consult_classes: bool = Field(default=False, alias="consultClasses")
    check_schedule: bool = Field(default=False, alias="checkSchedule")
    enroll_student: bool = Field(default=False, alias="enrollStudent")
    check_financial: bool = Field(default=False, alias="checkFinancial")

    model_config = {"populate_by_name": True}


# ── Config Principal ───────────────────────────────────────

class AgentConfigData(BaseModel):
    """
    Configuração completa do agente de I.A. de uma escola.
    Armazenada como JSONB no banco (campo `data` de AgentConfig).
    """

    # Identidade
    assistant_name: str = Field(default="", alias="assistantName")
    personality: str = ""
    greeting: str = "Olá! Como posso ajudar? 😊"

    # Roteiro e FAQ
    script_rules: list[ScriptRule] = Field(default_factory=list, alias="scriptRules")
    faq_items: list[FaqItem] = Field(default_factory=list, alias="faqItems")

    # Equipe e Handover
    team_members: list[TeamMember] = Field(default_factory=list, alias="teamMembers")
    fallback_contact: str = Field(default="", alias="fallbackContact")

    # Mensagem enviada ao ATENDENTE quando o handover ocorre
    # Suporta: {whatsapp_cliente}, {resumo_conversa}
    fallback_message: str = Field(
        default="🔔 Novo cliente precisa de ajuda! Por favor, verifique o WhatsApp.",
        alias="fallbackMessage",
    )

    # Mensagem que a I.A. diz ao CLIENTE antes de transferir
    # Suporta: {nome_atendente}, {resumo_conversa}
    fallback_user_message: str = Field(
        default="Opa! Ainda não aprendi sobre isso. Vou te transferir para um de nossos atendentes agora. 😊",
        alias="fallbackUserMessage",
    )

    # Se True, a I.A. para de responder após o handover (aguarda humano)
    pause_ai_on_handover: bool = Field(default=True, alias="pauseAiOnHandover")

    # Documentos e Ferramentas
    docs: list[DocItem] = Field(default_factory=list)
    tools: ToolsConfig = Field(default_factory=ToolsConfig)

    # Acesso
    api_token: str = Field(default="", alias="apiToken")

    model_config = {"populate_by_name": True}


# ── Response ───────────────────────────────────────────────

class AgentConfigOut(BaseModel):
    """Resposta da API com a config e metadados."""
    id: uuid.UUID
    school_id: uuid.UUID
    data: dict[str, Any]   # Retorna o JSON bruto para o frontend
    updated_at: datetime

    model_config = {"from_attributes": True}
