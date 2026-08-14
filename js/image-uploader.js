/**
 * FORMCRAFT - Client-side Image Compression & Cloud Uploader Engine
 * Automatically compresses high-resolution images via HTML5 Canvas (WebP/JPEG, ~80-120KB)
 * and uploads them to Firebase Storage with instant Base64 fallback.
 */

class ImageUploaderEngine {
  constructor() {
    this.DEFAULT_MAX_WIDTH_QUESTION = 1200;
    this.DEFAULT_MAX_WIDTH_OPTION = 600;
    this.DEFAULT_QUALITY = 0.82;
  }

  get storage() {
    return window.firebaseManager && window.firebaseManager.storage ? window.firebaseManager.storage : null;
  }

  /**
   * Compresses a file using HTML5 Canvas downsampling and WebP/JPEG conversion.
   * @param {File} file - Original user image file
   * @param {Object} options - { maxWidth, quality }
   * @returns {Promise<{ blob: Blob, dataUrl: string, originalSize: number, compressedSize: number, width: number, height: number }>}
   */
  compressImage(file, options = {}) {
    const maxWidth = options.maxWidth || this.DEFAULT_MAX_WIDTH_QUESTION;
    const quality = options.quality || this.DEFAULT_QUALITY;

    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('File yang dipilih bukan gambar yang valid.'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Format gambar tidak dapat diproses.'));
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Proportional Downscaling
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          // Max height limit (e.g. 1600px)
          const maxHeight = maxWidth * 1.5;
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = Math.round(maxHeight);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          // High quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Try WebP encoding first, fallback to JPEG
          let mimeType = 'image/webp';
          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            mimeType = 'image/jpeg';
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          canvas.toBlob((blob) => {
            if (!blob) {
              // Fallback to dataURL conversion if toBlob is null
              const byteString = atob(dataUrl.split(',')[1]);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              const fallbackBlob = new Blob([ab], { type: mimeType });
              resolve({
                blob: fallbackBlob,
                dataUrl,
                originalSize: file.size,
                compressedSize: fallbackBlob.size,
                width,
                height
              });
              return;
            }

            resolve({
              blob,
              dataUrl,
              originalSize: file.size,
              compressedSize: blob.size,
              width,
              height
            });
          }, mimeType, quality);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Compresses and uploads an image to Firebase Storage with Base64 fallback.
   * @param {File} file
   * @param {Object} options - { formId, context: 'question'|'option', maxWidth, quality }
   * @returns {Promise<{ url: string, size: number, type: 'cloud'|'base64' }>}
   */
  async processAndUpload(file, options = {}) {
    const context = options.context || 'question';
    const maxWidth = options.maxWidth || (context === 'option' ? this.DEFAULT_MAX_WIDTH_OPTION : this.DEFAULT_MAX_WIDTH_QUESTION);
    const formId = options.formId || 'form_' + Date.now();

    // 1. Compress Image
    const compressed = await this.compressImage(file, { maxWidth, quality: options.quality });
    console.log(`[ImageEngine] Gambar dikompres: ${(compressed.originalSize / 1024).toFixed(1)} KB -> ${(compressed.compressedSize / 1024).toFixed(1)} KB (${compressed.width}x${compressed.height}px)`);

    // 2. Try Upload to Firebase Storage
    if (this.storage) {
      try {
        const fileExt = compressed.blob.type === 'image/webp' ? 'webp' : 'jpg';
        const fileName = `${context}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${fileExt}`;
        const storageRef = this.storage.ref().child(`forms/${formId}/images/${fileName}`);

        const snapshot = await storageRef.put(compressed.blob, {
          contentType: compressed.blob.type,
          cacheControl: 'public,max-age=31536000'
        });

        const downloadUrl = await snapshot.ref.getDownloadURL();
        return {
          url: downloadUrl,
          size: compressed.compressedSize,
          type: 'cloud'
        };
      } catch (storageErr) {
        console.warn('[ImageEngine] Firebase Storage upload error (fallback to compressed Base64):', storageErr);
        // Fallback directly to compressed Data URL
        return {
          url: compressed.dataUrl,
          size: compressed.compressedSize,
          type: 'base64'
        };
      }
    }

    // Direct fallback if storage not initialized
    return {
      url: compressed.dataUrl,
      size: compressed.compressedSize,
      type: 'base64'
    };
  }
}

// Global instance
window.imageUploader = new ImageUploaderEngine();
