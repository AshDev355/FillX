function normalizeFieldValueClues(value) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isValidValueForField(field, value) {
  if (value === null || value === undefined || value === '') return false;

  const text = String(value).trim();
  const type = String(field?.type || '').toLowerCase();
  const autocomplete = normalizeFieldValueClues(field?.autocomplete);
  const semanticClues = normalizeFieldValueClues(
    `${field?.label || ''} ${field?.name || ''} ${field?.id || ''} ${field?.placeholder || ''} ${field?.ariaLabel || ''}`
  );

  if (type === 'email' || autocomplete === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
  }
  if (type === 'tel' || autocomplete === 'tel') {
    return text.replace(/\D/g, '').length >= 7;
  }
  if (type === 'date' || autocomplete === 'bday') {
    return /^\d{4}-\d{2}-\d{2}$/.test(text);
  }
  if (type === 'url') {
    return /^https?:\/\//i.test(text);
  }

  if (semanticClues.includes('username') || semanticClues.includes('user name')) {
    return !/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(text) &&
      !/^\S+@\S+\.\S+$/.test(text) && text.replace(/\D/g, '').length < 7;
  }

  if (semanticClues.includes('full name') || semanticClues.includes('first name') ||
      semanticClues.includes('last name') || semanticClues.includes('your name')) {
    return !/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(text);
  }

  return true;
}
