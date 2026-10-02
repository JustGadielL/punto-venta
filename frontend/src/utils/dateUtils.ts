export const parseLocalDate = (dateStr: string | null | undefined): Date => {
  if (!dateStr) return new Date();
  // If the date string from SQLite doesn't have timezone info (no Z or +), it's UTC from CURRENT_TIMESTAMP
  // By appending 'Z', Javascript will parse it as UTC and convert it to the local timezone correctly.
  if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('T')) {
    // SQLite usually returns "YYYY-MM-DD HH:MM:SS"
    return new Date(dateStr.replace(' ', 'T') + 'Z');
  }
  return new Date(dateStr);
};

export const formatTime = (dateStr: string | null | undefined): string => {
  return parseLocalDate(dateStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (dateStr: string | null | undefined): string => {
  return parseLocalDate(dateStr).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const formatDateTime = (dateStr: string | null | undefined): string => {
  return parseLocalDate(dateStr).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
};
