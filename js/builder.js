/**
 * FORMCRAFT - Form Builder Logic
 * Handles dynamic question card creation, Section management, Drag and Drop reordering,
 * type switching, options editor, and saving to Firestore/LocalStorage.
 */

class FormBuilder {
  constructor() {
    this.currentForm = null;
    this.sections = [];
    this.questions = [];
    this.draggedQuestionId = null;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.titleInput = document.getElementById('form-title-input');
    this.descInput = document.getElementById('form-desc-input');
    this.accentStripe = document.getElementById('form-accent-stripe');
    this.questionsContainer = document.getElementById('questions-container');
    this.statusBadge = document.getElementById('builder-status-badge');
    this.responseCountBadge = document.getElementById('builder-response-count');
    this.responsesTabLink = document.getElementById('tab-btn-responses-link');

    // Settings fields
    this.themeColorSwatches = document.querySelectorAll('.color-swatch');
    this.headerImgInput = document.getElementById('form-header-img');
    this.submitMsgInput = document.getElementById('form-submit-msg');
    this.collectEmailCheck = document.getElementById('form-collect-email');
    this.allowMultipleCheck = document.getElementById('form-allow-multiple');
    this.isActiveCheck = document.getElementById('form-is-active');
  }

  bindEvents() {
    // Add Question Main Button
    document.getElementById('btn-add-question').addEventListener('click', () => {
      this.addQuestion('text');
    });

    // Add Section Button
    const btnAddSection = document.getElementById('btn-add-section');
    if (btnAddSection) {
      btnAddSection.addEventListener('click', () => {
        this.addSection();
      });
    }

    // Quick Type Pills
    document.querySelectorAll('.type-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const type = pill.dataset.type;
        this.addQuestion(type);
      });
    });

    // Color Swatches
    this.themeColorSwatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        this.themeColorSwatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const color = swatch.dataset.color;
        this.setThemeColor(color);
      });
    });

    // Save Form Button
    document.getElementById('btn-save-form').addEventListener('click', () => {
      this.saveCurrentForm();
    });

    // Preview Button
    document.getElementById('btn-preview-form').addEventListener('click', () => {
      if (this.currentForm && this.currentForm.id) {
        window.location.hash = `#/view/${this.currentForm.id}`;
      } else {
        this.saveCurrentForm().then(saved => {
          if (saved) window.location.hash = `#/view/${saved.id}`;
        });
      }
    });

    // Responses Tab Link inside builder
    this.responsesTabLink.addEventListener('click', () => {
      if (this.currentForm && this.currentForm.id) {
        window.location.hash = `#/responses/${this.currentForm.id}`;
      }
    });

    // Builder Tabs (Questions vs Settings)
    document.getElementById('tab-btn-questions').addEventListener('click', () => {
      this.switchTab('questions');
    });
    document.getElementById('tab-btn-settings').addEventListener('click', () => {
      this.switchTab('settings');
    });
  }

  switchTab(tab) {
    document.getElementById('tab-btn-questions').classList.toggle('active', tab === 'questions');
    document.getElementById('tab-btn-settings').classList.toggle('active', tab === 'settings');
    document.getElementById('builder-panel-questions').classList.toggle('active', tab === 'questions');
    document.getElementById('builder-panel-settings').classList.toggle('active', tab === 'settings');
  }

  setThemeColor(color) {
    if (this.accentStripe) {
      this.accentStripe.style.background = color;
    }
  }

  loadForm(formId) {
    this.switchTab('questions');
    if (!formId) {
      // Create new blank form
      const defaultSecId = 'sec_' + Date.now();
      this.currentForm = {
        id: null,
        title: 'Formulir Tanpa Judul',
        description: '',
        themeColor: '#6366f1',
        bannerUrl: '',
        submitMessage: 'Terima kasih! Tanggapan Anda telah berhasil direkam.',
        collectEmail: false,
        allowMultiple: true,
        isActive: true,
        responseCount: 0,
        sections: [
          {
            id: defaultSecId,
            title: 'Bagian 1',
            description: ''
          }
        ],
        questions: []
      };
      this.sections = this.currentForm.sections;
      this.questions = [
        {
          id: 'q_' + Date.now(),
          sectionId: defaultSecId,
          type: 'text',
          title: 'Pertanyaan Tanpa Judul',
          required: false
        }
      ];
      this.renderForm();
      this.statusBadge.textContent = 'Formulir Baru';
      this.responsesTabLink.style.display = 'none';
      return;
    }

    // Load existing form from storage
    window.formStorage.getFormById(formId).then(form => {
      if (form) {
        this.currentForm = form;
        
        // Ensure sections array exists
        if (!form.sections || form.sections.length === 0) {
          const defaultSecId = 'sec_1';
          this.sections = [
            {
              id: defaultSecId,
              title: form.title || 'Bagian 1',
              description: form.description || ''
            }
          ];
        } else {
          this.sections = form.sections;
        }

        const firstSecId = this.sections[0].id;
        this.questions = (form.questions || []).map(q => {
          if (!q.sectionId) q.sectionId = firstSecId;
          return q;
        });

        this.renderForm();
        this.statusBadge.textContent = 'Edit Formulir';
        this.responsesTabLink.style.display = 'inline-flex';
        this.responseCountBadge.textContent = form.responseCount || 0;
      } else {
        window.app.showToast('Formulir tidak ditemukan', 'error');
        window.location.hash = '#/dashboard';
      }
    });
  }

  renderForm() {
    this.titleInput.value = this.currentForm.title || '';
    this.descInput.value = this.currentForm.description || '';
    this.setThemeColor(this.currentForm.themeColor || '#6366f1');

    // Update settings tab
    this.headerImgInput.value = this.currentForm.bannerUrl || '';
    this.submitMsgInput.value = this.currentForm.submitMessage || 'Terima kasih! Tanggapan Anda telah berhasil direkam.';
    this.collectEmailCheck.checked = this.currentForm.collectEmail === true;
    this.allowMultipleCheck.checked = this.currentForm.allowMultiple !== false;
    this.isActiveCheck.checked = this.currentForm.isActive !== false;

    // Update active color swatch
    this.themeColorSwatches.forEach(s => {
      s.classList.toggle('active', s.dataset.color === (this.currentForm.themeColor || '#6366f1'));
    });

    this.renderQuestions();
  }

  renderQuestions() {
    this.questionsContainer.innerHTML = '';
    const totalSections = this.sections.length;

    this.sections.forEach((sec, secIdx) => {
      // If there are multiple sections, render a section header card (for section 2 and above, or all if multi-section)
      if (totalSections > 1) {
        const secCard = this.createSectionCardElement(sec, secIdx, totalSections);
        this.questionsContainer.appendChild(secCard);
      }

      // Render questions for this section
      const sectionQuestions = this.questions.filter(q => q.sectionId === sec.id);
      
      sectionQuestions.forEach(q => {
        const globalIndex = this.questions.findIndex(item => item.id === q.id);
        const card = this.createQuestionCardElement(q, globalIndex, sectionQuestions.length);
        this.questionsContainer.appendChild(card);
      });
    });

    // Refresh icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  createSectionCardElement(sec, secIdx, totalSections) {
    const card = document.createElement('div');
    card.className = 'form-card section-card glass-card';
    card.dataset.sectionId = sec.id;

    card.innerHTML = `
      <div class="section-header-top">
        <div class="section-tag-badge">
          <i data-lucide="layers"></i>
          <span>Bagian ${secIdx + 1} dari ${totalSections}</span>
        </div>
        <div class="section-actions">
          ${secIdx > 0 ? `
            <button type="button" class="btn-q-icon sec-move-up" title="Pindah Bagian ke Atas">
              <i data-lucide="chevron-up"></i>
            </button>
          ` : ''}
          ${secIdx < totalSections - 1 ? `
            <button type="button" class="btn-q-icon sec-move-down" title="Pindah Bagian ke Bawah">
              <i data-lucide="chevron-down"></i>
            </button>
          ` : ''}
          <button type="button" class="btn-q-icon sec-delete" title="Hapus Bagian Ini">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
      <div class="section-body">
        <input type="text" class="input-section-title" value="${this.escapeHtml(sec.title || '')}" placeholder="Judul Bagian/Halaman...">
        <textarea class="input-section-desc" placeholder="Deskripsi bagian ini (opsional)..." rows="1">${this.escapeHtml(sec.description || '')}</textarea>
      </div>
    `;

    // Bind section input events
    const titleInput = card.querySelector('.input-section-title');
    titleInput.addEventListener('input', (e) => {
      sec.title = e.target.value;
    });

    const descInput = card.querySelector('.input-section-desc');
    descInput.addEventListener('input', (e) => {
      sec.description = e.target.value;
    });

    // Move Section Up
    const btnMoveUp = card.querySelector('.sec-move-up');
    if (btnMoveUp) {
      btnMoveUp.addEventListener('click', () => {
        const temp = this.sections[secIdx];
        this.sections[secIdx] = this.sections[secIdx - 1];
        this.sections[secIdx - 1] = temp;
        this.renderQuestions();
      });
    }

    // Move Section Down
    const btnMoveDown = card.querySelector('.sec-move-down');
    if (btnMoveDown) {
      btnMoveDown.addEventListener('click', () => {
        const temp = this.sections[secIdx];
        this.sections[secIdx] = this.sections[secIdx + 1];
        this.sections[secIdx + 1] = temp;
        this.renderQuestions();
      });
    }

    // Delete Section
    const btnDelete = card.querySelector('.sec-delete');
    btnDelete.addEventListener('click', () => {
      if (this.sections.length <= 1) {
        window.app.showToast('Formulir harus memiliki minimal satu bagian', 'error');
        return;
      }

      const targetSecId = secIdx > 0 ? this.sections[secIdx - 1].id : this.sections[1].id;
      // Reassign questions in this section to target section
      this.questions.forEach(q => {
        if (q.sectionId === sec.id) {
          q.sectionId = targetSecId;
        }
      });

      this.sections.splice(secIdx, 1);
      this.renderQuestions();
      window.app.showToast('Bagian berhasil dihapus', 'info');
    });

    return card;
  }

  createQuestionCardElement(q, globalIndex, totalQuestionsInSec) {
    const card = document.createElement('div');
    card.className = 'form-card question-card glass-card';
    card.dataset.questionId = q.id;
    card.setAttribute('draggable', 'false');

    // Build question body based on type
    let optionsHtml = '';
    if (q.type === 'choice' || q.type === 'checkbox' || q.type === 'dropdown') {
      const icon = q.type === 'choice' ? 'circle' : (q.type === 'checkbox' ? 'square' : 'chevron-down');
      const options = q.options || ['Opsi 1'];
      optionsHtml = `
        <div class="question-options-container">
          ${options.map((opt, optIdx) => `
            <div class="option-row" data-opt-index="${optIdx}">
              <i data-lucide="${icon}" class="option-type-icon"></i>
              <input type="text" class="input-option-text" value="${this.escapeHtml(opt)}" placeholder="Nama opsi (Bisa paste list Excel/Sheets)...">
              ${options.length > 1 ? `
                <button type="button" class="btn-remove-option" title="Hapus Opsi">
                  <i data-lucide="x"></i>
                </button>
              ` : ''}
            </div>
          `).join('')}
          <button type="button" class="btn-add-option-row">
            <i data-lucide="plus"></i>
            <span>Tambah Opsi</span>
          </button>
        </div>
      `;
    } else if (q.type === 'rating') {
      optionsHtml = `
        <div class="rating-preview-box">
          <i data-lucide="star"></i>
          <i data-lucide="star"></i>
          <i data-lucide="star"></i>
          <i data-lucide="star"></i>
          <i data-lucide="star"></i>
          <span style="margin-left: 8px; font-size: 0.85rem;">(Skala 1 - 5 Bintang)</span>
        </div>
      `;
    } else if (q.type === 'paragraph') {
      optionsHtml = `<div class="text-preview-box">Teks jawaban panjang / paragraf responden...</div>`;
    } else if (q.type === 'date') {
      optionsHtml = `<div class="text-preview-box">Pilihan Tanggal (DD/MM/YYYY)...</div>`;
    } else if (q.type === 'time') {
      optionsHtml = `<div class="text-preview-box">Pilihan Waktu (HH:MM)...</div>`;
    } else if (q.type === 'number') {
      optionsHtml = `<div class="text-preview-box">Input Angka / Nomor...</div>`;
    } else {
      optionsHtml = `<div class="text-preview-box">Teks jawaban singkat responden...</div>`;
    }

    card.innerHTML = `
      <!-- Top Drag Handle -->
      <div class="card-drag-handle" title="Tahan & geser untuk mengubah urutan pertanyaan">
        <i data-lucide="grip-horizontal"></i>
      </div>

      <div class="question-card-top">
        <div class="q-title-wrap">
          <input type="text" class="input-q-title" value="${this.escapeHtml(q.title || '')}" placeholder="Ketik pertanyaan di sini...">
        </div>
        <div class="q-type-select-wrap">
          <select class="select-q-type">
            <option value="text" ${q.type === 'text' ? 'selected' : ''}>Teks Singkat</option>
            <option value="paragraph" ${q.type === 'paragraph' ? 'selected' : ''}>Paragraf</option>
            <option value="choice" ${q.type === 'choice' ? 'selected' : ''}>Pilihan Ganda</option>
            <option value="checkbox" ${q.type === 'checkbox' ? 'selected' : ''}>Kotak Centang</option>
            <option value="dropdown" ${q.type === 'dropdown' ? 'selected' : ''}>Dropdown</option>
            <option value="rating" ${q.type === 'rating' ? 'selected' : ''}>Rating Bintang</option>
            <option value="date" ${q.type === 'date' ? 'selected' : ''}>Tanggal</option>
            <option value="time" ${q.type === 'time' ? 'selected' : ''}>Waktu</option>
            <option value="number" ${q.type === 'number' ? 'selected' : ''}>Angka</option>
          </select>
        </div>
      </div>

      <div class="question-card-middle">
        ${optionsHtml}
      </div>

      <div class="question-card-bottom">
        <label class="q-required-toggle">
          <span>Wajib diisi</span>
          <label class="switch">
            <input type="checkbox" class="q-required-check" ${q.required ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </label>

        <div class="q-actions-group">
          ${globalIndex > 0 ? `
            <button type="button" class="btn-q-icon move-up" title="Pindah ke Atas">
              <i data-lucide="chevron-up"></i>
            </button>
          ` : ''}
          ${globalIndex < this.questions.length - 1 ? `
            <button type="button" class="btn-q-icon move-down" title="Pindah ke Bawah">
              <i data-lucide="chevron-down"></i>
            </button>
          ` : ''}
          <button type="button" class="btn-q-icon duplicate" title="Duplikat Pertanyaan">
            <i data-lucide="copy"></i>
          </button>
          <button type="button" class="btn-q-icon delete" title="Hapus Pertanyaan">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;

    // Attach Drag and Drop handlers
    this.attachDragEvents(card, q.id);

    // Attach local card event listeners
    const titleInput = card.querySelector('.input-q-title');
    titleInput.addEventListener('input', (e) => {
      q.title = e.target.value;
    });

    const typeSelect = card.querySelector('.select-q-type');
    typeSelect.addEventListener('change', (e) => {
      q.type = e.target.value;
      if (['choice', 'checkbox', 'dropdown'].includes(q.type) && (!q.options || q.options.length === 0)) {
        q.options = ['Opsi 1', 'Opsi 2'];
      }
      this.renderQuestions();
    });

    const requiredCheck = card.querySelector('.q-required-check');
    requiredCheck.addEventListener('change', (e) => {
      q.required = e.target.checked;
    });

    // Options row modifications (with Excel / Google Sheets multi-line paste support)
    const optInputs = card.querySelectorAll('.input-option-text');
    optInputs.forEach((input, optIdx) => {
      input.addEventListener('input', (e) => {
        if (!q.options) q.options = [];
        q.options[optIdx] = e.target.value;
      });

      // Paste multiple items from Excel / Google Sheets
      input.addEventListener('paste', (e) => {
        const pasteData = (e.clipboardData || window.clipboardData).getData('text');
        if (pasteData && (pasteData.includes('\n') || pasteData.includes('\r'))) {
          e.preventDefault();
          const lines = pasteData
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(l => l.length > 0);

          if (lines.length > 0) {
            if (!q.options) q.options = [];
            // Replace current option with first line, and insert remaining lines
            q.options.splice(optIdx, 1, ...lines);
            this.renderQuestions();
            if (window.app && typeof window.app.showToast === 'function') {
              window.app.showToast(`Berhasil menempelkan ${lines.length} opsi dari Excel/Sheets!`, 'success');
            }
          }
        }
      });

      // Press Enter to create a new option row below and focus it
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!q.options) q.options = [];
          q.options.splice(optIdx + 1, 0, `Opsi ${q.options.length + 1}`);
          this.renderQuestions();

          // Focus the next option input
          setTimeout(() => {
            const currentCard = document.querySelector(`[data-question-id="${q.id}"]`);
            if (currentCard) {
              const inputs = currentCard.querySelectorAll('.input-option-text');
              if (inputs[optIdx + 1]) {
                inputs[optIdx + 1].focus();
                inputs[optIdx + 1].select();
              }
            }
          }, 60);
        }
      });
    });

    const btnRemoveOpts = card.querySelectorAll('.btn-remove-option');
    btnRemoveOpts.forEach((btn, optIdx) => {
      btn.addEventListener('click', () => {
        q.options.splice(optIdx, 1);
        this.renderQuestions();
      });
    });

    const btnAddOption = card.querySelector('.btn-add-option-row');
    if (btnAddOption) {
      btnAddOption.addEventListener('click', () => {
        if (!q.options) q.options = [];
        q.options.push(`Opsi ${q.options.length + 1}`);
        this.renderQuestions();
      });
    }

    // Card Actions (Duplicate, Delete, Move)
    const btnDuplicate = card.querySelector('.btn-q-icon.duplicate');
    btnDuplicate.addEventListener('click', () => {
      const cloned = JSON.parse(JSON.stringify(q));
      cloned.id = 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      this.questions.splice(globalIndex + 1, 0, cloned);
      this.renderQuestions();
    });

    const btnDelete = card.querySelector('.btn-q-icon.delete');
    btnDelete.addEventListener('click', () => {
      if (this.questions.length <= 1) {
        window.app.showToast('Formulir harus memiliki minimal satu pertanyaan', 'error');
        return;
      }
      this.questions.splice(globalIndex, 1);
      this.renderQuestions();
    });

    const btnMoveUp = card.querySelector('.btn-q-icon.move-up');
    if (btnMoveUp) {
      btnMoveUp.addEventListener('click', () => {
        const temp = this.questions[globalIndex];
        this.questions[globalIndex] = this.questions[globalIndex - 1];
        this.questions[globalIndex - 1] = temp;
        this.renderQuestions();
      });
    }

    const btnMoveDown = card.querySelector('.btn-q-icon.move-down');
    if (btnMoveDown) {
      btnMoveDown.addEventListener('click', () => {
        const temp = this.questions[globalIndex];
        this.questions[globalIndex] = this.questions[globalIndex + 1];
        this.questions[globalIndex + 1] = temp;
        this.renderQuestions();
      });
    }

    return card;
  }

  attachDragEvents(card, questionId) {
    const handle = card.querySelector('.card-drag-handle');

    handle.addEventListener('mousedown', () => {
      card.setAttribute('draggable', 'true');
    });

    document.addEventListener('mouseup', () => {
      card.setAttribute('draggable', 'false');
    });

    card.addEventListener('dragstart', (e) => {
      this.draggedQuestionId = questionId;
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', questionId);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      card.setAttribute('draggable', 'false');
      this.draggedQuestionId = null;
      document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      });
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!this.draggedQuestionId || this.draggedQuestionId === questionId) return;

      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;

      card.classList.remove('drag-over-top', 'drag-over-bottom');
      if (e.clientY < midY) {
        card.classList.add('drag-over-top');
      } else {
        card.classList.add('drag-over-bottom');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over-top', 'drag-over-bottom');

      if (!this.draggedQuestionId || this.draggedQuestionId === questionId) return;

      const sourceIndex = this.questions.findIndex(item => item.id === this.draggedQuestionId);
      const targetIndex = this.questions.findIndex(item => item.id === questionId);

      if (sourceIndex < 0 || targetIndex < 0) return;

      const rect = card.getBoundingClientRect();
      const insertBefore = e.clientY < rect.top + rect.height / 2;

      const [draggedItem] = this.questions.splice(sourceIndex, 1);
      
      // Update sectionId to target section
      const targetItem = this.questions.find(item => item.id === questionId);
      if (targetItem) {
        draggedItem.sectionId = targetItem.sectionId;
      }

      let newIndex = this.questions.findIndex(item => item.id === questionId);
      if (!insertBefore) {
        newIndex += 1;
      }

      this.questions.splice(newIndex, 0, draggedItem);
      this.renderQuestions();
      window.app.showToast('Urutan pertanyaan berhasil diubah', 'info');
    });
  }

  addQuestion(type = 'text', targetSectionId = null) {
    const secId = targetSectionId || (this.sections[this.sections.length - 1] ? this.sections[this.sections.length - 1].id : 'sec_1');
    const newQ = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      sectionId: secId,
      type,
      title: '',
      required: false
    };

    if (['choice', 'checkbox', 'dropdown'].includes(type)) {
      newQ.options = ['Opsi 1', 'Opsi 2'];
    }

    this.questions.push(newQ);
    this.renderQuestions();

    // Scroll to new question
    setTimeout(() => {
      const cards = this.questionsContainer.querySelectorAll('.question-card');
      const lastCard = cards[cards.length - 1];
      if (lastCard) {
        lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = lastCard.querySelector('.input-q-title');
        if (input) input.focus();
      }
    }, 50);
  }

  addSection() {
    const secNum = this.sections.length + 1;
    const newSec = {
      id: 'sec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: `Bagian ${secNum}`,
      description: ''
    };

    this.sections.push(newSec);

    // Also add a new default question in this section
    const newQ = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      sectionId: newSec.id,
      type: 'text',
      title: '',
      required: false
    };
    this.questions.push(newQ);

    this.renderQuestions();
    window.app.showToast(`Bagian ${secNum} berhasil ditambahkan!`, 'success');

    // Scroll to the new section card
    setTimeout(() => {
      const secCards = this.questionsContainer.querySelectorAll('.section-card');
      const lastSecCard = secCards[secCards.length - 1];
      if (lastSecCard) {
        lastSecCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = lastSecCard.querySelector('.input-section-title');
        if (input) input.focus();
      }
    }, 60);
  }

  async saveCurrentForm() {
    const title = this.titleInput.value.trim() || 'Formulir Tanpa Judul';
    const description = this.descInput.value.trim();

    // Active theme color
    let themeColor = '#6366f1';
    const activeSwatch = document.querySelector('.color-swatch.active');
    if (activeSwatch) {
      themeColor = activeSwatch.dataset.color;
    }

    const formData = {
      ...this.currentForm,
      title,
      description,
      themeColor,
      bannerUrl: this.headerImgInput.value.trim(),
      submitMessage: this.submitMsgInput.value.trim(),
      collectEmail: this.collectEmailCheck.checked,
      allowMultiple: this.allowMultipleCheck.checked,
      isActive: this.isActiveCheck.checked,
      sections: this.sections,
      questions: this.questions
    };

    try {
      const saved = await window.formStorage.saveForm(formData);
      this.currentForm = saved;
      this.statusBadge.textContent = 'Tersimpan';
      this.responsesTabLink.style.display = 'inline-flex';
      window.app.showToast('Formulir berhasil disimpan!', 'success');
      return saved;
    } catch (err) {
      console.error(err);
      window.app.showToast('Gagal menyimpan formulir: ' + err.message, 'error');
      return null;
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

window.FormBuilder = FormBuilder;
