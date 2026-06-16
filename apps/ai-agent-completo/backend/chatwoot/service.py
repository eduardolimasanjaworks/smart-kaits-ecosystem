import hmac
import hashlib
from core.config import settings

def generate_chatwoot_hmac(user_identifier: str) -> str:
    """
    Gera o hash HMAC-SHA256 para o Identity Validation do Chatwoot.
    O hash é gerado usando o identity_validation_token do Chatwoot como chave.
    """
    if not settings.chatwoot_identity_token:
        return ""
        
    return hmac.new(
        settings.chatwoot_identity_token.encode('utf-8'),
        user_identifier.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
