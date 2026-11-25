// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { gibFrei, onlineSicht } from '@shared/website/freigabe';
import { menueSpeichern, seiteSpeichern, websiteAusWerten } from '@shared/website/speicher';
import { statusSetzen } from '@shared/website/status';
import type { Zugang } from '@shared/website/zugang';
import {
  ENTWUERFE,
  JUGEND,
  JUGEND_ONLINE,
  ONLINE,
  fakeFreigabeSpeicher,
} from '@shared/website/freigabe.testutil';
import { baustein, menue, seiteMit } from '@shared/website/website.testdaten';
import * as D from './daten';
import * as M from './mailVersand';
import type { FreigabeDaten } from './daten';
import { Freigaben } from './Freigaben';

/**
 * **„Freigaben“ je Bereich** (W3b-4b): Die Leitung der Untergruppe sieht und gibt nur ihre Seiten frei; „Alles freigeben“ nimmt
 * nur, was sie freigeben darf; eine verschobene Seite, die im alten Bereich bleibt, steht in der Meldung. Daten aus echtem
 * Schreiben (Website-Kategorie 2, Jugend = Gruppe 347 mit Kategorie 117).
 */
vi.mock('./daten', () => ({
  gebeFrei: vi.fn(),
  gebeAllesFrei: vi.fn(),
  setzeStatus: vi.fn(),
  entferneStatus: vi.fn(),
  entferneSeiteUndOnline: vi.fn(),
  speichereMenue: vi.fn(),
}));
vi.mock('./mailVersand', () => ({
  mailAnLeitung: vi.fn(),
  mailZurueck: vi.fn(),
  mailFreigaben: vi.fn(),
}));
const d = vi.mocked(D);
const m = vi.mocked(M);

const KAT = {
  modul: 7,
  entwuerfe: ENTWUERFE,
  veroeffentlicht: ONLINE,
  untergruppen: [{ gruppe: JUGEND, kategorie: JUGEND_ONLINE }],
};
const NAMEN = { website: 'Website', untergruppen: [{ gruppe: JUGEND, name: 'Website – Jugend' }] };
const RITA = { person: 5, name: 'Rita', fenster: 'f2' };
const JETZT = new Date('2026-11-23T10:00:00Z');
const JUGEND_LEITUNG: Zugang = { sieht: [JUGEND], leitet: [JUGEND] };

const sei = (id: string, titel: string, bereich?: number) => ({
  ...seiteMit([baustein('text', { id: `t-${id}`, markdown: titel })], { id, pfad: id, titel }),
  ...(bereich ? { bereich } : {}),
});

/**
 * A = Website, eingereicht · J = Jugend, eingereicht · F = Jugend, liegt online noch in der Website-Kategorie · L = Jugend,
 * Löschen angefragt.
 */
async function daten(): Promise<FreigabeDaten> {
  const s = fakeFreigabeSpeicher();
  await seiteSpeichern(s.entwurfsOrt, sei('a', 'Aktuelles'), JETZT);
  await seiteSpeichern(s.entwurfsOrt, sei('j', 'Jugendabend', JUGEND), JETZT);
  await seiteSpeichern(s.entwurfsOrt, sei('f', 'Freizeit'), JETZT);
  await gibFrei(s.bereichsOrt, 'seite', 'f');
  await seiteSpeichern(s.entwurfsOrt, sei('f', 'Freizeit', JUGEND), JETZT);
  await menueSpeichern(s.entwurfsOrt, menue([]), JETZT);
  await statusSetzen(s.entwurfsOrt, 'a', { zustand: 'eingereicht' }, RITA, JETZT);
  await statusSetzen(s.entwurfsOrt, 'j', { zustand: 'eingereicht' }, RITA, JETZT);
  await seiteSpeichern(s.entwurfsOrt, sei('l', 'Lager', JUGEND), JETZT);
  await statusSetzen(s.entwurfsOrt, 'l', { zustand: 'loeschenAngefragt' }, RITA, JETZT);
  const entwurf = websiteAusWerten(s.werte[ENTWUERFE]);
  return {
    entwurf,
    online: onlineSicht(entwurf, [
      { bereich: null, kategorie: ONLINE, stand: websiteAusWerten(s.werte[ONLINE]) },
      {
        bereich: JUGEND,
        kategorie: JUGEND_ONLINE,
        stand: websiteAusWerten(s.werte[JUGEND_ONLINE]),
      },
    ]),
  };
}

async function zeigen(zugang: Zugang, person = 1) {
  render(
    <Freigaben
      kategorien={KAT}
      daten={await daten()}
      zugang={zugang}
      ich={{ person, name: 'Helene', fenster: 'f1' }}
      gemeinde="ECG"
      gruppe={344}
      bereiche={NAMEN}
      onGeaendert={vi.fn()}
    />,
  );
}
const liste = () => screen.getByRole('complementary', { name: 'Freigaben' });

beforeEach(() => {
  vi.clearAllMocks();
  d.gebeFrei.mockResolvedValue({ stand: 'x', statusEntfernt: true });
  d.gebeAllesFrei.mockResolvedValue({ geschafft: [], fehler: null, offen: 0 });
  m.mailFreigaben.mockResolvedValue({ art: 'aus' });
});

describe('Leitung der Untergruppe', () => {
  it('sieht nur die Seiten ihres Bereichs – auch die zu verschiebende – und kein Menü', async () => {
    await zeigen(JUGEND_LEITUNG);
    expect(within(liste()).getByText('Jugendabend')).toBeTruthy();
    expect(within(liste()).getByText('Freizeit')).toBeTruthy();
    expect(within(liste()).queryByText('Aktuelles')).toBeNull();
    expect(within(liste()).queryByText('Menü')).toBeNull();
  });

  it('die zu verschiebende Seite sagt es in der Zeile unter dem Titel', async () => {
    await zeigen(JUGEND_LEITUNG);
    fireEvent.click(within(liste()).getByText('Freizeit'));
    expect(await screen.findByText(/Steht online noch in einem anderen Bereich/)).toBeTruthy();
    expect(screen.getByText(/Bereich „Website – Jugend“/)).toBeTruthy();
  });

  it('„Alles freigeben“ nimmt nur ihre eingereichte Seite', async () => {
    await zeigen(JUGEND_LEITUNG);
    fireEvent.click(screen.getByRole('button', { name: 'Alles freigeben' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Alles freigeben',
      }),
    );
    await waitFor(() => expect(d.gebeAllesFrei).toHaveBeenCalledTimes(1));
    expect(d.gebeAllesFrei.mock.calls[0][1]).toEqual([{ einheit: 'seite', id: 'j' }]);
  });

  it('Leitung der Untergruppe, die alle sieht: ihre eigene eingereichte Website-Seite ohne Knöpfe, „Alles freigeben“ ohne sie', async () => {
    // Rita (5) leitet Jugend und ist Mitglied der Website: Sie sieht A (selbst eingereicht) wie ein Redakteur.
    await zeigen({ sieht: 'alle', leitet: [JUGEND] }, RITA.person);
    fireEvent.click(within(liste()).getByText('Aktuelles'));
    await screen.findByText(/Eingereicht von Rita/);
    expect(screen.queryByRole('button', { name: 'Freigeben' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mit Anmerkung zurück' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Alles freigeben' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Alles freigeben',
      }),
    );
    await waitFor(() => expect(d.gebeAllesFrei).toHaveBeenCalledTimes(1));
    expect(d.gebeAllesFrei.mock.calls[0][1]).toEqual([{ einheit: 'seite', id: 'j' }]);
  });

  it('Freigeben einer verschobenen Seite, die im alten Bereich bleibt: Meldung „steht zusätzlich noch … im Bereich „Website““', async () => {
    d.gebeFrei.mockResolvedValue({ stand: 'x', statusEntfernt: true, bleibtIn: [null] });
    await zeigen(JUGEND_LEITUNG);
    fireEvent.click(within(liste()).getByText('Freizeit'));
    fireEvent.click(await screen.findByRole('button', { name: 'Veröffentlichen' }));
    expect(
      await screen.findByText(
        /„Freizeit“ ist online\. „Freizeit“ steht zusätzlich noch online im Bereich „Website“/,
      ),
    ).toBeTruthy();
  });

  it('Löschen bestätigt: mit dem Bereich der Seite; fehlt im fremden Bereich das Recht, nennt die Meldung ihn', async () => {
    d.entferneSeiteUndOnline.mockResolvedValue({ bleibtIn: [null] });
    d.speichereMenue.mockResolvedValue(undefined);
    await zeigen(JUGEND_LEITUNG);
    fireEvent.click(within(liste()).getByText('Lager'));
    fireEvent.click(await screen.findByRole('button', { name: 'Löschen und offline nehmen' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Löschen und offline nehmen',
      }),
    );
    await waitFor(() => expect(d.entferneSeiteUndOnline).toHaveBeenCalledWith(KAT, 'l', JUGEND));
    expect(
      await screen.findByText(
        /„Lager“ ist gelöscht\. Sie steht aber noch online im Bereich „Website“/,
      ),
    ).toBeTruthy();
  });
});
