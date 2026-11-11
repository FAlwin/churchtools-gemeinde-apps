import { describe, expect, it } from 'vitest';
import { bisDahin, planenZeitraum, startUebersicht, NAECHSTE_DIENSTE } from './start';
import { zeile, mein } from './zeile.testutil';

const TECHNIK = { id: 3, name: 'Technik', fuerAlle: false };
const MUSIK = { id: 4, name: 'Musik', fuerAlle: false };
const JETZT = new Date('2026-10-14T12:00:00Z');
const O = { jetzt: JETZT, heute: '2026-10-14', planbar: [TECHNIK, MUSIK] };

describe('startUebersicht', () => {
  it('Als Nächstes: der erste nicht vorbei und nicht abgesagte Termin – auch ohne eigenen Dienst', () => {
    const z = [
      zeile(1, 'Vorbei', '2026-10-14', { ende: '2026-10-14T11:00:00Z' }),
      zeile(2, 'Abgesagt', '2026-10-15', { abgesagt: true }),
      zeile(3, 'Gebetsabend', '2026-10-16'),
      zeile(4, 'Gottesdienst', '2026-10-18'),
    ];
    expect(startUebersicht(z, O).naechster?.id).toBe(3);
  });

  it('ein Termin, der gerade läuft, ist noch „als Nächstes“', () => {
    const z = [zeile(1, 'Läuft', '2026-10-14', { ende: '2026-10-14T13:00:00Z' })];
    expect(startUebersicht(z, O).naechster?.id).toBe(1);
  });

  it('Für dich offen = angefragt; nächste Dienste = zugesagt ohne den Termin oben, höchstens vier', () => {
    const z = [
      zeile(1, 'A', '2026-10-15', { meine: [mein('Ton', true)] }),
      zeile(2, 'B', '2026-10-16', { meine: [mein('Gesang', false)] }),
      ...[3, 4, 5, 6, 7].map((id) =>
        zeile(id, 'G', `2026-10-${16 + id}`, { meine: [mein('Licht', true)] }),
      ),
    ];
    const u = startUebersicht(z, O);
    expect(u.offen.map((d) => [d.termin.id, d.dienst])).toEqual([[2, 'Gesang']]);
    expect(u.naechsteDienste.map((d) => d.termin.id)).toEqual([3, 4, 5, 6]);
    expect(u.naechsteDienste).toHaveLength(NAECHSTE_DIENSTE);
  });

  it('eben beantwortet (E7-1) bleibt unter „offen“ – auch eine Zusage –, nicht unter „nächste Dienste“', () => {
    const antwort = {
      art: 'zugesagt' as const,
      seit: 0,
      letzte: null,
      mein: mein('Gesang', false),
    };
    const z = [zeile(2, 'B', '2026-10-16', { meine: [mein('Gesang', true, { antwort })] })];
    const u = startUebersicht(z, O);
    expect(u.offen.map((d) => d.dienst)).toEqual(['Gesang']);
    expect(u.naechsteDienste).toEqual([]);
  });

  it('Planen: freie Plätze je geplanter Gruppe in den nächsten 6 Wochen; abgesagte zählen nicht', () => {
    const z = [
      zeile(1, 'A', '2026-10-18', { freiNachGruppe: { 3: 2, 4: 1 } }),
      zeile(2, 'B', '2026-11-24', { freiNachGruppe: { 3: 1 } }),
      zeile(3, 'C', '2026-11-25', { freiNachGruppe: { 3: 5 } }),
      zeile(4, 'D', '2026-10-20', { freiNachGruppe: { 3: 9 }, abgesagt: true }),
    ];
    expect(startUebersicht(z, O).planen).toEqual([
      { gruppe: TECHNIK, frei: 3 },
      { gruppe: MUSIK, frei: 1 },
    ]);
  });

  it('ohne Termine: nichts als Nächstes, leere Listen, Planen mit 0', () => {
    expect(startUebersicht([], O)).toEqual({
      naechster: null,
      offen: [],
      naechsteDienste: [],
      planen: [
        { gruppe: TECHNIK, frei: 0 },
        { gruppe: MUSIK, frei: 0 },
      ],
    });
  });
});

describe('bisDahin', () => {
  it('heute, morgen, in N Tagen', () => {
    expect(bisDahin('2026-10-14', '2026-10-14')).toBe('heute');
    expect(bisDahin('2026-10-14', '2026-10-15')).toBe('morgen');
    expect(bisDahin('2026-10-14', '2026-10-18')).toBe('in 4 Tagen');
  });
});

describe('planenZeitraum – dieselben Tage wie die Karte „Planen“ (Wunsch 7)', () => {
  it('von heute bis zum letzten Tag, den die Karte noch zählt – der Tag danach zählt nicht', () => {
    const zr = planenZeitraum(O.heute);
    expect(zr).toEqual({ art: 'eigen', von: '2026-10-14', bis: '2026-11-24' });
    if (zr.art !== 'eigen') throw new Error('eigen erwartet');
    // Gegen die Zählung der Karte geprüft, nicht gegen eine Zahl: der letzte Tag zählt, der nächste nicht.
    const frei = (tag: string) =>
      startUebersicht([zeile(1, 'G', tag, { freiNachGruppe: { 3: 1 } })], O).planen[0].frei;
    expect(frei(zr.bis)).toBe(1);
    expect(frei('2026-11-25')).toBe(0);
  });
});
