/**
 * FORMCRAFT - Firebase Configuration & Initialization Module
 * Handles Firebase Firestore connection with automatic fallback to LocalStorage.
 */

// Default Firebase Configuration for FORM::IskakFatoni
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCJAcQeuI1XznZm7KVceD_PsQSWHTrs83c",
  authDomain: "form-iskakfatoni.firebaseapp.com",
  projectId: "form-iskakfatoni",
  storageBucket: "form-iskakfatoni.firebasestorage.app",
  messagingSenderId: "197414743539",
  appId: "1:197414743539:web:280506f8c468306c40f686",
  measurementId: "G-PYNCN6Y2H5"
};

class FirebaseManager {
  constructor() {
    this.db = null;
    this.app = null;
    this.isConfigured = false;
    this.config = this.loadConfig();
    this.initFirebase();
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem('formcraft_firebase_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.apiKey && parsed.projectId) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Gagal membaca config dari localStorage:', e);
    }
    return DEFAULT_FIREBASE_CONFIG;
  }

  saveConfig(newConfig) {
    try {
      localStorage.setItem('formcraft_firebase_config', JSON.stringify(newConfig));
      this.config = newConfig;
      return this.initFirebase();
    } catch (e) {
      console.error('Error menyimpan config:', e);
      return false;
    }
  }

  initFirebase() {
    if (!this.config || !this.config.apiKey || !this.config.projectId) {
      this.isConfigured = false;
      this.updateStatusUI(false);
      return false;
    }

    try {
      if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
          this.app = firebase.initializeApp(this.config);
        } else {
          this.app = firebase.app();
        }
        this.db = firebase.firestore();
        if (typeof firebase.auth === 'function') {
          this.auth = firebase.auth();
        }
        this.isConfigured = true;
        this.updateStatusUI(true);
        console.log('Firebase Cloud Firestore & Auth berhasil diinisialisasi untuk project:', this.config.projectId);
        return true;
      }
    } catch (error) {
      console.error('Inisialisasi Firebase gagal:', error);
      this.isConfigured = false;
      this.updateStatusUI(false);
      return false;
    }
    return false;
  }

  updateStatusUI(isFirebase) {
    const badge = document.getElementById('btn-db-status');
    const text = document.getElementById('db-status-text');
    if (!badge || !text) return;

    if (isFirebase) {
      badge.className = 'status-badge status-firebase';
      text.textContent = 'Firebase Cloud';
      badge.title = `Terkoneksi ke Firebase Project: ${this.config.projectId}`;
    } else {
      badge.className = 'status-badge status-local';
      text.textContent = 'Mode Lokal Demo';
      badge.title = 'Mode Lokal Aktif (Klik untuk menghubungkan Firebase)';
    }
  }
}

// Global instance
window.firebaseManager = new FirebaseManager();
