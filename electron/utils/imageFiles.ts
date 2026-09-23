const SUPPORTED_IMAGE_EXTENSIONS: Record<string, true> = {
  '.avif': true,
  '.bmp': true,
  '.gif': true,
  '.heic': true,
  '.heif': true,
  '.jpeg': true,
  '.jpg': true,
  '.png': true,
  '.tif': true,
  '.tiff': true,
  '.webp': true
};

export function isSupportedImageFile(fileName: string): boolean {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS[extension] === true;
}
