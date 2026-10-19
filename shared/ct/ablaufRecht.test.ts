import { describe, expect, it } from 'vitest';
import { ablaufRechteAus, darfAblaufBearbeiten, terminAdminIds } from './ablaufRecht';
import { mapEventToService } from './mapEvent';
import { rechteAus } from './rechte';

/**
 * Wer darf einen Ablauf bearbeiten (#635, gemessen E6-0 am 17.10.2026)? Die Kette läuft wie in der App:
 * ChurchTools-Rechte → `rechteAus` → `ablaufRechteAus`, ChurchTools-Termin → `mapEventToService` → Regel.
 */
const fehler = (status: number, meldung: string) => new Error(`${status} ${meldung}`);
const rechte = (editAgenda: unknown, admin = false) =>
  ablaufRechteAus(
    rechteAus(
      {
        churchservice: { 'edit agenda': editAgenda },
        churchcore: { 'administer settings': admin },
      },
      'churchcore:administer settings',
      fehler,
    ),
  );
const termin = (kalender: string | undefined, admins: unknown = []) =>
  mapEventToService(
    {
      id: 7,
      name: 'GD',
      startDate: '2026-10-25T09:00:00Z',
      endDate: '2026-10-25T10:30:00Z',
      ...(kalender !== undefined ? { calendar: { domainIdentifier: kalender } } : {}),
      adminIds: admins,
      eventAdminIds: [],
    },
    0,
    null,
    'Europe/Berlin',
  );

describe('darfAblaufBearbeiten (#635)', () => {
  it('„Ablauf bearbeiten“ hängt am Kalender des Termins – nicht „irgendein Kalender“', () => {
    expect(darfAblaufBearbeiten(rechte([2]), termin('2'), 1)).toBe(true);
    expect(darfAblaufBearbeiten(rechte([1]), termin('2'), 1)).toBe(false);
    expect(darfAblaufBearbeiten(rechte([]), termin('2'), 1)).toBe(false);
  });

  it('Termin-Admin darf auch ganz ohne Kalender-Recht (gemessen: Spike an 166 → 201)', () => {
    expect(darfAblaufBearbeiten(rechte([]), termin('2', [19]), 19)).toBe(true);
    // Admin eines ANDEREN Termins bzw. jemand anderes – nein; unbekannte eigene Person zählt nie.
    expect(darfAblaufBearbeiten(rechte([]), termin('2', [19]), 49)).toBe(false);
    expect(darfAblaufBearbeiten(rechte([]), termin('2', [19]), null)).toBe(false);
  });

  it('Admin darf immer; Recht ohne Aufzählung (`true`) gilt für alle Kalender', () => {
    expect(darfAblaufBearbeiten(rechte([], true), termin('2'), 1)).toBe(true);
    expect(darfAblaufBearbeiten(rechte(true), termin('2'), 1)).toBe(true);
  });

  it('Kalender unbekannt (älterer Server): wie bisher genügt irgendein Recht – sonst wäre der Stift weg', () => {
    expect(termin(undefined).kalenderId).toBeUndefined();
    expect(darfAblaufBearbeiten(rechte([1]), termin(undefined), 1)).toBe(true);
    expect(darfAblaufBearbeiten(rechte([]), termin(undefined), 1)).toBe(false);
  });
});

describe('ablaufRechteAus', () => {
  it('kennt der Server `ablaufKalender` nicht (ältere Version), gilt `canEditAgendas` wie bisher', () => {
    const basis = { isAdmin: false, canEditAgendas: true };
    expect(ablaufRechteAus(basis)).toEqual({ isAdmin: false, ablaufKalender: null });
    expect(ablaufRechteAus({ ...basis, canEditAgendas: false })).toEqual({
      isAdmin: false,
      ablaufKalender: [],
    });
    expect(ablaufRechteAus({ ...basis, ablaufKalender: [3] }).ablaufKalender).toEqual([3]);
    // Rechte noch nicht geladen → nur als Termin-Admin (das hängt nicht an den Rechten, sondern am Termin).
    expect(darfAblaufBearbeiten(ablaufRechteAus(undefined), termin('2'), 1)).toBe(false);
    expect(darfAblaufBearbeiten(ablaufRechteAus(undefined), termin('2', [1]), 1)).toBe(true);
  });
});

describe('terminAdminIds', () => {
  it('beide Listen zusammen, ohne Doppelte; IDs als Text zählen, Unbrauchbares nicht', () => {
    expect(terminAdminIds({ adminIds: [19, 4], eventAdminIds: [19, '7', null, 'x', 1.5] })).toEqual(
      [19, 4, 7],
    );
    expect(terminAdminIds({})).toEqual([]);
    expect(terminAdminIds({ adminIds: 'nein' })).toEqual([]);
    expect(termin('2', [19]).terminAdminIds).toEqual([19]);
  });
});
