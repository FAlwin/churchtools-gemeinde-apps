/**
 * **To-Dos der Protokolle** (Bauplan S1/S7) – ein Wert je To-Do in der Kategorie „Mitarbeit“ der Gruppe, damit
 * Abhaken durch die Zuständigen das Protokoll nicht berührt.
 *
 * Entschieden 16.10.2026: Zuständige sind Personen der Gruppe; Externe nur als Name (ohne eigenen Zugriff).
 * Status offen → in Arbeit → erledigt, Fälligkeit, Verlauf mit Notizen.
 *
 * **Nie hart löschen** (S0, 22.10.2026): Wer in „Mitarbeit“ ändern darf, darf dort auch jeden Wert löschen –
 * ChurchTools kennt dafür kein eigenes Recht. Darum wird ein To-Do nur als gelöscht vermerkt; der Verlauf
 * zeigt, wer es war.
 */
export type AufgabenStatus = 'offen' | 'arbeit' | 'erledigt';

export interface VerlaufEintrag {
  /** ISO-Zeit. */
  am: string;
  von: number;
  /**
   * Vorname dessen, der schrieb – beim Schreiben gestempelt (`mitNamen`). Mitglieder sehen die Mitgliederliste oft nicht;
   * ohne ihn stand für sie „Person 1“ (S7-2a, Test-Instanz 30.10.2026). Ältere Einträge haben ihn nicht.
   */
  name?: string;
  art:
    | 'angelegt'
    | 'status'
    | 'notiz'
    | 'geloescht'
    | 'wiederhergestellt'
    | 'zustaendig'
    | 'teil'
    | 'modus'
    /** Vorschläge (W9b): vorgeschlagen, geändert, von der Leitung übernommen/abgelehnt, vom Vorschlagenden zurückgezogen. */
    | 'vorgeschlagen'
    | 'vorschlagGeaendert'
    | 'uebernommen'
    | 'abgelehnt'
    | 'zurueckgezogen';
  status?: AufgabenStatus;
  /** Bei `teil` (W8a): wessen Teil, und ob er fertig (`true`) oder wieder offen (`false`) ist. */
  person?: number;
  fertig?: boolean;
  /** Bei `modus` (W8a): `true` = „Jeder für sich“, `false` = „Gemeinsam“. */
  jeder?: boolean;
  text?: string;
  /** Bei `zustaendig` (S7-3): wer vorher und nachher zuständig war. */
  vorher?: number[];
  nachher?: number[];
}

/**
 * **Das Kennzeichen „Vorschlag“** (W9b, Alwin 20.11.2026): Ein Mitarbeiter schlägt der Gruppe ein To-Do vor. Es ist derselbe
 * Datensatz wie jedes To-Do (Kategorie „Mitarbeit“, ohne Zuständige) – **solange das Kennzeichen daran hängt, ist es KEIN
 * To-Do** (`istToDoVorschlag`): Es erscheint in keiner Liste, keinem Zähler, keiner Suche. Übernimmt die Leitung den
 * Vorschlag, fällt das Kennzeichen weg (`vorschlagUebernehmen`), und derselbe Datensatz ist ein normales To-Do.
 * `offen` wartet auf die Leitung, `abgelehnt` bleibt sieben Tage sichtbar (`abgelehntAm`). Ein zurückgezogener Vorschlag ist
 * als gelöscht vermerkt (nie hart löschen). Alte Datensätze haben das Feld nicht – dann ist es ein To-Do.
 */
export interface ToDoVorschlag {
  stand: 'offen' | 'abgelehnt';
  /** Wer vorschlug – mit Namen, weil Mitglieder die Mitgliederliste oft nicht sehen. */
  von: number;
  name: string;
  /** ISO-Zeit des Vorschlags. */
  am: string;
  /** Begründung beim Ablehnen – fehlt, wenn keine genannt wurde. */
  grund?: string;
  /** ISO-Zeit des Ablehnens. */
  abgelehntAm?: string;
}

export interface Aufgabe {
  art: 'aufgabe';
  fassung: 1;
  /** Eigene ID (der Block im Protokoll verweist darauf, `props.aufgabe`). */
  id: string;
  gruppe: number;
  /** Sitzung, in der die Aufgabe entstand – `null` bei Aufgaben ohne Sitzung. */
  sitzung: string | null;
  text: string;
  wer: number[];
  /** Name einer Person außerhalb der Gruppe – nur Text. */
  extern: string;
  /** `JJJJ-MM-TT` oder `null`. */
  bis: string | null;
  status: AufgabenStatus;
  verlauf: VerlaufEintrag[];
  geloescht: boolean;
  /**
   * Was die Karte in der To-Do-Übersicht zusätzlich zeigt (S7-2, Alwin 30.10.2026: „Auf Karte anzeigen“, für alle
   * gespeichert): die letzte Notiz und aus welcher Sitzung. Fehlt bei älteren To-Dos – dann nichts davon.
   */
  karte?: { notiz?: boolean; sitzung?: boolean };
  /**
   * **„Jeder für sich“** (W8a, Alwin 19.11.2026): Bei zwei oder mehr Zuständigen hakt jeder seinen Teil selbst ab. Fehlt das
   * Feld, gilt „gemeinsam“ (einer erledigt es für alle – wie bisher; alte To-Dos ändern sich nicht). Wirksam ist es nur ab
   * zwei Zuständigen (`istJeder`).
   */
  jeder?: true;
  /**
   * Bei „Jeder für sich“: wer seinen Teil erledigt hat – Person-ID (als Text) → ISO-Zeit. Wer nicht (mehr) in `wer`
   * steht, zählt nicht mit. **Das gespeicherte `status` ist dann immer der daraus abgeleitete Gesamtstand**
   * (`gesamtstandNeu`) – darum lesen alle Stellen, die nur `status` kennen, automatisch richtig.
   */
  fertig?: Record<string, string>;
  /** **Vorschlag** (W9b): solange es gesetzt ist, ist das hier KEIN To-Do. Siehe `ToDoVorschlag`. */
  vorschlag?: ToDoVorschlag;
}

/**
 * **Ist das ein Vorschlag und noch kein To-Do?** (W9b) – die eine Stelle dafür. Jeder Leser der To-Do-Liste lässt solche
 * Datensätze weg (`trenneToDoVorschlaege`, `aufgabenAusRoh`, `aufgabenWerte`); der Schreibweg lehnt normale Änderungen daran ab.
 */
export function istToDoVorschlag(a: Pick<Aufgabe, 'vorschlag'>): boolean {
  return a.vorschlag !== undefined;
}

/**
 * **To-Dos und Vorschläge trennen** – die eine Stelle beim Lesen (W9b). Die Reihenfolge bleibt; gelöschte (auch
 * zurückgezogene Vorschläge) bleiben in ihrer Liste, das Weglassen geschieht dort, wo es schon immer geschah.
 */
export function trenneToDoVorschlaege<T extends Pick<Aufgabe, 'vorschlag'>>(
  liste: readonly T[],
): { aufgaben: T[]; vorschlaege: T[] } {
  return {
    aufgaben: liste.filter((a) => !istToDoVorschlag(a)),
    vorschlaege: liste.filter(istToDoVorschlag),
  };
}

/** **Wie ein Status heißt** – die eine Stelle dafür (Protokoll, Sitzung, Startseite, Suche). */
export function statusText(s: AufgabenStatus): string {
  return s === 'arbeit' ? 'in Arbeit' : s;
}

export function neueAufgabe(a: {
  id: string;
  gruppe: number;
  sitzung: string | null;
  text: string;
  wer?: number[];
  extern?: string;
  bis?: string | null;
  von: number;
  am: string;
}): Aufgabe {
  return {
    art: 'aufgabe',
    fassung: 1,
    id: a.id,
    gruppe: a.gruppe,
    sitzung: a.sitzung,
    text: a.text.trim(),
    wer: [...new Set(a.wer ?? [])],
    extern: (a.extern ?? '').trim(),
    bis: a.bis ?? null,
    status: 'offen',
    verlauf: [{ am: a.am, von: a.von, art: 'angelegt' }],
    geloescht: false,
  };
}

/**
 * Neuer Status mit Verlaufseintrag. Gleicher Status → unverändert zurück (kein doppelter Eintrag). **Bei „Jeder für sich“
 * ändert das nichts** – dort ist der Status der abgeleitete Gesamtstand (`gesamtstandNeu`), gesetzt wird der eigene Teil
 * (`teilSetzen`).
 */
export function statusSetzen(a: Aufgabe, status: AufgabenStatus, von: number, am: string): Aufgabe {
  if (a.status === status || istJeder(a)) return a;
  return { ...a, status, verlauf: [...a.verlauf, { am, von, art: 'status', status }] };
}

/** **Gilt „Jeder für sich“?** Nur mit dem Merkmal und ab zwei Zuständigen – sonst immer „gemeinsam“. */
export function istJeder(a: Pick<Aufgabe, 'jeder' | 'wer'>): boolean {
  return a.jeder === true && a.wer.length >= 2;
}

/** Hat `person` ihren Teil erledigt? (Nur bei „Jeder für sich“ von Bedeutung.) */
export function teilFertig(a: Pick<Aufgabe, 'fertig'>, person: number): boolean {
  return !!a.fertig?.[String(person)];
}

/** **Wie weit ist es?** Bei „Jeder für sich“ `{ fertig, gesamt }` über die Zuständigen, sonst `null`. */
export function teilStand(a: Pick<Aufgabe, 'jeder' | 'wer' | 'fertig'>): {
  fertig: number;
  gesamt: number;
} | null {
  if (!istJeder(a)) return null;
  return { fertig: a.wer.filter((p) => teilFertig(a, p)).length, gesamt: a.wer.length };
}

/** „2 von 5 fertig“ – `null`, wenn nicht „Jeder für sich“. Karte, Startseite und Fenster sagen es gleich. */
export function teilText(a: Pick<Aufgabe, 'jeder' | 'wer' | 'fertig'>): string | null {
  const t = teilStand(a);
  return t ? `${t.fertig} von ${t.gesamt} fertig` : null;
}

/**
 * **Der Gesamtstand neu gerechnet** – die eine Stelle dafür (Teil gesetzt, Zuständige geändert, Modus gewechselt). Bei „Jeder
 * für sich“: niemand fertig = offen, einige = in Arbeit, alle = erledigt; ändert sich der Gesamtstand, kommt ein
 * `status`-Eintrag in den Verlauf (so findet `erledigtAm` den Zeitpunkt). Bei „gemeinsam“ bleibt alles, wie es ist.
 */
export function gesamtstandNeu(a: Aufgabe, von: number, am: string): Aufgabe {
  const t = teilStand(a);
  if (!t) return a;
  const status: AufgabenStatus =
    t.fertig === 0 ? 'offen' : t.fertig === t.gesamt ? 'erledigt' : 'arbeit';
  if (a.status === status) return a;
  return { ...a, status, verlauf: [...a.verlauf, { am, von, art: 'status', status }] };
}

/**
 * **Den Teil einer Person setzen** (fertig oder wieder offen) – mit Verlaufseintrag `teil`, danach rechnet
 * `gesamtstandNeu` den Gesamtstand neu. Nichts zu tun (nicht „Jeder für sich“, Person nicht zuständig, schon so) →
 * unverändert zurück. Läuft auf dem **frisch gelesenen** Stand: Zwei, die kurz nacheinander abhaken, löschen sich nicht
 * gegenseitig (jeder ändert nur seinen eigenen Eintrag).
 */
export function teilSetzen(
  a: Aufgabe,
  person: number,
  fertig: boolean,
  von: number,
  am: string,
): Aufgabe {
  if (!istJeder(a) || !a.wer.includes(person) || teilFertig(a, person) === fertig) return a;
  const map = { ...a.fertig };
  if (fertig) map[String(person)] = am;
  else delete map[String(person)];
  return gesamtstandNeu(
    { ...a, fertig: map, verlauf: [...a.verlauf, { am, von, art: 'teil', person, fertig }] },
    von,
    am,
  );
}

/**
 * **Wer darf den Teil von `person` setzen?** (W8a, Alwin 19.11.2026) Jeder nur seinen eigenen; die Leitung alle. Die Regel
 * gilt im Schreibweg (`toDoAendern`), nicht nur in der Oberfläche – ChurchTools selbst kennt dafür kein Recht, die Prüfung
 * liegt in der Erweiterung.
 */
export function darfTeilSetzen(person: number, ich: number, leitung: boolean): boolean {
  return person === ich || leitung;
}

/**
 * **Ist es für diesen Betrachter nur SEINE Aufgabe?** (W10, Alwin 20.11.2026) – bei „Jeder für sich“ gilt das für jeden
 * zuständigen **Mitarbeiter**: Er sieht keine anderen Zuständigen, keinen Zähler, kein „Wer ist fertig?“. Die Leitung sieht
 * immer das ganze To-Do. Die eine Stelle dafür – `standFuer`, `sichtFuer` und `toDoRechte` (`teile`) richten sich danach.
 */
export function nurMeinTeil(
  a: Pick<Aufgabe, 'jeder' | 'wer'>,
  q: { ich: number; leitung: boolean },
): boolean {
  return !q.leitung && istJeder(a) && a.wer.includes(q.ich);
}

/**
 * **Wie steht das To-Do FÜR MICH?** (W10) – die eine Regel für „Offen / In Arbeit / Erledigt“ in Board, Liste, Tabelle,
 * Startseite, Filter und Suche. Die Leitung sieht den Gesamtstand (`a.status`); ein Mitarbeiter bei „Jeder für sich“ nur sein
 * Teil: fertig = erledigt, sonst offen – auch wenn der Gesamtstand „in Arbeit“ ist. Das **gespeicherte** `status` ändert sich
 * dadurch nie (es bleibt der Gesamtstand).
 */
export function standFuer(
  a: Pick<Aufgabe, 'status' | 'jeder' | 'wer' | 'fertig'>,
  q: { ich: number; leitung: boolean },
): AufgabenStatus {
  if (!nurMeinTeil(a, q)) return a.status;
  return teilFertig(a, q.ich) ? 'erledigt' : 'offen';
}

/**
 * **Das To-Do, wie ein Betrachter es sieht** (W10) – für alles, was nur anzeigt, einteilt, sortiert oder zählt
 * (`gruppieren`, Frist, Karte, Tabelle): Es hat `standFuer` als Stand, bei „nur mein Teil“ kein „Jeder für sich“ mehr (kein
 * Zähler), als Verlauf nur die Notizen und – ist mein Teil fertig – einen Erledigt-Eintrag mit **meiner** Zeit (so findet
 * `erledigtAm` ihn). Alle anderen sehen das To-Do unverändert (dieselbe Instanz zurück). **Nie zum Schreiben benutzen** –
 * dort gilt das echte To-Do.
 */
export function sichtFuer(a: Aufgabe, q: { ich: number; leitung: boolean }): Aufgabe {
  if (!nurMeinTeil(a, q)) return a;
  const status = standFuer(a, q);
  const am = a.fertig?.[String(q.ich)];
  const { jeder: _jeder, fertig: _fertig, ...rest } = a;
  const notizen = notizenVon(a);
  return {
    ...rest,
    status,
    verlauf:
      status === 'erledigt' && am
        ? [...notizen, { am, von: q.ich, art: 'status', status }]
        : notizen,
  };
}

/**
 * **Die Notizen eines To-Dos** (Verlaufseinträge `notiz`, in der Reihenfolge des Schreibens) – die eine Stelle dafür: Karte
 * („Notizen“-Zahl, letzte Notiz) und Fenster (Liste über dem Notizfeld). Sie sehen alle, auch wo der Verlauf verborgen ist.
 */
export function notizenVon(a: Pick<Aufgabe, 'verlauf'>): VerlaufEintrag[] {
  return a.verlauf.filter((v) => v.art === 'notiz');
}

/** **Ohne Zuständigen** – weder jemand aus der Gruppe noch eine Person außerhalb. Die eine Stelle dafür (Sichtbarkeit, Rechte). */
export function ohneZustaendige(a: Pick<Aufgabe, 'wer' | 'extern'>): boolean {
  return a.wer.length === 0 && !a.extern.trim();
}

/**
 * **Wer darf was an einem To-Do?** (W9a, Alwin 20.11.2026) – **die eine Regel** für Fenster, Haken an Karte und Zeile,
 * Ziehen im Board, „Neues To-Do“, Abgeben, „Das mache ich“ und den Schreibweg (`aenderungVerboten`). Keine Stelle rechnet
 * das nach. `leitung` = wer in der Gruppe Protokolle schreiben darf; sie darf alles. Für Mitarbeiter hängt es am Fall:
 * - `eigen`: genau ich bin zuständig (kein Externer) – abhaken, Status, Notiz, Frist, abgeben, Text, löschen;
 * - `geteilt`: ich und andere (oder jemand außerhalb) – abhaken und Notiz, sonst nichts;
 * - `ohne`: niemand zuständig – nur „Das mache ich“ (`mache`);
 * - `fremd`: andere zuständig, ich nicht – nichts (die Übersicht zeigt es auch nicht: `sichtbarFuer`).
 * Steht das To-Do noch in einem **Protokoll-Entwurf** (`imEntwurf`), führt dort das Protokoll: Text und Löschen bleiben bei
 * der Leitung. ChurchTools kennt dafür kein Recht – die Prüfung liegt in der Erweiterung.
 */
export type ToDoFall = 'leitung' | 'eigen' | 'geteilt' | 'ohne' | 'fremd' | 'vorschlag';

export interface ToDoRechte {
  fall: ToDoFall;
  sehen: boolean;
  /** Abhaken (bei „Jeder für sich“ den eigenen Teil – für andere gilt zusätzlich `darfTeilSetzen`). */
  haken: boolean;
  /** Den Status setzen (auch „in Arbeit“). Bei „Jeder für sich“ gibt es ihn nicht – dort zählen die Teile. */
  status: boolean;
  notiz: boolean;
  text: boolean;
  frist: boolean;
  /** „Auf Karte anzeigen“ – gilt für alle, darum nur bei eigenen To-Dos. */
  karte: boolean;
  /** Zuständige frei ändern. */
  zustaendig: boolean;
  /** Gemeinsam ↔ Jeder für sich. */
  modus: boolean;
  /** In eine andere Gruppe verschieben. */
  gruppe: boolean;
  /** An genau ein anderes Gruppenmitglied abgeben. */
  abgeben: boolean;
  loeschen: boolean;
  /** „Das mache ich“ – mich selbst eintragen. */
  mache: boolean;
  /** Nur bei einem Vorschlag (W9b, Fall `vorschlag`): die Leitung übernimmt oder lehnt ab – nur solange er offen ist. */
  uebernehmen: boolean;
  ablehnen: boolean;
  /** Nur bei einem Vorschlag: wer vorschlug, ändert ihn oder zieht ihn zurück – nur solange er offen ist. */
  vorschlagAendern: boolean;
  zurueckziehen: boolean;
  /**
   * **Den Verlauf sehen** (W10, Alwin 20.11.2026): nur die Leitung – ein Mitarbeiter nie, in keinem Fall. Seine Notizen sieht er
   * trotzdem (`notizenVon`).
   */
  verlauf: boolean;
  /**
   * **Die Teile sehen** (W10): bei „Jeder für sich“ den Fortschritt („2 von 14 fertig“), die Liste „Wer ist fertig?“ und die
   * anderen Zuständigen. Die Leitung immer; ein Mitarbeiter nur, wo es nichts zu verbergen gibt – bei „Jeder für sich“ ist es
   * für ihn nur SEINE Aufgabe (`nurMeinTeil`).
   */
  teile: boolean;
}

const NICHTS: Omit<ToDoRechte, 'fall' | 'sehen'> = {
  haken: false,
  status: false,
  notiz: false,
  text: false,
  frist: false,
  karte: false,
  zustaendig: false,
  modus: false,
  gruppe: false,
  abgeben: false,
  loeschen: false,
  mache: false,
  uebernehmen: false,
  ablehnen: false,
  vorschlagAendern: false,
  zurueckziehen: false,
  verlauf: false,
  teile: false,
};

export function toDoRechte(
  a: Pick<Aufgabe, 'wer' | 'extern' | 'jeder' | 'vorschlag'>,
  q: { ich: number; leitung: boolean; imEntwurf?: boolean },
): ToDoRechte {
  // **Ein Vorschlag ist kein To-Do** (W9b): Haken, Status, „Das mache ich“ und alle Felder gibt es nicht – auch nicht für die
  // Leitung. Sie übernimmt oder lehnt ab; wer vorschlug, ändert oder zieht zurück (beides nur, solange er offen ist).
  if (a.vorschlag) {
    const offen = a.vorschlag.stand === 'offen';
    const meiner = a.vorschlag.von === q.ich;
    return {
      ...NICHTS,
      fall: 'vorschlag',
      sehen: q.leitung || meiner,
      uebernehmen: q.leitung && offen,
      ablehnen: q.leitung && offen,
      vorschlagAendern: meiner && offen,
      zurueckziehen: meiner && offen,
    };
  }
  if (q.leitung)
    return {
      fall: 'leitung',
      sehen: true,
      haken: true,
      status: true,
      notiz: true,
      text: true,
      frist: true,
      karte: true,
      zustaendig: true,
      modus: true,
      gruppe: true,
      abgeben: false,
      loeschen: true,
      mache: false,
      uebernehmen: false,
      ablehnen: false,
      vorschlagAendern: false,
      zurueckziehen: false,
      verlauf: true,
      teile: true,
    };
  if (ohneZustaendige(a)) return { ...NICHTS, fall: 'ohne', sehen: true, mache: true };
  if (!a.wer.includes(q.ich)) return { ...NICHTS, fall: 'fremd', sehen: false };
  if (a.wer.length === 1 && !a.extern.trim())
    return {
      ...NICHTS,
      fall: 'eigen',
      sehen: true,
      haken: true,
      status: true,
      notiz: true,
      frist: true,
      karte: true,
      abgeben: true,
      text: !q.imEntwurf,
      loeschen: !q.imEntwurf,
      teile: true,
    };
  return {
    ...NICHTS,
    fall: 'geteilt',
    sehen: true,
    haken: true,
    status: !istJeder({ jeder: a.jeder, wer: a.wer }),
    notiz: true,
    // „Jeder für sich“: für den Mitarbeiter nur seine eigene Aufgabe – keine Teile, keine anderen Zuständigen (W10).
    teile: !istJeder({ jeder: a.jeder, wer: a.wer }),
  };
}

/** Der Satz, wenn ein normaler To-Do-Weg einen Vorschlag trifft (Haken, Status, „Das mache ich“, Board, Editor …). */
export const VORSCHLAG_KEIN_TODO =
  'Das ist noch ein Vorschlag – die Leitung muss ihn erst übernehmen.';

/**
 * **Darf `x` an diesem (frisch gelesenen) To-Do geschrieben werden?** – `null` ja, sonst der Satz, warum nicht. Die Regel
 * für den Schreibweg (`toDoAendern`) **und** für die Oberfläche, die vorher fragt (Ziehen im Board). Nur Felder, die sich
 * wirklich ändern, zählen. Abgeben (`x.wer` = genau ein anderer) und „Das mache ich“ (`x.wer` = nur ich) sind die einzigen
 * Zuständigen-Änderungen eines Mitarbeiters.
 */
export function aenderungVerboten(
  a: Aufgabe,
  x: ToDoAenderung,
  q: { ich: number; leitung: boolean; imEntwurf?: boolean },
): string | null {
  const r = toDoRechte(a, q);
  if (r.fall === 'vorschlag') return VORSCHLAG_KEIN_TODO;
  if (r.fall === 'leitung') return null;
  if (r.fall === 'fremd') return 'Dieses To-Do gehört jemand anderem.';
  const nur = 'Das darf nur die Leitung.';
  if (x.text !== undefined && x.text.trim() && x.text.trim() !== a.text && !r.text)
    return r.fall === 'eigen'
      ? 'Der Text steht noch im Protokoll-Entwurf – ihn ändert die Leitung dort.'
      : 'Den Text ändert nur die Leitung.';
  if (x.bis !== undefined && (x.bis || null) !== a.bis && !r.frist)
    return 'Die Frist ändert nur die Leitung.';
  if (x.extern !== undefined && x.extern.trim() !== a.extern.trim() && !r.zustaendig)
    return 'Die Zuständigen ändert nur die Leitung.';
  if (x.karte !== undefined && !r.karte) return nur;
  if (x.jeder !== undefined && x.jeder !== istJeder(a) && !r.modus) return nur;
  if (x.wer !== undefined) {
    const gleich = x.wer.length === a.wer.length && x.wer.every((p) => a.wer.includes(p));
    const abgeben = r.abgeben && x.wer.length === 1 && x.wer[0] !== q.ich;
    const mache = r.mache && x.wer.length === 1 && x.wer[0] === q.ich;
    if (!gleich && !abgeben && !mache && !r.zustaendig)
      return r.fall === 'ohne'
        ? 'Hier kannst du dich nur selbst eintragen.'
        : r.fall === 'eigen'
          ? 'Du kannst es nur an ein anderes Mitglied abgeben.'
          : 'Die Zuständigen ändert nur die Leitung.';
  }
  if (x.status !== undefined && x.status !== a.status && !r.status)
    return 'Den Status kannst du hier nicht ändern.';
  if (x.teile?.length) {
    if (!r.haken) return 'Hier kannst du nichts abhaken.';
    if (x.teile.some((t) => !darfTeilSetzen(t.person, q.ich, false)))
      return 'Du kannst nur deinen eigenen Teil abhaken – die anderen nur die Leitung.';
  }
  if (x.notiz?.trim() && !r.notiz) return 'Hier kannst du keine Notiz schreiben.';
  return null;
}

/**
 * **Darf ein neues To-Do so angelegt werden?** Ein Mitarbeiter legt nur eines für sich selbst an – **oder einen Vorschlag**
 * (`vorschlag`, W9b: ohne Zuständige; die legt die Leitung beim Übernehmen fest) – `null` ja, sonst der Satz.
 */
export function anlegenVerboten(
  q: { wer: readonly number[]; extern: string; vorschlag?: boolean },
  w: { ich: number; leitung: boolean },
): string | null {
  if (w.leitung) return null;
  if (q.vorschlag)
    return q.wer.length === 0 && !q.extern.trim()
      ? null
      : 'Ein Vorschlag hat noch keine Zuständigen – die legt die Leitung beim Übernehmen fest.';
  return q.wer.length === 1 && q.wer[0] === w.ich && !q.extern.trim()
    ? null
    : 'Als Mitglied legst du To-Dos nur für dich selbst an.';
}

/**
 * **Modus wechseln** (Gemeinsam ↔ Jeder für sich) – mit Verlaufseintrag `modus`. Wird aus „gemeinsam / erledigt“ zu „Jeder für
 * sich“ gewechselt, gelten alle Zuständigen als fertig (sonst fiele ein erledigtes To-Do auf „offen“ zurück). Danach rechnet
 * `gesamtstandNeu`. Schon so → unverändert zurück.
 */
export function modusSetzen(a: Aufgabe, jeder: boolean, von: number, am: string): Aufgabe {
  if ((a.jeder === true) === jeder) return a;
  let n: Aufgabe = { ...a, verlauf: [...a.verlauf, { am, von, art: 'modus', jeder }] };
  if (jeder) {
    n.jeder = true;
    if (a.status === 'erledigt' && a.wer.length >= 2)
      n.fertig = { ...a.fertig, ...Object.fromEntries(a.wer.map((p) => [String(p), am])) };
  } else delete n.jeder;
  n = gesamtstandNeu(n, von, am);
  return n;
}

/**
 * **Der Haken** (W8a, Alwin 19.11.2026: Haken statt Weiterschalten) – was ein Klick bei `ich` bewirkt: bei „Jeder für sich“
 * den eigenen Teil (nur wenn man zuständig ist, sonst `null` = nur Anzeige), sonst erledigt ↔ offen. Nie „in Arbeit“.
 */
export type HakenSchritt =
  | { art: 'status'; neu: 'offen' | 'erledigt' }
  | { art: 'teil'; person: number; fertig: boolean };

export function hakenSchritt(a: Aufgabe, ich: number): HakenSchritt | null {
  if (istJeder(a)) {
    if (!a.wer.includes(ich)) return null;
    return { art: 'teil', person: ich, fertig: !teilFertig(a, ich) };
  }
  return { art: 'status', neu: a.status === 'erledigt' ? 'offen' : 'erledigt' };
}

/** Ist der Haken gesetzt? Bei „Jeder für sich“: mein Teil (nicht zuständig: der Gesamtstand), sonst `erledigt`. */
export function hakenGesetzt(a: Aufgabe, ich: number): boolean {
  return istJeder(a) && a.wer.includes(ich) ? teilFertig(a, ich) : a.status === 'erledigt';
}

/** Einen Haken-Schritt anwenden – auf den (frischen) Stand. Eine Regel für Editor, feste Punkte und Übersicht. */
export function hakenAnwenden(a: Aufgabe, s: HakenSchritt, von: number, am: string): Aufgabe {
  return s.art === 'teil'
    ? teilSetzen(a, s.person, s.fertig, von, am)
    : statusSetzen(a, s.neu, von, am);
}

export function notizHinzufuegen(a: Aufgabe, text: string, von: number, am: string): Aufgabe {
  const t = text.trim();
  if (!t) return a;
  return { ...a, verlauf: [...a.verlauf, { am, von, art: 'notiz', text: t }] };
}

/** Als gelöscht vermerken – der Wert bleibt, der Verlauf zeigt, wer es war. */
export function alsGeloescht(a: Aufgabe, von: number, am: string): Aufgabe {
  if (a.geloescht) return a;
  return { ...a, geloescht: true, verlauf: [...a.verlauf, { am, von, art: 'geloescht' }] };
}

/** Wieder da (die Aufgabe steht wieder im Protokoll, etwa nach „Rückgängig“) – mit Verlaufseintrag. */
export function alsWiederhergestellt(a: Aufgabe, von: number, am: string): Aufgabe {
  if (!a.geloescht) return a;
  return { ...a, geloescht: false, verlauf: [...a.verlauf, { am, von, art: 'wiederhergestellt' }] };
}

/** **Die letzte Notiz** aus dem Verlauf – für die Karte („Auf Karte anzeigen“). */
export function letzteNotiz(a: Aufgabe): VerlaufEintrag | null {
  return notizenVon(a).at(-1) ?? null;
}

/**
 * **Den eigenen Namen an die eigenen Verlaufseinträge** – geschieht in den beiden Schreibtoren
 * (`protokolle/src/aufgabenSchreiben.ts`), also für jeden Weg, auf dem ein To-Do geschrieben wird. Den eigenen Namen kennt
 * jeder; fremde Einträge bleiben, wie sie sind.
 */
export function mitNamen(a: Aufgabe, ich: { person: number; name: string }): Aufgabe {
  const name = ich.name.trim().split(' ')[0];
  if (!name || !a.verlauf.some((v) => v.von === ich.person && !v.name)) return a;
  return {
    ...a,
    verlauf: a.verlauf.map((v) => (v.von === ich.person && !v.name ? { ...v, name } : v)),
  };
}

/** **Wie heißt `p`?** Laut Verlauf dieses To-Dos (der jüngste gestempelte Name) – `null`, wenn er dort nie schrieb. */
export function nameImVerlauf(a: Pick<Aufgabe, 'verlauf'>, p: number): string | null {
  for (let i = a.verlauf.length - 1; i >= 0; i--) {
    const v = a.verlauf[i];
    if (v.von === p && v.name) return v.name;
  }
  return null;
}

/**
 * **Wer bei diesem To-Do schrieb oder zuständig ist** – erst die Mitgliederliste (`liste`, Vornamen), dann der im Verlauf
 * gestempelte Name, sonst `null`. Eine Regel für Karte, Fenster und Editor.
 */
export function nameFuer(
  a: Pick<Aufgabe, 'verlauf'>,
  p: number,
  liste: ReadonlyMap<number, string>,
): string | null {
  return liste.get(p)?.split(' ')[0] ?? nameImVerlauf(a, p);
}

/**
 * **Der Name aus der Mitgliederliste** – ist sie verborgen (Mitglieder sehen sie oft nicht) oder noch nicht geladen,
 * kennt man wenigstens sich selbst. Für Editor und feste Punkte; danach kommt `nameImVerlauf`.
 */
export function nameAusListe(
  liste: readonly { id: number; name: string }[] | 'verborgen' | null,
  ich: { person: number; name: string },
): (p: number) => string | null {
  return (p) =>
    (liste && liste !== 'verborgen' ? liste.find((m) => m.id === p)?.name : undefined) ??
    (p === ich.person ? ich.name : null);
}

/**
 * **Die Zuständigen eines To-Dos als Namen** – erst die Mitglieder (`name`, sonst der im Verlauf gestempelte Name, sonst
 * `unbekannt`; wer dann noch ohne Namen ist, fällt weg), danach die Person außerhalb der Gruppe mit „(extern)“. Ohne
 * `name` (Lese-Ansicht ohne Mitgliederliste) nur die externe Person. Eine Regel für Editor, feste Punkte und PDF (S6-3a)
 * – bis dahin stand sie zweimal von Hand.
 */
export function zustaendigeNamen(
  a: Pick<Aufgabe, 'wer' | 'extern'> & { verlauf?: Aufgabe['verlauf'] },
  name: ((p: number) => string | null) | null,
  unbekannt: (p: number) => string | null = () => null,
): string[] {
  const mitglieder = name
    ? a.wer
        .map(
          (p) =>
            name(p) ??
            (a.verlauf ? nameImVerlauf({ verlauf: a.verlauf }, p) : null) ??
            unbekannt(p),
        )
        .filter((n): n is string => !!n)
    : [];
  return [...mitglieder, ...(a.extern ? [`${a.extern} (extern)`] : [])];
}

/**
 * **Zuständige, die man nicht kennt** (Mitgliederliste verborgen): mit Namen, wenn sie im Verlauf je schrieben, sonst
 * gezählt – „eine weitere Person“, „2 weitere“. Karte und Fenster sagen es gleich.
 */
export function weitereZustaendige(a: Pick<Aufgabe, 'verlauf'>, ids: readonly number[]): string[] {
  const namen = ids.flatMap((p) => nameImVerlauf(a, p) ?? []);
  const rest = ids.length - namen.length;
  return [...namen, ...(rest ? [rest === 1 ? 'eine weitere Person' : `${rest} weitere`] : [])];
}

/**
 * **Schalter „Alle“ bei den Zuständigen** (W5, Alwin 17.11.2026): wirkt genau so, als hätte man alle Personen der Liste von
 * Hand angehakt – es gibt kein eigenes Datenfeld, gespeichert wird weiter `wer`. „Alle gewählt?“ ist nur, ob jeder aus der
 * Liste dabei ist (eine leere Liste ist nie „alle“).
 */
export function alleGewaehlt(liste: readonly number[], wer: Iterable<number>): boolean {
  const da = new Set(wer);
  return liste.length > 0 && liste.every((p) => da.has(p));
}

/**
 * Schalter „Alle“ umgelegt: an = alle aus `liste` dazu, aus = alle aus `liste` weg. Wer nicht in der Liste steht
 * (Mitglieder, die man nicht kennt) bleibt unberührt – wie beim Hand-Anhaken. Reihenfolge: Bestehende zuerst.
 */
export function alleSetzen(liste: readonly number[], wer: Iterable<number>, an: boolean): number[] {
  const aktuell = [...wer];
  if (!an) {
    const weg = new Set(liste);
    return aktuell.filter((p) => !weg.has(p));
  }
  return [...new Set([...aktuell, ...liste])];
}

/**
 * **Zuständige für Bildschirm-Stellen kürzen** (W5): die ersten `max` Namen, danach „+N“ – bei 17 Zuständigen wäre die
 * volle Liste unlesbar. `voll` ist die ganze Liste (Tooltip, Screenreader). Das Protokoll (PDF, Lesen) kürzt nie.
 */
export function zustaendigKurz(
  namen: readonly string[],
  max = 3,
): { text: string; voll: string; gekuerzt: boolean } {
  const voll = namen.join(', ');
  if (namen.length <= max) return { text: voll, voll, gekuerzt: false };
  return {
    text: `${namen.slice(0, max).join(', ')} +${namen.length - max}`,
    voll,
    gekuerzt: true,
  };
}

/** Was das Fenster „To-Do“ ändert – nur, was der Nutzer angefasst hat (`undefined` = bleibt, wie es frisch gelesen ist). */
export interface ToDoAenderung {
  text?: string;
  wer?: number[];
  extern?: string;
  bis?: string | null;
  status?: AufgabenStatus;
  /** „Jeder für sich“ ein/aus (W8a). */
  jeder?: boolean;
  /** Die Teile einzelner Personen setzen (W8a, „Jeder für sich“). */
  teile?: { person: number; fertig: boolean }[];
  /** Neue Notiz (leer = keine). */
  notiz?: string;
  karte?: { notiz?: boolean; sitzung?: boolean };
}

/**
 * **Zuständige setzen – mit Eintrag im Verlauf** (S7-3, Alwin 30.10.2026: „Zuständig“ überall in den Verlauf – im
 * Fenster, beim Ziehen im Board und im Editor). Ändert sich nichts (gleiche Personen, andere Reihenfolge), bleibt das
 * To-Do, wie es ist.
 */
export function zustaendigSetzen(
  a: Aufgabe,
  wer: readonly number[],
  von: number,
  am: string,
): Aufgabe {
  const nachher = [...new Set(wer)];
  const gleich = nachher.length === a.wer.length && nachher.every((p) => a.wer.includes(p));
  if (gleich) return a;
  // Wer dazukommt oder geht, ändert bei „Jeder für sich“ den Gesamtstand (alle fertig? niemand fertig?).
  return gesamtstandNeu(
    {
      ...a,
      wer: nachher,
      verlauf: [...a.verlauf, { am, von, art: 'zustaendig', vorher: [...a.wer], nachher }],
    },
    von,
    am,
  );
}

/**
 * **Ein To-Do bearbeiten** (Fenster „To-Do“, S7-2) – auf den **frisch gelesenen** Stand angewendet, und nur die Felder,
 * die im Fenster geändert wurden: Hat inzwischen jemand anderes etwas anderes geändert (etwa abgehakt), bleibt das. Status,
 * Notiz und Zuständige (S7-3) kommen in den Verlauf; Text und Bis wie am Aufgaben-Block ohne Eintrag.
 */
export function bearbeiten(a: Aufgabe, x: ToDoAenderung, von: number, am: string): Aufgabe {
  let n: Aufgabe = { ...a };
  if (x.text !== undefined && x.text.trim()) n.text = x.text.trim();
  if (x.wer !== undefined) n = zustaendigSetzen(n, x.wer, von, am);
  if (x.extern !== undefined) n.extern = x.extern.trim();
  if (x.bis !== undefined) n.bis = x.bis || null;
  if (x.karte !== undefined) n.karte = { ...a.karte, ...x.karte };
  if (x.jeder !== undefined) n = modusSetzen(n, x.jeder, von, am);
  for (const t of x.teile ?? []) n = teilSetzen(n, t.person, t.fertig, von, am);
  if (x.status !== undefined) n = statusSetzen(n, x.status, von, am);
  if (x.notiz) n = notizHinzufuegen(n, x.notiz, von, am);
  return n;
}

/**
 * **In eine andere Gruppe verschieben** (S7-2, Alwin 30.10.2026: „auch später änderbar“): Ein To-Do liegt in der
 * „Mitarbeit“ seiner Gruppe – umziehen heißt, in der neuen Gruppe **neu anlegen** (neue ID, ohne Sitzung, der Verlauf
 * zieht mit) und das alte **als gelöscht vermerken**. Beide tragen eine Notiz, wohin bzw. woher.
 */
export function verschieben(
  a: Aufgabe,
  q: {
    gruppe: number;
    neueId: string;
    von: string;
    nach: string;
    wer: number[];
    ich: number;
    am: string;
  },
): { neu: Aufgabe; alt: Aufgabe } {
  // Wer in der neuen Gruppe nicht Mitglied ist, fällt weg – auch das kommt in den Verlauf (eine Regel, S7-3).
  const neu = notizHinzufuegen(
    zustaendigSetzen({ ...a, id: q.neueId, gruppe: q.gruppe, sitzung: null }, q.wer, q.ich, q.am),
    `Aus „${q.von}“ hierher verschoben.`,
    q.ich,
    q.am,
  );
  const alt = alsGeloescht(
    notizHinzufuegen(a, `Nach „${q.nach}“ verschoben.`, q.ich, q.am),
    q.ich,
    q.am,
  );
  return { neu, alt };
}

/** Überfällig: nicht erledigt und das Datum liegt vor heute (`heute` als `JJJJ-MM-TT`, Ortszeit des Aufrufers). */
export function istUeberfaellig(a: Pick<Aufgabe, 'status' | 'bis'>, heute: string): boolean {
  return a.status !== 'erledigt' && a.bis !== null && a.bis < heute;
}

export function istMeine(a: Aufgabe, person: number): boolean {
  return !a.geloescht && a.wer.includes(person);
}

/**
 * **Ist das To-Do für mich offen?** – die eine Stelle für „meine offenen To-Dos“ (Startseite, Hinweis-Band und Zähler):
 * ich bin zuständig, und bei „Jeder für sich“ fehlt **mein** Teil, sonst ist der Gesamtstand nicht erledigt.
 */
export function istFuerMichOffen(a: Aufgabe, person: number): boolean {
  if (!istMeine(a, person)) return false;
  return istJeder(a) ? !teilFertig(a, person) && a.status !== 'erledigt' : a.status !== 'erledigt';
}

/**
 * **Erledigt von wem, wann?** (aus dem Verlauf, für die Karte „Erledigt von … am …“): bei „gemeinsam“ der, der zuletzt auf
 * erledigt setzte; bei „Jeder für sich“ alle Zuständigen, die ihren Teil erledigt haben (in der Reihenfolge der Zuständigen),
 * `am` = wann der Gesamtstand erledigt wurde. `null`, solange nicht erledigt.
 */
export function erledigtVon(a: Aufgabe): { von: number[]; am: string } | null {
  const am = erledigtAm(a);
  if (am === null) return null;
  if (istJeder(a)) return { von: a.wer.filter((p) => teilFertig(a, p)), am };
  for (let i = a.verlauf.length - 1; i >= 0; i--) {
    const e = a.verlauf[i];
    if (e.art === 'status' && e.status === 'erledigt') return { von: [e.von], am };
  }
  return null;
}

/** Wann zuletzt auf „erledigt“ gesetzt (ISO) – `null`, wenn nicht erledigt. */
export function erledigtAm(a: Aufgabe): string | null {
  if (a.status !== 'erledigt') return null;
  for (let i = a.verlauf.length - 1; i >= 0; i--) {
    const e = a.verlauf[i];
    if (e.art === 'status' && e.status === 'erledigt') return e.am;
  }
  return null;
}

export interface Gruppiert {
  ueberfaellig: Aufgabe[];
  arbeit: Aufgabe[];
  offen: Aufgabe[];
  erledigt: Aufgabe[];
}

const nachDatum = (x: Aufgabe, y: Aufgabe): number =>
  (x.bis ?? '9999-99-99').localeCompare(y.bis ?? '9999-99-99') ||
  x.text.localeCompare(y.text, 'de');

/**
 * **Die Liste wie im Entwurf**: überfällig zuerst, dann in Arbeit, offen, erledigt; innerhalb nach Fälligkeit
 * (ohne Datum zuletzt). Gelöschte fehlen; Erledigte zuletzt erledigt zuerst.
 */
export function gruppieren(liste: readonly Aufgabe[], heute: string): Gruppiert {
  const g: Gruppiert = { ueberfaellig: [], arbeit: [], offen: [], erledigt: [] };
  for (const a of liste) {
    if (a.geloescht) continue;
    if (istUeberfaellig(a, heute)) g.ueberfaellig.push(a);
    else if (a.status === 'arbeit') g.arbeit.push(a);
    else if (a.status === 'offen') g.offen.push(a);
    else g.erledigt.push(a);
  }
  g.ueberfaellig.sort(nachDatum);
  g.arbeit.sort(nachDatum);
  g.offen.sort(nachDatum);
  g.erledigt.sort((x, y) => (erledigtAm(y) ?? '').localeCompare(erledigtAm(x) ?? ''));
  return g;
}

/**
 * **Die offenen To-Dos** – alles, was nicht erledigt und nicht gelöscht ist, in der Reihenfolge von `gruppieren`
 * (überfällig, in Arbeit, offen; je nach Fälligkeit). Die eine Stelle dafür (Startseite: Zähler je Gruppe und „Meine“).
 */
export function offene(liste: readonly Aufgabe[], heute: string): Aufgabe[] {
  const g = gruppieren(liste, heute);
  return [...g.ueberfaellig, ...g.arbeit, ...g.offen];
}

/** **Meine offenen To-Dos** (Startseite, S3-3): die mir zugewiesenen unter `offene`. */
export function meineOffenen(liste: readonly Aufgabe[], ich: number, heute: string): Aufgabe[] {
  return offene(
    liste.filter((a) => istFuerMichOffen(a, ich)),
    heute,
  );
}

/** „Seit der Sitzung am … erledigt“ – erledigt nach `seit` (ISO). */
export function erledigtSeit(liste: readonly Aufgabe[], seit: string): Aufgabe[] {
  return liste.filter((a) => {
    const am = erledigtAm(a);
    return !a.geloescht && am !== null && am > seit;
  });
}

/** Ist das ein To-Do-Wert von uns? Für alles, was aus dem Speicher kommt. */
export function istAufgabe(x: unknown): x is Aufgabe {
  if (!x || typeof x !== 'object') return false;
  const a = x as Partial<Aufgabe>;
  return (
    a.art === 'aufgabe' &&
    a.fassung === 1 &&
    typeof a.id === 'string' &&
    typeof a.gruppe === 'number' &&
    typeof a.text === 'string' &&
    Array.isArray(a.wer) &&
    (a.status === 'offen' || a.status === 'arbeit' || a.status === 'erledigt') &&
    Array.isArray(a.verlauf) &&
    (a.jeder === undefined || a.jeder === true) &&
    (a.fertig === undefined ||
      (!!a.fertig &&
        typeof a.fertig === 'object' &&
        !Array.isArray(a.fertig) &&
        Object.values(a.fertig).every((z) => typeof z === 'string'))) &&
    // Ein Vorschlag (W9b): fehlt das Feld, ist es ein To-Do; ist es kaputt, ist der Wert keiner von uns – nie versehentlich ein
    // To-Do.
    (a.vorschlag === undefined || istToDoVorschlagFeld(a.vorschlag))
  );
}

function istToDoVorschlagFeld(x: unknown): x is ToDoVorschlag {
  const v = x as Partial<ToDoVorschlag> | null;
  return (
    !!v &&
    typeof v === 'object' &&
    (v.stand === 'offen' || v.stand === 'abgelehnt') &&
    typeof v.von === 'number' &&
    typeof v.name === 'string' &&
    typeof v.am === 'string' &&
    (v.grund === undefined || typeof v.grund === 'string') &&
    (v.abgelehntAm === undefined || typeof v.abgelehntAm === 'string')
  );
}

/**
 * **Wer und Bis, bevor es das To-Do gibt** (K1, beim Durchklicken 28.10.2026: „Wer und Bis vor dem Inhalt bearbeiten“).
 * Ein To-Do entsteht erst mit Text (sonst stünde ein leeres To-Do bei den Zuständigen, und das nächste Speichern
 * vermerkte es als gelöscht). Bis dahin merkt sich der Aufgaben-Block die Wahl (`props.vorab`, JSON); beim Anlegen wird
 * sie übernommen – beim Speichern (`aufgabenAbgleich`) wie beim ersten Tipp auf den Status-Kreis (`vorabAnwenden`).
 */
export interface Vorab {
  wer: number[];
  extern: string;
  bis: string | null;
}

/** `props.vorab` lesen – leer oder kaputt → `null`. */
export function vorabLesen(x: unknown): Vorab | null {
  if (typeof x !== 'string' || !x) return null;
  try {
    const v = JSON.parse(x) as Partial<Vorab> | null;
    if (!v || typeof v !== 'object') return null;
    const wer = Array.isArray(v.wer) ? v.wer.filter((p): p is number => Number.isInteger(p)) : [];
    const extern = typeof v.extern === 'string' ? v.extern : '';
    const bis = typeof v.bis === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.bis) ? v.bis : null;
    return wer.length || extern || bis ? { wer, extern, bis } : null;
  } catch {
    return null;
  }
}

/** Die Vorab-Wahl in ein (neues) To-Do übernehmen – die eine Stelle dafür. */
export function vorabAnwenden(a: Aufgabe, v: Vorab | null): Aufgabe {
  if (!v) return a;
  return { ...a, wer: [...new Set(v.wer)], extern: v.extern.trim(), bis: v.bis };
}

/** Was der Abgleich braucht – ein Block des Protokolls (`AufgabenEintrag` aus `ableiten`). */
interface Eintrag {
  aufgabe: string | null;
  text: string;
  /** Wer/Bis, gewählt bevor es das To-Do gab. */
  vorab?: Vorab | null;
}

/** Ein Block, wie er im Dokument steht – nur, was die ID-Vergabe braucht. */
interface IdBlock {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: IdBlock[];
}

/**
 * **IDs für Aufgaben im Protokoll** (S4-2): Ein Aufgaben-Block ohne ID (neu, aus einer Vorlage) oder mit einer ID, die
 * schon ein früherer Block trägt (kopiert und eingefügt) oder die zu einer anderen Sitzung gehört (aus einem anderen
 * Protokoll eingefügt), bekommt eine neue – sonst teilten sich zwei Aufgaben ein To-Do. Ergebnis: welche Blöcke welche
 * ID bekommen; leer, wenn alles passt.
 */
export function aufgabenIdsVergeben(
  dokument: readonly IdBlock[],
  fremd: (id: string) => boolean,
  neueId: () => string,
): { blockId: string; aufgabe: string }[] {
  const gesehen = new Set<string>();
  const neu: { blockId: string; aufgabe: string }[] = [];
  const besuche = (b: IdBlock): void => {
    if (b.type === 'aufgabe') {
      const id = typeof b.props?.aufgabe === 'string' ? b.props.aufgabe : '';
      if (!id || gesehen.has(id) || fremd(id)) neu.push({ blockId: b.id, aufgabe: neueId() });
      else gesehen.add(id);
    }
    for (const k of b.children ?? []) besuche(k);
  };
  dokument.forEach(besuche);
  return neu;
}

export interface AufgabenPlan {
  /** Neue To-Do-Werte. */
  anlegen: Aufgabe[];
  /** Geänderte To-Dos (Text, gelöscht vermerkt, wiederhergestellt) – jeweils der neue Stand. */
  aendern: Aufgabe[];
}

/**
 * **Das Protokoll führt** (Alwin 24.10.2026, S4-2): Was muss in „Mitarbeit“ geschehen, damit die To-Dos dieser Sitzung zu
 * den Aufgaben im Protokoll passen?
 * - Aufgabe mit Text, aber noch kein To-Do → anlegen (Zuständige sehen es sofort), mit Wer/Bis von vorab (`Vorab`);
 * - Text im Protokoll geändert → Text im To-Do mit (Wer, Bis und Status bleiben – die gehören dem To-Do);
 * - To-Do dieser Sitzung, dessen Aufgabe nicht mehr im Protokoll steht → als gelöscht vermerkt (nie hart gelöscht);
 * - als gelöscht vermerkt, aber wieder im Protokoll (Rückgängig) → wiederhergestellt.
 * To-Dos anderer Sitzungen bleiben unberührt. Nichts zu tun → leere Listen (dann wird nichts geschrieben).
 */
export function aufgabenAbgleich(q: {
  eintraege: readonly Eintrag[];
  vorhanden: readonly Aufgabe[];
  gruppe: number;
  sitzung: string;
  von: number;
  am: string;
}): AufgabenPlan {
  const plan: AufgabenPlan = { anlegen: [], aendern: [] };
  const vorhanden = new Map(q.vorhanden.map((a) => [a.id, a]));
  const imProtokoll = new Set<string>();
  for (const e of q.eintraege) {
    if (!e.aufgabe || imProtokoll.has(e.aufgabe)) continue;
    imProtokoll.add(e.aufgabe);
    const a = vorhanden.get(e.aufgabe);
    const text = e.text.trim();
    if (!a) {
      plan.anlegen.push(
        vorabAnwenden(
          neueAufgabe({
            id: e.aufgabe,
            gruppe: q.gruppe,
            sitzung: q.sitzung,
            text,
            von: q.von,
            am: q.am,
          }),
          e.vorab ?? null,
        ),
      );
      continue;
    }
    if (a.sitzung !== q.sitzung) continue; // gehört einer anderen Sitzung – IDs vergibt `aufgabenIdsVergeben` neu
    let neu = alsWiederhergestellt(a, q.von, q.am);
    if (neu.text !== text) neu = { ...neu, text };
    if (neu !== a) plan.aendern.push(neu);
  }
  for (const a of q.vorhanden)
    if (a.sitzung === q.sitzung && !a.geloescht && !imProtokoll.has(a.id))
      plan.aendern.push(alsGeloescht(a, q.von, q.am));
  return plan;
}
