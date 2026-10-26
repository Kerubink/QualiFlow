// Entrypoint do content script (Azure DevOps / Jira). A ordem dos imports define a ordem
// de carga: dashboard e scenarios registram seus hooks antes de a FAB ser injetada.
import './dashboard/index.js';
import './scenarios/index.js';
import { injectFAB } from './ui/index.js';

injectFAB();
