/**
 * Utilitário para decodificar entidades HTML e extrair mensagens de erro amigáveis
 */
export const decodeHtmlEntities = (text: string): string => {
  if (!text) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    return doc.documentElement.textContent || text;
  } catch {
    return text
      .replace(/&atilde;/gi, 'ã')
      .replace(/&Atilde;/gi, 'Ã')
      .replace(/&ccedil;/gi, 'ç')
      .replace(/&Ccedil;/gi, 'Ç')
      .replace(/&eacute;/gi, 'é')
      .replace(/&Eacute;/gi, 'É')
      .replace(/&ecirc;/gi, 'ê')
      .replace(/&Ecirc;/gi, 'Ê')
      .replace(/&iacute;/gi, 'í')
      .replace(/&Iacute;/gi, 'Í')
      .replace(/&oacute;/gi, 'ó')
      .replace(/&Oacute;/gi, 'Ó')
      .replace(/&ocirc;/gi, 'ô')
      .replace(/&Ocirc;/gi, 'Ô')
      .replace(/&otilde;/gi, 'õ')
      .replace(/&Otilde;/gi, 'Õ')
      .replace(/&uacute;/gi, 'ú')
      .replace(/&Uacute;/gi, 'Ú')
      .replace(/&aacute;/gi, 'á')
      .replace(/&Aacute;/gi, 'Á')
      .replace(/&agrave;/gi, 'à')
      .replace(/&Agrave;/gi, 'À')
      .replace(/&quot;/gi, '"')
      .replace(/&#039;/gi, "'")
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  }
};

export const extractErrorMessage = (err: any, fallback: string): string => {
  if (!err) return fallback;
  const resData = err.response?.data;
  let rawMsg = '';

  if (typeof resData === 'string' && resData.length > 0) {
    if (resData.includes('<html') || resData.includes('<!DOCTYPE')) {
      rawMsg = 'Erro interno temporário no servidor (HTTP 500). Verifique os logs da aplicação.';
    } else {
      rawMsg = resData;
    }
  } else if (resData?.messages?.error) {
    rawMsg = String(resData.messages.error);
  } else if (resData?.message) {
    rawMsg = String(resData.message);
  } else if (resData?.error) {
    rawMsg = String(resData.error);
  } else if (err.message && typeof err.message === 'string') {
    rawMsg = err.message;
  } else {
    rawMsg = fallback;
  }

  // Remove tags HTML remanescentes
  const stripped = rawMsg.replace(/<[^>]*>/g, ' ');
  // Decodifica entidades HTML como &atilde;, &ccedil;, etc.
  const decoded = decodeHtmlEntities(stripped);
  return decoded.replace(/\s+/g, ' ').trim();
};
