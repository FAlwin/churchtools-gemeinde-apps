import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ladeIch } from '@ui/ct/ich';
import { modulId } from '@ui/ct/modulPort';
import { kategorienLesen } from '@shared/ct/modulDaten';
import { ctDaten } from '@ui/ct/verbindung';
import { KATEGORIE_EINSTELLUNGEN, KATEGORIE_ZUGANG } from '@shared/gebetsabend/einrichten';
import { ladeStart } from './start';

vi.mock('@ui/ct/ich', () => ({ ladeIch: vi.fn() }));
vi.mock('@ui/ct/modulPort', () => ({
  modulId: vi.fn(),
  modulPort: { kuerzel: () => 'gebetsabend' },
}));
vi.mock('@shared/ct/modulDaten', async (original) => ({
  ...(await original<typeof import('@shared/ct/modulDaten')>()),
  kategorienLesen: vi.fn(),
}));
vi.mock('@ui/ct/verbindung', () => ({ ctDaten: vi.fn() }));

const ich = vi.mocked(ladeIch);
const modul = vi.mocked(modulId);
const kategorien = vi.mocked(kategorienLesen);
const daten = vi.mocked(ctDaten);

/** Die Kategorien, wie sie die Seite selbst anlegt (Kürzel aus der Regel, nicht abgeschrieben). */
const beide = [
  { id: 74, shorty: KATEGORIE_ZUGANG.kuerzel, name: KATEGORIE_ZUGANG.name },
  { id: 75, shorty: KATEGORIE_EINSTELLUNGEN.kuerzel, name: KATEGORIE_EINSTELLUNGEN.name },
];

beforeEach(() => {
  ich.mockResolvedValue({
    id: 1,
    vorname: 'Helene',
    gemeinde: 'ECG',
    rollen: [],
    mitgliedschaften: [],
  });
  modul.mockResolvedValue(26);
  kategorien.mockResolvedValue(beide);
  daten.mockResolvedValue({ churchcore: {} });
});

describe('ladeStart', () => {
  it('sucht das eigene Modul unter dem Namen des Gebetsabends und liest dessen Kategorien', async () => {
    const s = await ladeStart();
    expect(modul).toHaveBeenCalledWith('Die Erweiterung „Gebetsabend“');
    expect(kategorien).toHaveBeenCalledWith(expect.anything(), 26);
    expect(daten).toHaveBeenCalledWith('/permissions/global');
    expect(s.einrichtung).toEqual({ zugang: 74, einstellungen: 75 });
    expect(s).toMatchObject({ vorname: 'Helene', darfAnlegen: false, technik: false });
  });

  it('Technik = anlegen, ändern UND löschen in „Zugang“ – unter dem Kürzel der Erweiterung', async () => {
    daten.mockResolvedValue({
      gebetsabend: {
        'create custom category': true,
        'create custom data': [74],
        'edit custom data': [74],
        'delete custom data': [74],
      },
      andereerweiterung: {
        'create custom data': [74],
        'edit custom data': [74],
        'delete custom data': [74],
      },
    });
    expect(await ladeStart()).toMatchObject({ darfAnlegen: true, technik: true });
  });

  it('nur „Einstellungen“ schreiben macht noch nicht zur Technik', async () => {
    daten.mockResolvedValue({
      gebetsabend: {
        'create custom data': [75],
        'edit custom data': [75],
        'delete custom data': [75],
      },
    });
    expect((await ladeStart()).technik).toBe(false);
  });

  it('ohne sichtbare Kategorie „Zugang“ ist niemand Technik, auch mit Schreibrecht auf eine fremde ID', async () => {
    kategorien.mockResolvedValue([]);
    daten.mockResolvedValue({
      gebetsabend: {
        'create custom data': [74],
        'edit custom data': [74],
        'delete custom data': [74],
      },
    });
    expect(await ladeStart()).toMatchObject({
      einrichtung: { zugang: null, einstellungen: null },
      technik: false,
    });
  });

  it('wirft, wenn die Kategorien nicht lesbar sind – nicht „nicht eingerichtet“', async () => {
    kategorien.mockRejectedValue(new Error('502'));
    await expect(ladeStart()).rejects.toThrow('502');
  });
});
