/**
 * FORMCRAFT - Form Viewer / Respondent Logic
 * Handles rendering the live public form, validation, and submitting responses to Firestore.
 */

class FormViewer {
  constructor() {
    this.currentForm = null;
    this.answers = {};
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.titleEl = document.getElementById('form-view-title');
    this.descEl = document.getElementById('form-view-desc');
    this.bannerEl = document.getElementById('form-view-banner-img');
    this.accentBar = document.getElementById('form-view-accent-bar');
    this.questionsContainer = document.getElementById('form-view-questions');
    this.formElement = document.getElementById('form-live-element');
    this.successCard = document.getElementById('form-view-success');
    this.successMsgEl = document.getElementById('form-view-success-message');
    this.btnSubmitAnother = document.getElementById('btn-submit-another');
  }

  bindEvents() {
    this.formElement.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    document.getElementById('btn-reset-form').addEventListener('click', () => {
      if (confirm('Apakah Anda yakin ingin mengosongkan seluruh jawaban?')) {
        this.resetAnswers();
      }
    });

    this.btnSubmitAnother.addEventListener('click', () => {
      this.resetAnswers();
      this.successCard.classList.add('hidden');
      this.formElement.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  async loadForm(formId) {
    this.answers = {};
    this.successCard.classList.add('hidden');
    this.formElement.classList.remove('hidden');

    if (!formId) {
      window.app.showToast('ID Formulir tidak valid', 'error');
      window.location.hash = '#/dashboard';
      return;
    }

    const form = await window.formStorage.getFormById(formId);
    if (!form) {
      window.app.showToast('Formulir tidak ditemukan atau telah dihapus', 'error');
      window.location.hash = '#/dashboard';
      return;
    }

    this.currentForm = form;
    this.renderForm();
  }

  renderForm() {
    const form = this.currentForm;
    this.titleEl.textContent = form.title || 'Formulir Tanpa Judul';
    this.descEl.textContent = form.description || '';
    
    // Theme color
    const color = form.themeColor || '#6366f1';
    this.accentBar.style.background = color;

    // Header banner
    if (form.bannerUrl) {
      this.bannerEl.style.backgroundImage = `url('${form.bannerUrl}')`;
      this.bannerEl.classList.remove('hidden');
    } else {
      this.bannerEl.classList.add('hidden');
    }

    // Success message text
    this.successMsgEl.textContent = form.submitMessage || 'Terima kasih! Tanggapan Anda telah berhasil disimpan.';

    // Allow multiple
    this.btnSubmitAnother.style.display = form.allowMultiple !== false ? 'inline-flex' : 'none';

    // Render questions
    this.questionsContainer.innerHTML = '';
    (form.questions || []).forEach((q, index) => {
      const card = this.renderQuestionItem(q, index);
      this.questionsContainer.appendChild(card);
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderQuestionItem(q, index) {
    const card = document.createElement('div');
    card.className = 'live-question-card glass-card';
    card.dataset.questionId = q.id;

    let inputHtml = '';
    const qName = `q_${q.id}`;

    if (q.type === 'paragraph') {
      inputHtml = `
        <textarea class="live-input-textarea" name="${qName}" placeholder="Ketik jawaban Anda..." rows="3"></textarea>
      `;
    } else if (q.type === 'choice') {
      const options = q.options || ['Opsi 1'];
      inputHtml = `
        <div class="live-options-group">
          ${options.map((opt, i) => `
            <label class="live-choice-label">
              <input type="radio" name="${qName}" value="${this.escapeHtml(opt)}">
              <span class="custom-radio"></span>
              <span class="choice-text">${this.escapeHtml(opt)}</span>
            </label>
          `).join('')}
        </div>
      `;
    } else if (q.type === 'checkbox') {
      const options = q.options || ['Opsi 1'];
      inputHtml = `
        <div class="live-options-group">
          ${options.map((opt, i) => `
            <label class="live-choice-label custom-checkbox-label">
              <input type="checkbox" name="${qName}" value="${this.escapeHtml(opt)}">
              <span class="custom-box"></span>
              <span class="choice-text">${this.escapeHtml(opt)}</span>
            </label>
          `).join('')}
        </div>
      `;
    } else if (q.type === 'dropdown') {
      const options = q.options || ['Opsi 1'];
      inputHtml = `
        <select class="live-select" name="${qName}">
          <option value="">-- Pilih Jawaban --</option>
          ${options.map(opt => `<option value="${this.escapeHtml(opt)}">${this.escapeHtml(opt)}</option>`).join('')}
        </select>
      `;
    } else if (q.type === 'rating') {
      inputHtml = `
        <div class="live-rating-group" data-name="${qName}">
          ${[1, 2, 3, 4, 5].map(val => `
            <button type="button" class="rating-star-btn" data-value="${val}" title="${val} Bintang">
              <i data-lucide="star"></i>
            </button>
          `).join('')}
          <input type="hidden" name="${qName}" value="">
        </div>
      `;
    } else if (q.type === 'date') {
      inputHtml = `
        <input type="date" class="live-input-text" name="${qName}">
      `;
    } else if (q.type === 'time') {
      inputHtml = `
        <input type="time" class="live-input-text" name="${qName}">
      `;
    } else if (q.type === 'number') {
      inputHtml = `
        <input type="number" class="live-input-text" name="${qName}" placeholder="Ketik angka...">
      `;
    } else {
      // Default: text
      inputHtml = `
        <input type="text" class="live-input-text" name="${qName}" placeholder="Ketik jawaban singkat...">
      `;
    }

    card.innerHTML = `
      <div class="live-q-header">
        <label class="live-q-title">
          ${this.escapeHtml(q.title || `Pertanyaan ${index + 1}`)}
          ${q.required ? '<span class="live-q-required-mark">*</span>' : ''}
        </label>
      </div>
      <div class="live-q-body">
        ${inputHtml}
      </div>
      <div class="error-msg">Pertanyaan ini wajib diisi.</div>
    `;

    // Handle Rating click
    if (q.type === 'rating') {
      const ratingGroup = card.querySelector('.live-rating-group');
      const starBtns = ratingGroup.querySelectorAll('.rating-star-btn');
      const hiddenInput = ratingGroup.querySelector('input[type="hidden"]');

      starBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const val = parseInt(btn.dataset.value, 10);
          hiddenInput.value = val;
          this.answers[q.id] = val;

          starBtns.forEach(s => {
            const sVal = parseInt(s.dataset.value, 10);
            s.classList.toggle('active', sVal <= val);
          });
          card.classList.remove('has-error');
        });
      });
    }

    // Input listeners to clear error state
    card.querySelectorAll('input, select, textarea').forEach(input => {
      input.addEventListener('change', () => {
        card.classList.remove('has-error');
      });
      input.addEventListener('input', () => {
        card.classList.remove('has-error');
      });
    });

    return card;
  }

  collectAnswers() {
    const answers = {};
    let isValid = true;
    let firstErrorElement = null;

    (this.currentForm.questions || []).forEach(q => {
      const qCard = this.questionsContainer.querySelector(`[data-question-id="${q.id}"]`);
      const qName = `q_${q.id}`;
      let val = null;

      if (q.type === 'choice') {
        const checked = qCard.querySelector(`input[name="${qName}"]:checked`);
        val = checked ? checked.value : '';
      } else if (q.type === 'checkbox') {
        const checkedList = qCard.querySelectorAll(`input[name="${qName}"]:checked`);
        val = Array.from(checkedList).map(el => el.value);
        if (val.length === 0) val = [];
      } else if (q.type === 'rating') {
        val = this.answers[q.id] || null;
      } else {
        const input = qCard.querySelector(`[name="${qName}"]`);
        val = input ? input.value.trim() : '';
      }

      // Check required
      let isEmpty = false;
      if (q.required) {
        if (q.type === 'checkbox' && (!val || val.length === 0)) {
          isEmpty = true;
        } else if (q.type === 'rating' && !val) {
          isEmpty = true;
        } else if (!val || val === '') {
          isEmpty = true;
        }
      }

      if (isEmpty) {
        isValid = false;
        qCard.classList.add('has-error');
        if (!firstErrorElement) firstErrorElement = qCard;
      } else {
        qCard.classList.remove('has-error');
      }

      answers[q.id] = val;
    });

    if (!isValid && firstErrorElement) {
      firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.app.showToast('Harap lengkapi semua pertanyaan yang wajib diisi', 'error');
      return null;
    }

    return answers;
  }

  async handleSubmit() {
    const answers = this.collectAnswers();
    if (!answers) return;

    const btnSubmit = document.getElementById('btn-submit-response');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>Mengirim tanggapan...</span>';

    try {
      await window.formStorage.submitResponse(this.currentForm.id, answers);
      
      // Show success screen
      this.formElement.classList.add('hidden');
      this.successCard.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.app.showToast('Tanggapan berhasil dikirim!', 'success');
    } catch (err) {
      console.error(err);
      window.app.showToast('Gagal mengirim tanggapan: ' + err.message, 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalText;
    }
  }

  resetAnswers() {
    this.formElement.reset();
    this.answers = {};
    this.questionsContainer.querySelectorAll('.has-error').forEach(c => c.classList.remove('has-error'));
    this.questionsContainer.querySelectorAll('.rating-star-btn').forEach(s => s.classList.remove('active'));
    this.questionsContainer.querySelectorAll('input[type="hidden"]').forEach(h => h.value = '');
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

window.FormViewer = FormViewer;
