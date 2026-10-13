import { describe, expect, it } from 'vitest';
import { bisDahin, startUebersicht, NAECHSTE_DIENSTE } from './start';
import { zeile } from './zeile.testutil';

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
      zeile(1, 'A', '2026-10-15', { meine: [{ dienst: 'Ton', zugesagt: true }] }),
      zeile(2, 'B', '2026-10-16', { meine: [{ dienst: 'Gesang', zugesagt: false }] }),
      ...[3, 4, 5, 6, 7].map((id) =>
        zeile(id, 'G', `2026-10-${16 + id}`, { meine: [{ dienst: 'Licht', zugesagt: true }] }),
      ),
    ];
    const u = startUebersicht(z, O);
    expect(u.offen.map((d) => [d.termin.id, d.dienst])).toEqual([[2, 'Gesang']]);
    expect(u.naechsteDienste.map((d) => d.termin.id)).toEqual([3, 4, 5, 6]);
    expect(u.naechsteDienste).toHaveLength(NAECHSTE_DIENSTE);
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
