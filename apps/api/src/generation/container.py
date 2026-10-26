"""Composition root do contexto generation: liga os servicos de aplicacao a provedores e prompts."""
import os

from .application.copilot_service import CopilotService
from .application.generation_service import GenerationService
from .infrastructure.ai_gateway import ProviderAiGateway
from .infrastructure.prompts import PromptCatalog
from .infrastructure.providers.copilot import CopilotGateway
from .infrastructure.providers.copilot_sdk import CopilotSdkGateway, sdk_available, warm_up_runtime


def _build_copilot_gateway():
    """COPILOT_MODE: "sdk" (padrao) usa o SDK oficial do Copilot (pip, sem Node); "http" usa os endpoints internos."""
    mode = (os.environ.get("COPILOT_MODE") or "sdk").strip().lower()
    if mode == "http" or not sdk_available():
        return CopilotGateway()
    warm_up_runtime()
    return CopilotSdkGateway()


_copilot_gateway = _build_copilot_gateway()
_prompts = PromptCatalog()

copilot_service = CopilotService(_copilot_gateway, _prompts)
generation_service = GenerationService(ProviderAiGateway(_copilot_gateway), _prompts)
