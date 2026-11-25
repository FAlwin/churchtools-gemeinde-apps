// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { SpeicherErgebnis, Versioniert } from '@shared/ct/versionierterWert';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import { STANDARD_BETRIEBSART } from '@shared/ct/liveAgenda';
import type { EinstellungenStand } from '@shared/dienstplan/liveEinstellungen';
import {
  STANDARD_PLAN,
  type Abfrage,
  type AbfragenInhalt,
  type Erinnerungsplan,
} from '@shared/dienstplan/abfragen';
import { STANDARD_BETREFF } from '@shared/dienstplan/abfrageMail';
import { standardInhalt, type AbfragenStand } from '@shared/dienstplan/abfragenSpeicher';
import type { AbfrageAnschluss } from './AbfrageFenster';
import { EinstellungenFenster } from './EinstellungenFenster';
import { ABFRAGE_UNLESBAR } from './abfragenTexte';

/**
 * **Abschnitt „Abfragen – Erinnerungen“ in den Einstellungen** (R-4). Die Regeln dahinter prüfen `abfragePlan.test.ts` und
 * `abfrageMail.test.ts`; hier geht es um das Fenster: wer den Abschnitt sieht, was „Speichern“ schreibt (genau ein Aufruf je
 * geändertem Teil), und die Fehlerzweige – jeder einzeln.
 */
const HEUTE = '2026-12-01';
const ICH = { personId: 1, name: 'Alwin Friesen' };
const BEA = { personId: 2, name: 'Bea' };
const MUSIK: Dienstgruppe = { id: 4, name: 'Musik', fuerAlle: false };
const TECHNIK: Dienstgruppe = { id: 5, name: 'Technik', fuerAlle: false };

const version = (inhalt: AbfragenInhalt, v: number, von = BEA): Versioniert<AbfragenInhalt> => ({
  version: v,
  zeit: 'z',
  von,
  inhalt,
});
const abfrage: Abfrage = {
  id: 'a1',
  von: '2027-02-01',
  bis: '2027-03-31',
  frist: '2027-01-05',
  oeffnen: '2026-12-01',
  termine: [1, 2],
  gestartet: { personId: 2, name: 'Bea', zeit: 'z' },
  beendet: null,
};
const stand = (
  inhalt: AbfragenInhalt = standardInhalt(),
  v: number | null = null,
): AbfragenStand => ({
  inhalt,
  gespeichert: v === null ? null : version(inhalt, v),
  unlesbar: false,
  fehler: null,
});

const betriebsartStand = (): EinstellungenStand => ({
  betriebsart: STANDARD_BETRIEBSART,
  gespeichert: null,
  unlesbar: false,
  fehler: null,
});

type Speichern = AbfrageAnschluss['speichern'];

function zeige(
  o: {
    darfAendern?: boolean;
    gruppen?: Dienstgruppe[];
    lesen?: (id: number) => Promise<AbfragenStand>;
    speichern?: Speichern;
    betriebsartSpeichern?: () => Promise<SpeicherErgebnis<{ betriebsart: string }>>;
  } = {},
) {
  const lesen = vi.fn(o.lesen ?? (() => Promise.resolve(stand())));
  const speichern = vi.fn<Speichern>(
    o.speichern ?? ((_g, neu) => Promise.resolve({ ok: true, daten: version(neu, 1, ICH) })),
  );
  const betriebsart = vi.fn(
    o.betriebsartSpeichern ??
      (() =>
        Promise.resolve({
          ok: true,
          daten: { version: 1, zeit: 'z', von: ICH, inhalt: { betriebsart: 'klicken' } },
        } as SpeicherErgebnis<{ betriebsart: string }>)),
  );
  const onSchliessen = vi.fn();
  render(
    <EinstellungenFenster
      darfAendern={o.darfAendern ?? true}
      ich={{ personId: 1, name: 'Alwin' }}
      abfragen={{
        anschluss: { lesen, speichern, ich: ICH },
        gruppen: o.gruppen ?? [MUSIK, TECHNIK],
        heute: HEUTE,
      }}
      onSchliessen={onSchliessen}
      lesen={() => Promise.resolve(betriebsartStand())}
      speichern={betriebsart as never}
    />,
  );
  return { lesen, speichern, betriebsart, onSchliessen };
}

const abschnitt = () => screen.findByRole('region', { name: 'Abfragen – Erinnerungen' });
const geladen = async () => {
  await abschnitt();
  await screen.findByRole('list', { name: 'Erinnerungen' });
};
const zeilen = () =>
  within(screen.getByRole('list', { name: 'Erinnerungen' })).getAllByRole('listitem');
const speichernKnopf = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' });
const entfernen = (i: number) =>
  fireEvent.click(screen.getAllByRole('button', { name: 'Erinnerung entfernen' })[i]);
const hinzufuegenTippen = (wort: RegExp | string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Erinnerung hinzufügen' }));
  fireEvent.click(screen.getByRole('button', { name: wort }));
};

afterEach(cleanup);

describe('Wer den Abschnitt sieht', () => {
  it('Planer sehen ihn zwischen „Live-Ansicht – für alle“ und „Meine Anzeige“', async () => {
    zeige();
    const a = await abschnitt();
    const titel = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titel).toEqual(['Live-Ansicht – für alle', 'Abfragen – Erinnerungen', 'Meine Anzeige']);
    expect(a).toBeTruthy();
  });

  it('Nicht-Planer sehen ihn nicht – und es wird nichts gelesen', async () => {
    const { lesen } = zeige({ darfAendern: false });
    await screen.findByRole('radiogroup');
    expect(screen.queryByRole('region', { name: 'Abfragen – Erinnerungen' })).toBeNull();
    expect(lesen).not.toHaveBeenCalled();
  });

  it('ohne planbare Dienstgruppe gibt es ihn nicht', async () => {
    const { lesen } = zeige({ gruppen: [] });
    await screen.findByRole('radiogroup');
    expect(screen.queryByRole('region', { name: 'Abfragen – Erinnerungen' })).toBeNull();
    expect(lesen).not.toHaveBeenCalled();
  });

  it('eine Gruppe: kein Wähler, der Name steht da; mehrere: Wähler mit allen Gruppen', async () => {
    zeige({ gruppen: [MUSIK] });
    await geladen();
    expect(screen.queryByRole('combobox', { name: 'Dienstgruppe' })).toBeNull();
    expect(screen.getByText('Für Musik.')).toBeTruthy();
    cleanup();
    zeige();
    await geladen();
    const wahl = screen.getByRole('combobox', { name: 'Dienstgruppe' });
    expect(
      within(wahl)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Musik', 'Technik']);
  });
});

describe('Liste', () => {
  it('ohne eigenen Plan der Standard: vier Erinnerungen mit den Werten des Plans', async () => {
    zeige();
    await geladen();
    expect(zeilen()).toHaveLength(STANDARD_PLAN.punkte.length);
    expect(zeilen()[0].textContent).toContain('Beim Öffnen der Abfrage');
    expect(
      screen.getByRole<HTMLSelectElement>('combobox', { name: 'Tage vor der Frist' }).value,
    ).toBe('2');
    expect(zeilen()[2].textContent).toContain('Am Tag der Frist');
    expect(
      screen.getByRole<HTMLSelectElement>('combobox', { name: 'Wie oft nach der Frist' }).value,
    ).toBe('1');
    expect(
      screen.getByRole<HTMLSelectElement>('combobox', {
        name: 'Höchstens wie viele Erinnerungen nach der Frist',
      }).value,
    ).toBe('3');
  });

  it('ein eigener Plan wird gezeigt', async () => {
    const plan: Erinnerungsplan = { punkte: [{ art: 'frist' }], mail: null };
    zeige({ lesen: () => Promise.resolve(stand({ plan, abfragen: [] }, 3)) });
    await geladen();
    expect(zeilen()).toHaveLength(1);
  });

  it('hinzufügen: das Menü bietet nur noch fehlende Arten; „vor der Frist“ bringt eine neue Zeile', async () => {
    zeige();
    await geladen();
    fireEvent.click(screen.getByRole('button', { name: 'Erinnerung hinzufügen' }));
    expect(screen.getAllByRole('button', { name: /Einige Tage vor der Frist/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Am Tag der Frist' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Einige Tage vor der Frist/ }));
    expect(zeilen()).toHaveLength(5);
    const tage = screen.getAllByRole<HTMLSelectElement>('combobox', { name: 'Tage vor der Frist' });
    expect(tage.map((s) => s.value)).toEqual(['3', '2']);
    // 2 ist in der Auswahl der anderen Zeile gesperrt
    expect(within(tage[0]).getByRole<HTMLOptionElement>('option', { name: '2' }).disabled).toBe(
      true,
    );
  });

  it('entfernen nimmt genau diese Zeile weg; die Art lässt sich danach wieder hinzufügen', async () => {
    zeige();
    await geladen();
    entfernen(2);
    expect(zeilen().map((z) => z.textContent)).not.toContain('Am Tag der Frist');
    expect(screen.queryByText('Am Tag der Frist')).toBeNull();
    hinzufuegenTippen('Am Tag der Frist');
    expect(screen.getByText('Am Tag der Frist')).toBeTruthy();
  });

  it('ändern: ein anderer Wert in der Auswahl', async () => {
    zeige();
    await geladen();
    fireEvent.change(screen.getByRole('combobox', { name: 'Tage vor der Frist' }), {
      target: { value: '7' },
    });
    expect(
      screen.getByRole<HTMLSelectElement>('combobox', { name: 'Tage vor der Frist' }).value,
    ).toBe('7');
    fireEvent.change(screen.getByRole('combobox', { name: 'Wie oft nach der Frist' }), {
      target: { value: '2' },
    });
    expect(screen.getByRole('option', { name: 'alle 2 Tage' })).toBeTruthy();
  });

  it('ohne Erinnerungen steht ein Hinweis; „hinzufügen“ bleibt möglich', async () => {
    zeige({
      lesen: () => Promise.resolve(stand({ plan: { punkte: [], mail: null }, abfragen: [] }, 2)),
    });
    await screen.findByText(/Keine Erinnerung – die Abfrage erscheint nur auf der Startseite/);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Erinnerung hinzufügen' }).disabled,
    ).toBe(false);
  });
});

describe('Mail und Vorschau', () => {
  it('Betreff-Feld mit dem Standard als Platzhalter; „Text ändern“ klappt das Textfeld auf', async () => {
    zeige();
    await geladen();
    const betreff = screen.getByLabelText('Mail – Betreff');
    expect(betreff.getAttribute('placeholder')).toBe(STANDARD_BETREFF);
    expect(screen.queryByLabelText('Mail – Text')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Text ändern' }));
    expect(screen.getByLabelText('Mail – Text')).toBeTruthy();
    expect(
      screen.getByText(/Platzhalter: \{zeitraum\}, \{frist\}, \{gruppe\}, \{vorname\}/),
    ).toBeTruthy();
  });

  it('„Auf Standard zurücksetzen“ erscheint nur bei eigenem Text und setzt zurück', async () => {
    zeige();
    await geladen();
    expect(screen.queryByRole('button', { name: 'Auf Standard zurücksetzen' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Mail – Betreff'), {
      target: { value: 'Mein Betreff' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Auf Standard zurücksetzen' }));
    expect(screen.getByLabelText<HTMLInputElement>('Mail – Betreff').value).toBe(STANDARD_BETREFF);
  });

  it('ein unbekannter Platzhalter wird gemeldet, Speichern bleibt möglich', async () => {
    zeige();
    await geladen();
    fireEvent.change(screen.getByLabelText('Mail – Betreff'), {
      target: { value: 'Im {zeitrum}' },
    });
    await screen.findByText(/Diesen Platzhalter gibt es nicht: \{zeitrum\} im Betreff/);
    expect(speichernKnopf().disabled).toBe(false);
  });

  it('Hinweise: 0:15 Uhr, Pause; ohne Automatik der Satz zu ChurchTools', async () => {
    zeige();
    await geladen();
    expect(screen.getByText(/Mails kommen gegen 0:15 Uhr am jeweiligen Tag/)).toBeTruthy();
    expect(screen.getByText(/Wer alles beantwortet hat oder pausiert, bekommt keine/)).toBeTruthy();
    expect(
      screen.getByText(
        /Automatisch verschickt wird erst, wenn die Erinnerungen in ChurchTools eingerichtet sind/,
      ),
    ).toBeTruthy();
  });

  it('Vorschau: Beispiel mit Standard; ändert sich mit der Liste', async () => {
    zeige();
    await geladen();
    const v = () => screen.getByLabelText('Vorschau').textContent ?? '';
    expect(v()).toContain(
      'Beispiel: Frist Di, 15.12., Zeitraum ab Di, 12.01. → Erinnerungen am Di, 01.12. · So, 13.12.',
    );
    entfernen(0);
    expect(v()).not.toContain('Di, 01.12.');
  });

  it('Vorschau: läuft eine Abfrage der Gruppe, zählen deren echte Tage', async () => {
    zeige({
      lesen: () => Promise.resolve(stand({ plan: null, abfragen: [abfrage] }, 2)),
    });
    await geladen();
    expect(screen.getByLabelText('Vorschau').textContent).toContain(
      'Läuft gerade: Frist Di, 05.01., Zeitraum ab Mo, 01.02. → Erinnerungen am',
    );
  });
});

describe('Speichern – nur, was sich geändert hat', () => {
  it('nur der Plan: genau ein Aufruf für den Plan mit der gelesenen Version, die Abfragen unverändert, keiner für die Betriebsart', async () => {
    const inhalt: AbfragenInhalt = { plan: null, abfragen: [abfrage] };
    const { speichern, betriebsart, onSchliessen } = zeige({
      lesen: () => Promise.resolve(stand(inhalt, 7)),
    });
    await geladen();
    entfernen(1);
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
    expect(speichern).toHaveBeenCalledTimes(1);
    expect(speichern).toHaveBeenCalledWith(
      4,
      {
        plan: {
          punkte: [
            { art: 'oeffnen' },
            { art: 'frist' },
            { art: 'nachFrist', alleTage: 1, hoechstens: 3 },
          ],
          mail: null,
        },
        abfragen: [abfrage],
      },
      ICH,
      7,
    );
    expect(betriebsart).not.toHaveBeenCalled();
  });

  it('nur die Betriebsart: kein Aufruf für den Plan', async () => {
    const { speichern, betriebsart, onSchliessen } = zeige();
    await geladen();
    fireEvent.click(screen.getByRole('radio', { name: /Von Anfang an klicken/ }));
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
    expect(betriebsart).toHaveBeenCalledTimes(1);
    expect(speichern).not.toHaveBeenCalled();
  });

  it('beides geändert: je ein Aufruf', async () => {
    const { speichern, betriebsart, onSchliessen } = zeige();
    await geladen();
    fireEvent.click(screen.getByRole('radio', { name: /Von Anfang an klicken/ }));
    entfernen(0);
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
    expect(betriebsart).toHaveBeenCalledTimes(1);
    expect(speichern).toHaveBeenCalledTimes(1);
  });

  it('nichts geändert: nichts wird geschrieben, das Fenster schließt', async () => {
    const { speichern, betriebsart, onSchliessen } = zeige();
    await geladen();
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
    expect(speichern).not.toHaveBeenCalled();
    expect(betriebsart).not.toHaveBeenCalled();
  });

  it('entfernen und wieder hinzufügen = Standard: nichts geschrieben', async () => {
    const { speichern, onSchliessen } = zeige();
    await geladen();
    entfernen(2);
    hinzufuegenTippen('Am Tag der Frist');
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
    expect(speichern).not.toHaveBeenCalled();
  });

  it('ein eigener Plan, der wieder dem Standard gleicht, wird als „plan: null“ gespeichert', async () => {
    const eigener: Erinnerungsplan = {
      punkte: STANDARD_PLAN.punkte.slice(0, 3),
      mail: null,
    };
    const { speichern, onSchliessen } = zeige({
      lesen: () => Promise.resolve(stand({ plan: eigener, abfragen: [] }, 4)),
    });
    await geladen();
    hinzufuegenTippen(/Nach der Frist, wiederholt/);
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
    expect(speichern.mock.calls[0][1].plan).toBeNull();
  });

  it('eigener Betreff: gespeichert, der Text bleibt Standard (mail mit beiden Feldern)', async () => {
    const { speichern, onSchliessen } = zeige();
    await geladen();
    fireEvent.change(screen.getByLabelText('Mail – Betreff'), { target: { value: ' Neu ' } });
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
    const mail = speichern.mock.calls[0][1].plan?.mail;
    expect(mail?.betreff).toBe('Neu');
    expect(mail?.text.length).toBeGreaterThan(20);
  });
});

describe('Fehlerzweige – jeder einzeln', () => {
  it('Plan scheitert, Betriebsart klappt: Meldung nennt den Plan, Fenster bleibt; zweiter Klick schreibt nur den Plan', async () => {
    let versuch = 0;
    const { speichern, betriebsart, onSchliessen } = zeige({
      speichern: (_g, neu) =>
        Promise.resolve(
          versuch++ === 0
            ? { ok: false, grund: 'voruebergehend' }
            : { ok: true, daten: version(neu, 1, ICH) },
        ),
    });
    await geladen();
    fireEvent.click(screen.getByRole('radio', { name: /Von Anfang an klicken/ }));
    entfernen(0);
    fireEvent.click(speichernKnopf());
    const meldung = await screen.findByRole('alert');
    expect(meldung.textContent).toContain(
      'Erinnerungen für Musik: ChurchTools antwortet gerade nicht',
    );
    expect(meldung.textContent).toContain('Gespeichert: Live-Ansicht.');
    expect(onSchliessen).not.toHaveBeenCalled();
    expect(zeilen()).toHaveLength(3);
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
    expect(betriebsart).toHaveBeenCalledTimes(1);
    expect(speichern).toHaveBeenCalledTimes(2);
  });

  it('Betriebsart scheitert, Plan klappt: Meldung nennt die Live-Ansicht; erneut wird nur sie geschrieben', async () => {
    let versuch = 0;
    const { speichern, betriebsart, onSchliessen } = zeige({
      betriebsartSpeichern: () =>
        Promise.resolve(
          versuch++ === 0
            ? { ok: false, grund: 'voruebergehend' }
            : {
                ok: true,
                daten: { version: 1, zeit: 'z', von: ICH, inhalt: { betriebsart: 'klicken' } },
              },
        ),
    });
    await geladen();
    fireEvent.click(screen.getByRole('radio', { name: /Von Anfang an klicken/ }));
    entfernen(0);
    fireEvent.click(speichernKnopf());
    const meldung = await screen.findByRole('alert');
    expect(meldung.textContent).toContain('Live-Ansicht: ChurchTools antwortet gerade nicht');
    expect(meldung.textContent).toContain('Gespeichert: Erinnerungen für Musik.');
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
    expect(speichern).toHaveBeenCalledTimes(1);
    expect(betriebsart).toHaveBeenCalledTimes(2);
  });

  it('Plan: Konflikt – nichts überschrieben, der neue Stand steht da, mit dem Namen', async () => {
    const fremd: AbfragenInhalt = {
      plan: { punkte: [{ art: 'frist' }], mail: null },
      abfragen: [],
    };
    const { onSchliessen } = zeige({
      speichern: () => Promise.resolve({ ok: false, grund: 'konflikt', jetzt: version(fremd, 5) }),
    });
    await geladen();
    entfernen(0);
    fireEvent.click(speichernKnopf());
    await screen.findByText(/Bea hat das inzwischen geändert – nichts überschrieben/);
    expect(zeilen()).toHaveLength(1);
    expect(onSchliessen).not.toHaveBeenCalled();
  });

  it('Plan: Konflikt, aber es steht schon genau das da, was gewünscht war: fertig', async () => {
    const gewuenscht: AbfragenInhalt = {
      plan: {
        punkte: STANDARD_PLAN.punkte.slice(1),
        mail: null,
      },
      abfragen: [],
    };
    const { onSchliessen } = zeige({
      speichern: () =>
        Promise.resolve({ ok: false, grund: 'konflikt', jetzt: version(gewuenscht, 2, ICH) }),
    });
    await geladen();
    entfernen(0);
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['kein-recht', /ChurchTools erlaubt dir das nicht/],
    ['abgemeldet', /Nicht mehr bei ChurchTools angemeldet/],
    ['nicht-angekommen', /nachgelesen steht aber der alte Stand da/],
  ] as const)(
    'Plan: Speichern scheitert mit „%s“: Meldung, Fenster bleibt, Änderung bleibt',
    async (grund, text) => {
      const { onSchliessen } = zeige({ speichern: () => Promise.resolve({ ok: false, grund }) });
      await geladen();
      entfernen(0);
      fireEvent.click(speichernKnopf());
      await screen.findByText(text);
      expect(onSchliessen).not.toHaveBeenCalled();
      expect(zeilen()).toHaveLength(3);
    },
  );

  it('Plan: Speichern wirft – Meldung, nichts geschlossen', async () => {
    const { onSchliessen } = zeige({ speichern: () => Promise.reject(new Error('Netz')) });
    await geladen();
    entfernen(0);
    fireEvent.click(speichernKnopf());
    await screen.findByRole('alert');
    expect(onSchliessen).not.toHaveBeenCalled();
  });

  it('unlesbar: Hinweis „neuere Version“, nichts änderbar, nie gespeichert', async () => {
    const { speichern, onSchliessen } = zeige({
      lesen: () =>
        Promise.resolve({
          inhalt: standardInhalt(),
          gespeichert: version(standardInhalt(), 9),
          unlesbar: true,
          fehler: null,
        }),
    });
    await screen.findByText(ABFRAGE_UNLESBAR);
    expect(screen.queryByRole('button', { name: 'Erinnerung entfernen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Erinnerung hinzufügen' })).toBeNull();
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
    expect(speichern).not.toHaveBeenCalled();
  });

  it('Lesefehler: nur der Abschnitt ist gesperrt, mit „Nochmal versuchen“, das neu liest', async () => {
    const lesen = vi
      .fn<(id: number) => Promise<AbfragenStand>>()
      .mockResolvedValueOnce({ ...stand(), fehler: 'voruebergehend' })
      .mockResolvedValue(stand());
    const { speichern } = zeige({ lesen });
    await screen.findByText(/die Abfrage konnte nicht gelesen werden/);
    expect(screen.queryByRole('list', { name: 'Erinnerungen' })).toBeNull();
    // die Betriebsart bleibt bedienbar
    expect(
      screen.getByRole<HTMLInputElement>('radio', { name: /Von Anfang an klicken/ }).disabled,
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal versuchen' }));
    await geladen();
    expect(lesen).toHaveBeenCalledTimes(2);
    expect(speichern).not.toHaveBeenCalled();
  });

  it('Lesen wirft: wie ein vorübergehender Fehler', async () => {
    zeige({ lesen: () => Promise.reject(new Error('Netz')) });
    await screen.findByRole('button', { name: 'Nochmal versuchen' });
    expect(screen.queryByRole('list', { name: 'Erinnerungen' })).toBeNull();
  });
});

describe('Gruppenwechsel', () => {
  it('ohne Änderungen: sofort, die andere Gruppe wird frisch gelesen', async () => {
    const { lesen } = zeige();
    await geladen();
    fireEvent.change(screen.getByRole('combobox', { name: 'Dienstgruppe' }), {
      target: { value: '5' },
    });
    await waitFor(() => expect(lesen).toHaveBeenLastCalledWith(5));
    expect(screen.queryByText('Änderungen verwerfen?')).toBeNull();
  });

  it('mit ungespeicherten Änderungen: Rückfrage; Abbrechen behält Gruppe und Änderung', async () => {
    const { lesen } = zeige();
    await geladen();
    entfernen(0);
    fireEvent.change(screen.getByRole('combobox', { name: 'Dienstgruppe' }), {
      target: { value: '5' },
    });
    await screen.findByText('Änderungen verwerfen?');
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Dienstgruppe' }).value).toBe(
      '4',
    );
    expect(zeilen()).toHaveLength(3);
    expect(lesen).toHaveBeenCalledTimes(1);
  });

  it('mit ungespeicherten Änderungen: „Verwerfen und wechseln“ liest die andere Gruppe, die Änderung ist weg', async () => {
    const { lesen, speichern } = zeige();
    await geladen();
    entfernen(0);
    fireEvent.change(screen.getByRole('combobox', { name: 'Dienstgruppe' }), {
      target: { value: '5' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Verwerfen und wechseln' }));
    await waitFor(() => expect(lesen).toHaveBeenLastCalledWith(5));
    await waitFor(() => expect(zeilen()).toHaveLength(4));
    expect(speichern).not.toHaveBeenCalled();
  });
});
