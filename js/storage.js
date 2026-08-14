/**
 * FORMCRAFT - Unified Storage & Data Layer
 * Provides CRUD operations for Forms and Responses across Firestore & LocalStorage fallback.
 */

class FormStorage {
  constructor() {
    this.LOCAL_FORMS_KEY = 'formcraft_local_forms';
    this.LOCAL_RESPONSES_KEY = 'formcraft_local_responses';
    this.ensureSeedData();
  }

  // Check if Firebase is active
  get isCloud() {
    return window.firebaseManager && window.firebaseManager.isConfigured && window.firebaseManager.db;
  }

  get db() {
    return window.firebaseManager.db;
  }

  // --- FORMS CRUD ---

  async getAllForms() {
    if (this.isCloud) {
      try {
        const snapshot = await this.db.collection('forms').orderBy('updatedAt', 'desc').get();
        const forms = [];
        snapshot.forEach(doc => {
          forms.push({ id: doc.id, ...doc.data() });
        });
        return forms;
      } catch (err) {
        console.warn('Firestore fetch failed, fallback to local:', err);
      }
    }
    return this.getLocalForms();
  }

  async getFormById(id) {
    if (this.isCloud) {
      try {
        const doc = await this.db.collection('forms').doc(id).get();
        if (doc.exists) {
          return { id: doc.id, ...doc.data() };
        }
      } catch (err) {
        console.warn('Firestore getFormById failed, fallback to local:', err);
      }
    }
    const forms = this.getLocalForms();
    return forms.find(f => f.id === id) || null;
  }

  async saveForm(formData) {
    const timestamp = new Date().toISOString();
    const id = formData.id || 'form_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    
    const record = {
      ...formData,
      id,
      updatedAt: timestamp,
      createdAt: formData.createdAt || timestamp
    };

    if (this.isCloud) {
      try {
        await this.db.collection('forms').doc(id).set(record, { merge: true });
      } catch (err) {
        console.error('Gagal menyimpan ke Firestore:', err);
      }
    }

    // Always keep a local copy as well
    const forms = this.getLocalForms();
    const index = forms.findIndex(f => f.id === id);
    if (index >= 0) {
      forms[index] = record;
    } else {
      forms.unshift(record);
    }
    localStorage.setItem(this.LOCAL_FORMS_KEY, JSON.stringify(forms));
    return record;
  }

  async deleteForm(id) {
    if (this.isCloud) {
      try {
        await this.db.collection('forms').doc(id).delete();
        // Also delete associated responses
        const respSnap = await this.db.collection('responses').where('formId', '==', id).get();
        const batch = this.db.batch();
        respSnap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      } catch (err) {
        console.error('Gagal menghapus form dari Firestore:', err);
      }
    }

    let forms = this.getLocalForms();
    forms = forms.filter(f => f.id !== id);
    localStorage.setItem(this.LOCAL_FORMS_KEY, JSON.stringify(forms));

    let responses = this.getLocalResponses();
    responses = responses.filter(r => r.formId !== id);
    localStorage.setItem(this.LOCAL_RESPONSES_KEY, JSON.stringify(responses));
    return true;
  }

  // --- RESPONSES CRUD ---

  async submitResponse(formId, answers, respondentEmail = null) {
    const timestamp = new Date().toISOString();
    const responseId = 'resp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    const email = respondentEmail || (answers && answers._respondent_email ? answers._respondent_email : null);

    const responseRecord = {
      id: responseId,
      formId,
      respondentEmail: email,
      answers,
      submittedAt: timestamp
    };

    if (this.isCloud) {
      try {
        await this.db.collection('responses').doc(responseId).set(responseRecord);
        // Increment responseCount on form doc
        const formRef = this.db.collection('forms').doc(formId);
        await formRef.update({
          responseCount: firebase.firestore.FieldValue.increment(1),
          lastResponseAt: timestamp
        });
      } catch (err) {
        console.error('Gagal mengirim respon ke Firestore:', err);
      }
    }

    // Local copy
    const responses = this.getLocalResponses();
    responses.push(responseRecord);
    localStorage.setItem(this.LOCAL_RESPONSES_KEY, JSON.stringify(responses));

    // Update local form response count
    const forms = this.getLocalForms();
    const form = forms.find(f => f.id === formId);
    if (form) {
      form.responseCount = (form.responseCount || 0) + 1;
      form.lastResponseAt = timestamp;
      localStorage.setItem(this.LOCAL_FORMS_KEY, JSON.stringify(forms));
    }

    return responseRecord;
  }

  async getResponsesByFormId(formId) {
    if (this.isCloud) {
      try {
        const snapshot = await this.db.collection('responses')
          .where('formId', '==', formId)
          .get();
        const results = [];
        snapshot.forEach(doc => {
          results.push({ id: doc.id, ...doc.data() });
        });
        // Sort descending by submittedAt
        results.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        return results;
      } catch (err) {
        console.warn('Gagal mengambil respon dari Firestore:', err);
      }
    }
    const responses = this.getLocalResponses();
    return responses
      .filter(r => r.formId === formId)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }

  async clearResponsesByFormId(formId) {
    if (this.isCloud) {
      try {
        const snapshot = await this.db.collection('responses').where('formId', '==', formId).get();
        const batch = this.db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        await this.db.collection('forms').doc(formId).update({
          responseCount: 0,
          lastResponseAt: null
        });
      } catch (err) {
        console.error('Error clear responses di Firestore:', err);
      }
    }

    let responses = this.getLocalResponses();
    responses = responses.filter(r => r.formId !== formId);
    localStorage.setItem(this.LOCAL_RESPONSES_KEY, JSON.stringify(responses));

    const forms = this.getLocalForms();
    const form = forms.find(f => f.id === formId);
    if (form) {
      form.responseCount = 0;
      form.lastResponseAt = null;
      localStorage.setItem(this.LOCAL_FORMS_KEY, JSON.stringify(forms));
    }
    return true;
  }

  // --- LOCAL HELPERS ---

  getLocalForms() {
    try {
      const data = localStorage.getItem(this.LOCAL_FORMS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  getLocalResponses() {
    try {
      const data = localStorage.getItem(this.LOCAL_RESPONSES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  // Initial template/seed form for fresh user experience
  ensureSeedData() {
    const existing = this.getLocalForms();
    if (!existing || existing.length === 0) {
      const sampleForm = {
        id: 'sample_customer_feedback',
        title: 'Survei Kepuasan Pengguna & Layanan',
        description: 'Mohon luangkan waktu 2 menit untuk mengisi survei ini guna meningkatkan kualitas produk kami.',
        themeColor: '#6366f1',
        bannerUrl: '',
        submitMessage: 'Terima kasih atas masukan berharga Anda!',
        allowMultiple: true,
        isActive: true,
        responseCount: 3,
        lastResponseAt: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        questions: [
          {
            id: 'q_1',
            type: 'text',
            title: 'Nama Lengkap Anda',
            required: true
          },
          {
            id: 'q_2',
            type: 'choice',
            title: 'Seberapa sering Anda menggunakan aplikasi kami?',
            required: true,
            options: ['Setiap Hari', 'Beberapa Kali Seminggu', 'Jarang', 'Pertama Kali']
          },
          {
            id: 'q_3',
            type: 'rating',
            title: 'Beri nilai kepuasan Anda terhadap kecepatan & kemudahan sistem',
            required: true
          },
          {
            id: 'q_4',
            type: 'checkbox',
            title: 'Fitur apa saja yang paling sering Anda gunakan?',
            required: false,
            options: ['Form Builder', 'Export Excel', 'Realtime Sync Firebase', 'Tema Kustom']
          },
          {
            id: 'q_5',
            type: 'paragraph',
            title: 'Saran dan masukan untuk pengembangan fitur selanjutnya',
            required: false
          }
        ]
      };

      const sampleResponses = [
        {
          id: 'resp_demo_1',
          formId: 'sample_customer_feedback',
          submittedAt: new Date(Date.now() - 86400000).toISOString(),
          answers: {
            'q_1': 'Budi Santoso',
            'q_2': 'Setiap Hari',
            'q_3': 5,
            'q_4': ['Form Builder', 'Export Excel'],
            'q_5': 'Sangat bagus, fitur export excel-nya sangat membantu pelaporan bulanan!'
          }
        },
        {
          id: 'resp_demo_2',
          formId: 'sample_customer_feedback',
          submittedAt: new Date(Date.now() - 43200000).toISOString(),
          answers: {
            'q_1': 'Siti Rahmawati',
            'q_2': 'Beberapa Kali Seminggu',
            'q_3': 4,
            'q_4': ['Export Excel', 'Realtime Sync Firebase'],
            'q_5': 'Tampilan antarmukanya sangat modern dan mudah digunakan dari HP.'
          }
        },
        {
          id: 'resp_demo_3',
          formId: 'sample_customer_feedback',
          submittedAt: new Date(Date.now() - 3600000).toISOString(),
          answers: {
            'q_1': 'Ahmad Fauzi',
            'q_2': 'Setiap Hari',
            'q_3': 5,
            'q_4': ['Form Builder', 'Export Excel', 'Tema Kustom'],
            'q_5': 'Proses submit cepat dan data langsung tersimpan aman.'
          }
        }
      ];

      localStorage.setItem(this.LOCAL_FORMS_KEY, JSON.stringify([sampleForm]));
      localStorage.setItem(this.LOCAL_RESPONSES_KEY, JSON.stringify(sampleResponses));
    }
  }
}

// Global instance
window.formStorage = new FormStorage();
