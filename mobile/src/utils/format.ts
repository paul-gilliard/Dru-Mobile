export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const DAY_NAMES_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function formatDateFR(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
}

/** Ex: « lundi 30 juillet 2026 » */
export function formatDateLongFR(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const weekday = DAY_NAMES[(d.getDay() + 6) % 7];
  return `${weekday} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Ex: « 30 juil. 2026 » */
export function formatDateMediumFR(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Ex: « 28 juil. → 3 août 2026 » */
export function formatDateRangeFR(startIso: string, endIso: string): string {
  const a = new Date(`${startIso}T12:00:00`);
  const b = new Date(`${endIso}T12:00:00`);
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = a.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' as const }),
  });
  const right = b.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${left} → ${right}`;
}

/** Ex: « juillet 2026 » */
export function formatMonthFR(isoOrYm: string): string {
  const iso = isoOrYm.length === 7 ? `${isoOrYm}-01` : isoOrYm;
  const d = new Date(`${iso}T12:00:00`);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Monday of the week containing iso (local). */
export function weekStartISO(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const day = (d.getDay() + 6) % 7; // 0=lun
  d.setDate(d.getDate() - day);
  return toLocalISO(d);
}

export function weekEndISO(iso: string): string {
  return shiftLocalISO(weekStartISO(iso), 6);
}

export function monthStartISO(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function monthEndISO(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return toLocalISO(end);
}

/** Local calendar date YYYY-MM-DD (avoid UTC shift from toISOString). */
export function toLocalISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toLocalISO(new Date());
}

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toLocalISO(d);
}

export function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
}

export function shiftLocalISO(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return toLocalISO(d);
}

export function shiftMonthISO(iso: string, deltaMonths: number): string {
  const d = new Date(`${monthStartISO(iso)}T12:00:00`);
  d.setMonth(d.getMonth() + deltaMonths);
  return toLocalISO(d);
}

export function round1(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return (Math.round(value * 10) / 10).toString();
}

export function jsWeekdayToBackend(jsDay: number): number {
  // JS: 0=dimanche..6=samedi -> backend: 0=lundi..6=dimanche
  return (jsDay + 6) % 7;
}
