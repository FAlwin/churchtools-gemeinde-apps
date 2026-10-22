/**
 * **Anmeldung von Hand** (A7-4, Entwurf `a7-4-von-hand-v1`, abgenommen 22.10.2026) – Telefon, Papier, nach dem
 * Anmeldeschluss. Erst die Person in ChurchTools suchen, sonst neu anlegen; dann dieselben Fragen wie im Formular.
 *
 * - Geschrieben wird, was das Formular schreiben würde – dieselbe Regel (`anmeldungAufbauen`): Felder, Betrag,
 *   Aufschlüsselung, Auswahl, Extras, Anmelde-Nr.
 * - Unterschreiben kann nur die Familie selbst. Liegt die Unterschrift auf Papier vor, steht das mit Name und Tag im
 *   Feld (`unterschriftAufPapier`); sonst bleibt es leer (Alwin, 22.10.2026).
 * - Platz wie im Formular (`platzPlan`): Wartet jemand oder ist alles voll, kommt die Person hinten auf die Warteliste
 *   – oder das Team gibt ihr trotzdem einen Platz und erhöht dabei die Plätze (wie beim Nachrücken, A7-3).
 * - Gemessen 19.10.2026: Anlegen (`POST /persons`) und Eintragen (`PUT /groups/{id}/members/{personId}`) schicken
 *   **keine** Mail – Bescheid gibt es als fertige Mail (`bescheidMail`, Art `angemeldet`).
 */
import type { Antworten, Feld, Formular, OeffentlicheEinstellungen } from './formular';
import type { CtGruppenfeld } from './liste';
import { platzPlan, platzStandAus } from './oeffentlich';
import { anmeldungAufbauen, type CtFormular, type PreisWahl } from './senden';

/** Die Person, die von Hand angemeldet wird – aus ChurchTools oder eben angelegt. */
export interface HandPerson {
  vor: string;
  nach: string;
  geburtstag: string | null;
  email: string | null;
}

const vonHandGeht = (f: Feld) => !['privacy', 'unterschrift', 'price'].includes(f.typ);
/** Am Telefon hat nicht jede Familie eine E-Mail-Adresse – von Hand ist sie freiwillig. */
const vonHandFreiwillig = (f: Feld): Feld =>
  f.typ === 'email' && f.zustand === 'pflicht' ? { ...f, zustand: 'freiwillig' } : f;

/**
 * **Die Fragen von Hand** – wie im Formular, ohne das Datenschutz-Häkchen (das bestätigt das Team beim Anlegen der
 * Person), ohne die Unterschrift (dafür der Schalter „liegt auf Papier vor“) und ohne Auswahl und Extras (eigener
 * Bereich im Fenster). Die E-Mail-Adresse ist freiwillig.
 */
export function handFormular(f: Formular): Formular {
  return {
    anmeldung: f.anmeldung.filter(vonHandGeht).map(vonHandFreiwillig),
    person: f.person.filter(vonHandGeht).map(vonHandFreiwillig),
  };
}

/** Fragt das Formular nach einer Unterschrift? Dann gibt es den Schalter „liegt auf Papier vor“. */
export function mitUnterschrift(f: Formular): boolean {
  return [...f.anmeldung, ...f.person].some((x) => x.typ === 'unterschrift' && x.zustand !== 'aus');
}

/**
 * **Die Antworten zu Beginn** – Name, Geburtsdatum und E-Mail aus ChurchTools. „Angemeldet von“ ist bei Kinder-Events
 * leer (dort melden Eltern an), sonst die Person selbst.
 */
export function handStart(e: OeffentlicheEinstellungen, p: HandPerson): Antworten {
  const kontakt = e.formular.anmeldung.find((f) => f.typ === 'name');
  const mail = e.formular.anmeldung.find((f) => f.typ === 'email');
  const name = e.formular.person.find((f) => f.typ === 'name');
  return {
    anmeldung: {
      ...(kontakt && e.wer !== 'kinder' ? { [kontakt.id]: { vor: p.vor, nach: p.nach } } : {}),
      ...(mail ? { [mail.id]: p.email ?? '' } : {}),
    },
    personen: [
      {
        ...(name ? { [name.id]: { vor: p.vor, nach: p.nach } } : {}),
        ...(p.geburtstag ? { birth: p.geburtstag.slice(0, 10) } : {}),
      },
    ],
  };
}

/** Plätze und Warteliste, wie sie jetzt in ChurchTools stehen. */
export interface HandLage {
  belegt: number;
  /** `null` = unbegrenzt. */
  max: number | null;
  /** Wie viele warten. */
  wartende: number;
  /** Gibt es eine Warteliste? */
  warteliste: boolean;
}

export interface HandPlatz {
  status: 'active' | 'waiting';
  /** Bei `waiting`: hinten an. */
  warteplatz: number | null;
  /** Die Plätze werden dafür erhöht – sonst `null`. */
  neuesMax: number | null;
  /** Ohne „trotzdem“ käme die Person auf die Warteliste. */
  wuerdeWarten: boolean;
  /** Voll und keine Warteliste: Es geht nur mit mehr Plätzen. */
  nurMitPlatz: boolean;
}

/**
 * **Platz oder Warteliste** – nach der Regel des Formulars (`platzStandAus`, `platzPlan`): Wartet jemand, kommen Neue
 * hinten an, auch bei freien Plätzen. `trotzdem` gibt einen Platz und erhöht, falls voll, die Plätze um eins.
 */
export function handPlatz(lage: HandLage, trotzdem: boolean): HandPlatz {
  const [platz] = platzPlan(
    platzStandAus({
      maxMemberCount: lage.max,
      currentMemberCount: lage.belegt,
      requestedWaitinglistSeatsCount: lage.wartende,
      allowWaitinglist: lage.warteliste,
    }),
    1,
  );
  const voll = lage.max !== null && lage.belegt >= lage.max;
  const nurMitPlatz = platz === 'kein';
  if (platz === 'platz' || trotzdem || nurMitPlatz)
    return {
      status: 'active',
      warteplatz: null,
      neuesMax: voll ? lage.belegt + 1 : null,
      wuerdeWarten: platz !== 'platz',
      nurMitPlatz,
    };
  return {
    status: 'waiting',
    warteplatz: lage.wartende + 1,
    neuesMax: null,
    wuerdeWarten: true,
    nurMitPlatz,
  };
}

/**
 * Das ChurchTools-Formular, wie `anmeldungAufbauen` es erwartet – aus den Gruppenfeldern der Veranstaltung. Die
 * Personenfelder schreibt die Anmeldung von Hand nicht über die Gruppe (die Person gibt es schon).
 */
function formularAus(felder: ReadonlyMap<number, CtGruppenfeld>): CtFormular {
  return {
    form: [
      ...['firstName', 'lastName', 'email', 'birthday'].map((n) => ({
        id: n,
        type: 'person',
        name: n,
      })),
      ...[...felder.values()].map((f) => ({
        id: f.id,
        type: 'custom',
        name: f.name,
        fieldTypeCode: f.fieldTypeCode,
        options: f.options ?? null,
      })),
    ],
  };
}

/**
 * **Die Gruppenfelder einer Anmeldung von Hand** (`fields` für `PUT /groups/{id}/members/{personId}`) – gebaut von
 * `anmeldungAufbauen`, derselben Regel wie im Formular. Wirft `PasstNicht`, wenn ein Feld in ChurchTools fehlt.
 */
export function handFelder(
  e: OeffentlicheEinstellungen,
  a: Antworten,
  wahl: PreisWahl,
  heute: string,
  felder: ReadonlyMap<number, CtGruppenfeld>,
  w: { nr: string; mitPlatz: boolean; papier: string | null },
): Record<number, string> {
  // Gezeichnet wird von Hand nichts – auch keine alte Antwort darf als Unterschrift durchrutschen.
  const ohneStriche = (w: Record<string, unknown>, liste: Feld[]) =>
    Object.fromEntries(
      Object.entries(w).filter(([id]) => liste.find((f) => f.id === id)?.typ !== 'unterschrift'),
    ) as Antworten['anmeldung'];
  const nurVonHand: Antworten = {
    anmeldung: ohneStriche(a.anmeldung, e.formular.anmeldung),
    personen: a.personen.map((p) => ohneStriche(p, e.formular.person)),
  };
  const { forms } = anmeldungAufbauen(e, nurVonHand, wahl, heute, formularAus(felder), {
    nr: w.nr,
    mitPlatz: [w.mitPlatz],
    ...(w.papier ? { papier: w.papier } : {}),
  });
  return Object.fromEntries(
    forms[0].form.filter((x) => x.type === 'custom').map((x) => [Number(x.id), x.value]),
  );
}
