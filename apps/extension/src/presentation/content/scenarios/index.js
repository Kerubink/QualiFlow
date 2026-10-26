// Entrypoint do modulo de cenarios: registra em `hooks` as acoes chamadas pela UI do modal
// (ui/) e inicia o listener de progresso de geracao.
import { hooks } from '../hooks.js';
import { onEvaluateCoverage } from './coverage.js';
import { onGenerateScenarios } from './generation.js';
import { attachGenerationProgressListener } from './generationProgress.js';
import { startCopyFromCardFlow, onAutoAdjustCopiedScenarios } from './copyFlow.js';
import { syncCopyFlowButtons } from './copyButtons.js';
import { renderLocalSessions, onSaveLocal } from './localSessions.js';
import { closeEditModal } from './editModal.js';
import { onSaveScenarios } from './saveToBoard.js';

attachGenerationProgressListener();

hooks.onEvaluateCoverage = onEvaluateCoverage;
hooks.onGenerateScenarios = onGenerateScenarios;
hooks.startCopyFromCardFlow = startCopyFromCardFlow;
hooks.onAutoAdjustCopiedScenarios = onAutoAdjustCopiedScenarios;
hooks.syncCopyFlowButtons = syncCopyFlowButtons;
hooks.renderLocalSessions = renderLocalSessions;
hooks.onSaveLocal = onSaveLocal;
hooks.closeEditModal = closeEditModal;
hooks.onSaveScenarios = onSaveScenarios;
