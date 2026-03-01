export function toPageSrc(filePath: string): string {
  return `manga-cover://local-image?path=${encodeURIComponent(filePath)}`;
}
