"""Composition root do contexto generation: liga os servicos de aplicacao a provedores e prompts."""
import os

from .application.copilot_service import CopilotService
from .application.generation_service import GenerationService
from .infrastructure.ai_gateway import ProviderAiGateway
from .infrastructure.prompts import PromptCatalog
from .infrastructure.providers.copilot import CopilotGateway
from .infrastructure.providers.copilot_cli import CopilotCliGateway


def _build_copilot_gateway():
    """COPILOT_MODE=cli (padrao) executa o GitHub Copilot CLI; COPILOT_MODE=http usa os endpoints internos."""
    mode = (os.environ.get("COPILOT_MODE") or "cli").strip().lower()
    return CopilotGateway() if mode == "http" else CopilotCliGateway()


_copilot_gateway = _build_copilot_gateway()
_prompts = PromptCatalog()

copilot_service = CopilotService(_copilot_gateway, _prompts)
generation_service = GenerationService(ProviderAiGateway(_copilot_gateway), _prompts)
