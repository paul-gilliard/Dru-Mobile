export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const DAY_NAMES_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function formatDateFR(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
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

export function round1(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return (Math.round(value * 10) / 10).toString();
}

export function jsWeekdayToBackend(jsDay: number): number {
  // JS: 0=dimanche..6=samedi -> backend: 0=lundi..6=dimanche
  return (jsDay + 6) % 7;
}
