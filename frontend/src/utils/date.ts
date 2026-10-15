/**
 * Utilitários centralizados de formatação e manipulação de datas em Português do Brasil (pt-BR).
 * Garante padronização em todos os componentes do sistema e previne erros comuns de timezone / parsing.
 */

export const MESES_PT: Record<string, string> = {
  '01': 'Janeiro',
  '02': 'Fevereiro',
  '03': 'Março',
  '04': 'Abril',
  '05': 'Maio',
  '06': 'Junho',
  '07': 'Julho',
  '08': 'Agosto',
  '09': 'Setembro',
  '10': 'Outubro',
  '11': 'Novembro',
  '12': 'Dezembro',
};

export const MESES_PT_ABREV: Record<string, string> = {
  '01': 'Jan',
  '02': 'Fev',
  '03': 'Mar',
  '04': 'Abr',
  '05': 'Mai',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Ago',
  '09': 'Set',
  '10': 'Out',
  '11': 'Nov',
  '12': 'Dez',
};

/**
 * Converte com segurança diversos formatos de data (ISO, MySQL, timestamp, Date) para um objeto Date.
 */
export function parseDate(val: string | number | Date | null | undefined): Date | null {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim().replace(/^\[|\]$/g, '');
    if (!trimmed) return null;

    // Se for formato apenas data: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const parts = trimmed.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }

    // Se for formato MySQL: YYYY-MM-DD HH:mm:ss (substitui espaço por T para compatibilidade cross-browser)
    const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) return d;

    // Tentativa direta com o valor limpo (ex: PHP debug logs "15-Oct-2026 14:30:12 UTC")
    const directDate = new Date(trimmed);
    if (!isNaN(directDate.getTime())) return directDate;
  }

  return null;
}

/**
 * Formata apenas a data no padrão brasileiro: DD/MM/AAAA.
 * Exemplo: '2026-10-15' -> '15/10/2026'.
 */
export function formatDateOnly(val: string | number | Date | null | undefined, fallback: string = '—'): string {
  if (val === null || val === undefined || val === '') return fallback;

  // Se for string YYYY-MM-DD direta, inverte os campos sem risco de deslocamento de fuso horário
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    const [y, m, d] = val.trim().split('-');
    return `${d}/${m}/${y}`;
  }

  const d = parseDate(val);
  if (!d) return fallback;

  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();

  return `${dia}/${mes}/${ano}`;
}

/**
 * Formata data e hora no padrão brasileiro: DD/MM/AAAA HH:mm (ou DD/MM/AAAA às HH:mm).
 * Exemplo: '2026-10-15 14:30:00' -> '15/10/2026 14:30'.
 */
export function formatDateTime(
  val: string | number | Date | null | undefined,
  fallback: string = '—',
  options: { withAt?: boolean; includeSeconds?: boolean } = {}
): string {
  if (val === null || val === undefined || val === '') return fallback;

  const d = parseDate(val);
  if (!d) return typeof val === 'string' ? val : fallback;

  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();

  const horas = String(d.getHours()).padStart(2, '0');
  const minutos = String(d.getMinutes()).padStart(2, '0');

  const sep = options.withAt ? ' às ' : ' ';
  let timeStr = `${horas}:${minutos}`;

  if (options.includeSeconds) {
    const segundos = String(d.getSeconds()).padStart(2, '0');
    timeStr += `:${segundos}`;
  }

  return `${dia}/${mes}/${ano}${sep}${timeStr}`;
}

/**
 * Formata ciclo de mês/ano em português (ex: '2026-10' -> 'Outubro de 2026').
 */
export function formatMonthYear(
  val: string | Date | null | undefined,
  style: 'long' | 'short' = 'long',
  fallback: string = '—'
): string {
  if (!val) return fallback;

  let yyyy = '';
  let mm = '';

  if (typeof val === 'string') {
    const match = val.trim().match(/^(\d{4})-(\d{2})/);
    if (match) {
      yyyy = match[1];
      mm = match[2];
    }
  } else if (val instanceof Date && !isNaN(val.getTime())) {
    yyyy = String(val.getFullYear());
    mm = String(val.getMonth() + 1).padStart(2, '0');
  }

  if (!yyyy || !mm) return fallback;

  const monthName = style === 'short' ? (MESES_PT_ABREV[mm] ?? mm) : (MESES_PT[mm] ?? mm);
  return style === 'short' ? `${monthName}/${yyyy}` : `${monthName} de ${yyyy}`;
}

/**
 * Formata indicador de dias decorridos para os radares de segurança e integridade.
 */
export function formatRelativeDays(
  days: number | null | undefined,
  type: 'audit' | 'integrity' | 'generic' = 'audit'
): { label: string; isOutdated: boolean; badgeColor: string } {
  const isAudit = type === 'audit';
  const actionPast = isAudit ? 'Auditado' : 'Verificado';
  const actionNoun = isAudit ? 'auditoria' : 'checagem';
  const neverMsg = isAudit ? 'Nunca auditado' : 'Nunca verificado';

  if (days === null || days === undefined) {
    return {
      label: neverMsg,
      isOutdated: true,
      badgeColor: 'red',
    };
  }

  if (days === 0) {
    return {
      label: `${actionPast} hoje`,
      isOutdated: false,
      badgeColor: 'teal',
    };
  }

  if (days === 1) {
    return {
      label: `${actionPast} ontem`,
      isOutdated: false,
      badgeColor: 'teal',
    };
  }

  if (days < 30) {
    return {
      label: `${actionPast} há ${days}d`,
      isOutdated: false,
      badgeColor: 'gray',
    };
  }

  return {
    label: `+${days}d sem ${actionNoun}`,
    isOutdated: true,
    badgeColor: days > 60 ? 'red' : 'orange',
  };
}
