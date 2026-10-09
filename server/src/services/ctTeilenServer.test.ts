import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { leeren, tempVerzeichnis } from '../testHilfen/tempAblage.js';
import { AblageFake, BILD } from '../testHilfen/ablageFake.js';

/**
 * Team-Notizen der Server-App über ChurchTools (09.10.2026). Hier der Übergang: Wer in der Server-App
 * geteilt hat, sich seitdem aber nicht angemeldet hat, ist noch nicht umgezogen – nur er selbst darf in
 * seine Personen-Dateien schreiben. Seine Notizen kommen bis dahin vom Volume. Hat er das Teilen in
 * ChurchTools (Erweiterung) aber ausgeschaltet, gilt das.
 */
const dir = tempVerzeichnis('teilen-server-test');
process.env.ANNOTATIONS_PATH = dir;
process.env.SEEN_SETLISTS_PATH = path.join(dir, 'seen.json');

const fake = vi.hoisted(() => ({ aktuell: null as unknown as AblageFake }));
vi.mock('./ctPersonenAblage.js', async () => {
  const { erstellePersonenAblage } = await import('@shared/ct/personenAblage');
  const ablagen = new Map<number, ReturnType<typeof erstellePersonenAblage>>();
  return {
    ablagePortFuer: (_cookie: string, userId: number) => fake.aktuell.port(userId),
    ablageVon: (userId: number) => {
      if (!ablagen.has(userId)) ablagen.set(userId, erstellePersonenAblage());
      return ablagen.get(userId)!;
    },
    __reset: () => ablagen.clear(),
  };
});
// Keine Erweiterung in dieser Gemeinde: Die Modulliste ist leer → Verzeichnis auf dem Volume.
vi.mock('./ctHttp.js', async (orig) => ({
  ...(await orig<typeof import('./ctHttp.js')>()),
  ctGet: vi.fn(() => Promise.resolve([])),
}));
vi.mock('./ctAuth.js', () => ({
  whoami: vi.fn(() => Promise.resolve({ id: 7, firstName: 'Ich', lastName: 'Selbst' })),
}));

const teilen = await import('./ctTeilenServer.js');
const sharing = await import('./sharing.js');
const annotations = await import('./annotations.js');
const umzug = await import('./ablageUmzug.js');
const ctAblage = (await import('./ctPersonenAblage.js')) as unknown as {
  __reset: () => void;
  ablageVon: (id: number) => import('@shared/ct/personenAblage').PersonenAblage;
};

const ICH = 7;
const KOLLEGE = 9;
const SEITE = 'song1_a1_voriginal_0';

beforeEach(async () => {
  await leeren(dir);
  fake.aktuell = new AblageFake();
  ctAblage.__reset();
  sharing.__resetForTests();
  umzug.__resetUmzugForTests();
  teilen.__resetTeilenServerForTests();
  await annotations.kontoLoeschen(KOLLEGE);
  // Der Kollege hat in der Server-App geteilt und gezeichnet – und ist seitdem nicht da gewesen.
  await sharing.setSharing(KOLLEGE, 'Kollege', true);
  await annotations.putAnnotation(KOLLEGE, SEITE, { strokes: BILD });
});

describe('Teilende, die noch nicht umgezogen sind', () => {
  it('erscheinen weiter – mit ihren Notizen vom Volume', async () => {
    expect(await teilen.teilende('ct=1', ICH, [1])).toEqual([
      { id: KOLLEGE, name: 'Kollege', songs: [1] },
    ]);
    const seiten = await teilen.anmerkungenVon('ct=1', ICH, KOLLEGE, [1]);
    expect(seiten[SEITE]).toEqual({ strokes: BILD, texts: [] });
  });

  it('hat er in ChurchTools ausgeschaltet, gilt das – der alte Eintrag schaltet es nicht wieder ein', async () => {
    await ctAblage.ablageVon(KOLLEGE).schreibeTeilen(fake.aktuell.port(KOLLEGE), false, 'Kollege');
    expect(await teilen.teilende('ct=1', ICH, [1])).toEqual([]);
    await expect(teilen.anmerkungenVon('ct=1', ICH, KOLLEGE, [1])).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe('Teilen umschalten ohne Erweiterung', () => {
  it('die eigene Datei in ChurchTools gilt, gefunden wird man über die Liste auf dem Volume', async () => {
    await teilen.teilenSetzen('ct=1', ICH, true);
    expect(await ctAblage.ablageVon(ICH).holeTeilenStand(fake.aktuell.port(ICH))).toBe(true);
    expect((await sharing.listSharers()).map((s) => s.id)).toContain(ICH);
  });
});
