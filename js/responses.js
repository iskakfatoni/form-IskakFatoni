/**
 * FORMCRAFT - Responses & Analytics Dashboard Logic
 * Displays collected form submissions in a clean data table with search filtering and Excel export.
 */

class ResponsesDashboard {
  constructor() {
    this.currentForm = null;
    this.responses = [];
    this.filteredResponses = [];
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.titleEl = document.getElementById('resp-page-title');
    this.subtitleEl = document.getElementById('resp-page-subtitle');
    this.statTotal = document.getElementById('resp-stat-total');
    this.statLatest = document.getElementById('resp-stat-latest');
    this.statRate = document.getElementById('resp-stat-rate');
    this.tableHead = document.getElementById('responses-table-head');
    this.tableBody = document.getElementById('responses-table-body');
    this.emptyTable = document.getElementById('responses-empty-table');
    this.searchInput = document.getElementById('resp-search-input');
    this.btnExportExcel = document.getElementById('btn-export-excel');
    this.btnShareForm = document.getElementById('btn-copy-form-share');
    this.btnEditForm = document.getElementById('btn-edit-form-from-resp');
    this.btnClearAll = document.getElementById('btn-clear-all-responses');
  }

  bindEvents() {
    // Export to Excel Button
    if (this.btnExportExcel) {
      this.btnExportExcel.addEventListener('click', () => {
        if (this.currentForm && this.responses.length > 0) {
          window.ExcelExporter.exportFormResponses(this.currentForm, this.responses);
        } else {
          window.app.showToast('Belum ada data tanggapan untuk diekspor', 'error');
        }
      });
    }

    // Share Form Button
    if (this.btnShareForm) {
      this.btnShareForm.addEventListener('click', () => {
        if (this.currentForm) {
          window.app.openShareModal(this.currentForm.id);
        }
      });
    }

    // Edit Form Button
    if (this.btnEditForm) {
      this.btnEditForm.addEventListener('click', () => {
        if (this.currentForm) {
          window.location.hash = `#/builder/${this.currentForm.id}`;
        }
      });
    }

    // Clear All Responses Button
    if (this.btnClearAll) {
      this.btnClearAll.addEventListener('click', async () => {
        if (!this.currentForm || this.responses.length === 0) return;
        if (confirm(`Apakah Anda yakin ingin menghapus seluruh (${this.responses.length}) tanggapan dari formulir ini? Tindakan ini tidak dapat dibatalkan.`)) {
          await window.formStorage.clearResponsesByFormId(this.currentForm.id);
          window.app.showToast('Seluruh tanggapan berhasil dihapus', 'info');
          this.loadDashboard(this.currentForm.id);
        }
      });
    }

    // Search in responses
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        if (!q) {
          this.filteredResponses = [...this.responses];
        } else {
          this.filteredResponses = this.responses.filter(r => {
            // Search in submittedAt or any answer
            if (r.submittedAt && r.submittedAt.toLowerCase().includes(q)) return true;
            for (const key in r.answers) {
              const val = r.answers[key];
              if (Array.isArray(val)) {
                if (val.some(v => String(v).toLowerCase().includes(q))) return true;
              } else if (val && String(val).toLowerCase().includes(q)) {
                return true;
              }
            }
            return false;
          });
        }
        this.renderTableRows();
      });
    }
  }

  async loadDashboard(formId) {
    if (!formId) {
      window.app.showToast('ID Formulir tidak valid', 'error');
      window.location.hash = '#/dashboard';
      return;
    }

    const form = await window.formStorage.getFormById(formId);
    if (!form) {
      window.app.showToast('Formulir tidak ditemukan', 'error');
      window.location.hash = '#/dashboard';
      return;
    }

    this.currentForm = form;
    this.titleEl.textContent = form.title || 'Ringkasan Respon';

    // Load responses
    this.responses = await window.formStorage.getResponsesByFormId(formId);
    this.filteredResponses = [...this.responses];

    this.renderStats();
    this.renderTable();
  }

  renderStats() {
    const count = this.responses.length;
    this.subtitleEl.textContent = `${count} Tanggapan`;
    this.statTotal.textContent = count;

    if (count > 0 && this.responses[0].submittedAt) {
      const date = new Date(this.responses[0].submittedAt);
      this.statLatest.textContent = date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      this.statLatest.textContent = '-';
    }

    this.statRate.textContent = this.currentForm.isActive !== false ? 'Aktif' : 'Nonaktif';
  }

  renderTable() {
    const form = this.currentForm;
    const questions = form.questions || [];
    const hasEmail = form.collectEmail || this.responses.some(r => !!r.respondentEmail || !!(r.answers && r.answers._respondent_email));

    // 1. Render Table Headers
    let headHtml = `
      <tr>
        <th style="width: 50px;">#</th>
        <th style="min-width: 150px;">Waktu Kirim</th>
        ${hasEmail ? '<th style="min-width: 180px;">Email Responden</th>' : ''}
    `;

    questions.forEach((q, idx) => {
      headHtml += `<th title="${this.escapeHtml(q.title || '')}">${this.escapeHtml(q.title || `Pertanyaan ${idx + 1}`)}</th>`;
    });

    headHtml += `</tr>`;
    this.tableHead.innerHTML = headHtml;

    // 2. Render Rows
    this.renderTableRows();
  }

  renderTableRows() {
    const questions = this.currentForm.questions || [];
    const count = this.filteredResponses.length;
    const hasEmail = this.currentForm.collectEmail || this.responses.some(r => !!r.respondentEmail || !!(r.answers && r.answers._respondent_email));

    if (count === 0) {
      this.tableBody.innerHTML = '';
      this.emptyTable.classList.remove('hidden');
      return;
    }

    this.emptyTable.classList.add('hidden');
    let bodyHtml = '';

    this.filteredResponses.forEach((resp, index) => {
      const dateStr = resp.submittedAt ? new Date(resp.submittedAt).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : '-';

      const emailStr = resp.respondentEmail || (resp.answers && resp.answers._respondent_email) || '-';

      bodyHtml += `
        <tr>
          <td><strong>${index + 1}</strong></td>
          <td style="color: var(--text-secondary); font-size: 0.85rem;">${dateStr}</td>
          ${hasEmail ? `<td style="font-weight: 500; color: #818cf8;">${this.escapeHtml(emailStr)}</td>` : ''}
      `;

      questions.forEach(q => {
        let ans = resp.answers ? resp.answers[q.id] : null;
        let displayVal = '-';

        if (Array.isArray(ans)) {
          displayVal = ans.join(', ');
        } else if (ans !== null && ans !== undefined && ans !== '') {
          if (q.type === 'rating') {
            displayVal = `⭐ ${ans} / 5`;
          } else {
            displayVal = this.escapeHtml(String(ans));
          }
        }

        bodyHtml += `<td title="${displayVal}">${displayVal}</td>`;
      });

      bodyHtml += `</tr>`;
    });

    this.tableBody.innerHTML = bodyHtml;
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

window.ResponsesDashboard = ResponsesDashboard;
