export function shouldCloseDocumentWorkspace(hasUnsavedChanges: boolean, confirmDiscard: () => boolean): boolean {
  return !hasUnsavedChanges || confirmDiscard();
}
