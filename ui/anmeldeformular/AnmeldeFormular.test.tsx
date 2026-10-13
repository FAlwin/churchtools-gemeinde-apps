// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import { berechnePreis, euroText } from '@shared/anmeldung/preis';
import { alterAm, type OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { AnmeldeFormular } from './AnmeldeFormular';
import { musterAntworten, textAufFarbe } from './daten';

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
        { name: '4-Bett', preisCent: 6552, kontingent: 0, belegt: 0 },
        { name: '2-Bett', preisCent: 8900, kontingent: 0, belegt: 0 },
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
  it('Kopf: Gemeinde, Name, Datum und Ort, Preis in einem Wort; „noch 3 Plätze“ nur wenn knapp', () => {
    const e = freizeit();
    zeigen(e);
    expect(screen.getByText('ECG Donrath')).toBeTruthy();
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

  it('Kinder-Event: Eltern als Kontakt, „Weiteres Kind“; Einzelpersonen: keine weitere Person', () => {
    const k = zeigen(neueEinstellungen('kinder'));
    expect(screen.getByText('Kontakt der Eltern')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Weiteres Kind' })).toBeTruthy();
    k.unmount();
    zeigen({ ...neueEinstellungen('einfach'), wer: 'einzeln' }, false);
    expect(screen.queryByRole('button', { name: /Weitere Person/ })).toBeNull();
  });

  it('kostenlos: keine Summe in Euro, „Die Teilnahme ist kostenlos.“', () => {
    zeigen(neueEinstellungen('einfach'), false);
    expect(screen.getByText('Die Teilnahme ist kostenlos.')).toBeTruthy();
  });

  it('Gestaltung: Vorlage, Feldstil, Knöpfe als Klassen; Gemeindename abschaltbar', () => {
    const e = freizeit();
    e.gestaltung = {
      ...e.gestaltung,
      vorlage: 'bunt',
      feldstil: 'linie',
      knoepfe: 'rund',
      gemeindename: false,
    };
    const { container } = zeigen(e);
    const wurzel = container.firstElementChild!;
    expect(wurzel.className).toMatch(/t-bunt/);
    expect(wurzel.className).toMatch(/fs-linie/);
    expect(wurzel.className).toMatch(/bt-rund/);
    expect(screen.queryByText('ECG Donrath')).toBeNull();
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
        ansicht={{ name: 'Freizeit', gemeinde: 'ECG', einstellungen: mitText() }}
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
