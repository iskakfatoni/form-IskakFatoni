/**
 * FORMCRAFT - Firebase Authentication Manager
 * Exclusively configured for the project owner: iskakfatoni@gmail.com
 * Handles Google Sign-In, Email/Password Login, session guard, and UI synchronization.
 */

const ALLOWED_ADMIN_EMAIL = "iskakfatoni@gmail.com";

class AuthManager {
  constructor() {
    this.SESSION_KEY = 'formcraft_auth_session';
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

  isOwner(email) {
    if (!email) return false;
    return email.toLowerCase().trim() === ALLOWED_ADMIN_EMAIL.toLowerCase();
  }

  loadStoredUser() {
    try {
      const data = localStorage.getItem(this.SESSION_KEY);
      const user = data ? JSON.parse(data) : null;
      if (user && this.isOwner(user.email)) {
        return user;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  saveStoredUser(user) {
    if (user && this.isOwner(user.email)) {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
      this.currentUser = user;
    } else {
      localStorage.removeItem(this.SESSION_KEY);
      this.currentUser = null;
    }
    this.updateAuthUI();
    window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: this.currentUser } }));
  }

  isLoggedIn() {
    return !!this.currentUser && this.isOwner(this.currentUser.email);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  initFirebaseAuthState() {
    if (this.auth) {
      this.auth.onAuthStateChanged(firebaseUser => {
        this.authCheckDone = true;
        if (firebaseUser) {
          if (this.isOwner(firebaseUser.email)) {
            const userObj = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Iskak Fatoni',
              email: firebaseUser.email,
              photoUrl: firebaseUser.photoURL || null,
              provider: firebaseUser.providerData && firebaseUser.providerData[0] ? firebaseUser.providerData[0].providerId : 'firebase',
              role: 'admin'
            };
            this.saveStoredUser(userObj);
          } else {
            // Not the owner -> Force logout
            this.auth.signOut();
            this.saveStoredUser(null);
            this.notify('Akses ditolak. Aplikasi ini khusus privat untuk pemilik (iskakfatoni@gmail.com).', 'error');
          }
        } else {
          this.saveStoredUser(null);
        }
        this.checkRouteGuard();
      });
    } else {
      this.authCheckDone = true;
      setTimeout(() => this.checkRouteGuard(), 100);
    }
  }

  /**
   * Protects form.html so only the authenticated owner can access Dashboard & Builder.
   * Public responder views (#/view/ or #/form/) remain accessible to form respondents.
   */
  checkRouteGuard() {
    if (!this.isFormPage()) return;

    const hash = window.location.hash || '';
    const isPublicView = hash.startsWith('#/view/') || hash.startsWith('#/form/');

    // Public respondent view is allowed
    if (isPublicView) return;

    // Check if owner is logged in
    if (!this.isLoggedIn()) {
      if (!this.authCheckDone) {
        setTimeout(() => this.checkRouteGuard(), 400);
        return;
      }

      console.warn('Akses ditolak: Anda harus login sebagai admin untuk mengakses Form Builder.');
      window.location.replace('index.html?auth=required');
    }
  }

  handleUrlParams() {
    if (this.isLandingPage()) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('auth') === 'required') {
        setTimeout(() => {
          this.notify('Silakan masuk sebagai admin untuk mengelola dan membuat formulir.', 'error');
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
      this.notify('Firebase Auth belum siap. Pastikan koneksi online.', 'error');
      return null;
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await this.auth.signInWithPopup(provider);
      const u = result.user;

      // Restrict to project owner
      if (!this.isOwner(u.email)) {
        await this.auth.signOut();
        this.saveStoredUser(null);
        this.notify(`Akses ditolak untuk ${u.email}. Khusus akun pemilik (iskakfatoni@gmail.com).`, 'error');
        return null;
      }

      const userObj = {
        uid: u.uid,
        name: u.displayName || 'Iskak Fatoni',
        email: u.email,
        photoUrl: u.photoURL,
        provider: 'google.com',
        role: 'admin'
      };
      this.saveStoredUser(userObj);
      this.notify(`Selamat datang kembali, ${userObj.name}! Mengalihkan...`, 'success');

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
      this.notify('Firebase Auth belum siap di browser.', 'error');
      return false;
    }

    const inputEmail = email.trim().toLowerCase();
    if (!this.isOwner(inputEmail)) {
      this.notify('Akses dibatasi hanya untuk akun administrator (iskakfatoni@gmail.com).', 'error');
      return false;
    }

    const btnSubmit = document.getElementById('btn-auth-submit');
    const labelSpan = document.getElementById('auth-submit-label');
    const origText = labelSpan ? labelSpan.textContent : '';

    if (btnSubmit) {
      btnSubmit.disabled = true;
      if (labelSpan) labelSpan.textContent = 'Memverifikasi...';
    }

    try {
      const cred = await this.auth.signInWithEmailAndPassword(inputEmail, password);
      const u = cred.user;
      const userObj = {
        uid: u.uid,
        name: u.displayName || 'Iskak Fatoni',
        email: u.email,
        photoUrl: u.photoURL || null,
        provider: 'password',
        role: 'admin'
      };
      this.saveStoredUser(userObj);
      this.notify(`Berhasil masuk sebagai ${userObj.name}! Mengalihkan...`, 'success');

      if (this.isLandingPage()) {
        setTimeout(() => {
          window.location.href = 'form.html#/dashboard';
        }, 600);
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
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        msg = 'Kata sandi atau kredensial salah. Silakan periksa kembali kata sandi Anda.';
        break;
      case 'auth/weak-password':
        msg = 'Kata sandi terlalu pendek. Gunakan minimal 6 karakter.';
        break;
      case 'auth/invalid-email':
        msg = 'Format alamat email tidak valid.';
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

    if (this.isFormPage()) {
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 500);
    }
  }

  bindEvents() {
    // Google Login Button
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

    // Email & Password Form
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

    // Logout Button
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
            const passInput = document.getElementById('auth-password-input');
            if (passInput) {
              passInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
              passInput.focus();
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
    const isLogged = this.isLoggedIn();

    // 1. Navbar Auth Pill
    const navAuthPill = document.getElementById('nav-user-auth-pill');
    const navAuthText = document.getElementById('nav-user-auth-name');
    const navAuthAvatar = document.getElementById('nav-user-auth-avatar');

    if (navAuthPill && navAuthText) {
      if (isLogged) {
        navAuthPill.classList.remove('logged-out');
        navAuthPill.classList.add('logged-in');
        navAuthText.textContent = user.name || 'Iskak Fatoni';
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
        if (heroUserName) heroUserName.textContent = user.name || 'Iskak Fatoni';
        if (heroUserEmail) heroUserEmail.textContent = user.email || ALLOWED_ADMIN_EMAIL;
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
        heroCtaBtn.innerHTML = `<i data-lucide="arrow-right"></i><span>Masuk ke Form Builder</span>`;
        heroCtaBtn.onclick = () => {
          const el = document.getElementById('hero-auth-container');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
      }
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

// Global instance
window.authManager = new AuthManager();
