// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import { berechnePreis, euroText } from '@shared/anmeldung/preis';
import { alterAm, type OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { AnmeldeFormular } from './AnmeldeFormular';
import { FeldEingabe } from './FeldEingabe';
import { SCHRIFT, musterAntworten, textAufFarbe } from './daten';
import { titelbildGross } from '@shared/anmeldung/gestaltung';
import { loeschDatum } from '@shared/anmeldung/termin';
import { datumText } from '@shared/ct/datum';
import type { Abgeschickt } from '@shared/anmeldung/senden';

/** Die Instanz der Tests – das Logo kommt nur von dort (#849). */
const BASIS = 'https://ct.test';

const HEUTE = '2026-10-13';

function freizeit(): OeffentlicheEinstellungen {
  const e = neueEinstellungen('freizeit');
  e.termin = {
    beginn: '2026-12-28T15:00',
    ende: '2027-01-02T11:00',
    ort: 'Haus Lutzenberg',
    terminId: 1,
  };
  e.preis = {
    grundpreis: {
      art: 'auswahl',
      betragCent: 0,
      gilt: 'person',
      auswahlName: 'Zimmer',
      optionen: [
        { name: '4-Bett', preisCent: 6552, kontingent: 0, belegt: 0, personenJe: 0 },
        { name: '2-Bett', preisCent: 8900, kontingent: 0, belegt: 0, personenJe: 0 },
      ],
    },
    alter: [{ von: 3, bis: 11, art: 'prozent', wert: 50 }],
    anpassungen: [],
    extras: [{ bezeichnung: 'Bettwäsche', preisCent: 800, gilt: 'person' }],
  };
  e.formular.person.push({
    id: 'f1',
    art: 'eigen',
    typ: 'select',
    frage: 'T-Shirt',
    hilfe: '',
    zustand: 'freiwillig',
    antworten: ['116', '128'],
    verborgen: ['140'],
  });
  return e;
}

const zeigen = (e: OeffentlicheEinstellungen, mitMuster = true) =>
  render(
    <AnmeldeFormular
      ansicht={{
        basis: BASIS,
        name: 'Silvesterfreizeit',
        gemeinde: 'ECG Donrath',
        einstellungen: e,
        freiePlaetze: 3,
      }}
      heute={HEUTE}
      vorschau
      start={mitMuster ? musterAntworten(e, HEUTE) : undefined}
    />,
  );

describe('Anmeldeformular (A5)', () => {
  it('Beschriftung: Pflichtfelder mit * (für Vorleser verborgen), freiwillige mit „(freiwillig)“ – reine Texte ohne', () => {
    const e = freizeit();
    // Ein reiner Text (Überschrift) ist auch „freiwillig“ – zu ihm passt der Zusatz nicht.
    e.formular.person.push({
      id: 'f2',
      art: 'eigen',
      typ: 'ueberschrift',
      frage: 'Zum Schluss',
      hilfe: '',
      zustand: 'freiwillig',
      antworten: [],
    });
    const { container } = zeigen(e);
    const beschriftung = (frage: string) =>
      [...container.querySelectorAll('label')].find((l) => l.firstChild?.textContent === frage)!;
    const pflichtFelder = [...e.formular.anmeldung, ...e.formular.person].filter(
      (f) => f.zustand === 'pflicht',
    );
    const mitBeschriftung = pflichtFelder.filter((f) => beschriftung(f.frage));
    expect(mitBeschriftung.length).toBeGreaterThan(0);
    for (const f of mitBeschriftung) {
      const stern = beschriftung(f.frage).querySelector('[aria-hidden="true"]');
      expect(stern?.textContent).toBe('*');
    }
    expect(beschriftung('T-Shirt').textContent).toBe('T-Shirt (freiwillig)');
    // Je Person einmal – überall ohne Zusatz.
    for (const x of screen.getAllByText('Zum Schluss')) expect(x.textContent).toBe('Zum Schluss');
    expect(container.textContent).not.toMatch(/Zum Schluss \(freiwillig\)/);
  });

  it('Fakten oben mit Symbol: Plätze, Anmeldeschluss, Preis', () => {
    const e = freizeit();
    const { container } = render(
      <AnmeldeFormular
        ansicht={{
          basis: BASIS,
          name: 'Silvesterfreizeit',
          gemeinde: null,
          einstellungen: e,
          freiePlaetze: 3,
          anmeldeschluss: '2026-12-01',
        }}
        heute={HEUTE}
        vorschau
      />,
    );
    const fakten = [...container.querySelectorAll('span')].filter(
      (x) =>
        x.firstElementChild?.tagName === 'svg' &&
        /Plätze|Anmeldeschluss|€/.test(x.textContent ?? ''),
    );
    expect(fakten).toHaveLength(3);
    for (const f of fakten) expect(f.querySelector('svg path')?.getAttribute('d')).toBeTruthy();
  });

  it('Kopf: Name, Datum und Ort, Preis in einem Wort; „noch 3 Plätze“ nur wenn knapp; kein Gemeindename', () => {
    const e = freizeit();
    zeigen(e);
    // Gemeindename im Kopf gibt es nicht mehr (Alwin, 13.10.2026: „kann weg“); unten im Fuß steht er noch.
    expect(screen.getAllByText(/ECG Donrath/).every((x) => x.closest('footer'))).toBe(true);
    expect(screen.getByRole('heading', { level: 1, name: 'Silvesterfreizeit' })).toBeTruthy();
    expect(screen.getByText('Mo, 28.12.2026 – Sa, 02.01.2027 · Haus Lutzenberg')).toBeTruthy();
    expect(screen.getByText('ab 65,52 € p. P.')).toBeTruthy();
    // Vorgabe: „wenn weniger als 5 frei“ → 3 ist knapp
    expect(screen.getByText(/noch/).textContent).toBe('noch 3 Plätze frei');
  });

  it('ausgeschaltete Felder fehlen; verborgene Antworten werden nicht angeboten', () => {
    zeigen(freizeit());
    expect(screen.queryByText(/Dürfen Fotos/)).toBeNull(); // Vorlage Freizeit: Foto aus
    const tshirt = screen.getAllByLabelText(/T-Shirt/)[0] as HTMLSelectElement;
    expect([...tshirt.options].map((o) => o.textContent)).toEqual(['Bitte wählen …', '116', '128']);
  });

  it('der Preis kommt aus berechnePreis – mit dem Alter aus dem Geburtsdatum am ersten Tag', () => {
    const e = freizeit();
    zeigen(e);
    const muster = musterAntworten(e, HEUTE);
    fireEvent.click(screen.getByLabelText(/Bettwäsche/));
    const erwartet = berechnePreis(e.preis, {
      alter: muster.personen.map((p) => alterAm(String(p.birth), '2026-12-28')),
      option: 0,
      angemeldetAm: HEUTE,
      extras: [true],
    });
    expect(
      within(screen.getByLabelText('Preis').parentElement!).getByText(
        euroText(erwartet.gesamtCent),
      ),
    ).toBeTruthy();
    // 2-Bett wählen → neu gerechnet
    fireEvent.change(screen.getByLabelText(/Zimmer/), { target: { value: '1' } });
    const neu = berechnePreis(e.preis, {
      ...{ alter: muster.personen.map((p) => alterAm(String(p.birth), '2026-12-28')) },
      option: 1,
      angemeldetAm: HEUTE,
      extras: [true],
    });
    expect(screen.getByText(euroText(neu.gesamtCent))).toBeTruthy();
  });

  it('Pflichtangaben fehlen → markiert, nichts „abgeschickt“; vollständig → Bestätigung der Vorschau', () => {
    zeigen(freizeit());
    fireEvent.click(screen.getByRole('button', { name: 'Verbindlich anmelden' }));
    expect(screen.getByText('Bitte ankreuzen.')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('markierten Angaben');
    fireEvent.click(screen.getByLabelText(/Ich bin einverstanden/));
    fireEvent.click(screen.getByRole('button', { name: 'Verbindlich anmelden' }));
    expect(screen.getByText('Danke für die Anmeldung!')).toBeTruthy();
    expect(screen.getByText('Vorschau – abgeschickt wurde nichts.')).toBeTruthy();
  });

  it('Datenschutz nennt das Löschdatum: Ende + Löschfrist', () => {
    zeigen(freizeit());
    // Ende 02.01.2027 + 3 Monate
    expect(screen.getByText(/Sie werden am Fr, 02.04.2027 gelöscht/)).toBeTruthy();
  });

  it('nennt denselben Tag, an dem ChurchTools löscht – auch am Monatsende (30.11. + 3 → 28.02.)', () => {
    const e = freizeit();
    e.termin = { beginn: '2027-11-27T15:00', ende: '2027-11-30T11:00', ort: '', terminId: 1 };
    e.loeschfristMonate = 3;
    zeigen(e);
    // Gegen den Erzeuger: die Regel, nach der auch die Routine schreibt. Vorher rechnete das Formular selbst (02.03.).
    expect(loeschDatum(e)).toBe('2028-02-29');
    expect(
      screen.getByText(new RegExp(`Sie werden am ${datumText(loeschDatum(e)!)} gelöscht`)),
    ).toBeTruthy();
  });

  it('Kinder-Event: Eltern als Kontakt, „Weiteres Kind“; Einzelpersonen: keine weitere Person', () => {
    const k = zeigen(neueEinstellungen('kinder'));
    expect(screen.getByText('Kontakt der Eltern')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Weiteres Kind' })).toBeTruthy();
    // Der Satz „wiederholt sich …“ ist nur für den Baukasten – Gäste sehen ihn nicht.
    expect(screen.queryByText(/wiederholt sich/)).toBeNull();
    k.unmount();
    zeigen({ ...neueEinstellungen('einfach'), wer: 'einzeln' }, false);
    expect(screen.queryByRole('button', { name: /Weitere Person/ })).toBeNull();
  });

  it('kostenlos: keine Summe in Euro, „Die Teilnahme ist kostenlos.“', () => {
    zeigen(neueEinstellungen('einfach'), false);
    expect(screen.getByText('Die Teilnahme ist kostenlos.')).toBeTruthy();
  });

  it('Gestaltung: jede Einstellung eine Klasse (Aufbau, Kopf, Muster, Ecken, Abschnitte, Felder, Knopf)', () => {
    const e = freizeit();
    e.gestaltung = {
      ...e.gestaltung,
      aufbau: 'karte',
      kopfHoehe: 'gross',
      kopfAusrichtung: 'mitte',
      hintergrund: 'muster',
      muster: 'sterne',
      ecken: 'sehrrund',
      schatten: true,
      rahmen: true,
      bunt: true,
      gross: true,
      feldstil: 'linie',
      knoepfe: 'rund',
      knopfVoll: false,
    };
    const { container } = zeigen(e);
    const k = container.firstElementChild!.className;
    for (const klasse of [
      'a-karte',
      'kh-gross',
      'kopf-mitte',
      'm-sterne',
      'ek-sehrrund',
      'schatten',
      'rahmen',
      'bunt',
      'gross',
      'fs-linie',
      'bt-rund',
    ])
      expect(k).toMatch(new RegExp(klasse));
    expect(k).not.toMatch(/bt-voll|t-bunt/);
  });

  it('Muster nur bei „Muster“; Titelbild als Seite nur bei „Titelbild“ oder „Bild über alles“', () => {
    const e = freizeit();
    e.gestaltung = { ...e.gestaltung, aufbau: 'kopfband', hintergrund: 'farbe', muster: 'sterne' };
    const mitBild = (g: typeof e.gestaltung) =>
      render(
        <AnmeldeFormular
          ansicht={{
            basis: BASIS,
            name: 'X',
            gemeinde: null,
            einstellungen: { ...e, gestaltung: g },
            bildUrl: 'https://ct.test/b',
          }}
          heute={HEUTE}
        />,
      ).container.firstElementChild!.className;
    expect(mitBild(e.gestaltung)).toMatch(/bild-kopf/);
    expect(mitBild(e.gestaltung)).not.toMatch(/m-sterne|bild-seite/);
    expect(mitBild({ ...e.gestaltung, hintergrund: 'bild' })).toMatch(/bild-seite/);
    expect(mitBild({ ...e.gestaltung, aufbau: 'seite' })).toMatch(/bild-seite/);
  });

  it('Schrift auf der Akzentfarbe: hell auf dunkel, dunkel auf hell', () => {
    expect(textAufFarbe('#00616e')).toBe('#ffffff');
    expect(textAufFarbe('#c9a54a')).toBe('#1a1410');
  });
});

describe('Haken für den Baukasten (A5)', () => {
  const mitText = () => {
    const e = freizeit();
    e.formular.person.push(
      {
        id: 'f2',
        art: 'eigen',
        typ: 'ueberschrift',
        frage: 'Zum Essen',
        hilfe: '',
        zustand: 'freiwillig',
        antworten: [],
      },
      {
        id: 'f3',
        art: 'eigen',
        typ: 'trenner',
        frage: '',
        hilfe: '',
        zustand: 'pflicht',
        antworten: [],
      },
    );
    return e;
  };

  it('Überschrift und Trennlinie: ohne Eingabe, ohne „Pflicht“-Stern', () => {
    const { container } = zeigen(mitText());
    expect(screen.getAllByRole('heading', { name: 'Zum Essen' }).length).toBeGreaterThan(0);
    expect(container.querySelectorAll('hr').length).toBeGreaterThan(0);
    // Kein Stern an der Überschrift; dass eine Trennlinie auf „Pflicht“ nichts aufhält, prüft formular.test.ts.
    expect(screen.getAllByRole('heading', { name: 'Zum Essen' })[0].textContent).toBe('Zum Essen');
  });

  it('jedes sichtbare Feld in der Hülle, eine Person, eigener Kopf; schickt nichts ab', () => {
    const gesehen: string[] = [];
    render(
      <AnmeldeFormular
        ansicht={{ basis: BASIS, name: 'Freizeit', gemeinde: 'ECG', einstellungen: mitText() }}
        heute={HEUTE}
        vorschau
        start={musterAntworten(mitText(), HEUTE)}
        baukasten={{
          feld: (f, bereich, inhalt) => {
            gesehen.push(`${bereich}:${f.id}`);
            return <div data-testid={`h-${f.id}`}>{inhalt}</div>;
          },
          titel: <span>Eigener Titel</span>,
          einleitung: <span>Eigene Begrüßung</span>,
          bild: <button type="button">Bild</button>,
        }}
      />,
    );
    // Musterdaten haben zwei Personen – der Baukasten zeigt eine.
    expect(gesehen.filter((x) => x === 'person:pname')).toHaveLength(1);
    expect(gesehen).toContain('anmeldung:mail');
    expect(gesehen).toContain('anmeldung:priv');
    expect(gesehen).not.toContain('person:foto'); // aus
    expect(screen.getByRole('heading', { name: 'Eigener Titel' })).toBeTruthy();
    expect(screen.getByText('Eigene Begrüßung')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Entfernen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Verbindlich anmelden' }));
    expect(screen.queryByText('Danke für die Anmeldung!')).toBeNull();
    expect(screen.queryByText(/abgeschickt wird hier nichts/)).toBeNull();
  });
});

describe('Feinheiten (A5): Schrift, Farben, Breite, Titelbild', () => {
  it('Farben, Schriften und Breite landen als Variablen bzw. Klasse am Formular', () => {
    const e = freizeit();
    e.gestaltung = {
      ...e.gestaltung,
      kopfSchrift: 'rund',
      textSchrift: 'lesbar',
      breite: 'breit',
      seitenfarbe: '#112233',
      kartenfarbe: '#fefefe',
      schriftfarbe: '#222222',
      musterfarbe: '#abcdef',
    };
    const { container } = render(
      <AnmeldeFormular
        ansicht={{ basis: BASIS, name: 'X', gemeinde: 'ECG', einstellungen: e }}
        heute={HEUTE}
      />,
    );
    const pv = container.firstElementChild as HTMLElement;
    expect(pv.style.getPropertyValue('--p-page')).toBe('#112233');
    expect(pv.style.getPropertyValue('--p-card')).toBe('#fefefe');
    expect(pv.style.getPropertyValue('--p-text')).toBe('#222222');
    expect(pv.style.getPropertyValue('--p-muster')).toBe('#abcdef');
    expect(pv.style.getPropertyValue('--p-head')).toBe(SCHRIFT.rund);
    expect(pv.style.getPropertyValue('--p-body')).toBe(SCHRIFT.lesbar);
    // Auf dunkler Seite helle Schrift für Hinweise und Begrüßung
    expect(pv.style.getPropertyValue('--p-auf-seite')).toBe('#ffffff');
    expect(pv.className).toMatch(/br-breit/);
  });

  it('Logo: oben in der Mitte (Standard), links daneben oder keins; ohne Adresse keins', () => {
    const e = freizeit();
    const logo = (g: Partial<typeof e.gestaltung>) => {
      const { container, unmount } = render(
        <AnmeldeFormular
          ansicht={{
            basis: BASIS,
            name: 'X',
            gemeinde: null,
            einstellungen: { ...e, gestaltung: { ...e.gestaltung, ...g } },
          }}
          heute={HEUTE}
        />,
      );
      const img = container.querySelector('img');
      const r = img ? `${img.getAttribute('src')}|${img.className}` : null;
      unmount();
      return r;
    };
    expect(logo({ logo: 'ct', logoUrl: 'https://ct.test/images/558/x' })).toMatch(
      /^https:\/\/ct.test\/images\/558\/x\?w=240&h=0\|.*logo-oben/,
    );
    expect(logo({ logo: 'ct', logoUrl: 'https://ct.test/l', logoOrt: 'links' })).not.toMatch(
      /logo-oben/,
    );
    expect(logo({ logo: 'keins', logoUrl: 'https://ct.test/l' })).toBeNull();
    expect(logo({ logo: 'ct', logoUrl: null })).toBeNull();
    // #849: Die Adresse steht in der Gruppe und ist über die API änderbar – ein fremder Host zeigt kein Logo.
    expect(logo({ logo: 'eigen', logoUrl: 'https://fremd.example/l.png' })).toBeNull();
    expect(logo({ logo: 'eigen', logoUrl: 'https://ct.test.fremd.example/l.png' })).toBeNull();
  });

  it('Logo oben in der Mitte → Titel auch mittig (Alwin, 14.10.2026); links daneben → wie eingestellt', () => {
    const e = freizeit();
    const klasse = (g: Partial<typeof e.gestaltung>) => {
      const { container, unmount } = render(
        <AnmeldeFormular
          ansicht={{
            basis: BASIS,
            name: 'X',
            gemeinde: null,
            einstellungen: {
              ...e,
              gestaltung: { ...e.gestaltung, kopfAusrichtung: 'links', ...g },
            },
          }}
          heute={HEUTE}
        />,
      );
      const k = container.firstElementChild!.className;
      unmount();
      return k;
    };
    expect(klasse({ logo: 'ct', logoUrl: 'https://ct.test/l', logoOrt: 'oben' })).toMatch(
      /kopf-mitte/,
    );
    expect(klasse({ logo: 'ct', logoUrl: 'https://ct.test/l', logoOrt: 'links' })).not.toMatch(
      /kopf-mitte/,
    );
    expect(klasse({ logo: 'keins', logoUrl: 'https://ct.test/l', logoOrt: 'oben' })).not.toMatch(
      /kopf-mitte/,
    );
  });

  it('Titelbild in voller Größe, nicht das 150-Pixel-Vorschaubild (Alwin: „verzogen und unscharf“)', () => {
    const { container } = render(
      <AnmeldeFormular
        ansicht={{
          basis: BASIS,
          name: 'X',
          gemeinde: null,
          einstellungen: freizeit(),
          bildUrl: 'https://ct.test/images/555/abc',
        }}
        heute={HEUTE}
      />,
    );
    const pv = container.firstElementChild as HTMLElement;
    expect(pv.style.getPropertyValue('--user-img')).toBe(
      'url("https://ct.test/images/555/abc?w=1600&h=0")',
    );
    expect(titelbildGross('https://ct.test/b?x=1', 800)).toBe('https://ct.test/b?x=1&w=800&h=0');
  });
});

describe('Reihenfolge (Feinheiten A5)', () => {
  it('das Formular zeigt die gespeicherte Reihenfolge – auch Bemerkungen ganz oben; Datenschutz am Ende', () => {
    const e = freizeit();
    const note = e.formular.anmeldung.find((f) => f.id === 'note')!;
    e.formular.anmeldung = [note, ...e.formular.anmeldung.filter((f) => f.id !== 'note')];
    const { container } = render(
      <AnmeldeFormular
        ansicht={{ basis: BASIS, name: 'X', gemeinde: null, einstellungen: e }}
        heute={HEUTE}
      />,
    );
    const text = container.textContent ?? '';
    expect(text.indexOf('Bemerkungen')).toBeGreaterThan(-1);
    expect(text.indexOf('Bemerkungen')).toBeLessThan(text.indexOf('E-Mail'));
    expect(text.indexOf('Ich bin einverstanden')).toBeGreaterThan(text.indexOf('Bemerkungen'));
  });
});

describe('Spam-Schutz im echten Formular (A6-3, #593)', () => {
  afterEach(() => vi.useRealTimers());
  const ANGEMELDET: Abgeschickt = {
    personen: [{ index: 0, name: 'Maria Beispiel', ergebnis: 'angemeldet' }],
    mail: '',
  };

  /** Echtes Formular (mit `onAbsenden`), vollständig ausgefüllt, Uhr gestellt. */
  function echt(onAbsenden = vi.fn().mockResolvedValue(ANGEMELDET)) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
    const e = freizeit();
    const r = render(
      <AnmeldeFormular
        ansicht={{
          basis: BASIS,
          name: 'Freizeit',
          gemeinde: 'ECG',
          einstellungen: e,
          freiePlaetze: 3,
        }}
        heute={HEUTE}
        start={musterAntworten(e, HEUTE)}
        onAbsenden={onAbsenden}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Ich bin einverstanden/));
    return { onAbsenden, ...r };
  }
  const absenden = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Verbindlich anmelden' }));

  it('zu schnell → nichts geschickt, Bitte zu prüfen; nach 3 Sekunden geht es durch', async () => {
    const { onAbsenden } = echt();
    vi.setSystemTime(new Date('2026-10-16T10:00:01Z'));
    absenden();
    expect(onAbsenden).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/kurz prüfen/);
    vi.setSystemTime(new Date('2026-10-16T10:00:04Z'));
    absenden();
    await act(async () => {});
    expect(onAbsenden).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Danke für die Anmeldung!')).toBeTruthy();
  });

  it('Honigtopf gefüllt → nichts geschickt, sichtbare Meldung (nicht still „Danke“)', async () => {
    const { onAbsenden, container } = echt();
    vi.setSystemTime(new Date('2026-10-16T10:01:00Z'));
    const topf = container.querySelector<HTMLInputElement>('input[name="af-zusatz-hinweis"]')!;
    expect(topf.tabIndex).toBe(-1);
    expect(topf.closest('[aria-hidden="true"]')).toBeTruthy();
    fireEvent.change(topf, { target: { value: 'http://spam.example' } });
    absenden();
    await act(async () => {});
    expect(onAbsenden).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/neu laden/);
    expect(screen.queryByText('Danke für die Anmeldung!')).toBeNull();
  });

  it('zweimal Absenden im selben Augenblick → nur EINE Anmeldung', async () => {
    let fertig: (w: Abgeschickt) => void = () => {};
    const onAbsenden = vi.fn(() => new Promise<Abgeschickt>((r) => (fertig = r)));
    echt(onAbsenden);
    vi.setSystemTime(new Date('2026-10-16T10:01:00Z'));
    const form = screen.getByRole('button', { name: 'Verbindlich anmelden' }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onAbsenden).toHaveBeenCalledTimes(1);
    await act(async () => fertig(ANGEMELDET));
  });

  it('Vorschau: kein Honigtopf, keine Wartezeit', () => {
    const { container } = zeigen(freizeit());
    expect(container.querySelector('input[name="af-zusatz-hinweis"]')).toBeNull();
    fireEvent.click(screen.getByLabelText(/Ich bin einverstanden/));
    absenden();
    expect(screen.getByText('Danke für die Anmeldung!')).toBeTruthy();
  });
});

describe('Bedingungen im Formular (F1b)', () => {
  /** Eine Person (Einzelanmeldung): getauft? → „Wann getauft?“ (Pflicht) und „Mitarbeit“ mit Bedingungen je Antwort. */
  function mitBedingungen(wer: OeffentlicheEinstellungen['wer'] = 'einzeln') {
    const e = freizeit();
    e.wer = wer;
    const taufeJa = {
      modus: 'eine' as const,
      regeln: [{ feld: 'taufe', op: 'ist' as const, wert: 'Ja' }],
    };
    e.formular.person.push(
      {
        id: 'taufe',
        art: 'eigen',
        typ: 'janein',
        frage: 'Bist du getauft?',
        hilfe: '',
        zustand: 'freiwillig',
        antworten: [],
      },
      {
        id: 'wann',
        art: 'eigen',
        typ: 'text',
        frage: 'Wann getauft?',
        hilfe: '',
        zustand: 'pflicht',
        antworten: [],
        bed: taufeJa,
      },
      {
        id: 'rolle',
        art: 'eigen',
        typ: 'radio',
        frage: 'Mitarbeit',
        hilfe: '',
        zustand: 'freiwillig',
        antworten: ['Teilnehmer', 'Gruppenleiter', 'Küche'],
        antwortBed: {
          Gruppenleiter: { ...taufeJa, art: 'grau', grund: 'nur für Getaufte' },
          Küche: { ...taufeJa, art: 'weg' },
        },
      },
    );
    return e;
  }
  const knopf = (c: HTMLElement, pfad: string, wert: string) =>
    c.querySelector<HTMLInputElement>(`input[name="af-${pfad}"][value="${wert}"]`);
  const absenden = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Verbindlich anmelden' }));

  it('eine Frage erscheint erst, wenn ihre Bedingung zutrifft – je Person', () => {
    const { container } = zeigen(mitBedingungen('familie'));
    expect(screen.queryAllByLabelText(/Wann getauft\?/)).toHaveLength(0);
    fireEvent.click(knopf(container, 'personen.1.taufe', 'Ja')!);
    // Nur bei Person 2 – Person 1 hat nichts gewählt.
    expect(container.querySelector('#af-personen\\.1\\.wann')).toBeTruthy();
    expect(container.querySelector('#af-personen\\.0\\.wann')).toBeNull();
    fireEvent.click(knopf(container, 'personen.1.taufe', 'Nein')!);
    expect(container.querySelector('#af-personen\\.1\\.wann')).toBeNull();
  });

  it('Pflicht gilt nur, solange die Frage zu sehen ist', () => {
    const { container } = zeigen(mitBedingungen());
    fireEvent.click(screen.getByLabelText(/Ich bin einverstanden/));
    fireEvent.click(knopf(container, 'personen.0.taufe', 'Ja')!);
    absenden();
    expect(screen.queryByText('Danke für die Anmeldung!')).toBeNull();
    expect(screen.getByText('Bitte ausfüllen.')).toBeTruthy();
    fireEvent.click(knopf(container, 'personen.0.taufe', 'Nein')!);
    absenden();
    expect(screen.getByText('Danke für die Anmeldung!')).toBeTruthy();
  });

  it('Antworten mit Bedingung: „grau“ gesperrt mit Grund, „weg“ gar nicht da – bis die Bedingung zutrifft', () => {
    const { container } = zeigen(mitBedingungen());
    const leiter = knopf(container, 'personen.0.rolle', 'Gruppenleiter')!;
    expect(leiter.disabled).toBe(true);
    expect(leiter.closest('label')!.textContent).toBe('Gruppenleiter (nur für Getaufte)');
    expect(knopf(container, 'personen.0.rolle', 'Küche')).toBeNull();
    expect(knopf(container, 'personen.0.rolle', 'Teilnehmer')!.disabled).toBe(false);
    fireEvent.click(knopf(container, 'personen.0.taufe', 'Ja')!);
    expect(knopf(container, 'personen.0.rolle', 'Gruppenleiter')!.disabled).toBe(false);
    expect(
      knopf(container, 'personen.0.rolle', 'Gruppenleiter')!.closest('label')!.textContent,
    ).toBe('Gruppenleiter');
    expect(knopf(container, 'personen.0.rolle', 'Küche')).toBeTruthy();
  });

  it('wird eine gewählte Antwort ungültig, wird die Wahl gelöst und die Frage sagt warum – bis man neu wählt', () => {
    const { container } = zeigen(mitBedingungen());
    fireEvent.click(knopf(container, 'personen.0.taufe', 'Ja')!);
    fireEvent.click(knopf(container, 'personen.0.rolle', 'Gruppenleiter')!);
    expect(knopf(container, 'personen.0.rolle', 'Gruppenleiter')!.checked).toBe(true);
    fireEvent.click(knopf(container, 'personen.0.taufe', 'Nein')!);
    expect(knopf(container, 'personen.0.rolle', 'Gruppenleiter')!.checked).toBe(false);
    const hinweis = '„Gruppenleiter“ ist nur für Getaufte möglich – bitte neu wählen.';
    expect(screen.getByRole('status', { name: '' }).textContent).toBe(hinweis);
    // Eine andere Frage ändern: Der Hinweis bleibt.
    fireEvent.change(container.querySelector('#af-anmeldung\\.tel')!, { target: { value: '0' } });
    expect(screen.getByText(hinweis)).toBeTruthy();
    // An der Frage neu wählen: Er geht.
    fireEvent.click(knopf(container, 'personen.0.rolle', 'Teilnehmer')!);
    expect(screen.queryByText(hinweis)).toBeNull();
  });

  it('eine ausgeblendete Frage behält ihren Wert – taucht sie wieder auf, ist er noch da', () => {
    const { container } = zeigen(mitBedingungen());
    fireEvent.click(knopf(container, 'personen.0.taufe', 'Ja')!);
    fireEvent.change(container.querySelector('#af-personen\\.0\\.wann')!, {
      target: { value: '2019' },
    });
    fireEvent.click(knopf(container, 'personen.0.taufe', 'Nein')!);
    fireEvent.click(knopf(container, 'personen.0.taufe', 'Ja')!);
    expect(container.querySelector<HTMLInputElement>('#af-personen\\.0\\.wann')!.value).toBe(
      '2019',
    );
  });

  it('im Baukasten ist alles zu sehen und nichts gesperrt – dort bearbeitet man das Formular', () => {
    const e = mitBedingungen();
    const { container } = render(
      <AnmeldeFormular
        ansicht={{ basis: BASIS, name: 'Freizeit', gemeinde: 'ECG', einstellungen: e }}
        heute={HEUTE}
        vorschau
        start={musterAntworten(e, HEUTE)}
        baukasten={{ feld: (_f, _b, inhalt) => inhalt }}
      />,
    );
    expect(container.querySelector('#af-personen\\.0\\.wann')).toBeTruthy();
    expect(knopf(container, 'personen.0.rolle', 'Küche')).toBeTruthy();
    expect(knopf(container, 'personen.0.rolle', 'Gruppenleiter')!.disabled).toBe(false);
    expect(container.textContent).not.toContain('nur für Getaufte');
  });
});

describe('Bedingungen: Kontakt-Fragen und weitere Feldarten (F1b)', () => {
  it('eine Kontakt-Frage mit Bedingung – auch eine Frage je Person darf auf den Kontakt schauen', () => {
    const e = freizeit();
    e.wer = 'einzeln';
    const telGefuellt = {
      modus: 'eine' as const,
      regeln: [{ feld: 'tel', op: 'ausgefuellt' as const }],
    };
    const tel = e.formular.anmeldung.findIndex((f) => f.id === 'tel');
    e.formular.anmeldung.splice(tel + 1, 0, {
      id: 'erreichbar',
      art: 'eigen',
      typ: 'text',
      frage: 'Wann erreichbar?',
      hilfe: '',
      zustand: 'freiwillig',
      antworten: [],
      bed: telGefuellt,
    });
    e.formular.person.push({
      id: 'sms',
      art: 'eigen',
      typ: 'check',
      frage: 'SMS-Erinnerung',
      hilfe: '',
      zustand: 'freiwillig',
      antworten: [],
      bed: telGefuellt,
    });
    const { container } = zeigen(e, false);
    expect(screen.queryByLabelText(/Wann erreichbar\?/)).toBeNull();
    expect(screen.queryByLabelText(/SMS-Erinnerung/)).toBeNull();
    fireEvent.change(container.querySelector('#af-anmeldung\\.tel')!, {
      target: { value: '0151' },
    });
    expect(screen.getByLabelText(/Wann erreichbar\?/)).toBeTruthy();
    expect(screen.getByLabelText(/SMS-Erinnerung/)).toBeTruthy();
  });

  const grau = (a: string) =>
    a === 'B'
      ? { art: 'grau' as const, grund: 'nur für Getaufte' }
      : a === 'C'
        ? { art: 'weg' as const }
        : { art: 'frei' as const };

  it('Auswahlliste: gesperrte Antwort mit Grund und nicht wählbar, ausgeblendete fehlt', () => {
    const { container } = render(
      <FeldEingabe
        feld={{
          id: 'x',
          art: 'eigen',
          typ: 'select',
          frage: 'Liste',
          hilfe: '',
          zustand: 'freiwillig',
          antworten: ['A', 'B', 'C'],
        }}
        pfad="anmeldung.x"
        wert={undefined}
        onWert={() => {}}
        antwortZu={grau}
      />,
    );
    const optionen = [...container.querySelectorAll('option')].map((o) => [
      o.textContent,
      o.disabled,
    ]);
    expect(optionen).toEqual([
      ['Bitte wählen …', false],
      ['A', false],
      ['B (nur für Getaufte)', true],
    ]);
  });

  it('Mehrfachauswahl: gesperrte Antwort grau und nicht wählbar, ausgeblendete fehlt', () => {
    const onWert = vi.fn();
    const { container } = render(
      <FeldEingabe
        feld={{
          id: 'x',
          art: 'eigen',
          typ: 'multi',
          frage: 'Mehrere',
          hilfe: '',
          zustand: 'freiwillig',
          antworten: ['A', 'B', 'C'],
        }}
        pfad="anmeldung.x"
        wert={[]}
        onWert={onWert}
        antwortZu={grau}
        geloest="„B“ ist nur für Getaufte möglich – bitte neu wählen."
      />,
    );
    const kaesten = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(kaesten.map((k) => [k.closest('label')!.textContent, k.disabled])).toEqual([
      ['A', false],
      ['B (nur für Getaufte)', true],
    ]);
    expect(screen.getByRole('status').textContent).toBe(
      '„B“ ist nur für Getaufte möglich – bitte neu wählen.',
    );
  });
});
