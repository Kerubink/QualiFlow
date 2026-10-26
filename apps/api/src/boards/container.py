"""Composition root do contexto boards: liga os servicos de aplicacao aos gateways REST."""
from .application.azure_service import AzureBoardService
from .application.jira_service import JiraBoardService
from .infrastructure.azure.gateway import AzureDevOpsGateway
from .infrastructure.jira.gateway import JiraCloudGateway

azure_service = AzureBoardService(AzureDevOpsGateway())
jira_service = JiraBoardService(JiraCloudGateway())
