// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { datumText, tagPunkt } from '@shared/ct/datum';
import { heuteImKalender } from '@shared/ct/zeit';
import { GRUNDWERTE, sommerferienAus, wechseljahre } from '@shared/organigramm/gruppenwechsel';
import type { KjDaten, KjMitglied } from '@shared/organigramm/gruppenwechselSicht';
import type { Gelesen, RegelRoh } from '@shared/organigramm/einrichtungStand';
import { REGELN } from '@shared/organigramm/gruppenwechsel';
import { EinrichtenFenster } from './EinrichtenFenster';
import { EinrichtungSeite, NichtEingerichtet } from './EinrichtungSeite';
import { ladeFerien, ladeKjDaten } from './ladeKinderJugend';
import { ladeEinrichtungStand } from './ladeEinrichtungStand';
import { ladeKalenderNamen, ladeRegelnDerStufen, ladeTypVorhanden } from './ladeEinrichten';
import { waehleSpitze } from './spitzenAuswahl.testutil';
import {
  EINRICHTUNG,
  FISCHE,
  gutesStand,
  JUNGSCHAR,
  SCHAEFCHEN,
  START,
  TEENY,
} from './einrichten.testutil';

vi.mock('./ladeKinderJugend', () => ({ ladeFerien: vi.fn(), ladeKjDaten: vi.fn() }));
vi.mock('./ladeEinrichtungStand', () => ({ ladeEinrichtungStand: vi.fn() }));
vi.mock('./ladeEinrichten', () => ({
  ladeKalenderNamen: vi.fn(),
  ladeTypVorhanden: vi.fn(),
  ladeRegelnDerStufen: vi.fn(),
}));
const ferienLaden = vi.mocked(ladeFerien);
const kjLaden = vi.mocked(ladeKjDaten);
const standLaden = vi.mocked(ladeEinrichtungStand);
const kalenderLaden = vi.mocked(ladeKalenderNamen);
const typLaden = vi.mocked(ladeTypVorhanden);
const regelnLaden = vi.mocked(ladeRegelnDerStufen);

const JAHR = Number(heuteImKalender().slice(0, 4)) + 1;
const FERIEN = sommerferienAus(
  [0, 1, 2].map((i) => ({
    titel: `Sommerferien NRW ${JAHR + i}`,
    beginn: `${JAHR + i}-07-19`,
    ende: `${JAHR + i}-08-31`,
  })),
  GRUNDWERTE.ferienStichwort,
);
const JAHRE = wechseljahre(FERIEN, GRUNDWERTE);

const kind = (personId: number, name: string): KjMitglied => ({
  personId,
  name,
  leitung: false,
  status: 'active',
  statusGeaendert: null,
});
// Am 30.09. des nächsten Wechseljahres: Anna 7 (wechselt in die Fische), Ben 5, Cleo 10 (wechselt in die Jungschar), Dora ohne Geburtstag.
const geb = (alter: number) => `${JAHR - alter}-03-15`;
const KJ: KjDaten = {
  gruppen: new Map([
    [SCHAEFCHEN, { art: 'sichtbar', mitglieder: [kind(10, 'Anna'), kind(11, 'Ben')] }],
    [FISCHE, { art: 'sichtbar', mitglieder: [kind(20, 'Cleo'), kind(21, 'Dora')] }],
    [JUNGSCHAR, { art: 'sichtbar', mitglieder: [] }],
  ]),
  geburtstage: new Map<number, string | null>([
    [10, geb(7)],
    [11, geb(5)],
    [20, geb(10)],
    [21, null],
  ]),
};
const ok = <T,>(wert: T): Gelesen<T> => ({ ok: true, wert });
const KEINE_REGELN = new Map<number, Gelesen<readonly RegelRoh[]>>([
  [SCHAEFCHEN, ok([])],
  [FISCHE, ok([])],
  [JUNGSCHAR, ok([])],
]);

beforeEach(() => {
  ferienLaden.mockReset().mockResolvedValue({ art: 'da', jahre: JAHRE, ferien: FERIEN });
  kjLaden.mockReset().mockResolvedValue({ art: 'da', daten: KJ, rechte: new Map() });
  standLaden.mockReset().mockResolvedValue(gutesStand());
  kalenderLaden.mockReset().mockResolvedValue(ok([GRUNDWERTE.ferienkalender, 'Gemeinde']));
  typLaden.mockReset().mockResolvedValue(ok(true));
  regelnLaden.mockReset().mockResolvedValue(KEINE_REGELN);
});
afterEach(cleanup);

const onSchliessen = vi.fn();
const onGeschrieben = vi.fn();
const fenster = (art: 'einrichten' | 'aendern', standDaten?: ReturnType<typeof gutesStand>) =>
  render(
    <EinrichtenFenster
      art={art}
      start={START}
      einrichtung={art === 'aendern' ? EINRICHTUNG : null}
      standDaten={standDaten}
      onSchliessen={onSchliessen}
      onGeschrieben={onGeschrieben}
    />,
  );
const weiter = () => fireEvent.click(screen.getByRole('button', { name: 'Weiter zur Vorschau' }));
const zurVorschau = async () => {
  weiter();
  await screen.findByText('Wer wechselt wann wohin');
};
const hauptKnopf = () =>
  screen.getByRole('button', { name: /^(Jetzt einrichten|Änderungen schreiben)$/ });
/** Der Hauptknopf ist an (seit O9-5d schreibt er): alles gelesen und gut. */
const bereit = () => !(hauptKnopf() as HTMLButtonElement).disabled;

/** Das erste Einrichten, fertig ausgefüllt: Bereich, drei Stufen. */
function ausfuellen() {
  waehleSpitze('Wechsel-Gruppen anlegen unter', 'Kinder & Jugend');
  waehleSpitze('Gruppe der Stufe 1', 'Schäfchen');
  waehleSpitze('Gruppe der Stufe 2', 'Fische');
  fireEvent.change(screen.getByLabelText('ab Alter, Stufe 1'), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('ab Alter, Stufe 2'), { target: { value: '7' } });
}

describe('Fenster öffnen – aus beiden Stellen', () => {
  it('„Einrichten …“ auf der Seite „noch nicht eingerichtet“ öffnet das Modal-Fenster; der Satz „folgt“ ist weg', () => {
    render(<NichtEingerichtet start={START} onGeschrieben={onGeschrieben} />);
    expect(screen.queryByText(/Einrichten folgt/)).toBeNull();
    expect(screen.getByText('Es wird erst nach einer Vorschau etwas angelegt.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Einrichten …' }));
    const d = screen.getByRole('dialog', { name: 'Gruppenwechsel einrichten' });
    expect(d.getAttribute('aria-modal')).toBe('true');
    // Schrittanzeige: Stufen › Vorschau › Fertig, der erste Schritt läuft
    const schritte = within(screen.getByRole('list', { name: 'Schritte' }));
    expect(schritte.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '1Stufen',
      '2Vorschau',
      '3Fertig',
    ]);
    expect(schritte.getByText('Stufen').closest('li')?.getAttribute('aria-current')).toBe('step');
    fireEvent.click(screen.getByRole('button', { name: 'Fenster schließen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('„Stufen ändern …“ unter der Karte „Stufen“ öffnet das Fenster, vorbelegt mit der gespeicherten Einrichtung', async () => {
    render(
      <EinrichtungSeite
        start={START}
        einrichtung={EINRICHTUNG}
        regel={{ art: 'nichtPruefbar' }}
        jahr={JAHR}
        onGeschrieben={onGeschrieben}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Stufen ändern …' }));
    expect(screen.getByRole('dialog', { name: 'Stufen ändern' })).toBeTruthy();
    // Die Bereichsgruppe ist beim Ändern gesperrt (O9-F11): nur Anzeige, keine Auswahl.
    expect(screen.queryByRole('button', { name: /Wechsel-Gruppen anlegen unter/ })).toBeNull();
    expect(screen.getByText('Wechsel-Gruppen hängen unter')).toBeTruthy();
    expect(
      within(screen.getByRole('dialog', { name: 'Stufen ändern' })).getByText('Kinder & Jugend'),
    ).toBeTruthy();
    expect(screen.getByText(/Lässt sich hier nicht ändern/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gruppe der Stufe 2: Fische' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('ab Alter, Stufe 2').value).toBe('7');
    expect(screen.getByLabelText<HTMLInputElement>('Ankündigung').value).toBe('8');
    expect(screen.getByLabelText<HTMLInputElement>('Stichtag fürs Alter').value).toBe('30.09.');
    await screen.findByText('Gruppentyp „Gruppenwechsel“'); // die Seite hat ihren Stand gelesen
  });

  it('den Stand, den die Seite schon gelesen hat, liest das Fenster nicht noch einmal', async () => {
    render(
      <EinrichtungSeite
        start={START}
        einrichtung={EINRICHTUNG}
        regel={{ art: 'nichtPruefbar' }}
        jahr={JAHR}
        onGeschrieben={onGeschrieben}
      />,
    );
    await screen.findByText('Gruppentyp „Gruppenwechsel“');
    expect(standLaden).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Stufen ändern …' }));
    await zurVorschau();
    await screen.findByRole('list', { name: 'Das legt die Erweiterung an' });
    expect(standLaden).toHaveBeenCalledTimes(1);
  });
});

describe('Schritt „Stufen“', () => {
  it('Einrichten: noch nichts gewählt – „Weiter“ bleibt stehen und nennt, was fehlt; danach geht es', async () => {
    fenster('einrichten');
    weiter();
    expect(screen.queryByText('Wer wechselt wann wohin')).toBeNull();
    expect(screen.getByText('Hier fehlt noch etwas – siehe die roten Hinweise.')).toBeTruthy();
    expect(
      screen.getByText(/Es ist noch keine Gruppe gewählt, unter der die Wechsel-Gruppen/),
    ).toBeTruthy();
    expect(screen.getByText('Gruppe 1: Es ist noch keine Gruppe gewählt.')).toBeTruthy();
    ausfuellen();
    await zurVorschau();
  });

  it('einmal Gruppe doppelt gewählt und Bereich = Stufe: Es geht nicht weiter, jedes Mal mit Satz', () => {
    fenster('einrichten');
    waehleSpitze('Wechsel-Gruppen anlegen unter', 'Schäfchen');
    waehleSpitze('Gruppe der Stufe 1', 'Schäfchen');
    waehleSpitze('Gruppe der Stufe 2', 'Schäfchen');
    fireEvent.change(screen.getByLabelText('ab Alter, Stufe 1'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('ab Alter, Stufe 2'), { target: { value: '7' } });
    weiter();
    expect(screen.getByText(/„Schäfchen“ steht zweimal/)).toBeTruthy();
    expect(screen.getByText(/„Schäfchen“ ist eine Stufe und kann nicht zugleich/)).toBeTruthy();
    expect(screen.queryByText('Wer wechselt wann wohin')).toBeNull();
  });

  it('Alter, das nicht steigt, steht bei den Stufen', () => {
    fenster('aendern');
    fireEvent.change(screen.getByLabelText('ab Alter, Stufe 2'), { target: { value: '4' } });
    weiter();
    expect(screen.getByText('„Fische“ muss ein höheres Alter haben als „Schäfchen“.')).toBeTruthy();
    expect(screen.queryByText('Wer wechselt wann wohin')).toBeNull();
  });

  it('Stufen nach unten und oben schieben – die Reihenfolge gilt auch für die Prüfung', async () => {
    fenster('aendern');
    fireEvent.click(screen.getByRole('button', { name: 'Stufe 1 nach unten' }));
    expect(screen.getByRole('button', { name: 'Gruppe der Stufe 1: Fische' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gruppe der Stufe 2: Schäfchen' })).toBeTruthy();
    // das Alter wandert mit der Gruppe
    expect(screen.getByLabelText<HTMLInputElement>('ab Alter, Stufe 1').value).toBe('7');
    weiter();
    expect(screen.getByText('„Schäfchen“ muss ein höheres Alter haben als „Fische“.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stufe 2 nach oben' }));
    await zurVorschau();
  });

  it('erste Stufe kann nicht nach oben, letzte nicht nach unten', () => {
    fenster('aendern');
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Stufe 1 nach oben' }).disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Stufe 3 nach unten' }).disabled,
    ).toBe(true);
  });

  it('entfernen: bis zwei Stufen; mit zweien ist der Knopf aus', () => {
    fenster('aendern');
    fireEvent.click(screen.getByRole('button', { name: 'Stufe 3 entfernen' }));
    expect(screen.queryByLabelText('ab Alter, Stufe 3')).toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Stufe 1 entfernen' }).disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Stufe 2 entfernen' }).disabled,
    ).toBe(true);
  });

  it('Stufe hinzufügen: eine leere Zeile mit dem Alter der letzten + 3; ohne Gruppe geht es nicht weiter', () => {
    fenster('aendern');
    fireEvent.click(screen.getByRole('button', { name: 'Stufe hinzufügen' }));
    expect(screen.getByLabelText<HTMLInputElement>('ab Alter, Stufe 4').value).toBe('13');
    expect(
      screen.getByRole('button', { name: 'Gruppe der Stufe 4: Gruppe wählen …' }),
    ).toBeTruthy();
    weiter();
    expect(screen.getByText('Gruppe 4: Es ist noch keine Gruppe gewählt.')).toBeTruthy();
    waehleSpitze('Gruppe der Stufe 4', 'Teeny');
    expect(screen.getByRole('button', { name: 'Gruppe der Stufe 4: Teeny' })).toBeTruthy();
  });

  it('Ankündigung in Wochen; weitere Einstellungen sind zugeklappt, und ein Fehler darin klappt sie auf', () => {
    fenster('aendern');
    const mehr = screen.getByText('Weitere Einstellungen').closest('details')!;
    expect(mehr.open).toBe(false);
    fireEvent.change(screen.getByLabelText('Ankündigung'), { target: { value: '0' } });
    weiter();
    expect(mehr.open).toBe(true);
    expect(screen.getByText('Die Ankündigung braucht mindestens einen Tag Vorlauf.')).toBeTruthy();
  });

  it('der Ferienkalender kommt aus den sichtbaren Kalendern, mit dem Hinweis bis wann Sommerferien da sind', async () => {
    fenster('aendern');
    const kal = await screen.findByLabelText<HTMLSelectElement>('Ferien aus dem Kalender');
    await waitFor(() =>
      expect([...kal.options].map((o) => o.value)).toEqual([GRUNDWERTE.ferienkalender, 'Gemeinde']),
    );
    expect(kal.value).toBe(GRUNDWERTE.ferienkalender);
    expect(await screen.findByText(`Sommerferien gefunden bis ${JAHR + 2}.`)).toBeTruthy();
  });

  it('der gespeicherte Kalender bleibt in der Liste, auch wenn er nicht zu sehen ist – er wird nicht still ersetzt', async () => {
    kalenderLaden.mockResolvedValue(ok(['Gemeinde']));
    fenster('aendern');
    const kal = screen.getByLabelText<HTMLSelectElement>('Ferien aus dem Kalender');
    await waitFor(() =>
      expect([...kal.options].map((o) => o.value)).toEqual([GRUNDWERTE.ferienkalender, 'Gemeinde']),
    );
    expect(kal.value).toBe(GRUNDWERTE.ferienkalender);
  });

  it('ein Tipp neben das Fenster schließt es nicht, wenn etwas eingegeben wurde – ohne Eingaben schon', () => {
    fenster('aendern');
    const overlay = screen.getByRole('dialog').parentElement as HTMLElement;
    onSchliessen.mockClear();
    fireEvent.click(overlay);
    expect(onSchliessen).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('ab Alter, Stufe 3'), { target: { value: '11' } });
    fireEvent.click(overlay);
    expect(onSchliessen).toHaveBeenCalledTimes(1);
  });
});

describe('Schritt „Vorschau“', () => {
  it('„Wer wechselt wann wohin“: Jahr × Übergang mit den Zahlen von werWechselt, Wechseltag, Namen zum Aufklappen', async () => {
    fenster('aendern');
    await zurVorschau();
    const tabelle = await screen.findByRole('table');
    const zeilen = within(tabelle).getAllByRole('row');
    expect(
      within(zeilen[0])
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Jahr', 'Wechseltag', 'Schäfchen → Fische', 'Fische → Jungschar']);
    // 1. Jahr: Anna → Fische, Cleo → Jungschar; die späteren Jahre sind der heutige Stand
    expect(
      within(zeilen[1])
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual([String(JAHR), datumText(JAHRE[0].wechseltag), '1', '1']);
    expect(zeilen).toHaveLength(1 + JAHRE.length);
    expect(screen.getByText(`Namen für ${JAHR} zeigen`)).toBeTruthy();
    expect(screen.getByText('Anna')).toBeTruthy();
    expect(screen.getByText('Cleo')).toBeTruthy();
    expect(screen.getByText(/die Zahlen sind der heutige Stand/)).toBeTruthy();
  });

  it('der gelbe Hinweis zählt die Kinder ohne Geburtstag', async () => {
    fenster('aendern');
    await zurVorschau();
    expect(
      await screen.findByText(/1 Kind ohne Geburtstag wechselt nie von selbst\./),
    ).toBeTruthy();
    // Einzahl: „Es steht …“, nicht „Sie stehen …“.
    expect(screen.getByText(/Es steht unter „Daten pflegen“\./)).toBeTruthy();
    expect(screen.queryByText(/Sie stehen unter „Daten pflegen“/)).toBeNull();
  });

  it('„Das legt die Erweiterung in ChurchTools an“: aus dem Plan – beim Ändern ist das meiste „vorhanden“', async () => {
    fenster('aendern', gutesStand());
    await zurVorschau();
    const liste = await screen.findByRole('list', { name: 'Das legt die Erweiterung an' });
    const zeilen = within(liste).getAllByRole('listitem');
    expect(zeilen.map((z) => z.querySelector('span')?.textContent)).toEqual([
      'vorhanden',
      'vorhanden',
      'vorhanden',
      'vorhanden',
      'ändern',
    ]);
    expect(within(liste).getByText('Regeln in 5 Gruppen')).toBeTruthy();
    // die Rechte als Chips
    expect(within(liste).getByText('Gruppeninfos sehen')).toBeTruthy();
    expect(typLaden).toHaveBeenCalledTimes(1);
  });

  it('beim ersten Einrichten ist alles neu – auch wenn es den Typ schon gibt, wird er nicht noch einmal angelegt', async () => {
    typLaden.mockResolvedValue(ok(false));
    fenster('einrichten');
    ausfuellen();
    await zurVorschau();
    const liste = await screen.findByRole('list', { name: 'Das legt die Erweiterung an' });
    expect(
      within(liste)
        .getAllByRole('listitem')
        .map((z) => z.querySelector('span')?.textContent),
    ).toEqual(['neu', 'neu', 'neu', 'neu', 'neu']);
    expect(standLaden).not.toHaveBeenCalled(); // es gibt noch keine Einrichtung, deren Stand es zu lesen gäbe
  });

  it('solange der Gruppentyp noch gefragt wird, steht kein Plan da – „noch nicht gelesen“ sieht nie aus wie „fehlt“', async () => {
    typLaden.mockReturnValue(new Promise(() => {}));
    fenster('aendern', gutesStand());
    await zurVorschau();
    expect(await screen.findByText('Der Stand in ChurchTools wird geprüft …')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Das legt die Erweiterung an' })).toBeNull();
    expect(screen.queryByText('Nicht alles ließ sich prüfen:')).toBeNull();
    expect(bereit()).toBe(false);
  });

  it('der Typ ließ sich nicht prüfen: gelber Hinweis, nie „neu“ oder „vorhanden“', async () => {
    typLaden.mockResolvedValue({ ok: false });
    fenster('aendern', gutesStand());
    await zurVorschau();
    expect(await screen.findByText('Nicht alles ließ sich prüfen:')).toBeTruthy();
    expect(screen.getByText('ließ sich gerade nicht prüfen')).toBeTruthy();
    expect(bereit()).toBe(false);
  });

  it('„Es wird keine Mail verschickt“ mit dem echten Ankündigungsdatum des ersten Jahres – und es richtet sich nach den Wochen', async () => {
    fenster('aendern');
    fireEvent.change(screen.getByLabelText('Ankündigung'), { target: { value: '6' } });
    await zurVorschau();
    const sechs = wechseljahre(FERIEN, { ...GRUNDWERTE, ankuendigungTage: 42 })[0].ankuendigung;
    expect(sechs).not.toBe(JAHRE[0].ankuendigung);
    expect(
      await screen.findByText(
        new RegExp(`Es wird keine Mail verschickt.*am ${tagPunkt(sechs).replace(/\./g, '\\.')}`),
      ),
    ).toBeTruthy();
  });

  it('Ferienkalender nicht gefunden: eine Meldung statt der Tabelle, und es wird nicht geschrieben', async () => {
    ferienLaden.mockResolvedValue({ art: 'keinKalender' });
    fenster('aendern', gutesStand());
    await zurVorschau();
    expect(
      await screen.findByText(
        /Den Kalender „.*“ gibt es nicht oder er ist für dich nicht sichtbar\./,
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(bereit()).toBe(false);
  });

  it('die Kinder ließen sich nicht lesen: Meldung mit „Erneut versuchen“, kein Zahlenblock', async () => {
    kjLaden.mockResolvedValue({ art: 'fehler' });
    fenster('aendern');
    await zurVorschau();
    expect(await screen.findByText('Die Kinder ließen sich gerade nicht lesen.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('Zurück führt zu den Stufen, mit den Eingaben', async () => {
    fenster('aendern');
    fireEvent.change(screen.getByLabelText('ab Alter, Stufe 3'), { target: { value: '11' } });
    await zurVorschau();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(screen.getByLabelText<HTMLInputElement>('ab Alter, Stufe 3').value).toBe('11');
  });

  it('die Vorschau liest für die gewählten Stufen (nicht für die gespeicherten)', async () => {
    fenster('aendern');
    fireEvent.click(screen.getByRole('button', { name: 'Stufe hinzufügen' }));
    waehleSpitze('Gruppe der Stufe 4', 'Teeny');
    await zurVorschau();
    await waitFor(() => expect(regelnLaden).toHaveBeenCalled());
    expect(regelnLaden.mock.calls[0][0]).toEqual([SCHAEFCHEN, FISCHE, JUNGSCHAR, TEENY]);
    expect(kjLaden.mock.calls[0][0].einstellung.stufen.map((s) => s.gruppeId)).toEqual([
      SCHAEFCHEN,
      FISCHE,
      JUNGSCHAR,
      TEENY,
    ]);
    expect(kjLaden.mock.calls[0][0].wechselGruppen).toEqual([]);
  });
});

describe('Fußzeile und Haken', () => {
  it('der Hauptknopf ist an, sobald alles gelesen und gut ist – Beschriftung je nach Fall; den Satz „folgt“ gibt es nicht mehr', async () => {
    fenster('aendern', gutesStand());
    await zurVorschau();
    await screen.findByRole('list', { name: 'Das legt die Erweiterung an' });
    const k = hauptKnopf() as HTMLButtonElement;
    expect(k.textContent).toBe('Änderungen schreiben');
    expect(screen.queryByText(/nächsten Fassung/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zurück' })).toBeTruthy();
    // beim Ändern gibt es keinen Haken (O9-F4 gilt fürs Einrichten)
    expect(screen.queryByRole('checkbox')).toBeNull();
    // alles gelesen und gut: an
    await waitFor(() => expect(!k.disabled).toBe(true));
  });

  it('Einrichten: erst mit dem Haken „Rechte der Leitung geprüft“ ist der Knopf an', async () => {
    fenster('einrichten');
    ausfuellen();
    await zurVorschau();
    await screen.findByRole('list', { name: 'Das legt die Erweiterung an' });
    const k = hauptKnopf() as HTMLButtonElement;
    expect(k.textContent).toBe('Jetzt einrichten');
    expect(k.disabled).toBe(true); // ohne Haken
    const haken = await screen.findByRole<HTMLInputElement>('checkbox');
    await waitFor(() => expect(haken.disabled).toBe(false));
    expect(!k.disabled).toBe(false);
    fireEvent.click(haken);
    expect(!k.disabled).toBe(true);
    fireEvent.click(haken);
    expect(!k.disabled).toBe(false);
  });

  it('der Haken gilt nur für diesen Durchgang: Zurück und wieder vor setzt ihn zurück', async () => {
    fenster('einrichten');
    ausfuellen();
    await zurVorschau();
    const haken = await screen.findByRole<HTMLInputElement>('checkbox');
    await waitFor(() => expect(haken.disabled).toBe(false));
    fireEvent.click(haken);
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    await zurVorschau();
    expect(screen.getByRole<HTMLInputElement>('checkbox').checked).toBe(false);
  });
});

describe('Stopp bei fremden Regeln', () => {
  it('eine gewählte Gruppe hat Regeln, die nicht von uns sind: roter Hinweis mit Gruppe und Zahl, Haken aus, nie „an“', async () => {
    regelnLaden.mockResolvedValue(
      new Map<number, Gelesen<readonly RegelRoh[]>>([
        [SCHAEFCHEN, ok([])],
        [
          FISCHE,
          ok([
            { shorty: 'jugendliste' },
            { shorty: 'noch-eine' },
            { shorty: REGELN.kinder.shorty },
          ]),
        ],
        [JUNGSCHAR, ok([])],
      ]),
    );
    fenster('einrichten');
    ausfuellen();
    await zurVorschau();
    const alarm = await screen.findByRole('alert');
    expect(alarm.textContent).toContain('„Fische“ hat schon eigene Regeln in ChurchTools');
    expect(alarm.textContent).toContain('2 Regeln');
    expect(alarm.textContent).toContain('„jugendliste“');
    expect(alarm.textContent).toContain('Einrichten würde sie ersetzen');
    expect(alarm.textContent).toContain('Deshalb geht es hier nicht weiter');
    const haken = screen.getByRole<HTMLInputElement>('checkbox');
    expect(haken.disabled).toBe(true);
    expect(bereit()).toBe(false);
  });

  it('beim Ändern heißt es „Das Schreiben würde sie ersetzen“, und auch dort ist es ein Stopp', async () => {
    regelnLaden.mockResolvedValue(
      new Map<number, Gelesen<readonly RegelRoh[]>>([
        [SCHAEFCHEN, ok([])],
        [FISCHE, ok([{ shorty: 'jugendliste' }])],
        [JUNGSCHAR, ok([])],
      ]),
    );
    fenster('aendern', gutesStand());
    await zurVorschau();
    const alarm = await screen.findByRole('alert');
    expect(alarm.textContent).toContain('1 Regel,');
    expect(alarm.textContent).toContain('Das Schreiben würde sie ersetzen');
    expect(bereit()).toBe(false);
  });

  it('Regeln nur von uns: kein Stopp', async () => {
    regelnLaden.mockResolvedValue(
      new Map<number, Gelesen<readonly RegelRoh[]>>([
        [SCHAEFCHEN, ok(Object.values(REGELN).map((r) => ({ shorty: r.shorty })))],
        [FISCHE, ok([])],
        [JUNGSCHAR, ok([])],
      ]),
    );
    fenster('aendern', gutesStand());
    await zurVorschau();
    await screen.findByRole('list', { name: 'Das legt die Erweiterung an' });
    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => expect(bereit()).toBe(true));
  });
});

describe('Stopp bei Regeln, die sich nicht lesen ließen', () => {
  it('„ließ sich nicht prüfen“ – nie so tun, als gäbe es keine; „Nochmal prüfen“ fragt noch einmal', async () => {
    regelnLaden.mockResolvedValueOnce(
      new Map<number, Gelesen<readonly RegelRoh[]>>([
        [SCHAEFCHEN, ok([])],
        [FISCHE, { ok: false }],
        [JUNGSCHAR, ok([])],
      ]),
    );
    fenster('aendern', gutesStand());
    await zurVorschau();
    const alarm = await screen.findByRole('alert');
    expect(alarm.textContent).toContain('Die Regeln von „Fische“ ließen sich nicht prüfen.');
    expect(alarm.textContent).toContain('nie angenommen, dass es keine gibt');
    expect(bereit()).toBe(false);
    // beim zweiten Mal klappt es
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal prüfen' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(regelnLaden).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(bereit()).toBe(true));
  });

  it('solange die Regeln noch geladen werden, ist es auch nicht „an“', async () => {
    regelnLaden.mockReturnValue(new Promise(() => {}));
    fenster('aendern', gutesStand());
    await zurVorschau();
    await screen.findByRole('list', { name: 'Das legt die Erweiterung an' });
    expect(bereit()).toBe(false);
  });
});
