/**
 * FORMCRAFT - Form Viewer / Respondent Logic
 * Handles multi-step Section wizard, live validation, progress bar,
 * and submitting responses to Firestore / LocalStorage.
 */

class FormViewer {
  constructor() {
    this.currentForm = null;
    this.sections = [];
    this.currentStep = 0;
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

    // Section progress elements
    this.progressWrap = document.getElementById('form-section-progress-wrap');
    this.progressText = document.getElementById('section-progress-text');
    this.progressPct = document.getElementById('section-progress-percent');
    this.progressBar = document.getElementById('section-progress-bar');

    // Step Nav Buttons
    this.btnPrevStep = document.getElementById('btn-prev-step');
    this.btnNextStep = document.getElementById('btn-next-step');
    this.btnSubmitResponse = document.getElementById('btn-submit-response');
  }

  bindEvents() {
    if (this.formElement) {
      this.formElement.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSubmit();
      });
    }

    if (this.btnNextStep) {
      this.btnNextStep.addEventListener('click', () => {
        this.handleNextStep();
      });
    }

    if (this.btnPrevStep) {
      this.btnPrevStep.addEventListener('click', () => {
        this.handlePrevStep();
      });
    }

    const btnReset = document.getElementById('btn-reset-form');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin mengosongkan seluruh jawaban?')) {
          this.resetAnswers();
        }
      });
    }

    if (this.btnSubmitAnother) {
      this.btnSubmitAnother.addEventListener('click', () => {
        this.resetAnswers();
        if (this.successCard) this.successCard.classList.add('hidden');
        if (this.formElement) this.formElement.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  async loadForm(formId) {
    this.answers = {};
    this.currentStep = 0;
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

    // Standardize sections
    if (!form.sections || form.sections.length === 0) {
      this.sections = [{ id: 'sec_1', title: form.title || 'Bagian 1', description: form.description || '' }];
    } else {
      this.sections = form.sections;
    }

    // Standardize questions sectionId
    const firstSecId = this.sections[0].id;
    (this.currentForm.questions || []).forEach(q => {
      if (!q.sectionId) q.sectionId = firstSecId;
    });

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

    this.renderCurrentStep();
  }

  renderCurrentStep() {
    const totalSteps = this.sections.length;
    const isMultiStep = totalSteps > 1;
    const currentSec = this.sections[this.currentStep] || this.sections[0];

    // Progress Bar
    if (isMultiStep) {
      this.progressWrap.classList.remove('hidden');
      const pct = Math.round(((this.currentStep + 1) / totalSteps) * 100);
      this.progressText.textContent = `Bagian ${this.currentStep + 1} dari ${totalSteps}`;
      this.progressPct.textContent = `${pct}%`;
      this.progressBar.style.width = `${pct}%`;
    } else {
      this.progressWrap.classList.add('hidden');
    }

    // Buttons Visibility
    if (isMultiStep) {
      if (this.currentStep === 0) {
        this.btnPrevStep.classList.add('hidden');
        this.btnNextStep.classList.remove('hidden');
        this.btnSubmitResponse.classList.add('hidden');
      } else if (this.currentStep < totalSteps - 1) {
        this.btnPrevStep.classList.remove('hidden');
        this.btnNextStep.classList.remove('hidden');
        this.btnSubmitResponse.classList.add('hidden');
      } else {
        // Last step
        this.btnPrevStep.classList.remove('hidden');
        this.btnNextStep.classList.add('hidden');
        this.btnSubmitResponse.classList.remove('hidden');
      }
    } else {
      this.btnPrevStep.classList.add('hidden');
      this.btnNextStep.classList.add('hidden');
      this.btnSubmitResponse.classList.remove('hidden');
    }

    // Render questions for current section
    this.questionsContainer.innerHTML = '';

    // If step > 0 in multi-step form, render Section Header Card
    if (isMultiStep && this.currentStep > 0 && currentSec) {
      const secHeaderCard = document.createElement('div');
      secHeaderCard.className = 'glass-card live-section-header-card';
      secHeaderCard.innerHTML = `
        <div class="live-sec-badge">
          <i data-lucide="layers"></i>
          <span>Bagian ${this.currentStep + 1} dari ${totalSteps}</span>
        </div>
        <h2 class="live-sec-title">${this.escapeHtml(currentSec.title || `Bagian ${this.currentStep + 1}`)}</h2>
        ${currentSec.description ? `<p class="live-sec-desc">${this.escapeHtml(currentSec.description)}</p>` : ''}
      `;
      this.questionsContainer.appendChild(secHeaderCard);
    }

    // If collectEmail is enabled and we are on step 0 (Section 1), render standard Email Collector card at top
    if (this.currentForm.collectEmail && this.currentStep === 0) {
      const emailCard = document.createElement('div');
      emailCard.className = 'live-question-card glass-card live-email-card';
      emailCard.id = 'live-email-card';
      emailCard.innerHTML = `
        <div class="live-q-header">
          <div class="live-q-title">
            Email <span class="live-q-required-mark">*</span>
          </div>
          <div class="live-email-hint">Alamat email pengisi formulir</div>
        </div>
        <div class="live-email-input-wrap">
          <input type="email" id="live-respondent-email" class="input-text live-input-text" placeholder="nama@email.com" autocomplete="email" required value="${this.escapeHtml(this.respondentEmail || '')}">
        </div>
      `;
      this.questionsContainer.appendChild(emailCard);
    }

    const stepQuestions = isMultiStep 
      ? (this.currentForm.questions || []).filter(q => q.sectionId === currentSec.id)
      : (this.currentForm.questions || []);

    if (stepQuestions.length === 0 && !(this.currentForm.collectEmail && this.currentStep === 0)) {
      const emptyNotice = document.createElement('div');
      emptyNotice.className = 'glass-card';
      emptyNotice.style.padding = '24px';
      emptyNotice.style.textAlign = 'center';
      emptyNotice.style.color = 'var(--text-muted)';
      emptyNotice.innerHTML = '<p>Tidak ada pertanyaan pada bagian ini.</p>';
      this.questionsContainer.appendChild(emptyNotice);
    } else {
      stepQuestions.forEach((q, index) => {
        const card = this.renderQuestionItem(q, index);
        this.questionsContainer.appendChild(card);
      });
    }

    // Restore previously saved answers for this step
    this.restoreAnswersForCurrentStep(stepQuestions);

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
          ${options.map(opt => {
            const optText = typeof opt === 'object' ? (opt.text || '') : opt;
            const optImg = typeof opt === 'object' ? (opt.imageUrl || '') : '';
            return `
              <label class="live-choice-label ${optImg ? 'has-opt-img' : ''}">
                <input type="radio" name="${qName}" value="${this.escapeHtml(optText)}">
                <span class="custom-radio"></span>
                <div class="choice-content-wrap">
                  ${optImg ? `
                    <div class="live-opt-img-box">
                      <img src="${this.escapeHtml(optImg)}" alt="${this.escapeHtml(optText)}" class="live-opt-img" loading="lazy">
                    </div>
                  ` : ''}
                  <span class="choice-text">${this.escapeHtml(optText)}</span>
                </div>
              </label>
            `;
          }).join('')}
        </div>
      `;
    } else if (q.type === 'checkbox') {
      const options = q.options || ['Opsi 1'];
      inputHtml = `
        <div class="live-options-group">
          ${options.map(opt => {
            const optText = typeof opt === 'object' ? (opt.text || '') : opt;
            const optImg = typeof opt === 'object' ? (opt.imageUrl || '') : '';
            return `
              <label class="live-choice-label custom-checkbox-label ${optImg ? 'has-opt-img' : ''}">
                <input type="checkbox" name="${qName}" value="${this.escapeHtml(optText)}">
                <span class="custom-box"></span>
                <div class="choice-content-wrap">
                  ${optImg ? `
                    <div class="live-opt-img-box">
                      <img src="${this.escapeHtml(optImg)}" alt="${this.escapeHtml(optText)}" class="live-opt-img" loading="lazy">
                    </div>
                  ` : ''}
                  <span class="choice-text">${this.escapeHtml(optText)}</span>
                </div>
              </label>
            `;
          }).join('')}
        </div>
      `;
    } else if (q.type === 'dropdown') {
      const options = q.options || ['Opsi 1'];
      inputHtml = `
        <select class="live-select" name="${qName}">
          <option value="">-- Pilih Jawaban --</option>
          ${options.map(opt => {
            const optText = typeof opt === 'object' ? (opt.text || '') : opt;
            return `<option value="${this.escapeHtml(optText)}">${this.escapeHtml(optText)}</option>`;
          }).join('')}
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
    } else if (q.type === 'location') {
      inputHtml = `
        <div class="live-location-picker" data-question-id="${q.id}">
          <div class="location-action-bar">
            <button type="button" class="btn btn-secondary btn-detect-gps" id="btn-gps-${q.id}">
              <i data-lucide="navigation"></i>
              <span class="btn-gps-text">Ambil Titik Lokasi GPS Rumah</span>
            </button>
            <div class="gps-searching-indicator hidden">
              <span class="pulse-dot"></span>
              <span>Mencari sinyal satelit GPS...</span>
            </div>
          </div>

          <div class="location-result-card hidden" id="gps-result-${q.id}">
            <div class="location-coords-badge">
              <div class="coords-icon-wrap">
                <i data-lucide="map-pin"></i>
              </div>
              <div class="coords-info">
                <div class="coords-title">Titik Koordinat Terekam</div>
                <strong class="coords-latlng">-</strong>
                <div class="coords-accuracy-tag">Akurasi: ± - m</div>
              </div>
            </div>
            <div class="location-map-actions">
              <a href="#" target="_blank" class="btn btn-secondary btn-xs btn-open-gmaps" title="Buka Titik Koordinat di Google Maps">
                <i data-lucide="external-link"></i>
                <span>Lihat di Google Maps</span>
              </a>
              <button type="button" class="btn btn-ghost btn-xs text-danger btn-reset-gps" title="Ulangi Deteksi Lokasi">
                <i data-lucide="rotate-ccw"></i>
                <span>Ulangi Ambil Lokasi</span>
              </button>
            </div>
          </div>
          <input type="hidden" name="${qName}" class="input-gps-hidden" value="">
        </div>
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
      ${q.imageUrl ? `
        <div class="live-q-image-container">
          <img src="${this.escapeHtml(q.imageUrl)}" alt="${this.escapeHtml(q.title || 'Ilustrasi Soal')}" class="live-q-image" loading="lazy">
        </div>
      ` : ''}
      <div class="live-q-body">
        ${inputHtml}
      </div>
      <div class="error-msg">Pertanyaan ini wajib diisi.</div>
    `;

    // Location / GPS Capture Handler
    if (q.type === 'location') {
      const btnDetect = card.querySelector('.btn-detect-gps');
      const btnGpsText = card.querySelector('.btn-gps-text');
      const indicator = card.querySelector('.gps-searching-indicator');
      const resultCard = card.querySelector('.location-result-card');
      const coordsText = card.querySelector('.coords-latlng');
      const accuracyTag = card.querySelector('.coords-accuracy-tag');
      const btnGmaps = card.querySelector('.btn-open-gmaps');
      const btnResetGps = card.querySelector('.btn-reset-gps');
      const hiddenInput = card.querySelector('.input-gps-hidden');

      const applyLocationData = (locData) => {
        if (!locData || !locData.lat) return;
        this.answers[q.id] = locData;
        hiddenInput.value = JSON.stringify(locData);
        coordsText.textContent = `${locData.lat.toFixed(6)}, ${locData.lng.toFixed(6)}`;
        accuracyTag.textContent = `Akurasi GPS: ± ${Math.round(locData.accuracy || 0)} meter`;
        btnGmaps.href = locData.mapsUrl || `https://www.google.com/maps?q=${locData.lat},${locData.lng}`;
        resultCard.classList.remove('hidden');
        btnDetect.classList.add('hidden');
        card.classList.remove('has-error');
        if (window.lucide) window.lucide.createIcons();
      };

      if (btnDetect) {
        btnDetect.addEventListener('click', () => {
          if (!navigator.geolocation) {
            alert('Perangkat atau browser Anda tidak mendukung fitur Geolocation GPS.');
            return;
          }

          btnDetect.disabled = true;
          if (btnGpsText) btnGpsText.textContent = 'Mendeteksi koordinat...';
          if (indicator) indicator.classList.remove('hidden');

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              btnDetect.disabled = false;
              if (btnGpsText) btnGpsText.textContent = 'Ambil Titik Lokasi GPS Rumah';
              if (indicator) indicator.classList.add('hidden');

              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              const accuracy = pos.coords.accuracy;
              const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

              const locData = {
                lat,
                lng,
                accuracy,
                mapsUrl,
                capturedAt: new Date().toISOString()
              };

              applyLocationData(locData);
              if (window.app && typeof window.app.showToast === 'function') {
                window.app.showToast(`Lokasi GPS berhasil terekam (Akurasi: ±${Math.round(accuracy)}m)`, 'success');
              }
            },
            (err) => {
              btnDetect.disabled = false;
              if (btnGpsText) btnGpsText.textContent = 'Ambil Titik Lokasi GPS Rumah';
              if (indicator) indicator.classList.add('hidden');

              let errorMsg = 'Gagal mengakses GPS.';
              switch (err.code) {
                case err.PERMISSION_DENIED:
                  errorMsg = 'Izin akses lokasi ditolak. Silakan izinkan akses lokasi/GPS pada pengaturan browser atau HP Anda.';
                  break;
                case err.POSITION_UNAVAILABLE:
                  errorMsg = 'Informasi lokasi GPS tidak tersedia. Pastikan fitur Lokasi di HP Anda telah aktif.';
                  break;
                case err.TIMEOUT:
                  errorMsg = 'Waktu permintaan GPS habis. Silakan coba tekan tombol ambil lokasi kembali.';
                  break;
              }
              alert(errorMsg);
              if (window.app && typeof window.app.showToast === 'function') {
                window.app.showToast(errorMsg, 'error');
              }
            },
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0
            }
          );
        });
      }

      if (btnResetGps) {
        btnResetGps.addEventListener('click', () => {
          delete this.answers[q.id];
          hiddenInput.value = '';
          resultCard.classList.add('hidden');
          btnDetect.classList.remove('hidden');
        });
      }
    }

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

    // Input listeners to clear error state and sync answers
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

  restoreAnswersForCurrentStep(questions) {
    questions.forEach(q => {
      const savedVal = this.answers[q.id];
      if (savedVal === undefined || savedVal === null) return;

      const qCard = this.questionsContainer.querySelector(`[data-question-id="${q.id}"]`);
      if (!qCard) return;
      const qName = `q_${q.id}`;

      if (q.type === 'location') {
        const coordsText = qCard.querySelector('.coords-latlng');
        const accuracyTag = qCard.querySelector('.coords-accuracy-tag');
        const btnGmaps = qCard.querySelector('.btn-open-gmaps');
        const resultCard = qCard.querySelector('.location-result-card');
        const btnDetect = qCard.querySelector('.btn-detect-gps');
        const hiddenInput = qCard.querySelector('.input-gps-hidden');

        if (coordsText && typeof savedVal === 'object' && savedVal.lat) {
          coordsText.textContent = `${savedVal.lat.toFixed(6)}, ${savedVal.lng.toFixed(6)}`;
          if (accuracyTag) accuracyTag.textContent = `Akurasi GPS: ± ${Math.round(savedVal.accuracy || 0)} meter`;
          if (btnGmaps) btnGmaps.href = savedVal.mapsUrl || `https://www.google.com/maps?q=${savedVal.lat},${savedVal.lng}`;
          if (hiddenInput) hiddenInput.value = JSON.stringify(savedVal);
          if (resultCard) resultCard.classList.remove('hidden');
          if (btnDetect) btnDetect.classList.add('hidden');
          if (window.lucide) window.lucide.createIcons();
        }
      } else if (q.type === 'choice') {
        const radio = qCard.querySelector(`input[name="${qName}"][value="${CSS.escape(savedVal)}"]`);
        if (radio) radio.checked = true;
      } else if (q.type === 'checkbox' && Array.isArray(savedVal)) {
        savedVal.forEach(v => {
          const cb = qCard.querySelector(`input[name="${qName}"][value="${CSS.escape(v)}"]`);
          if (cb) cb.checked = true;
        });
      } else if (q.type === 'rating') {
        const hiddenInput = qCard.querySelector(`input[name="${qName}"]`);
        if (hiddenInput) hiddenInput.value = savedVal;
        const starBtns = qCard.querySelectorAll('.rating-star-btn');
        starBtns.forEach(s => {
          const sVal = parseInt(s.dataset.value, 10);
          s.classList.toggle('active', sVal <= savedVal);
        });
      } else {
        const input = qCard.querySelector(`[name="${qName}"]`);
        if (input) input.value = savedVal;
      }
    });
  }

  collectCurrentStepAnswers() {
    let isValid = true;
    let firstErrorElement = null;
    const currentSec = this.sections[this.currentStep] || this.sections[0];
    const isMultiStep = this.sections.length > 1;
    const stepQuestions = isMultiStep 
      ? (this.currentForm.questions || []).filter(q => q.sectionId === currentSec.id)
      : (this.currentForm.questions || []);

    // Validate email if collectEmail is true on step 0
    if (this.currentForm.collectEmail && this.currentStep === 0) {
      const emailInput = document.getElementById('live-respondent-email');
      const emailCard = document.getElementById('live-email-card');
      const emailVal = emailInput ? emailInput.value.trim() : '';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailVal || !emailRegex.test(emailVal)) {
        isValid = false;
        if (emailCard) {
          emailCard.classList.add('has-error');
          if (!firstErrorElement) firstErrorElement = emailCard;
        }
      } else {
        if (emailCard) emailCard.classList.remove('has-error');
        this.respondentEmail = emailVal;
        this.answers._respondent_email = emailVal;
      }
    }

    stepQuestions.forEach(q => {
      const qCard = this.questionsContainer.querySelector(`[data-question-id="${q.id}"]`);
      if (!qCard) return;
      const qName = `q_${q.id}`;
      let val = null;

      if (q.type === 'choice') {
        const checked = qCard.querySelector(`input[name="${qName}"]:checked`);
        val = checked ? checked.value : '';
      } else if (q.type === 'checkbox') {
        const checkedList = qCard.querySelectorAll(`input[name="${qName}"]:checked`);
        val = Array.from(checkedList).map(el => el.value);
        if (val.length === 0) val = [];
      } else if (q.type === 'location' || q.type === 'rating') {
        val = this.answers[q.id] || null;
      } else {
        const input = qCard.querySelector(`[name="${qName}"]`);
        val = input ? input.value.trim() : '';
      }

      // Validate required
      let isEmpty = false;
      if (q.required) {
        if (q.type === 'location' && (!val || !val.lat)) {
          isEmpty = true;
        } else if (q.type === 'checkbox' && (!val || val.length === 0)) {
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

      this.answers[q.id] = val;
    });

    if (!isValid && firstErrorElement) {
      firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (firstErrorElement.id === 'live-email-card') {
        window.app.showToast('Harap masukkan alamat email yang valid', 'error');
        const emailInput = document.getElementById('live-respondent-email');
        if (emailInput) emailInput.focus();
      } else {
        window.app.showToast('Harap lengkapi semua pertanyaan wajib pada bagian ini', 'error');
      }
      return false;
    }

    return true;
  }

  handleNextStep() {
    if (!this.collectCurrentStepAnswers()) return;

    if (this.currentStep < this.sections.length - 1) {
      this.currentStep++;
      this.renderCurrentStep();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  handlePrevStep() {
    // Save current step data without strict required validation when navigating back
    const currentSec = this.sections[this.currentStep] || this.sections[0];
    const isMultiStep = this.sections.length > 1;
    const stepQuestions = isMultiStep 
      ? (this.currentForm.questions || []).filter(q => q.sectionId === currentSec.id)
      : (this.currentForm.questions || []);

    stepQuestions.forEach(q => {
      const qCard = this.questionsContainer.querySelector(`[data-question-id="${q.id}"]`);
      if (!qCard) return;
      const qName = `q_${q.id}`;
      if (q.type === 'choice') {
        const checked = qCard.querySelector(`input[name="${qName}"]:checked`);
        if (checked) this.answers[q.id] = checked.value;
      } else if (q.type === 'checkbox') {
        const checkedList = qCard.querySelectorAll(`input[name="${qName}"]:checked`);
        this.answers[q.id] = Array.from(checkedList).map(el => el.value);
      } else if (q.type !== 'rating') {
        const input = qCard.querySelector(`[name="${qName}"]`);
        if (input) this.answers[q.id] = input.value.trim();
      }
    });

    if (this.currentStep > 0) {
      this.currentStep--;
      this.renderCurrentStep();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async handleSubmit() {
    if (!this.collectCurrentStepAnswers()) return;

    const btnSubmit = document.getElementById('btn-submit-response');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>Mengirim tanggapan...</span>';

    try {
      await window.formStorage.submitResponse(this.currentForm.id, this.answers, this.respondentEmail);
      
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
    this.respondentEmail = '';
    this.currentStep = 0;
    this.renderCurrentStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
