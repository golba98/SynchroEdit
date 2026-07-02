import { debounce } from '../utils/debounce.js';
import { setSaveState } from '../state.js';

export function createAutosave(saveCallback, wait = 1000) {
  return debounce(async (...args) => {
    setSaveState('saving');
    try {
      const result = await saveCallback(...args);
      setSaveState('saved');
      return result;
    } catch (error) {
      setSaveState('error');
      throw error;
    }
  }, wait);
}

export function setEditorSaveStatus(editor, status) {
  setSaveState(status);
  return editor?._setSaveStatus?.(status);
}
