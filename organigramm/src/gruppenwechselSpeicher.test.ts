import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KAT, MODUL, speicher } from '@shared/dienstplan/entwuerfe.testutil';
import { Fehler } from '@shared/dienstplan/einteilen.testutil';
import { GRUNDWERTE } from '@shared/organigramm/gruppenwechsel';
import { GW_ART } from '@shared/organigramm/gruppenwechselEinrichtung';
import { SICHT_ART } from '@shared/organigramm/sichtbarkeit';

// Gegen den nachgebauten Speicher (wie bei der Sichtbarkeit); Modul und Kategorie sind gefunden bzw. fehlen.
const h = vi.hoisted(() => ({ kategorie: null as number | null, port: null as object | null }));
vi.mock('@ui/ct/modulPort', () => ({
  versionPortFuer: () => new Proxy({}, { get: (_ziel, k) => Reflect.get(h.port ?? {}, k) }),
}));
vi.mock('@shared/ct/modulDaten', async (original) => ({
  ...(await original<typeof import('@shared/ct/modulDaten')>()),
  modulSuchen: () => Promise.resolve(MODUL),
  kategorieSuchen: () => Promise.resolve(h.kategorie),
}));
const { ladeEinrichtung } = await import('./gruppenwechselSpeicher');
const { dokumentAusKategorie } = await import('./speicher');
const { _vergissModul } = await import('./speicher');

const EINRICHTUNG = {
  einstellung: {
    ...GRUNDWERTE,
    stufen: [
      { gruppeId: 1, name: 'Fische', abAlter: 7 },
      { gruppeId: 2, name: 'Jungschar', abAlter: 10 },
    ],
  },
  bereichGruppeId: 9,
  wechselGruppen: [{ vonGruppeId: 1, nachGruppeId: 2, gruppeId: 5 }],
};
const dokument = (inhalt: unknown, art: { art: string; fassung: number } = GW_ART) =>
  JSON.stringify({
    ...art,
    version: 1,
    zeit: '2026-11-16T10:00:00Z',
    von: { personId: 1, name: 'A' },
    inhalt,
  });

let sp: ReturnType<typeof speicher>;
beforeEach(() => {
  sp = speicher();
  h.port = sp.port;
  h.kategorie = KAT;
  _vergissModul();
});

describe('ladeEinrichtung – vier Fälle, die nie ineinander übergehen (O9-5c)', () => {
  it('Wert im richtigen Format → da', async () => {
    sp.s.werte.push({ id: 1, dataCategoryId: KAT, value: dokument(EINRICHTUNG) });
    expect(await ladeEinrichtung()).toMatchObject({
      art: 'da',
      einrichtung: { bereichGruppeId: 9, wechselGruppen: [{ gruppeId: 5 }] },
    });
  });

  it('keine Kategorie → keine', async () => {
    h.kategorie = null;
    expect(await ladeEinrichtung()).toEqual({ art: 'keine' });
  });

  it('Kategorie ohne Wert → keine', async () => {
    expect(await ladeEinrichtung()).toEqual({ art: 'keine' });
  });

  it('ein Wert, den `einrichtungAus` nicht erkennt → unlesbar – NICHT keine', async () => {
    sp.s.werte.push({
      id: 1,
      dataCategoryId: KAT,
      value: dokument({ ...EINRICHTUNG, bereichGruppeId: 'neun' }),
    });
    expect(await ladeEinrichtung()).toEqual({ art: 'unlesbar' });
  });

  it('andere Fassung oder kein JSON in der Kategorie → unlesbar – NICHT keine', async () => {
    sp.s.werte.push({
      id: 1,
      dataCategoryId: KAT,
      value: dokument(EINRICHTUNG, { ...GW_ART, fassung: GW_ART.fassung + 1 }),
    });
    expect(await ladeEinrichtung()).toEqual({ art: 'unlesbar' });
    sp.s.werte[0].value = 'kein json';
    expect(await ladeEinrichtung()).toEqual({ art: 'unlesbar' });
  });

  it('nicht lesbar (Recht, Netz) → fehler mit Grund – nie keine', async () => {
    sp.s.lesenWirft = new Fehler(503);
    expect(await ladeEinrichtung()).toEqual({ art: 'fehler', grund: 'voruebergehend' });
    sp.s.lesenWirft = new Fehler(403);
    expect(await ladeEinrichtung()).toEqual({ art: 'fehler', grund: 'kein-recht' });
    sp.s.lesenWirft = new Fehler(401);
    expect(await ladeEinrichtung()).toEqual({ art: 'fehler', grund: 'abgemeldet' });
  });
});

describe('dokumentAusKategorie – Verhalten für die anderen Aufrufer unverändert', () => {
  const lesen = () =>
    dokumentAusKategorie(SICHT_ART.art, SICHT_ART, (r) => (r === 'passt' ? 'x' : null));

  it('ein Wert, der nicht passt, zählt wie keiner (ok, daten null) – auch in der Kategorie mit fremdem Inhalt', async () => {
    h.kategorie = null;
    expect(await lesen()).toEqual({ ok: true, daten: null });
    h.kategorie = KAT;
    expect(await lesen()).toEqual({ ok: true, daten: null });
    sp.s.werte.push({ id: 1, dataCategoryId: KAT, value: 'kein json' });
    expect(await lesen()).toEqual({ ok: true, daten: null });
    sp.s.werte[0].value = dokument('anders', SICHT_ART);
    expect(await lesen()).toEqual({ ok: true, daten: null });
  });

  it('ein Wert, der passt, kommt mit Version; ein Lesefehler als ok: false mit Grund', async () => {
    sp.s.werte.push({ id: 1, dataCategoryId: KAT, value: dokument('passt', SICHT_ART) });
    expect(await lesen()).toMatchObject({ ok: true, daten: { version: 1, inhalt: 'x' } });
    sp.s.lesenWirft = new Fehler(503);
    expect(await lesen()).toEqual({ ok: false, grund: 'voruebergehend' });
  });
});
