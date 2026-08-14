/**
 * FORMCRAFT - Firebase Authentication Manager
 * Handles Firebase Auth (Google Sign-In, Email & Password Login / Registration),
 * session state listening, UI synchronization, and Route Protection (Auth Guard).
 */

class AuthManager {
  constructor() {
    this.SESSION_KEY = 'formcraft_auth_session';
    this.authMode = 'login'; // 'login' | 'register'
    this.currentUser = this.loadStoredUser();
    this.authCheckDone = false;
    this.initFirebaseAuthState();
    this.bindEvents();
    this.updateAuthUI();
    this.checkRouteGuard();
    this.handleUrlParams();
  }

  get auth() {
    return window.firebaseManager && window.firebaseManager.auth ? window.firebaseManager.auth : null;
  }

  isLandingPage() {
    const path = window.location.pathname.toLowerCase();
    return !path.includes('form.html');
  }

  isFormPage() {
    const path = window.location.pathname.toLowerCase();
    return path.includes('form.html');
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
        this.authCheckDone = true;
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
          // If no active firebase session and not a local demo user, clear stored session
          if (this.currentUser && this.currentUser.provider !== 'demo') {
            this.saveStoredUser(null);
          }
        }
        this.checkRouteGuard();
      });
    } else {
      this.authCheckDone = true;
      setTimeout(() => this.checkRouteGuard(), 100);
    }
  }

  /**
   * Protects form.html so only logged in users can access Dashboard, Builder, and Responses.
   * Public responder view (#/view/ or #/form/) is accessible to respondents.
   */
  checkRouteGuard() {
    if (!this.isFormPage()) return;

    const hash = window.location.hash || '';
    const isPublicView = hash.startsWith('#/view/') || hash.startsWith('#/form/');

    // Public respondent view is allowed
    if (isPublicView) return;

    // Check if user is logged in
    if (!this.isLoggedIn()) {
      // If auth state check hasn't finished, wait briefly
      if (!this.authCheckDone) {
        setTimeout(() => this.checkRouteGuard(), 400);
        return;
      }

      // Not logged in -> Redirect to index.html with notice
      console.warn('Akses ditolak: Anda harus login untuk mengakses Form Builder.');
      window.location.replace('index.html?auth=required');
    }
  }

  handleUrlParams() {
    if (this.isLandingPage()) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('auth') === 'required') {
        setTimeout(() => {
          this.notify('Silakan masuk (login) terlebih dahulu untuk mengelola dan membuat formulir.', 'error');
          const heroAuth = document.getElementById('hero-email-login-form');
          if (heroAuth) {
            heroAuth.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
      }
    }
  }

  notify(message, type = 'info') {
    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast(message, type);
    } else {
      // Fallback simple toast container for landing page if App() not initialized
      const container = document.getElementById('toast-container');
      if (container) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        let iconName = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-triangle' : 'info');
        toast.innerHTML = `<i data-lucide="${iconName}"></i><span>${message}</span>`;
        container.appendChild(toast);
        if (window.lucide) window.lucide.createIcons();
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(10px)';
          setTimeout(() => toast.remove(), 300);
        }, 4000);
      } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
      }
    }
  }

  async loginWithGoogle() {
    if (!this.auth) {
      this.notify('Firebase Auth belum aktif. Pastikan konfigurasi Firebase valid.', 'error');
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
      this.notify(`Selamat datang, ${userObj.name}! Mengalihkan ke Form Builder...`, 'success');

      // Redirect if on landing page
      if (this.isLandingPage()) {
        setTimeout(() => {
          window.location.href = 'form.html#/dashboard';
        }, 600);
      }
      return userObj;
    } catch (err) {
      console.warn('Google Popup Auth error:', err);
      this.handleAuthError(err);
      throw err;
    }
  }

  async handleEmailAuth(email, password) {
    if (!this.auth) {
      this.notify('Firebase Auth belum aktif di browser. Cek koneksi Firebase Anda.', 'error');
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
        this.notify(`Berhasil masuk sebagai ${userObj.email}! Mengalihkan...`, 'success');

        if (this.isLandingPage()) {
          setTimeout(() => {
            window.location.href = 'form.html#/dashboard';
          }, 600);
        }
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
        this.notify(`Pendaftaran berhasil! Selamat datang, ${userObj.email}`, 'success');

        if (this.isLandingPage()) {
          setTimeout(() => {
            window.location.href = 'form.html#/dashboard';
          }, 600);
        }
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
        msg = 'Akun belum terdaftar. Silakan klik "Daftar Akun Baru" di bawah untuk mendaftar.';
        break;
      case 'auth/wrong-password':
        msg = 'Kata sandi salah. Silakan periksa kembali kata sandi Anda.';
        break;
      case 'auth/invalid-credential':
        msg = 'Email/kata sandi salah atau akun belum didaftarkan. Jika baru pertama kali, klik "Daftar Akun Baru" di bawah.';
        break;
      case 'auth/email-already-in-use':
        msg = 'Email ini sudah terdaftar. Silakan klik "Masuk di Sini" untuk login dengan kata sandi Anda.';
        break;
      case 'auth/weak-password':
        msg = 'Kata sandi terlalu pendek. Gunakan minimal 6 karakter.';
        break;
      case 'auth/invalid-email':
        msg = 'Format alamat email tidak valid.';
        break;
      case 'auth/operation-not-allowed':
        msg = 'Metode Email/Password belum diaktifkan di Firebase Console. Buka Authentication > Sign-in method > Email/Password lalu pilih Enable.';
        break;
      case 'auth/popup-closed-by-user':
        msg = 'Jendela login Google ditutup sebelum selesai.';
        break;
      case 'auth/unauthorized-domain':
        msg = 'Domain ini belum diotorisasi di Firebase Authentication settings.';
        break;
      case 'auth/network-request-failed':
        msg = 'Koneksi jaringan gagal. Periksa koneksi internet Anda.';
        break;
      default:
        msg = err.message || msg;
    }
    this.notify(msg, 'error');
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
    this.notify('Anda telah berhasil keluar (Logout)', 'info');

    // If logging out from form.html, redirect back to landing page
    if (this.isFormPage()) {
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 500);
    }
  }

  toggleAuthMode() {
    this.authMode = this.authMode === 'login' ? 'register' : 'login';
    const labelSpan = document.getElementById('auth-submit-label');
    const submitIcon = document.getElementById('auth-submit-icon');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleBtn = document.getElementById('btn-auth-mode-toggle');

    if (this.authMode === 'login') {
      if (labelSpan) labelSpan.textContent = 'Masuk dengan Email';
      if (submitIcon) submitIcon.setAttribute('data-lucide', 'log-in');
      if (toggleText) toggleText.textContent = 'Belum punya akun?';
      if (toggleBtn) toggleBtn.textContent = 'Daftar Akun Baru';
    } else {
      if (labelSpan) labelSpan.textContent = 'Daftar Akun Baru';
      if (submitIcon) submitIcon.setAttribute('data-lucide', 'user-plus');
      if (toggleText) toggleText.textContent = 'Sudah punya akun?';
      if (toggleBtn) toggleBtn.textContent = 'Masuk di Sini';
    }

    if (window.lucide) {
      window.lucide.createIcons();
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
          if (this.isFormPage()) {
            window.location.href = 'index.html?auth=required';
          } else {
            const emailInput = document.getElementById('auth-email-input');
            if (emailInput) {
              emailInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
              emailInput.focus();
            }
          }
        }
      });
    }

    // Hash change guard for form.html
    window.addEventListener('hashchange', () => {
      this.checkRouteGuard();
    });
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

    // 2. Hero Auth Card (Landing Page)
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

    // 3. Landing page CTA button state
    const heroCtaBtn = document.getElementById('landing-main-cta');
    if (heroCtaBtn) {
      if (isLogged) {
        heroCtaBtn.innerHTML = `<i data-lucide="layout-dashboard"></i><span>Buka Form Builder</span>`;
        heroCtaBtn.onclick = () => { window.location.href = 'form.html#/dashboard'; };
      } else {
        heroCtaBtn.innerHTML = `<i data-lucide="arrow-right"></i><span>Mulai Buat Form Gratis</span>`;
        heroCtaBtn.onclick = () => {
          const el = document.getElementById('hero-auth-container');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
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
