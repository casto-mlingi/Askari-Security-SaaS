export function validateEducationRecords(records) {
  const errors = {};
  const arr = Array.isArray(records) ? records : [];
  const allowedLevels = new Set(['primary','secondary','advanced','nta4_5','military','college','university']);
  const currentYear = new Date().getFullYear() + 1;
  arr.forEach((rec, idx) => {
    const level = (rec && rec.level) ? String(rec.level).trim() : '';
    const inst = (rec && rec.institution_name) ? String(rec.institution_name).trim() : '';
    const yearRaw = rec?.graduation_year != null ? String(rec.graduation_year) : (rec?.year != null ? String(rec.year) : '');
    const yearDigits = yearRaw.replace(/[^0-9]/g, '').slice(0,4);
    if (!level || !allowedLevels.has(level.toLowerCase())) {
      errors[`edu_level_${idx}`] = 'Select a valid education level.';
    }
    if (!inst || inst.length < 2 || inst.length > 100) {
      errors[`edu_institution_${idx}`] = 'Institution must be 2-100 characters.';
    }
    const yr = parseInt(yearDigits || '0', 10);
    if (!/^\d{4}$/.test(yearDigits) || yr < 1900 || yr > currentYear) {
      errors[`edu_year_${idx}`] = 'Enter a 4-digit year between 1900 and next year.';
    }
  });
  try {
    console.warn('EDU_VALIDATION_DETAIL', {
      total: Object.keys(errors).length ? 1 : 0,
      errors
    });
  } catch {}
  return errors;
}
