"""Composition root do contexto generation: liga os servicos de aplicacao a provedores e prompts."""
from .application.copilot_service import CopilotService
from .application.generation_service import GenerationService
from .infrastructure.ai_gateway import ProviderAiGateway
from .infrastructure.prompts import PromptCatalog
from .infrastructure.providers.copilot import CopilotGateway

_copilot_gateway = CopilotGateway()
_prompts = PromptCatalog()

copilot_service = CopilotService(_copilot_gateway, _prompts)
generation_service = GenerationService(ProviderAiGateway(_copilot_gateway), _prompts)
