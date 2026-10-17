import {
  abmeldeDatenAus,
  abmeldeVorlage,
  apiBasis,
  platzPlan,
  platzStandAus,
  type AbmeldeDaten,
  type OeffentlicheGruppeRoh,
  type PlatzStand,
  type AbmeldeOrt,
  type AnmeldeOrt,
} from '@shared/anmeldung/oeffentlich';
import {
  einstellungenLesen,
  type Antworten,
  type OeffentlicheEinstellungen,
} from '@shared/anmeldung/formular';
import { optionRest } from '@shared/anmeldung/kontingent';
import {
  PasstNicht,
  anmeldungAufbauen,
  personenNamen,
  type Abgeschickt,
  type CtFormular,
  type PreisWahl,
} from '@shared/anmeldung/senden';
import { WARTEN_MS } from './laden';

/**
 * **Eine Anmeldung abschicken** (A6-2, #548) – ohne Login, wie gemessen (14.10.2026): Token holen, Formular-Aufbau mit
 * den Feldnummern lesen, anmelden. Die Antwort enthält keine Personen; ob jemand schon bekannt ist, sagt
 * `verificationNotice` – dann bestätigt die Person per Mail, bis dahin ändert sich nichts.
 *
 * **Jede Person einzeln** (#602, gemessen 16.10.2026): Mehrere Personen in einer Anmeldung ohne Beziehung lassen
 * ChurchTools abstürzen (500); mit Beziehung „Kind“ würde das erste Kind zur Mutter des zweiten. Deshalb je Person
 * ein eigener Token und eine eigene Anmeldung – Betrag & Co. bleiben bei der ersten (`anmeldungAufbauen`).
 */

/** Was beim Abschicken schiefgehen kann – je Fall ein Satz für die Person, die sich anmeldet. */
export class SendeProblem extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SendeProblem';
  }
}

const VORUEBERGEHEND =
  'ChurchTools antwortet gerade nicht. Deine Angaben sind noch da – bitte gleich noch einmal versuchen.';
/** 500: kein „antwortet gerade nicht“ – ChurchTools hat geantwortet, mit einem Fehler (#602: so fiel er auf). */
const SERVERFEHLER =
  'ChurchTools hat einen Fehler gemeldet. Deine Angaben sind noch da – bitte noch einmal versuchen. Klappt es wieder nicht, gib bitte der Gemeinde Bescheid.';
const AUSGEBUCHT =
  'Inzwischen ist kein Platz mehr frei, und es gibt keine Warteliste. Abgeschickt wurde nichts.';

/** Texte für die endgültigen Fälle – je Aufruf anders (anmelden, „Deine Anmeldung“). */
export interface AnfrageTexte {
  /** 401/403. */
  gesperrt: string;
  /** 404 – `null`: wie jeder andere abgelehnte Aufruf. */
  nichtGefunden?: string | null;
  /** Andere Ablehnung, mit der Meldung von ChurchTools (falls es eine gibt). */
  abgelehnt: (meldung: string | null) => string;
}

const ANMELDEN: AnfrageTexte = {
  gesperrt:
    'Zu dieser Veranstaltung kann man sich gerade nicht anmelden – vielleicht ist sie voll oder schon geschlossen. Bei Fragen hilft die Gemeinde weiter.',
  abgelehnt: (text) =>
    `ChurchTools hat die Anmeldung nicht angenommen${text ? `: „${text}“` : ''}. Bitte die Angaben prüfen.`,
};

/**
 * Ein Aufruf ohne Login, mit Zeitgrenze. Vorübergehendes (Netz, Zeitgrenze, 429, 5xx) wirft `SendeProblem` mit
 * „noch einmal versuchen“ – die Eingaben bleiben. Die endgültigen Fälle sagen `texte` (A6-4: eine Stelle für beide
 * Seiten).
 */
export async function anfrage(
  url: string,
  init: RequestInit = {},
  texte: AnfrageTexte = ANMELDEN,
): Promise<unknown> {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), WARTEN_MS);
  let r: Response;
  try {
    r = await fetch(url, {
      ...init,
      credentials: 'omit',
      signal: abbruch.signal,
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    });
  } catch {
    throw new SendeProblem(
      abbruch.signal.aborted
        ? VORUEBERGEHEND
        : 'Keine Verbindung. Deine Angaben sind noch da – bitte die Internetverbindung prüfen und noch einmal versuchen.',
    );
  } finally {
    clearTimeout(uhr);
  }
  if (r.status === 500) throw new SendeProblem(SERVERFEHLER);
  if (r.status === 429 || r.status > 500) throw new SendeProblem(VORUEBERGEHEND);
  if (r.status === 401 || r.status === 403) throw new SendeProblem(texte.gesperrt);
  if (r.status === 404 && texte.nichtGefunden) throw new SendeProblem(texte.nichtGefunden);
  if (!r.ok) {
    const text = await r
      .json()
      .then(
        (j: { translatedMessage?: string; message?: string }) => j.translatedMessage ?? j.message,
      )
      .catch(() => null);
    throw new SendeProblem(texte.abgelehnt(text ?? null));
  }
  return r.status === 204 ? null : r.json();
}

export async function abschicken(
  ort: AnmeldeOrt,
  e: OeffentlicheEinstellungen,
  antworten: Antworten,
  wahl: PreisWahl,
  heute: string,
  /** Adresse dieser Seite (ohne `#`) – „Austreten“ in der Mail führt hierher zurück (A6-4). */
  formularBasis: string,
  weiteres: {
    /** Nur diese Personen (Index) – „Noch einmal“ für die offen gebliebenen. Ohne: alle. */
    nur?: number[];
    /** Anmelde-Nr. (A6-5a) – dieselbe bei jeder Person und bei „noch einmal“. */
    nr?: string;
  } = {},
): Promise<Abgeschickt> {
  const { nur, nr } = weiteres;
  const basis = `${apiBasis(ort)}/publicgroups/${ort.gruppeId}`;
  // Wer bekommt einen Platz? Danach richtet sich der Betrag (A6-5a: Warteliste zahlt erst beim Nachrücken).
  const frisch = await frischeGruppe(ort);
  let stand: PlatzStand | null = platzStandAus(frisch);
  const plan = platzPlan(stand, antworten.personen.length);
  // A6-5b: Belegt die Anmeldung die Option (jemand bekommt einen Platz), muss sie noch frei sein.
  const voll = !nur && plan.includes('platz') ? ausgebuchtSeitDemLaden(e, wahl, frisch) : null;
  if (voll)
    throw new SendeProblem(
      `„${voll}“ ist inzwischen ausgebucht. Bitte eine andere Auswahl wählen – abgeschickt wurde nichts.`,
    );
  let token = await neuerToken(basis);
  const f = (await anfrage(`${basis}/form?token=${encodeURIComponent(token)}`)) as {
    data?: CtFormular;
  } | null;
  if (!f?.data?.form) throw new SendeProblem(VORUEBERGEHEND);
  let anmeldung;
  try {
    anmeldung = anmeldungAufbauen(e, antworten, wahl, heute, f.data, {
      nr,
      mitPlatz: plan.map((x) => x === 'platz'),
    });
  } catch (fehler) {
    if (fehler instanceof PasstNicht)
      throw new SendeProblem(
        'Diese Anmeldung ist gerade nicht richtig eingerichtet. Bitte der Gemeinde Bescheid geben – abgeschickt wurde nichts.',
      );
    throw fehler;
  }
  const namen = personenNamen(e, antworten);
  const mail = typeof antworten.anmeldung.mail === 'string' ? antworten.anmeldung.mail.trim() : '';
  const ergebnis: Abgeschickt = { personen: [], mail };
  const reihe = nur ?? antworten.personen.map((_, i) => i);
  for (const [n, i] of reihe.entries()) {
    try {
      // Direkt davor frisch nachsehen: Ob es ein Platz oder die Warteliste wird, sagt nur dieser Stand (gemessen).
      const platz = platzPlan(stand ?? (await platzStand(ort)), 1)[0];
      stand = null;
      if (platz === 'kein') throw new SendeProblem(AUSGEBUCHT);
      if (n > 0) token = await neuerToken(basis);
      const antwort = (await anfrage(`${basis}/signup`, {
        method: 'POST',
        // A6-4: „Austreten“ in der Mail von ChurchTools führt auf „Deine Anmeldung“ (gemessen 16.10.2026).
        body: JSON.stringify({
          token,
          forms: [anmeldung.forms[i]],
          hasAcceptedPrivacyForSelf: anmeldung.hasAcceptedPrivacyForSelf,
          signOutUrlTemplate: abmeldeVorlage(formularBasis, ort.instanz),
        }),
      })) as { verificationNotice?: boolean; verificationEmail?: string | null } | null;
      if (antwort?.verificationNotice && antwort.verificationEmail)
        ergebnis.mail = antwort.verificationEmail;
      ergebnis.personen.push({
        index: i,
        name: namen[i],
        ergebnis: antwort?.verificationNotice
          ? 'bestaetigen'
          : platz === 'platz'
            ? 'angemeldet'
            : 'warteliste',
      });
    } catch (fehler) {
      // Noch niemand angemeldet → wie bisher: Meldung am Formular, die Eingaben bleiben.
      if (ergebnis.personen.length === 0) throw fehler;
      // Sonst sagt die Ergebnis-Seite genau, wer drin ist; „Noch einmal“ schickt nur den Rest.
      const ausgebucht = fehler instanceof SendeProblem && fehler.message === AUSGEBUCHT;
      for (const j of reihe.slice(n))
        ergebnis.personen.push({
          index: j,
          name: namen[j],
          ergebnis: ausgebucht ? 'ausgebucht' : 'offen',
        });
      ergebnis.meldung = ausgebucht
        ? 'Inzwischen ist kein Platz mehr frei, und es gibt keine Warteliste.'
        : fehler instanceof Error
          ? fehler.message
          : 'Das hat nicht geklappt.';
      break;
    }
  }
  return ergebnis;
}

async function neuerToken(basis: string): Promise<string> {
  const t = (await anfrage(`${basis}/token`, { method: 'POST', body: '{}' })) as {
    data?: { token?: string };
  } | null;
  if (!t?.data?.token) throw new SendeProblem(VORUEBERGEHEND);
  return t.data.token;
}

/**
 * **Freie Plätze und Warteliste – frisch von ChurchTools** (#602), ohne Login. Für den Hinweis beim Hinzufügen einer
 * Person und vor jeder einzelnen Anmeldung.
 */
export async function platzStand(ort: AnmeldeOrt): Promise<PlatzStand> {
  return platzStandAus(await frischeGruppe(ort));
}

/** Die öffentliche Gruppe, frisch – Plätze, Warteliste und die Einstellungen samt Belegung der Auswahl. */
async function frischeGruppe(ort: AnmeldeOrt): Promise<OeffentlicheGruppeRoh> {
  const g = (await anfrage(`${apiBasis(ort)}/publicgroups/${ort.gruppeId}`)) as {
    data?: OeffentlicheGruppeRoh;
  } | null;
  if (!g?.data) throw new SendeProblem(VORUEBERGEHEND);
  return g.data;
}

/**
 * **Ist die gewählte Option inzwischen ausgebucht?** (A6-5b) – gegen die frisch gelesenen Einstellungen (die Erweiterung
 * schreibt dort die Belegung). Dann wird nichts geschickt.
 */
function ausgebuchtSeitDemLaden(
  e: OeffentlicheEinstellungen,
  wahl: PreisWahl,
  frisch: OeffentlicheGruppeRoh,
): string | null {
  const g = e.preis.grundpreis;
  if (g.art !== 'auswahl') return null;
  const name = g.optionen[wahl.option]?.name;
  const neu = einstellungenLesen(frisch.information?.note)?.preis.grundpreis.optionen.find(
    (o) => o.name === name,
  );
  return neu && optionRest(neu) === 0 ? name : null;
}

const ABSAGEN: AnfrageTexte = {
  gesperrt: 'Absagen geht gerade nicht. Bitte die Gemeinde direkt ansprechen.',
  nichtGefunden:
    'Dieser Link gilt nicht mehr – vielleicht wurde schon abgesagt. Bei Fragen hilft die Gemeinde weiter.',
  abgelehnt: (text) =>
    `ChurchTools hat die Absage nicht angenommen${text ? `: „${text}“` : ''}. Bitte die Gemeinde ansprechen.`,
};

/**
 * **Eine Person absagen** (A6-4) – ohne Login mit dem Schlüssel aus der Mail: `POST /publicgroups/{id}/signout`
 * (gemessen 16.10.2026: 204, Mitgliedschaft weg, Person bleibt). **Danach nachlesen:** Steht die Person noch da, hat
 * ChurchTools nicht abgesagt – ein „204“ allein ist kein Beleg. Gibt den neuen Stand zurück.
 */
export async function absagen(ort: AbmeldeOrt, personId: number): Promise<AbmeldeDaten> {
  const basis = `${apiBasis(ort)}/publicgroups/${ort.gruppeId}`;
  await anfrage(
    `${basis}/signout`,
    { method: 'POST', body: JSON.stringify({ token: ort.token, personIds: [personId] }) },
    ABSAGEN,
  );
  const neu = abmeldeDatenAus(
    await anfrage(`${basis}/signoutdata?token=${encodeURIComponent(ort.token)}`, {}, ABSAGEN),
  );
  if (!neu || neu.personen.some((p) => p.id === personId))
    throw new SendeProblem(
      'ChurchTools hat die Absage nicht übernommen. Bitte gleich noch einmal versuchen.',
    );
  return neu;
}
