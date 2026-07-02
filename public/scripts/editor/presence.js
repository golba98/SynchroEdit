export function updatePresence(editor, user) {
  return editor?.updateUser?.(user);
}

export function reconnectPresence(editor, user) {
  return editor?.reconnect?.(user);
}
