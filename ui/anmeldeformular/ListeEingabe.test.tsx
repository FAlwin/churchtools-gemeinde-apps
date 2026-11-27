// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { bausteinFeld } from '@shared/anmeldung/baukasten';
import { pruefeAntworten, type Antwort, type Feld } from '@shared/anmeldung/formular';
import { ListeEingabe } from './ListeEingabe';

/** F6a: Liste mit Zeilen, wie Gäste sie ausfüllen – die Regeln kommen aus `zeilenListe.ts`, hier nur die Bedienung. */

afterEach(cleanup);

const FELD: Feld = {
  ...bausteinFeld('liste', 'inv'),
  frage: 'Was bringst du mit?',
  zustand: 'pflicht',
  liste: {
    spalten: [
      { id: 'a', name: 'Gegenstand', art: 'text' },
      { id: 'c', name: 'Wert', art: 'zahl', einheit: '€', summe: true },
      { id: 'd', name: 'Zustand', art: 'auswahl', antworten: ['neu', 'gut'] },
    ],
    max: 2,
  },
};

/** Wie im Formular: Fehler aus `pruefeAntworten` mit dem Pfad des Felds. */
function Probe({ start, pruefen = false }: { start?: Antwort; pruefen?: boolean }) {
  const [wert, setWert] = useState<Antwort>(start);
  const fehler = pruefen
    ? pruefeAntworten(
        { anmeldung: [FELD], person: [] },
        { anmeldung: { inv: wert }, personen: [{}] },
      ).filter((x) => x !== 'personen')
    : [];
  return (
    <>
      <ListeEingabe
        feld={FELD}
        wert={wert}
        onWert={setWert}
        pfad="anmeldung.inv"
        fehler={fehler}
        gesperrt={false}
        zusatz={null}
      />
      <output data-testid="wert">{JSON.stringify(wert ?? null)}</output>
    </>
  );
}
const wert = () => JSON.parse(screen.getByTestId('wert').textContent) as { zeilen: unknown[] };

describe('ListeEingabe (F6a)', () => {
  it('ohne Eintrag steht eine leere Zeile da; Tippen legt sie an, „Zeile hinzufügen“ bis zur Höchstzahl', () => {
    render(<Probe />);
    expect(screen.getAllByRole('group')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Gegenstand'), { target: { value: 'Zelt' } });
    expect(wert()).toEqual({ zeilen: [{ a: 'Zelt' }] });
    fireEvent.click(screen.getByRole('button', { name: /Zeile hinzufügen/ }));
    expect(screen.getAllByRole('group')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'höchstens 2 Zeilen' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('Summe über vollständige Zeilen, mit Einheit; Entfernen nimmt die Zeile weg', () => {
    render(
      <Probe
        start={{
          zeilen: [
            { a: 'Zelt', c: '150', d: 'gut' },
            { a: 'Kocher', c: '40,5', d: '' },
          ],
        }}
      />,
    );
    expect(screen.getByText('Summe Wert: 150 €')).toBeTruthy();
    fireEvent.change(screen.getAllByLabelText('Zustand')[1], { target: { value: 'neu' } });
    expect(screen.getByText('Summe Wert: 190,5 €')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag 1 entfernen' }));
    expect(wert().zeilen).toEqual([{ a: 'Kocher', c: '40,5', d: 'neu' }]);
  });

  it('Fehler aus der Prüfung: Zellen markiert, Sätze darunter wie im Entwurf', () => {
    render(<Probe start={{ zeilen: [{ a: 'Zelt', c: 'viel' }] }} pruefen />);
    expect(screen.getByRole('alert').textContent).toBe(
      'Bitte mindestens eine Zeile vollständig ausfüllen.Zeile 1: Wert, Zustand fehlen',
    );
    expect(screen.getByLabelText('Wert in €').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Zustand').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Gegenstand').getAttribute('aria-invalid')).toBeNull();
  });

  it('gesperrt (Vorschau im Baukasten): keine Knöpfe, Felder gesperrt', () => {
    render(
      <ListeEingabe
        feld={FELD}
        wert={{ zeilen: [{ a: 'Zelt' }] }}
        onWert={() => {}}
        pfad="x"
        fehler={[]}
        gesperrt
        zusatz={null}
      />,
    );
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.getByLabelText('Gegenstand')).toHaveProperty('disabled', true);
  });
});
