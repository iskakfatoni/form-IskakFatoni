/**
 * FORMCRAFT - Google Drive Uploader Engine
 * Handles file conversion to Base64, Google Apps Script Webhook payload creation,
 * direct upload to Google Drive folders, and automatic fallback to Firebase Storage / DataURL.
 */

class GoogleDriveUploader {
  constructor() {
    this.defaultScriptTemplate = `// =========================================================================
// GOOGLE APPS SCRIPT WEBHOOK UNTUK FORM::IskakFatoni
// Simpan berkas dari form langsung ke folder Google Drive Anda
// =========================================================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var folderId = data.folderId;
    var folder;
    
    // Pilih folder tujuan (atau root Google Drive jika kosong)
    if (folderId && folderId.trim() !== '') {
      folder = DriveApp.getFolderById(folderId.trim());
    } else {
      folder = DriveApp.getRootFolder();
    }
    
    // Decode base64 dan buat file
    var decoded = Utilities.base64Decode(data.base64Data);
    var blob = Utilities.newBlob(decoded, data.mimeType || 'application/octet-stream', data.fileName);
    var file = folder.createFile(blob);
    
    // Beri izin publik hanya untuk membaca file ini (agar bisa dibuka admin/responden)
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(errShare) {
      Logger.log('Share setting note: ' + errShare.toString());
    }
    
    var viewUrl = 'https://drive.google.com/file/d/' + file.getId() + '/view?usp=sharing';
    var downloadUrl = 'https://drive.google.com/uc?export=download&id=' + file.getId();
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      fileId: file.getId(),
      fileName: file.getName(),
      fileSize: file.getSize(),
      url: viewUrl,
      downloadUrl: downloadUrl,
      mimeType: file.getMimeType()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    service: 'FORM::IskakFatoni Google Drive Webhook Endpoint'
  })).setMimeType(ContentService.MimeType.JSON);
}
`;
  }

  /**
   * Returns default Apps Script template code
   */
  getScriptTemplate() {
    return this.defaultScriptTemplate;
  }

  /**
   * Convert file to base64 string without data URL prefix
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        // Strip data:mime/type;base64, prefix
        const base64 = result.substring(result.indexOf(',') + 1);
        resolve({
          base64Data: base64,
          dataUrl: result
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Upload file to Google Drive via Apps Script Webhook
   * @param {File} file 
   * @param {Object} options - { scriptUrl, folderId, formId, questionTitle }
   */
  async uploadToGoogleDrive(file, options = {}) {
    if (!file) throw new Error('Berkas tidak ditemukan');

    const scriptUrl = (options.scriptUrl || '').trim();
    const folderId = (options.folderId || '').trim();

    // If scriptUrl is provided, attempt Google Apps Script upload
    if (scriptUrl) {
      try {
        const { base64Data, dataUrl } = await this.fileToBase64(file);
        
        const payload = {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data: base64Data,
          folderId: folderId,
          formId: options.formId || '',
          uploadedAt: new Date().toISOString()
        };

        // Google Apps Script redirect handling with fetch
        const response = await fetch(scriptUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8', // text/plain prevents CORS preflight OPTIONS in GAS
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error('HTTP error status: ' + response.status);
        }

        const result = await response.json();
        if (result && (result.status === 'success' || result.url)) {
          return {
            success: true,
            storage: 'gdrive',
            name: file.name,
            size: file.size,
            type: file.type,
            url: result.url || ('https://drive.google.com/file/d/' + result.fileId + '/view'),
            fileId: result.fileId || null,
            downloadUrl: result.downloadUrl || null
          };
        } else {
          throw new Error(result.message || 'Respons Google Drive tidak valid');
        }
      } catch (gasErr) {
        console.warn('Google Drive Apps Script upload gagal, mencoba fallback:', gasErr);
        // Fallback to Firebase Storage / compressed DataUrl
      }
    }

    // Fallback 1: Firebase Storage (if available)
    if (window.firebase && window.firebase.storage) {
      try {
        const storage = window.firebase.storage();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `gdrive_uploads/${options.formId || 'form'}/${Date.now()}_${safeName}`;
        const storageRef = storage.ref(storagePath);
        
        const snapshot = await storageRef.put(file, {
          contentType: file.type || 'application/octet-stream'
        });
        const downloadUrl = await snapshot.ref.getDownloadURL();
        
        return {
          success: true,
          storage: 'firebase_storage',
          name: file.name,
          size: file.size,
          type: file.type,
          url: downloadUrl
        };
      } catch (fbErr) {
        console.warn('Firebase Storage fallback failed:', fbErr);
      }
    }

    // Fallback 2: DataURL (Base64)
    const { dataUrl } = await this.fileToBase64(file);
    return {
      success: true,
      storage: 'data_url',
      name: file.name,
      size: file.size,
      type: file.type,
      url: dataUrl
    };
  }
}

window.gdriveUploader = new GoogleDriveUploader();
