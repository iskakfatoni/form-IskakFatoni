/**
 * FORMCRAFT - Main Application Controller & Hash Router
 * Orchestrates navigation, dashboard rendering, modal dialogues, and theme toggling.
 */

class App {
  constructor() {
    this.currentView = 'dashboard';
    this.initControllers();
    this.initModals();
    this.initTheme();
    this.bindEvents();
    this.handleRoute();
  }

  initControllers() {
    this.builder = new FormBuilder();
    this.viewer = new FormViewer();
    this.responsesDashboard = new ResponsesDashboard();
  }

  bindEvents() {
    // Hash Routing Listener
    window.addEventListener('hashchange', () => this.handleRoute());

    // Search on Dashboard
    const searchInput = document.getElementById('dashboard-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterDashboardForms(e.target.value.toLowerCase().trim());
      });
    }

    // Quick setup button in hero
    const btnQuickSetup = document.getElementById('btn-quick-setup');
    if (btnQuickSetup) {
      btnQuickSetup.addEventListener('click', () => {
        this.openSettingsModal();
      });
    }
  }

  // --- SPA HASH ROUTING ---

  handleRoute() {
    const hash = window.location.hash || '#/dashboard';
    const parts = hash.replace(/^#\/?/, '').split('/');
    const route = parts[0] || 'dashboard';
    const param = parts[1] || null;

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    // Hide all view sections
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const navDashboard = document.getElementById('nav-dashboard');
    const navBuilder = document.getElementById('nav-builder');

    if (route === 'dashboard' || route === '') {
      this.showSection('view-dashboard');
      if (navDashboard) navDashboard.classList.add('active');
      this.loadDashboard();
    } else if (route === 'builder') {
      this.showSection('view-builder');
      if (navBuilder) navBuilder.classList.add('active');
      this.builder.loadForm(param);
    } else if (route === 'view' || route === 'form') {
      this.showSection('view-form');
      this.viewer.loadForm(param);
    } else if (route === 'responses') {
      this.showSection('view-responses');
      this.responsesDashboard.loadDashboard(param);
    } else {
      // Fallback
      window.location.hash = '#/dashboard';
    }

    // Re-initialize Lucide Icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  showSection(sectionId) {
    const el = document.getElementById(sectionId);
    if (el) {
      el.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // --- DASHBOARD LOGIC ---

  async loadDashboard() {
    const forms = await window.formStorage.getAllForms();
    this.allDashboardForms = forms;
    this.renderDashboardStats(forms);
    this.renderDashboardForms(forms);
  }

  renderDashboardStats(forms) {
    const statForms = document.getElementById('stat-total-forms');
    const statResp = document.getElementById('stat-total-responses');

    const totalForms = forms.length;
    let totalResponses = 0;
    forms.forEach(f => {
      totalResponses += (f.responseCount || 0);
    });

    if (statForms) statForms.textContent = totalForms;
    if (statResp) statResp.textContent = totalResponses;
  }

  renderDashboardForms(forms) {
    const grid = document.getElementById('forms-grid');
    const emptyState = document.getElementById('forms-empty-state');

    if (!grid || !emptyState) return;

    if (forms.length === 0) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    grid.innerHTML = '';

    forms.forEach(form => {
      const card = document.createElement('div');
      card.className = 'form-item-card glass-card';
      const color = form.themeColor || '#6366f1';

      const dateStr = form.updatedAt ? new Date(form.updatedAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }) : 'Baru saja';

      card.innerHTML = `
        <div class="form-card-top-accent" style="background: ${color};"></div>
        <div class="form-item-header">
          <div>
            <h3 class="form-item-title">${this.escapeHtml(form.title || 'Formulir Tanpa Judul')}</h3>
            <p class="form-item-desc">${this.escapeHtml(form.description || 'Tidak ada deskripsi.')}</p>
          </div>
        </div>

        <div class="form-item-meta">
          <div class="meta-responses" title="Jumlah Tanggapan">
            <i data-lucide="users" style="width: 16px; height: 16px; color: var(--primary);"></i>
            <span>${form.responseCount || 0} Respon</span>
          </div>
          <div class="meta-date">
            Diperbarui: ${dateStr}
          </div>
        </div>

        <div class="form-item-actions">
          <button class="btn btn-secondary btn-sm btn-action-view" title="Buka Form">
            <i data-lucide="eye"></i>
            <span>Isi</span>
          </button>
          <button class="btn btn-secondary btn-sm btn-action-resp" title="Lihat Respon & Export Excel">
            <i data-lucide="bar-chart-2"></i>
            <span>Respon</span>
          </button>
          <button class="btn btn-secondary btn-sm btn-action-edit" title="Edit Form">
            <i data-lucide="edit-3"></i>
          </button>
          <button class="btn btn-secondary btn-sm btn-action-share" title="Bagikan Link">
            <i data-lucide="share-2"></i>
          </button>
          <button class="btn btn-ghost btn-sm text-danger btn-action-del" title="Hapus Form">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;

      // Card event listeners
      card.querySelector('.btn-action-view').addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.hash = `#/view/${form.id}`;
      });

      card.querySelector('.btn-action-resp').addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.hash = `#/responses/${form.id}`;
      });

      card.querySelector('.btn-action-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.hash = `#/builder/${form.id}`;
      });

      card.querySelector('.btn-action-share').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openShareModal(form.id);
      });

      card.querySelector('.btn-action-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Apakah Anda yakin ingin menghapus formulir "${form.title}" beserta seluruh responnya?`)) {
          await window.formStorage.deleteForm(form.id);
          this.showToast('Formulir berhasil dihapus', 'info');
          this.loadDashboard();
        }
      });

      // Clicking the card directly opens responses or builder
      card.addEventListener('click', () => {
        window.location.hash = `#/builder/${form.id}`;
      });

      grid.appendChild(card);
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  filterDashboardForms(query) {
    if (!this.allDashboardForms) return;
    if (!query) {
      this.renderDashboardForms(this.allDashboardForms);
      return;
    }
    const filtered = this.allDashboardForms.filter(f => {
      const titleMatch = f.title && f.title.toLowerCase().includes(query);
      const descMatch = f.description && f.description.toLowerCase().includes(query);
      return titleMatch || descMatch;
    });
    this.renderDashboardForms(filtered);
  }

  // --- MODALS & SETTINGS ---

  initModals() {
    const modalSettings = document.getElementById('modal-settings');
    const modalShare = document.getElementById('modal-share');

    // Open settings from status button & top nav icon
    const btnOpenSettings = document.getElementById('btn-open-settings');
    const btnDbStatus = document.getElementById('btn-db-status');

    if (btnOpenSettings) btnOpenSettings.addEventListener('click', () => this.openSettingsModal());
    if (btnDbStatus) btnDbStatus.addEventListener('click', () => this.openSettingsModal());

    // Close settings
    const btnCloseSettings = document.getElementById('btn-close-settings');
    if (btnCloseSettings) {
      btnCloseSettings.addEventListener('click', () => {
        modalSettings.classList.add('hidden');
      });
    }

    // Close share
    const btnCloseShare = document.getElementById('btn-close-share');
    if (btnCloseShare) {
      btnCloseShare.addEventListener('click', () => {
        modalShare.classList.add('hidden');
      });
    }

    // Modal Tabs (Form vs JSON)
    const tabCfgForm = document.getElementById('tab-cfg-form');
    const tabCfgJson = document.getElementById('tab-cfg-json');
    const modeForm = document.getElementById('cfg-mode-form');
    const modeJson = document.getElementById('cfg-mode-json');

    if (tabCfgForm && tabCfgJson) {
      tabCfgForm.addEventListener('click', () => {
        tabCfgForm.classList.add('active');
        tabCfgJson.classList.remove('active');
        modeForm.classList.add('active');
        modeJson.classList.remove('active');
      });
      tabCfgJson.addEventListener('click', () => {
        tabCfgJson.classList.add('active');
        tabCfgForm.classList.remove('active');
        modeJson.classList.add('active');
        modeForm.classList.remove('active');
      });
    }

    // Save Firebase Config Button
    const btnSaveCfg = document.getElementById('btn-save-firebase-cfg');
    if (btnSaveCfg) {
      btnSaveCfg.addEventListener('click', () => this.saveFirebaseConfig());
    }

    // Use Local Demo Mode
    const btnUseDemo = document.getElementById('btn-use-local-demo');
    if (btnUseDemo) {
      btnUseDemo.addEventListener('click', () => {
        localStorage.removeItem('formcraft_firebase_config');
        window.firebaseManager.config = {};
        window.firebaseManager.isConfigured = false;
        window.firebaseManager.updateStatusUI(false);
        modalSettings.classList.add('hidden');
        this.showToast('Beralih ke Mode Lokal Demo', 'info');
        this.loadDashboard();
      });
    }

    // Share Modal Copy URL Button
    const btnCopyShare = document.getElementById('btn-copy-share-url');
    if (btnCopyShare) {
      btnCopyShare.addEventListener('click', () => {
        const input = document.getElementById('share-link-input');
        if (input) {
          input.select();
          navigator.clipboard.writeText(input.value);
          this.showToast('Tautan formulir disalin ke clipboard!', 'success');
        }
      });
    }
  }

  openSettingsModal() {
    const modal = document.getElementById('modal-settings');
    const cfg = window.firebaseManager.config || {};

    document.getElementById('cfg-apiKey').value = cfg.apiKey || '';
    document.getElementById('cfg-authDomain').value = cfg.authDomain || '';
    document.getElementById('cfg-projectId').value = cfg.projectId || '';
    document.getElementById('cfg-storageBucket').value = cfg.storageBucket || '';
    document.getElementById('cfg-messagingSenderId').value = cfg.messagingSenderId || '';
    document.getElementById('cfg-appId').value = cfg.appId || '';
    document.getElementById('cfg-json-input').value = cfg.apiKey ? JSON.stringify(cfg, null, 2) : '';

    modal.classList.remove('hidden');
  }

  saveFirebaseConfig() {
    const isJsonMode = document.getElementById('tab-cfg-json').classList.contains('active');
    let config = {};

    if (isJsonMode) {
      const jsonText = document.getElementById('cfg-json-input').value.trim();
      try {
        config = JSON.parse(jsonText);
      } catch (e) {
        this.showToast('Format JSON Firebase tidak valid: ' + e.message, 'error');
        return;
      }
    } else {
      config = {
        apiKey: document.getElementById('cfg-apiKey').value.trim(),
        authDomain: document.getElementById('cfg-authDomain').value.trim(),
        projectId: document.getElementById('cfg-projectId').value.trim(),
        storageBucket: document.getElementById('cfg-storageBucket').value.trim(),
        messagingSenderId: document.getElementById('cfg-messagingSenderId').value.trim(),
        appId: document.getElementById('cfg-appId').value.trim()
      };
    }

    if (!config.apiKey || !config.projectId) {
      this.showToast('Harap lengkapi setidaknya API Key dan Project ID!', 'error');
      return;
    }

    const success = window.firebaseManager.saveConfig(config);
    if (success) {
      document.getElementById('modal-settings').classList.add('hidden');
      this.showToast('Berhasil terhubung ke Firebase Cloud Firestore!', 'success');
      this.loadDashboard();
    } else {
      this.showToast('Koneksi Firebase gagal diinisialisasi. Periksa config.', 'error');
    }
  }

  openShareModal(formId) {
    const modal = document.getElementById('modal-share');
    const input = document.getElementById('share-link-input');
    const openLink = document.getElementById('share-open-link');

    // Build URL using full current origin + pathname + hash
    const baseUrl = window.location.href.split('#')[0];
    const fullShareUrl = `${baseUrl}#/view/${formId}`;

    input.value = fullShareUrl;
    openLink.href = fullShareUrl;
    modal.classList.remove('hidden');
  }

  // --- THEME TOGGLING ---

  initTheme() {
    const savedTheme = localStorage.getItem('formcraft_theme') || 'dark';
    document.body.className = savedTheme === 'light' ? 'theme-light' : 'theme-dark';
    this.updateThemeIcon(savedTheme);

    const btnToggle = document.getElementById('btn-theme-toggle');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('theme-dark');
        const nextTheme = isDark ? 'light' : 'dark';
        document.body.className = nextTheme === 'light' ? 'theme-light' : 'theme-dark';
        localStorage.setItem('formcraft_theme', nextTheme);
        this.updateThemeIcon(nextTheme);
      });
    }
  }

  updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.setAttribute('data-lucide', theme === 'light' ? 'moon' : 'sun');
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // --- TOAST NOTIFICATIONS ---

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <span>${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// Bootstrap Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
