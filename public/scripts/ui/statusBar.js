import { setConnectionState, setCurrentPage, setSaveState } from '../state.js';

export function updateStatusBar(uiManager, pageIndex) {
  setCurrentPage(pageIndex);
  return uiManager?.updateStatus?.(pageIndex);
}

export function updateStats(uiManager, stats) {
  return uiManager?.updateStats?.(stats);
}

export function updateConnectionStatus(uiManager, status) {
  setConnectionState(status);
  return uiManager?.handleWSStatusChange?.(status);
}

export function updateSaveStatus(uiManager, status) {
  setSaveState(status);
  return uiManager?.setSaveStatus?.(status);
}
