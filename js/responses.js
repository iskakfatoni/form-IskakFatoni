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
          displayVal = this.escapeHtml(ans.join(', '));
        } else if (ans !== null && ans !== undefined && ans !== '') {
          if (q.type === 'location') {
            let locObj = ans;
            if (typeof locObj === 'string' && locObj.startsWith('{')) {
              try { locObj = JSON.parse(locObj); } catch(e){}
            }
            if (locObj && typeof locObj === 'object' && locObj.lat) {
              const mapsUrl = locObj.mapsUrl || `https://www.google.com/maps?q=${locObj.lat},${locObj.lng}`;
              displayVal = `
                <a href="${mapsUrl}" target="_blank" class="table-gps-link" title="Buka Titik Rumah di Google Maps">
                  <i data-lucide="map-pin"></i>
                  <span>${locObj.lat.toFixed(5)}, ${locObj.lng.toFixed(5)}</span>
                </a>
              `;
            } else {
              displayVal = this.escapeHtml(String(ans));
            }
          } else if (q.type === 'file_gdrive') {
            let fileObj = ans;
            if (typeof fileObj === 'string' && fileObj.startsWith('{')) {
              try { fileObj = JSON.parse(fileObj); } catch(e){}
            }
            let url = typeof fileObj === 'object' ? (fileObj.url || fileObj.viewUrl || '') : (String(fileObj).startsWith('http') ? fileObj : '');
            let name = typeof fileObj === 'object' ? (fileObj.name || fileObj.fileName || 'Berkas Google Drive') : String(fileObj);
            
            if (url) {
              displayVal = `
                <a href="${this.escapeHtml(url)}" target="_blank" class="btn btn-secondary btn-xs" style="color: #10b981; border-color: rgba(16, 185, 129, 0.3); font-weight: 500;" title="Buka berkas di Google Drive (${this.escapeHtml(name)})">
                  <i data-lucide="hard-drive" style="width:13px; height:13px;"></i>
                  <span>${this.escapeHtml(name.length > 20 ? name.substring(0, 18) + '...' : name)}</span>
                </a>
              `;
            } else {
              displayVal = `📁 ${this.escapeHtml(name)}`;
            }
          } else if (q.type === 'file') {
            displayVal = `
              <a href="${this.escapeHtml(String(ans))}" target="_blank" class="btn btn-ghost btn-xs" style="color: var(--primary); text-decoration: underline;" title="Buka / Unduh Foto">
                <i data-lucide="image" style="width:13px; height:13px;"></i>
                <span>Lihat Foto</span>
              </a>
            `;
          } else if (q.type === 'signature') {
            displayVal = `
              <a href="${this.escapeHtml(String(ans))}" target="_blank" class="btn btn-ghost btn-xs" style="color: var(--primary); text-decoration: underline;" title="Lihat Gambar Tanda Tangan">
                <i data-lucide="pen-tool" style="width:13px; height:13px;"></i>
                <span>Lihat TTD</span>
              </a>
            `;
          } else if (q.type === 'rating') {
            displayVal = `⭐ ${ans} / 5`;
          } else {
            displayVal = this.escapeHtml(String(ans));
          }
        }

        bodyHtml += `<td title="${this.escapeHtml(typeof ans === 'object' ? JSON.stringify(ans) : String(ans || ''))}">${displayVal}</td>`;
      });

      bodyHtml += `</tr>`;
    });

    this.tableBody.innerHTML = bodyHtml;
    if (window.lucide) {
      window.lucide.createIcons();
    }
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
