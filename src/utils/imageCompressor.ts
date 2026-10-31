/**
 * Client-Side Canvas Image Compression & Downscaler
 * Crushes 5MB-10MB mobile screenshots down to ~40KB-80KB (98%+ bandwidth savings)
 * completely protecting Render compute and free bandwidth limits.
 */

export interface CompressedImageResult {
  base64: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  savingsPercent: number;
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function compressImage(
  file: File,
  maxDimension = 1200,
  quality = 0.75
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));

    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return reject(new Error('Failed to process image'));

      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image into memory'));

      img.onload = () => {
        try {
          let { width, height } = img;

          // Downscale if image dimensions exceed maximum threshold
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Failed to initialize 2D canvas context'));
          }

          // Use high-quality bicubic smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // White background for JPEG conversion (prevents transparent PNG black background)
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);

          // Draw image
          ctx.drawImage(img, 0, 0, width, height);

          // Export compressed JPEG
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

          // Calculate size in bytes from Base64 string length
          const base64Data = compressedBase64.replace(/^data:image\/[a-z]+;base64,/, '');
          const compressedSize = Math.round((base64Data.length * 3) / 4);

          const savingsPercent = Math.max(
            0,
            Math.round(((file.size - compressedSize) / file.size) * 100)
          );

          resolve({
            base64: compressedBase64,
            originalSize: file.size,
            compressedSize,
            width,
            height,
            savingsPercent
          });
        } catch (err) {
          reject(err);
        }
      };

      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  });
}

