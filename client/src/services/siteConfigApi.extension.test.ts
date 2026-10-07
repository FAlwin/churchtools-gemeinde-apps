import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@shared/types/index';
import { _bremseLoesen, _vergissCsrf } from './ctRuntime';
import { _vergissModul } from './ctModulDaten';
import { KATEGORIE_KUERZEL } from './ctEinstellungen';
import { TEILEN_KATEGORIE } from './ctTeilen';
import { updateSiteConfig } from './siteConfigApi';
import { FakeCt } from './ctFake.testutil';

/**
 * Speichern der Gemeinde-Einstellungen in der Erweiterung (#335, 3b-4b): Mit Team-Gruppen legt der
 * Admin dabei das Verzeichnis „Wer teilt" an – Musiker dürfen in ChurchTools meist keine Kategorien
 * anlegen.
 */
vi.mock('./modus', async (original) => ({
  ...(await original<typeof import('./modus')>()),
  istExtension: true,
  erweiterungsKuerzel: () => 'musik-app',
}));

let ct: FakeCt;
const MIT_GRUPPE: SiteConfig = {
  ...DEFAULT_SITE_CONFIG,
  musicianGroupIds: [9],
  noteRoles: [{ groupId: 9, roles: [15] }],
};

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  _vergissModul();
  ct = new FakeCt();
  ct.installieren();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const kuerzel = () => ct.kategorien.map((k) => k.shorty).sort();

describe('updateSiteConfig in der Erweiterung', () => {
  it('mit Team-Gruppen: legt auch das Verzeichnis „Wer teilt" an', async () => {
    await updateSiteConfig(MIT_GRUPPE);
    expect(kuerzel()).toEqual([KATEGORIE_KUERZEL, TEILEN_KATEGORIE.kuerzel].sort());
  });

  it('ohne Team-Gruppen: nur die Einstellungen', async () => {
    await updateSiteConfig(DEFAULT_SITE_CONFIG);
    expect(kuerzel()).toEqual([KATEGORIE_KUERZEL]);
  });

  it('scheitert das Verzeichnis, ist auch nichts gespeichert', async () => {
    ct.datenSchreibenVerboten = true;
    await expect(updateSiteConfig(MIT_GRUPPE)).rejects.toMatchObject({
      message: expect.stringContaining('Liste der Team-Notizen') as unknown,
    });
    expect(ct.werte).toEqual([]);
  });
});
