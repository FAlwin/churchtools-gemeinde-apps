// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vorlageZeilenAus } from '@shared/ct/ablaufVorlagenListe';
import { ablaufZeileAus } from '@shared/ct/ablaufZeile';
import type { CtAgendaItem } from '@shared/ct/typen';
import { AblaufListe } from './AblaufListe';
import {
  useAblaufBearbeiten,
  type AblaufAktionen,
  type VorlagenAktionen,
} from './useAblaufBearbeiten';

/**
 * **Der Vorlagen-Modus des Ablauf-Bausteins** (E10-V3a). Jede Regel doppelt: in der Vorlage so, am Termin mit denselben
 * Daten wie bisher – damit der Modus nichts am Termin-Verhalten verschiebt. Die Zeilen kommen aus den Erzeugern
 * (`ablaufZeileAus` für den Termin, `vorlageZeilenAus` für die Vorlage), nicht aus handgeschriebenen Zeilen.
 */
afterEach(cleanup);

/** Ein Ablauf, wie ChurchTools ihn aus einer Vorlage liefert: Platzhalter `[Moderation]`, ein Punkt vor dem Beginn. */
const ROH: CtAgendaItem[] = [
  { id: 1, position: 0, title: 'Soundcheck', type: 'normal', duration: 600, isBeforeEvent: true },
  { id: 2, position: 1, title: 'Ankommen', type: 'header', duration: 0 },
  {
    id: 3,
    position: 2,
    title: 'Begrüßung',
    type: 'normal',
    duration: 300,
    // Eine Vorlage hat nie eine Uhrzeit – ein `start` darf trotzdem nicht als solche durchkommen.
    start: '2026-11-01T09:00:00Z',
    responsible: { text: '[Moderation]', persons: [{ service: 'Moderation' }] },
    serviceGroupNotes: [{ serviceGroupId: 3, note: 'Folie 1' }],
  },
];

const INFO_GRUPPEN = [{ id: 3, name: 'Technik' }];

// Einmal gebaut: Ein neues `items` bei jedem Zeichnen ließe den Hook endlos neu aufsetzen.
const VORLAGEN_ZEILEN = vorlageZeilenAus({ items: ROH });
const TERMIN_ZEILEN = ROH.map((i) => ablaufZeileAus(i, 7, 'Europe/Berlin'));

const vorlagenAktionen = (): VorlagenAktionen => ({
  reorder: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve(null)),
  restore: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  setVorBeginn: vi.fn(() => Promise.resolve()),
  add: vi.fn(() => Promise.resolve()),
});
const terminAktionen = (): AblaufAktionen => ({
  ...vorlagenAktionen(),
  setWeggelassen: vi.fn(() => Promise.resolve()),
});

function Vorlage({ aktionen }: { aktionen: VorlagenAktionen }) {
  const b = useAblaufBearbeiten({
    vorlage: true,
    aktiv: true,
    bereit: true,
    items: VORLAGEN_ZEILEN,
    abgeschlossen: false,
    sperrHinweis: 'gesperrt',
    aktionen,
    dienste: [],
    // Infos je Dienstgruppe gelten in der Vorlage wie am Termin (ChurchTools speichert sie an Text- und Lied-Punkten).
    infoGruppen: INFO_GRUPPEN,
    infoSpalten: INFO_GRUPPEN,
    gruppenVerborgen: true,
    plusImKopf: true,
    hinweisLinks: [
      { label: 'Umbenennen …', icon: 'pencil', onClick: vi.fn() },
      { label: 'Löschen …', icon: 'trash', onClick: vi.fn(), gefahr: true },
    ],
  });
  return (
    <>
      <div data-testid="kopf">{b.kopfKnopf}</div>
      <div data-testid="liste">{b.liste}</div>
      {b.ueberlagerung}
    </>
  );
}

function Termin({ aktionen }: { aktionen: AblaufAktionen }) {
  const b = useAblaufBearbeiten({
    aktiv: true,
    bereit: true,
    items: TERMIN_ZEILEN,
    beginn: '10:00',
    abgeschlossen: false,
    sperrHinweis: 'gesperrt',
    aktionen,
    dienste: [],
    infoGruppen: INFO_GRUPPEN,
    infoSpalten: INFO_GRUPPEN,
    gruppenVerborgen: true,
    plusImKopf: true,
  });
  return (
    <>
      <div data-testid="kopf">{b.kopfKnopf}</div>
      <div data-testid="liste">{b.liste}</div>
      {b.ueberlagerung}
    </>
  );
}

/** Den Punkt „Begrüßung“ im Bearbeiten öffnen (der Stift ganz rechts in seiner Zeile). */
function oeffneBegruessung() {
  const zeile = screen.getByText('Begrüßung').closest('button');
  fireEvent.click(zeile as HTMLElement);
}

describe('Punkt-Fenster in der Vorlage', () => {
  it('kein Auge „An diesem Termin weglassen“ – am Termin schon', () => {
    render(<Vorlage aktionen={vorlagenAktionen()} />);
    oeffneBegruessung();
    expect(screen.queryByRole('button', { name: /An diesem Termin weglassen/ })).toBeNull();
    cleanup();
    render(<Termin aktionen={terminAktionen()} />);
    oeffneBegruessung();
    expect(screen.getByRole('button', { name: /An diesem Termin weglassen/ })).toBeTruthy();
  });

  it('der Vorlauf-Schalter bleibt – Vorlagen kennen „vor Beginn“', () => {
    render(<Vorlage aktionen={vorlagenAktionen()} />);
    oeffneBegruessung();
    expect(screen.getByRole('button', { name: /Vor Gottesdienstbeginn/ })).toBeTruthy();
  });

  it('Infos je Dienstgruppe wie am Termin: der Programmpunkt hat das Feld, die Überschrift nicht', () => {
    render(<Vorlage aktionen={vorlagenAktionen()} />);
    oeffneBegruessung();
    expect(screen.getByLabelText('Info für Technik')).toBeTruthy();
    expect(screen.getByText('Infos je Gruppe')).toBeTruthy();
    cleanup();
    render(<Vorlage aktionen={vorlagenAktionen()} />);
    fireEvent.click(screen.getByText('Ankommen').closest('button') as HTMLElement);
    expect(screen.queryByLabelText('Info für Technik')).toBeNull();
    cleanup();
    render(<Termin aktionen={terminAktionen()} />);
    oeffneBegruessung();
    expect(screen.getByLabelText('Info für Technik')).toBeTruthy();
  });

  it('der Hinweis „Du siehst nicht alle Dienstgruppen“ steht in der Vorlage wie am Termin', () => {
    render(<Vorlage aktionen={vorlagenAktionen()} />);
    expect(screen.getAllByText(/nicht alle Dienstgruppen/).length).toBeGreaterThan(0);
    cleanup();
    render(<Termin aktionen={terminAktionen()} />);
    expect(screen.getAllByText(/nicht alle Dienstgruppen/).length).toBeGreaterThan(0);
  });

  it('Neuer Eintrag: unter „Weitere Einstellungen“ Vorlauf und Infos, aber kein Auge; am Termin auch das Auge', () => {
    render(<Vorlage aktionen={vorlagenAktionen()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Programmpunkt hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: /Weitere Einstellungen/ }));
    expect(screen.getByRole('button', { name: /Vor Gottesdienstbeginn/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /An diesem Termin weglassen/ })).toBeNull();
    expect(screen.getByLabelText('Info für Technik')).toBeTruthy();
    cleanup();
    render(<Termin aktionen={terminAktionen()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Programmpunkt hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: /Weitere Einstellungen/ }));
    expect(screen.getByRole('button', { name: /An diesem Termin weglassen/ })).toBeTruthy();
    expect(screen.getByLabelText('Info für Technik')).toBeTruthy();
  });

  it('Speichern kommt ohne `setWeggelassen` aus – die Vorlage braucht keine Attrappe', async () => {
    const a = vorlagenAktionen();
    expect('setWeggelassen' in a).toBe(false);
    render(<Vorlage aktionen={a} />);
    oeffneBegruessung();
    fireEvent.change(screen.getByPlaceholderText('z. B. 5'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(a.update).toHaveBeenCalledWith(3, { durationMin: 20 }, expect.anything()),
    );
  });

  it('Zuständig zeigt den Platzhalter neutral – am Termin als offener Dienst mit „?“', () => {
    render(<Vorlage aktionen={vorlagenAktionen()} />);
    oeffneBegruessung();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/\?/)).toBeNull();
    expect(within(dialog).getAllByText('[Moderation]').length).toBeGreaterThan(0);
    cleanup();
    render(<Termin aktionen={terminAktionen()} />);
    oeffneBegruessung();
    expect(within(screen.getByRole('dialog')).getAllByText(/Moderation \?/).length).toBeGreaterThan(
      0,
    );
  });
});

describe('Zeilen in der Vorlage', () => {
  it('Platzhalter „[Moderation]“ neutral, nicht als roter offener Dienst – am Termin „Moderation ?“ in Rot', () => {
    render(<Vorlage aktionen={vorlagenAktionen()} />);
    const p = screen.getByText('[Moderation]');
    expect(p.className).toMatch(/respName/);
    expect(p.className).not.toMatch(/respOpen/);
    expect(screen.queryByText(/Moderation \?/)).toBeNull();
    cleanup();
    render(<Termin aktionen={terminAktionen()} />);
    const offen = screen.getByText(/Moderation \?/);
    expect(offen.className).toMatch(/respOpen/);
  });

  it('keine Uhrzeit, nur die Dauer; der Balken „Beginn“ ohne Zeit – am Termin mit', () => {
    render(<Vorlage aktionen={vorlagenAktionen()} />);
    const liste = screen.getByTestId('liste');
    expect(liste.textContent).toContain('5 Min');
    expect(liste.textContent).not.toMatch(/\d\d:\d\d/);
    expect(screen.getByRole('separator', { name: 'Beginn' })).toBeTruthy();
    cleanup();
    render(<Termin aktionen={terminAktionen()} />);
    expect(screen.getByRole('separator', { name: 'Beginn 10:00' })).toBeTruthy();
    expect(screen.getByTestId('liste').textContent).toMatch(/\d\d:\d\d/);
  });

  it('Infos der gewählten Spalten als Zeile unter dem Punkt – wie am Termin „Technik: Folie 1“', () => {
    render(<Vorlage aktionen={vorlagenAktionen()} />);
    expect(screen.getByTestId('liste').textContent).toContain('Technik: Folie 1');
    cleanup();
    render(<Termin aktionen={terminAktionen()} />);
    expect(screen.getByTestId('liste').textContent).toContain('Technik: Folie 1');
  });

  it('nichts grau und kein Hinweis „weggelassen“', () => {
    render(<Vorlage aktionen={vorlagenAktionen()} />);
    expect(screen.queryByText(/weggelassen/)).toBeNull();
  });
});

describe('Hinweiszeile: Links', () => {
  it('„Umbenennen …“ und „Löschen …“ (rot) stehen rechts neben der Anleitung', () => {
    render(<Vorlage aktionen={vorlagenAktionen()} />);
    const liste = screen.getByTestId('liste');
    expect(liste.textContent).toContain('zum Sortieren');
    const umbenennen = within(liste).getByRole('button', { name: /Umbenennen …/ });
    const loeschen = within(liste).getByRole('button', { name: /Löschen …/ });
    expect(umbenennen.className).not.toMatch(/hinweisGefahr/);
    expect(loeschen.className).toMatch(/hinweisGefahr/);
    // Kein „Neu aufsetzen …“: Das gehört an einen Termin.
    expect(liste.textContent).not.toContain('Neu aufsetzen');
  });

  it('ohne Links keine Hinweiszeile mit Links – am Termin wie bisher', () => {
    render(<Termin aktionen={terminAktionen()} />);
    expect(screen.queryByRole('button', { name: /Umbenennen/ })).toBeNull();
  });
});

describe('AblaufListe im Vorlagen-Modus (Ansicht)', () => {
  const zeilen = () => VORLAGEN_ZEILEN;

  it('Platzhalter neutral, keine Uhrzeit, kein Beginn-Zeitpunkt; die gewählten Info-Spalten bleiben', () => {
    render(<AblaufListe zeilen={zeilen()} vorlage infoSpalten={INFO_GRUPPEN} />);
    expect(screen.getByText('[Moderation]').className).not.toMatch(/respOpen/);
    expect(document.body.textContent).not.toMatch(/\d\d:\d\d/);
    expect(screen.getByRole('separator', { name: 'Beginn' })).toBeTruthy();
    expect(document.body.textContent).toContain('Folie 1');
    expect(screen.getAllByText(/Technik/).length).toBeGreaterThan(0);
  });

  it('Gegenprobe: ohne `vorlage` sind dieselben Zeilen rot und die Spalte da', () => {
    render(<AblaufListe zeilen={zeilen()} infoSpalten={INFO_GRUPPEN} />);
    expect(screen.getByText(/Moderation \?/).className).toMatch(/respOpen/);
  });
});
