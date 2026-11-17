// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { demoStarten } from './demo';
import { ladeMitarbeit, ladeSitzungen } from './lesen';
import { protokollLoeschen } from './loeschen';

/** W6: „Protokoll löschen“ funktioniert auch in `?demo` – Werte, Termin und Gruppentreffen lassen sich dort löschen und nachlesen. */
const MODUL = 20;
const echtesFetch = window.fetch;
const ZONE = 'Europe/Berlin';
const GRUPPE = { id: 11, protokolle: 60, mitarbeit: 61 };
const ICH = { person: 1, name: 'Alwin Friesen', fenster: 'f1' };

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  (window as { settings?: { base_url?: string } }).settings = { base_url: 'https://ct.test/' };
  demoStarten('x');
});
afterEach(() => {
  window.fetch = echtesFetch;
  delete (window as { settings?: unknown }).settings;
  vi.restoreAllMocks();
});

const alle = async () => {
  const s = await ladeSitzungen(MODUL, GRUPPE, ZONE);
  return [...s.kommend, ...s.protokolle];
};

describe('Demo: Protokoll löschen', () => {
  it('der Entwurf vom 21.10. samt To-Do und Termin: danach weg, nichts bleibt hängen', async () => {
    const vorher = (await alle()).find((s) => s.kopf?.sitzung === 'demo-entwurf')!;
    expect(vorher.termin?.id).toBe(121);
    expect((await ladeMitarbeit(MODUL, GRUPPE)).aufgaben.map((a) => a.id)).toContain('demo-a1');

    const r = await protokollLoeschen({
      ort: { modul: MODUL, kategorie: 60, sitzung: 'demo-entwurf' },
      ich: ICH,
      gruppe: 11,
      mitarbeit: { modul: MODUL, kategorie: 61 },
      todos: true,
      termin: { termin: vorher.termin!, beginn: vorher.beginn, zeitzone: ZONE },
      treffen: null,
    });

    expect(r).toEqual({ art: 'ok' });
    expect((await alle()).find((s) => s.kopf?.sitzung === 'demo-entwurf')).toBeUndefined();
    expect((await ladeMitarbeit(MODUL, GRUPPE)).aufgaben.map((a) => a.id)).not.toContain('demo-a1');
    expect((await alle()).find((s) => s.termin?.id === 121)).toBeUndefined();
  });

  it('ein Gruppentreffen: danach kennen es Einzelabruf und Liste nicht mehr', async () => {
    const abruf = (id: number) => window.fetch(`https://ct.test/api/groups/11/meetings/${id}`);
    const liste = async () =>
      (
        (await (await window.fetch('https://ct.test/api/groups/11/meetings')).json()) as {
          data: { id: number }[];
        }
      ).data.map((t) => t.id);
    expect((await abruf(40)).status).toBe(200);
    expect(await liste()).toContain(40);

    await protokollLoeschen({
      ort: { modul: MODUL, kategorie: 60, sitzung: 'gibt-es-nicht' },
      ich: ICH,
      gruppe: 11,
      mitarbeit: null,
      todos: false,
      termin: null,
      treffen: 40,
    });

    expect((await abruf(40)).status).toBe(404);
    const danach = await liste();
    expect(danach).not.toContain(40);
    expect(danach).toContain(41); // die anderen bleiben
  });
});
