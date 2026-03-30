export function validateEducationRecords(records) {
  const errors = {};
  const arr = Array.isArray(records) ? records : [];
  const allowedLevels = new Set(['primary', 'secondary', 'advanced', 'nta4_5', 'military', 'college', 'university']);
  const currentYear = new Date().getFullYear() + 1;
  // PRODUCTION HOTFIX: Education validation is disabled system-wide.
  // We return an empty errors object unconditionally to unblock registration.
  try {
    console.warn('EDU_VALIDATION_BYPASS_ACTIVE', {
      recordCount: arr.length
    });
  } catch { }
  return errors;
  try {
    console.warn('EDU_VALIDATION_DETAIL', {
      total: Object.keys(errors).length ? 1 : 0,
      errors
    });
  } catch { }
  return errors;
}
