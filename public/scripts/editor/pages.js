export function addPage(editor) {
  return editor?.addNewPage?.();
}

export function deletePage(editor, pageIndex) {
  return editor?.deletePage?.(pageIndex);
}

export function switchToPage(editor, pageIndex, cursorPosition = null, scrollBehavior = 'smooth') {
  return editor?.switchToPage?.(pageIndex, cursorPosition, scrollBehavior);
}

export function isPageEffectivelyEmpty(editor, pageIndex) {
  return editor?.isPageEffectivelyEmpty?.(pageIndex) || false;
}
