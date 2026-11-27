// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { mitNachweisBedarf, type NachweisBedarf } from '@shared/anmeldung/nachweisBedarf';
import { einstellungen } from '@shared/anmeldung/senden.testdaten';
import { ApiError } from '@ui/ct/fehler';
import * as Arten from './nachweisArten';
import * as Einrichten from './einrichten';
import * as Ablage from './nachweisStandAblage';
import { NachweiseKarte } from './NachweiseKarte';

/**
 * Karte „Nachweise“ und ihr Fenster (N3b) mit ersetztem ChurchTools-Anschluss: Was ChurchTools liefert, prüft
 * `nachweisArten.test.ts`, wer den Nachweis braucht `nachweisBedarf.test.ts` – hier geht es um das, was die Person sieht,
 * und darum, dass nur Geändertes in die frisch gelesenen Einstellungen geschrieben wird.
 */
vi.mock('./nachweisArten', async (original) => ({
  ...(await original<typeof import('./nachweisArten')>()),
  nachweisArtenKurz: vi.fn(),
}));
vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  aendereEinstellungen: vi.fn(),
}));
vi.mock('./nachweisStandAblage', async (original) => ({
  ...(await original<typeof import('./nachweisStandAblage')>()),
  nachweisArtNamenLesen: vi.fn(),
}));
const arten = vi.mocked(Arten);
const ablage = vi.mocked(Ablage);
const einrichten = vi.mocked(Einrichten);

const FZ = { id: 61, name: 'Führungszeugnis', fertig: true };
const JU = { id: 62, name: 'JuLeiCa', fertig: true };
const FOTO = 'frage:foto';

const fuerFoto = (artGruppeId: number, antworten = ['Ja']): NachweisBedarf => ({
  artGruppeId,
  fuer: 'nurWenn',
  feld: FOTO,
  antworten,
});

/** Was in ChurchTools gespeichert wurde – `aendereEinstellungen` ersetzt, rechnet aber auf den „frisch gelesenen“ Einstellungen. */
let gespeichert: OeffentlicheEinstellungen | null;
let frisch: (e: OeffentlicheEinstellungen) => OeffentlicheEinstellungen;

beforeEach(() => {
  gespeichert = null;
  frisch = (e) => e;
  arten.nachweisArtenKurz.mockResolvedValue([FZ, JU]);
  ablage.nachweisArtNamenLesen.mockReset().mockResolvedValue(new Map());
  einrichten.aendereEinstellungen.mockImplementation(async (_id, aendern) => {
    gespeichert = aendern(frisch(einstellungen()));
    return gespeichert;
  });
});

const zeigen = (
  e: OeffentlicheEinstellungen,
  { darf = true, onGespeichert = () => {} } = {},
): ReturnType<typeof render> =>
  render(<NachweiseKarte id={5} name="AC 2027" e={e} darf={darf} onGespeichert={onGespeichert} />);

const mit = (...b: NachweisBedarf[]): OeffentlicheEinstellungen => ({
  ...einstellungen(),
  nachweise: b,
});
const fenster = () => screen.getByRole('dialog');
const oeffnen = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
  return fenster();
};

describe('Karte', () => {
  it('eine Zeile je Art: alle Angemeldeten, „nur wenn …“, aus', async () => {
    zeigen(mit({ artGruppeId: 61, fuer: 'alle' }, fuerFoto(62, ['Ja', 'Nein'])));
    expect(await screen.findByText('alle Angemeldeten')).toBeTruthy();
    expect(screen.getByText(/nur wenn .* ist Ja oder Nein/)).toBeTruthy();
  });

  it('eine Art, die nicht eingeschaltet ist, steht als „aus“', async () => {
    zeigen(mit({ artGruppeId: 61, fuer: 'alle' }));
    await screen.findByText('alle Angemeldeten');
    expect(screen.getByText('aus')).toBeTruthy();
  });

  it('ohne Recht zum Bearbeiten: nur ansehen, kein Knopf', async () => {
    zeigen(mit({ artGruppeId: 61, fuer: 'alle' }), { darf: false });
    await screen.findByText('alle Angemeldeten');
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
  });

  it('keine Art: Hinweis mit Verweis auf die Seite „Nachweise“, kein Bearbeiten', async () => {
    arten.nachweisArtenKurz.mockResolvedValue([]);
    zeigen(einstellungen());
    expect(await screen.findByText(/noch keine Nachweis-Art/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '„Nachweise“' }).getAttribute('href')).toBe(
      '#/nachweise',
    );
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
  });

  it('Lesefehler: „konnten nicht gelesen werden“ – nie „keine Art“ – und „Nochmal“ liest neu', async () => {
    arten.nachweisArtenKurz.mockRejectedValueOnce(new ApiError(503, 'weg'));
    zeigen(einstellungen());
    expect(await screen.findByText(/konnten nicht gelesen werden/)).toBeTruthy();
    expect(screen.queryByText(/noch keine Nachweis-Art/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal' }));
    expect(await screen.findByRole('button', { name: 'Bearbeiten' })).toBeTruthy();
    expect(arten.nachweisArtenKurz).toHaveBeenCalledTimes(2);
  });

  it('eingeschaltete Art, die diese Person nicht sieht: bleibt sichtbar (mit Nummer)', async () => {
    zeigen(mit({ artGruppeId: 99, fuer: 'alle' }));
    expect(await screen.findByText('Nachweis-Art Nr. 99')).toBeTruthy();
  });

  it('E35: …mit ihrem Namen aus der Ablage, wenn eine Vertrauensperson ihn hingeschrieben hat', async () => {
    ablage.nachweisArtNamenLesen.mockResolvedValue(new Map([[99, 'Erste Hilfe']]));
    zeigen(mit({ artGruppeId: 99, fuer: 'alle' }));
    expect(await screen.findByText('Erste Hilfe')).toBeTruthy();
    expect(screen.queryByText('Nachweis-Art Nr. 99')).toBeNull();
  });

  it('E35: Ablage nicht lesbar (null) oder noch leer: die Nummer, kein Fehler', async () => {
    ablage.nachweisArtNamenLesen.mockResolvedValue(null);
    zeigen(mit({ artGruppeId: 99, fuer: 'alle' }));
    expect(await screen.findByText('Nachweis-Art Nr. 99')).toBeTruthy();
    await waitFor(() => expect(ablage.nachweisArtNamenLesen).toHaveBeenCalled());
    expect(screen.queryByText(/Namen der Arten/)).toBeNull();
  });

  it('E35: Lesefehler (vorübergehend) ist nicht „kein Name“: Hinweis mit „Nochmal“', async () => {
    ablage.nachweisArtNamenLesen.mockRejectedValueOnce(new ApiError(503, 'weg'));
    ablage.nachweisArtNamenLesen.mockResolvedValueOnce(new Map([[99, 'Erste Hilfe']]));
    zeigen(mit({ artGruppeId: 99, fuer: 'alle' }));
    expect(await screen.findByText('Namen der Arten')).toBeTruthy();
    expect(screen.getByText('Nachweis-Art Nr. 99')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Nochmal' }).at(-1)!);
    expect(await screen.findByText('Erste Hilfe')).toBeTruthy();
  });

  it('E35: alle eingeschalteten Arten sichtbar – die Ablage wird gar nicht gelesen', async () => {
    zeigen(mit({ artGruppeId: 61, fuer: 'alle' }));
    expect(await screen.findByText('Führungszeugnis')).toBeTruthy();
    expect(ablage.nachweisArtNamenLesen).not.toHaveBeenCalled();
  });

  it('kaputte Bedingung: Hinweis in der Karte statt stillem Bruch', async () => {
    zeigen(mit({ artGruppeId: 61, fuer: 'nurWenn', feld: 'frage:gibtsnicht', antworten: ['Ja'] }));
    expect(await screen.findByText(/gibt es nicht mehr/)).toBeTruthy();
    expect(screen.getByText(/\(Frage fehlt\) ist Ja/)).toBeTruthy();
  });
});

describe('Fenster', () => {
  it('Titel mit der Veranstaltung; je Art ein Schalter; Speichern erst nach einer Änderung', async () => {
    zeigen(mit({ artGruppeId: 61, fuer: 'alle' }));
    const f = await oeffnen();
    expect(within(f).getByText('Nachweise · AC 2027')).toBeTruthy();
    expect(
      within(f).getByRole('button', { name: 'Führungszeugnis' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(within(f).getByRole('button', { name: 'JuLeiCa' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(within(f).getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
      true,
    );
  });

  it('der Satz zum Eintragen steht bei „Alle“ und bei „Nur wenn“ – ohne „sofort“', async () => {
    zeigen(mit({ artGruppeId: 61, fuer: 'alle' }, fuerFoto(62)));
    const f = await oeffnen();
    const saetze = within(f).getAllByText(
      /Eingetragen wird, sobald eine Vertrauensperson oder ein Admin/,
    );
    expect(saetze).toHaveLength(2);
    expect(saetze[0].textContent).toContain(
      'Wer schon in der Nachweis-Gruppe ist, bekommt keine neue Aufforderung.',
    );
    expect(f.textContent).not.toMatch(/sofort/i);
    expect(f.textContent).not.toMatch(/Mindestalter/i);
  });

  it('Art einschalten: „Alle“ wird gespeichert; Karte schließt das Fenster und meldet „gespeichert“', async () => {
    const fertig = vi.fn();
    zeigen(einstellungen(), { onGespeichert: fertig });
    const f = await oeffnen();
    fireEvent.click(within(f).getByRole('button', { name: 'JuLeiCa' }));
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(fertig).toHaveBeenCalled());
    expect(gespeichert!.nachweise).toEqual([{ artGruppeId: 62, fuer: 'alle' }]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('gespeichert wird nur, was geändert ist – in die frisch gelesenen Einstellungen, andere Einträge bleiben', async () => {
    // Zwischen Öffnen und Speichern hat jemand anderes Art 70 eingeschaltet und Art 61 umgestellt.
    frisch = (e) => ({
      ...e,
      nachweise: [
        fuerFoto(61, ['Nein']),
        { artGruppeId: 70, fuer: 'alle' },
        { artGruppeId: 99, fuer: 'alle' },
      ],
    });
    zeigen(mit({ artGruppeId: 61, fuer: 'alle' }, { artGruppeId: 99, fuer: 'alle' }));
    const f = await oeffnen();
    fireEvent.click(within(f).getByRole('button', { name: 'JuLeiCa' }));
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gespeichert).not.toBeNull());
    expect(gespeichert!.nachweise).toEqual([
      fuerFoto(61, ['Nein']),
      { artGruppeId: 70, fuer: 'alle' },
      { artGruppeId: 99, fuer: 'alle' },
      { artGruppeId: 62, fuer: 'alle' },
    ]);
  });

  it('Art ausschalten nimmt nur sie heraus – die unsichtbare Art 99 bleibt', async () => {
    const e = mit({ artGruppeId: 61, fuer: 'alle' }, { artGruppeId: 99, fuer: 'alle' });
    frisch = () => e;
    zeigen(e);
    const f = await oeffnen();
    fireEvent.click(within(f).getByRole('button', { name: 'Führungszeugnis' }));
    expect(within(f).getByText(/Nachweis-Art Nr. 99.*bleibt unverändert/)).toBeTruthy();
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gespeichert).not.toBeNull());
    expect(gespeichert!.nachweise).toEqual([{ artGruppeId: 99, fuer: 'alle' }]);
  });

  it('„Nur wenn …“: Frage und Antwort wählen; ohne Antwort geht Speichern nicht', async () => {
    zeigen(mit({ artGruppeId: 61, fuer: 'alle' }));
    const f = await oeffnen();
    fireEvent.click(within(f).getByRole('button', { name: 'Nur wenn …' }));
    expect(within(f).getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
      true,
    );
    expect(within(f).getByText('Bitte mindestens eine Antwort wählen.')).toBeTruthy();
    // Die Frage ist die erste mit festen Antworten (Fotos je Person).
    const auswahl = within(f).getByRole<HTMLSelectElement>('combobox', { name: /Frage/ });
    expect(auswahl.value).toBe(FOTO);
    fireEvent.click(within(f).getByRole('button', { name: /^Antworten/ }));
    fireEvent.click(within(f).getByRole('checkbox', { name: 'Ja' }));
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gespeichert).not.toBeNull());
    expect(gespeichert!.nachweise).toEqual([fuerFoto(61, ['Ja'])]);
  });

  it('eine andere Frage wählen leert die Antworten', async () => {
    // Zweite Frage mit festen Antworten, diesmal an den Kontakt (Anmeldung).
    const zwei = mit(fuerFoto(61, ['Ja']));
    zwei.formular.anmeldung.push({
      id: 'team',
      art: 'eigen',
      typ: 'janein',
      frage: 'Bist du im Team?',
      hilfe: '',
      zustand: 'freiwillig',
      antworten: [],
    });
    zwei.ctFelder = { ...zwei.ctFelder, team: 710 };
    zeigen(zwei);
    const f = await oeffnen();
    fireEvent.click(within(f).getByRole('button', { name: 'Bedingung ändern' }));
    const auswahl = within(f).getByRole<HTMLSelectElement>('combobox', { name: /Frage/ });
    expect([...auswahl.options].map((o) => o.value)).toContain('frage:team');
    fireEvent.change(auswahl, { target: { value: 'frage:team' } });
    expect(within(f).getByText('Bitte mindestens eine Antwort wählen.')).toBeTruthy();
    fireEvent.click(within(f).getByRole('button', { name: /^Antworten/ }));
    fireEvent.click(within(f).getByRole('checkbox', { name: 'Nein' }));
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gespeichert).not.toBeNull());
    expect(gespeichert!.nachweise).toEqual([
      { artGruppeId: 61, fuer: 'nurWenn', feld: 'frage:team', antworten: ['Nein'] },
    ]);
  });

  it('kaputte Bedingung im Fenster: Hinweis; die entfernte Antwort lässt sich abwählen', async () => {
    zeigen(mit(fuerFoto(61, ['Ja', 'Vielleicht'])));
    const f = await oeffnen();
    expect(within(f).getByText(/„Vielleicht“ gibt es bei/)).toBeTruthy();
    fireEvent.click(within(f).getByRole('button', { name: 'Bedingung ändern' }));
    fireEvent.click(within(f).getByRole('button', { name: /^Antworten/ }));
    fireEvent.click(within(f).getByRole('checkbox', { name: 'Vielleicht (gibt es nicht mehr)' }));
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gespeichert).not.toBeNull());
    expect(gespeichert!.nachweise).toEqual([fuerFoto(61, ['Ja'])]);
  });

  it('Schreibfehler: Meldung im Fenster, das Fenster bleibt offen', async () => {
    einrichten.aendereEinstellungen.mockRejectedValueOnce(new ApiError(403, 'nein'));
    zeigen(einstellungen());
    const f = await oeffnen();
    fireEvent.click(within(f).getByRole('button', { name: 'JuLeiCa' }));
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    expect(await within(f).findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('eine Art ohne fertige Einstellungen lässt sich nicht einschalten, sagt aber warum', async () => {
    arten.nachweisArtenKurz.mockResolvedValue([{ id: 64, name: 'Halb', fertig: false }, FZ]);
    zeigen(einstellungen());
    const f = await oeffnen();
    expect(within(f).getByRole<HTMLButtonElement>('button', { name: 'Halb' }).disabled).toBe(true);
    expect(within(f).getByText(/noch nicht fertig eingerichtet/)).toBeTruthy();
  });
});

describe('Erzeuger', () => {
  it('die Karte schreibt genau das, was `mitNachweisBedarf` macht (eine Regel zum Ändern)', async () => {
    zeigen(einstellungen());
    const f = await oeffnen();
    fireEvent.click(within(f).getByRole('button', { name: 'Führungszeugnis' }));
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gespeichert).not.toBeNull());
    expect(gespeichert).toEqual(
      mitNachweisBedarf(einstellungen(), 61, { artGruppeId: 61, fuer: 'alle' }),
    );
  });
});
