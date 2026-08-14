/**
 * FORMCRAFT - Excel Export Engine
 * Converts Form Responses to structured, formatted Microsoft Excel (.xlsx) files using SheetJS.
 */

class ExcelExporter {
  static exportFormResponses(form, responses) {
    if (!window.XLSX) {
      alert('Library SheetJS belum termuat. Periksa koneksi internet Anda.');
      return false;
    }

    if (!form || !responses || responses.length === 0) {
      if (window.app) window.app.showToast('Tidak ada data respon untuk diekspor ke Excel', 'error');
      return false;
    }

    try {
      // 1. Prepare Header Row mapping
      const hasEmail = form.collectEmail || responses.some(r => !!r.respondentEmail || !!(r.answers && r.answers._respondent_email));
      const headers = ['No', 'ID Respon', 'Waktu Pengisian (WIB/Lokal)'];
      if (hasEmail) {
        headers.push('Email Responden');
      }

      const questionMap = []; // { id, title }
      form.questions.forEach((q, idx) => {
        const title = q.title || `Pertanyaan ${idx + 1}`;
        headers.push(title);
        questionMap.push({ id: q.id, title });
      });

      // 2. Prepare Data Rows
      const rows = [];
      responses.forEach((resp, index) => {
        const row = [];
        row.push(index + 1);
        row.push(resp.id || '-');
        
        // Format Date
        const dateStr = resp.submittedAt ? new Date(resp.submittedAt).toLocaleString('id-ID', {
          dateStyle: 'medium',
          timeStyle: 'medium'
        }) : '-';
        row.push(dateStr);

        // Email
        if (hasEmail) {
          const emailVal = resp.respondentEmail || (resp.answers && resp.answers._respondent_email) || '-';
          row.push(emailVal);
        }

        // Answers
        questionMap.forEach(q => {
          let ans = resp.answers ? resp.answers[q.id] : '';
          if (q.type === 'location' || (ans && typeof ans === 'object' && ans.lat)) {
            let locObj = ans;
            if (typeof locObj === 'string' && locObj.startsWith('{')) {
              try { locObj = JSON.parse(locObj); } catch(e){}
            }
            if (locObj && typeof locObj === 'object' && locObj.lat) {
              ans = `${locObj.lat}, ${locObj.lng} (https://www.google.com/maps?q=${locObj.lat},${locObj.lng})`;
            }
          } else if (q.type === 'signature' && typeof ans === 'string' && ans.startsWith('data:image')) {
            ans = '[Tanda Tangan Digital Terverifikasi]';
          } else if (Array.isArray(ans)) {
            ans = ans.join(', ');
          } else if (ans === undefined || ans === null) {
            ans = '-';
          }
          row.push(ans);
        });

        rows.push(row);
      });

      // 3. Create Worksheet and Workbook
      const worksheetData = [headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // 4. Auto-calculate Column Widths for professional look
      const colWidths = headers.map((header, colIdx) => {
        let maxLen = header.length;
        rows.forEach(r => {
          const val = r[colIdx] ? String(r[colIdx]) : '';
          if (val.length > maxLen) {
            maxLen = val.length;
          }
        });
        return { wch: Math.min(Math.max(maxLen + 4, 12), 45) };
      });
      worksheet['!cols'] = colWidths;

      // 5. Append sheet to Workbook
      const workbook = XLSX.utils.book_new();
      const sheetName = (form.title || 'Respon Form').substring(0, 30).replace(/[:\\\/\?\*\[\]]/g, '_');
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // 6. Generate filename with date
      const safeTitle = (form.title || 'Form_Responses')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 30);
      const today = new Date().toISOString().split('T')[0];
      const filename = `${safeTitle}_responses_${today}.xlsx`;

      // 7. Trigger download
      XLSX.writeFile(workbook, filename);

      if (window.app) {
        window.app.showToast(`Berhasil mengekspor ${responses.length} respon ke file ${filename}`, 'success');
      }
      return true;
    } catch (err) {
      console.error('Gagal mengekspor data ke Excel:', err);
      if (window.app) {
        window.app.showToast('Gagal mengekspor ke Excel: ' + err.message, 'error');
      }
      return false;
    }
  }
}

window.ExcelExporter = ExcelExporter;
