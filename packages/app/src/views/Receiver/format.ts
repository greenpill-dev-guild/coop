export function sizeLabel(byteSize: number) {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }
  if (byteSize < 1024 * 1024) {
    return `${Math.max(1, Math.round(byteSize / 102.4) / 10)} KB`;
  }
  return `${Math.max(0.1, Math.round(byteSize / (1024 * 102.4)) / 10)} MB`;
}
