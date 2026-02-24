export function validateEducationRecords(records) {
  const errors = {};
  const arr = Array.isArray(records) ? records : [];
  arr.forEach((rec, idx) => {
    const level = (rec && rec.level) ? String(rec.level).trim() : '';
    const inst = (rec && rec.institution_name) ? String(rec.institution_name).trim() : '';
    const year = (rec && rec.year) != null ? String(rec.year).trim() : '';
    const start = (rec && rec.start_date) ? String(rec.start_date).trim() : '';
    const end = (rec && rec.end_date) ? String(rec.end_date).trim() : '';
    const cert = (rec && rec.certificate_url) ? String(rec.certificate_url).trim() : '';
    const touched = !!(level || inst || year || start || end || cert);
    if (!touched) return;
    if (!level) {
      errors[`edu_level_${idx}`] = 'This field is required.';
    }
    if (!inst) {
      errors[`edu_institution_${idx}`] = 'This field is required.';
    }
    const hasYear = !!year;
    const hasRange = !!(start && end);
    if (!hasYear && !hasRange) {
      errors[`edu_year_${idx}`] = 'Provide completion year or start/end dates.';
    }
    if (hasYear) {
      const y = year.replace(/[^0-9]/g, '');
      if (y.length !== 4) {
        errors[`edu_year_${idx}`] = 'Enter a valid 4-digit year.';
      }
    }
    if (start && end) {
      try {
        const s = new Date(start).getTime();
        const e = new Date(end).getTime();
        if (!Number.isNaN(s) && !Number.isNaN(e) && e < s) {
          errors[`edu_end_${idx}`] = 'End date cannot be before start date.';
        }
      } catch {}
    }
  });
  try {
    console.warn('EDU_VALIDATION_DETAIL', {
      total: arr.length,
      errors
    });
  } catch {}
  return errors;
}
