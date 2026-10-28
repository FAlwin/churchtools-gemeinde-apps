import type { Service } from '@shared/types/index';

/**
 * **Wann ein Termin ist, in EINER Schreibweise** – „Sonntag, 01. Nov · 10:00“. Steht im Kopf des Ablaufs (`Setlist`)
 * und im Titel der Kopfkarte des Liedblatts (Scheibe B1); vorher stand die Formel nur im Ablauf – mit dem Liedblatt
 * wäre es die zweite Kopie geworden.
 */
export function terminZeile(service: Pick<Service, 'weekday' | 'day' | 'month' | 'time'>): string {
  return `${service.weekday}, ${service.day}. ${service.month} · ${service.time}`;
}
