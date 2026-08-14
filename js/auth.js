/**
 * FORMCRAFT - Firebase Authentication Manager
 * Handles Firebase Auth (Google Sign-In, Email & Password Login / Registration),
 * session state listening, and UI synchronization.
 */

class AuthManager {
  constructor() {
    this.SESSION_KEY = 'formcraft_auth_session';
    this.authMode = 'login'; // 'login' | 'register'
    this.currentUser = this.loadStoredUser();
    this.initFirebaseAuthState();
    this.bindEvents();
    this.updateAuthUI();
  }

  get auth() {
    return window.firebaseManager && window.firebaseManager.auth ? window.firebaseManager.auth : null;
  }

  loadStoredUser() {
    try {
      const data = localStorage.getItem(this.SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  saveStoredUser(user) {
    if (user) {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.SESSION_KEY);
    }
    this.currentUser = user;
    this.updateAuthUI();
    window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user } }));
  }

  isLoggedIn() {
    return !!this.currentUser;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  initFirebaseAuthState() {
    if (this.auth) {
      this.auth.onAuthStateChanged(firebaseUser => {
        if (firebaseUser) {
          const userObj = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Admin'),
            email: firebaseUser.email || '',
            photoUrl: firebaseUser.photoURL || null,
            provider: firebaseUser.providerData && firebaseUser.providerData[0] ? firebaseUser.providerData[0].providerId : 'firebase',
            role: 'admin'
          };
          this.saveStoredUser(userObj);
        } else {
          // If no active firebase session, clear stored user
          if (this.currentUser && this.currentUser.provider !== 'demo') {
            this.saveStoredUser(null);
          }
        }
      });
    }
  }

  async loginWithGoogle() {
    if (!this.auth) {
      window.app.showToast('Firebase Auth belum aktif. Pastikan Firebase terhubung.', 'error');
      return null;
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await this.auth.signInWithPopup(provider);
      const u = result.user;
      const userObj = {
        uid: u.uid,
        name: u.displayName || (u.email ? u.email.split('@')[0] : 'Admin'),
        email: u.email,
        photoUrl: u.photoURL,
        provider: 'google.com',
        role: 'admin'
      };
      this.saveStoredUser(userObj);
      window.app.showToast(`Selamat datang, ${userObj.name}!`, 'success');
      return userObj;
    } catch (err) {
      console.warn('Google Popup Auth error:', err);
      this.handleAuthError(err);
      throw err;
    }
  }

  async handleEmailAuth(email, password) {
    if (!this.auth) {
      window.app.showToast('Firebase Auth belum aktif di browser.', 'error');
      return false;
    }

    const btnSubmit = document.getElementById('btn-auth-submit');
    const labelSpan = document.getElementById('auth-submit-label');
    const origText = labelSpan ? labelSpan.textContent : '';

    if (btnSubmit) {
      btnSubmit.disabled = true;
      if (labelSpan) labelSpan.textContent = 'Memproses...';
    }

    try {
      if (this.authMode === 'login') {
        const cred = await this.auth.signInWithEmailAndPassword(email, password);
        const u = cred.user;
        const userObj = {
          uid: u.uid,
          name: u.displayName || (u.email ? u.email.split('@')[0] : 'Admin'),
          email: u.email,
          photoUrl: u.photoURL || null,
          provider: 'password',
          role: 'admin'
        };
        this.saveStoredUser(userObj);
        window.app.showToast(`Berhasil masuk sebagai ${userObj.email}!`, 'success');
      } else {
        // Register new account
        const cred = await this.auth.createUserWithEmailAndPassword(email, password);
        const u = cred.user;
        const userObj = {
          uid: u.uid,
          name: u.email ? u.email.split('@')[0] : 'Admin',
          email: u.email,
          photoUrl: null,
          provider: 'password',
          role: 'admin'
        };
        this.saveStoredUser(userObj);
        window.app.showToast(`Pendaftaran berhasil! Selamat datang, ${userObj.email}`, 'success');
      }
      return true;
    } catch (err) {
      console.error('Email Auth error:', err);
      this.handleAuthError(err);
      return false;
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        if (labelSpan) labelSpan.textContent = origText;
      }
    }
  }

  handleAuthError(err) {
    let msg = 'Terjadi kesalahan autentikasi.';
    switch (err.code) {
      case 'auth/user-not-found':
        msg = 'Akun dengan email tersebut tidak ditemukan. Silakan daftar akun baru.';
        break;
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        msg = 'Email atau kata sandi salah. Silakan coba lagi.';
        break;
      case 'auth/email-already-in-use':
        msg = 'Email ini sudah terdaftar. Silakan beralih ke mode Masuk.';
        break;
      case 'auth/weak-password':
        msg = 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
        break;
      case 'auth/invalid-email':
        msg = 'Format alamat email tidak valid.';
        break;
      case 'auth/operation-not-allowed':
        msg = 'Metode login ini belum diaktifkan di Firebase Console (Authentication > Sign-in method).';
        break;
      case 'auth/popup-closed-by-user':
        msg = 'Jendela login Google ditutup sebelum selesai.';
        break;
      case 'auth/unauthorized-domain':
        msg = 'Domain ini belum diotorisasi di Firebase Authentication settings.';
        break;
      default:
        msg = err.message || msg;
    }
    window.app.showToast(msg, 'error');
  }

  async logout() {
    if (this.auth) {
      try {
        await this.auth.signOut();
      } catch (e) {
        console.warn('Logout warning:', e);
      }
    }
    this.saveStoredUser(null);
    window.app.showToast('Anda telah berhasil keluar (Logout)', 'info');
  }

  toggleAuthMode() {
    this.authMode = this.authMode === 'login' ? 'register' : 'login';
    const labelSpan = document.getElementById('auth-submit-label');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleBtn = document.getElementById('btn-auth-mode-toggle');

    if (this.authMode === 'login') {
      if (labelSpan) labelSpan.textContent = 'Masuk dengan Email';
      if (toggleText) toggleText.textContent = 'Belum punya akun?';
      if (toggleBtn) toggleBtn.textContent = 'Daftar Akun Baru';
    } else {
      if (labelSpan) labelSpan.textContent = 'Daftar Akun Baru';
      if (toggleText) toggleText.textContent = 'Sudah punya akun?';
      if (toggleBtn) toggleBtn.textContent = 'Masuk di Sini';
    }
  }

  bindEvents() {
    // Hero Google Login Button
    const btnGoogleLogin = document.getElementById('btn-hero-google-login');
    if (btnGoogleLogin) {
      btnGoogleLogin.addEventListener('click', async () => {
        try {
          await this.loginWithGoogle();
        } catch (e) {
          // Handled inside
        }
      });
    }

    // Hero Email & Password Form
    const emailForm = document.getElementById('hero-email-login-form');
    if (emailForm) {
      emailForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('auth-email-input');
        const passInput = document.getElementById('auth-password-input');
        if (emailInput && passInput) {
          const email = emailInput.value.trim();
          const pass = passInput.value;
          if (email && pass) {
            this.handleEmailAuth(email, pass);
          }
        }
      });
    }

    // Toggle Login vs Register Mode
    const toggleBtn = document.getElementById('btn-auth-mode-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.toggleAuthMode();
      });
    }

    // Hero Logout Button
    const btnHeroLogout = document.getElementById('btn-hero-logout');
    if (btnHeroLogout) {
      btnHeroLogout.addEventListener('click', () => {
        this.logout();
      });
    }

    // Navbar Login/Logout Pill Action
    const navAuthPill = document.getElementById('nav-user-auth-pill');
    if (navAuthPill) {
      navAuthPill.addEventListener('click', () => {
        if (this.isLoggedIn()) {
          if (confirm(`Apakah Anda ingin logout dari akun ${this.currentUser.email || this.currentUser.name}?`)) {
            this.logout();
          }
        } else {
          const emailInput = document.getElementById('auth-email-input');
          if (emailInput) {
            emailInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            emailInput.focus();
          }
        }
      });
    }
  }

  updateAuthUI() {
    const user = this.currentUser;
    const isLogged = !!user;

    // 1. Navbar Auth Pill
    const navAuthPill = document.getElementById('nav-user-auth-pill');
    const navAuthText = document.getElementById('nav-user-auth-name');
    const navAuthAvatar = document.getElementById('nav-user-auth-avatar');

    if (navAuthPill && navAuthText) {
      if (isLogged) {
        navAuthPill.classList.remove('logged-out');
        navAuthPill.classList.add('logged-in');
        navAuthText.textContent = user.name || (user.email ? user.email.split('@')[0] : 'Admin');
        if (user.photoUrl && navAuthAvatar) {
          navAuthAvatar.innerHTML = `<img src="${user.photoUrl}" alt="Avatar" class="user-avatar-img">`;
        } else if (navAuthAvatar) {
          navAuthAvatar.innerHTML = `<i data-lucide="user-check"></i>`;
        }
      } else {
        navAuthPill.classList.remove('logged-in');
        navAuthPill.classList.add('logged-out');
        navAuthText.textContent = 'Masuk Admin';
        if (navAuthAvatar) {
          navAuthAvatar.innerHTML = `<i data-lucide="log-in"></i>`;
        }
      }
    }

    // 2. Index / Dashboard Hero Auth Card
    const loggedOutCard = document.getElementById('hero-auth-logged-out');
    const loggedInCard = document.getElementById('hero-auth-logged-in');
    const heroUserName = document.getElementById('hero-user-name');
    const heroUserEmail = document.getElementById('hero-user-email');
    const heroUserAvatar = document.getElementById('hero-user-avatar');

    if (loggedOutCard && loggedInCard) {
      if (isLogged) {
        loggedOutCard.classList.add('hidden');
        loggedInCard.classList.remove('hidden');
        if (heroUserName) heroUserName.textContent = user.name || (user.email ? user.email.split('@')[0] : 'Admin');
        if (heroUserEmail) heroUserEmail.textContent = user.email || 'Akses Admin Terverifikasi';
        if (heroUserAvatar) {
          if (user.photoUrl) {
            heroUserAvatar.innerHTML = `<img src="${user.photoUrl}" alt="Avatar" class="hero-avatar-img">`;
          } else {
            heroUserAvatar.innerHTML = `<i data-lucide="shield-check"></i>`;
          }
        }
      } else {
        loggedOutCard.classList.remove('hidden');
        loggedInCard.classList.add('hidden');
      }
    }

    // Re-initialize Lucide Icons if available
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

// Global instance
window.authManager = new AuthManager();
