// Estado mutavel do runner (compartilhado entre os modulos).
export const S = {
    activeSession: null,
    // { testCases: [], currentTcIndex: 0, runId: 0, results: [], stepResults: {} }
    runnerState: null,
    mediaRecorder: null,
    recordingChunks: [],
    recordingTimer: null,
    recordingSeconds: 0
};
