import { useCallback, useEffect, useRef, useState } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import type {
  Feld,
  Feldtyp,
  Formular,
  Gestaltung,
  OeffentlicheEinstellungen,
} from '@shared/anmeldung/formular';
import { bereichVon } from '@shared/anmeldung/baukasten';
import {
  bedingungenNachziehen,
  umbenannteAntworten,
  weggefallenText,
} from '@shared/anmeldung/bedingungen';
import { antwortenZaehlen, ctFelderLesen, feldSpeichern, feldTypAendern } from './formularFelder';
import { aendereEinstellungen } from './einrichten';
import {
  entwurfFehler,
  ersetzeFeld,
  istFest,
  mitAntworten,
  type FeldEntwurf,
} from './baukastenEntwurf';
import type { useSchlange } from './useSchlange';

const feldIn = (fo: Formular, feldId: string) =>
  [...fo.anmeldung, ...fo.person].find((x) => x.id === feldId);

/** Das Feld mit den Bedingungen von `sauber` (nachgezogen) – sonst unverändert. */
function mitBedingungenVon(f: Feld, sauber: Feld | undefined): Feld {
  const neu: Feld = { ...f, bed: sauber?.bed, antwortBed: sauber?.antwortBed };
  if (!neu.bed) delete neu.bed;
  if (!neu.antwortBed) delete neu.antwortBed;
  return neu;
}

/** Pause beim Tippen, nach der ein Feld gespeichert wird. */
export const PAUSE_FELD_MS = 1500;
/** Pause nach einer Änderung am Design (Farbe, Vorlage …), nach der gespeichert wird. */
export const PAUSE_DESIGN_MS = 700;

/**
 * **Ein Feld ließ sich nicht speichern.** Solange es gewählt ist, gilt der Hinweis ihm. Wird es verlassen, ist die
 * Änderung weg – dann nennt der Hinweis das Feld (`verlassen`: wie es gespeichert heißt) und geht, sobald danach
 * etwas anderes gespeichert wird (Alwin, 12.11.2026; vorher blieb er stehen, bis wieder in ein Feld getippt wurde).
 */
interface Hinweis {
  fehler: string;
  verlassen?: string;
}

function hinweisText(h: Hinweis | null): string | null {
  if (!h) return null;
  if (h.verlassen === undefined) return `Nicht gespeichert: ${h.fehler}`;
  return `${h.verlassen ? `„${h.verlassen}“` : 'Feld'} nicht gespeichert: ${h.fehler}`;
}

interface AntwortInfo {
  feldId: string;
  beantwortet: number;
  jeAntwort: Map<string, number>;
  /** Die Antworten in ChurchTools: ID und Text. */
  ct: { id: string; text: string }[];
}

/**
 * **Das gewählte Feld im Baukasten und sein Entwurf** (#845, Scheibe 4b-2: aus der Komponente herausgezogen,
 * unverändert): welches Feld gewählt ist, was daran gerade geändert wird, wann es gespeichert wird (nach einer Pause
 * beim Tippen, beim Verlassen) und was ChurchTools zu seinen Antworten weiß (wie oft beantwortet, IDs der Antworten).
 */
export function useFeldEntwurf({
  id,
  tun,
  auftraege,
  formularRef,
  setLokalF,
  ctFelder,
}: {
  id: number;
  tun: ReturnType<typeof useSchlange>['tun'];
  /** Wie viele Aufgaben bisher in die Speicher-Schlange kamen – ein neues Speichern räumt den Hinweis eines verlassenen
   * Felds weg. */
  auftraege: number;
  /** Der Stand von jetzt – die Zeitgeber feuern später als das Zeichnen, in dem sie gestellt wurden. */
  formularRef: { readonly current: Formular };
  setLokalF: (fo: Formular) => void;
  ctFelder: OeffentlicheEinstellungen['ctFelder'];
}) {
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<FeldEntwurf | null>(null);
  const [hinweis, setHinweis] = useState<Hinweis | null>(null);
  const entwurfRef = useRef<FeldEntwurf | null>(null);
  const geaendert = useRef(false);
  const feldUhr = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Das bearbeitete Feld speichern, falls es sich geändert hat und in Ordnung ist. */
  const feldSichern = useCallback(() => {
    if (feldUhr.current) clearTimeout(feldUhr.current);
    feldUhr.current = null;
    const d = entwurfRef.current;
    if (!d || !geaendert.current) return;
    const fehler = entwurfFehler(d);
    if (fehler) {
      setHinweis({ fehler });
      return;
    }
    geaendert.current = false;
    const mit = mitAntworten(d.feld);
    const feld: Feld = {
      ...d.feld,
      frage: d.feld.frage.trim(),
      antworten: mit ? d.antworten.map((a) => a.text.trim()) : d.feld.antworten,
    };
    const antworten = mit
      ? d.antworten.map((a) => ({ text: a.text.trim(), altId: a.altId, von: a.von }))
      : undefined;
    const bereich = bereichVon(formularRef.current, feld.id) ?? 'person';
    // Bedingungen ziehen mit (F1c) – derselbe Schritt wie beim Speichern (`feldSpeichern` → `ersetzen`).
    const { formular, weggefallen } = bedingungenNachziehen(
      ersetzeFeld(formularRef.current, feld),
      { feldId: feld.id, antworten: umbenannteAntworten(antworten) },
    );
    setLokalF(formular);
    // Der Entwurf geht vom gespeicherten Stand aus weiter: Die Antworten heißen ab jetzt so (das nächste Umbenennen
    // zieht von hier aus mit, nicht vom Stand beim Laden), und die Bedingungen am Feld sind die nachgezogenen.
    const sauber = feldIn(formular, feld.id);
    const weiter: FeldEntwurf = {
      feld: mitBedingungenVon(d.feld, sauber),
      antworten: d.antworten.map((a) => ({ ...a, von: a.text.trim() })),
    };
    entwurfRef.current = weiter;
    setEntwurf(weiter);
    setHinweis(null);
    const zusatz = weggefallenText(weggefallen);
    void tun(`„${feld.frage || 'Trennlinie'}“ gespeichert.${zusatz ? ` ${zusatz}` : ''}`, () =>
      feldSpeichern(id, bereich, feld, antworten),
    );
  }, [id, tun, formularRef, setLokalF]);

  function neuerEntwurf(f: Feld | null) {
    const vorher = entwurfRef.current;
    if (vorher && vorher.feld.id !== f?.id) {
      const name = feldIn(formularRef.current, vorher.feld.id)?.frage.trim() ?? '';
      setHinweis((h) => (h && h.verlassen === undefined ? { ...h, verlassen: name } : h));
    }
    const d = f ? { feld: f, antworten: f.antworten.map((t) => ({ text: t, von: t })) } : null;
    entwurfRef.current = d;
    geaendert.current = false;
    setEntwurf(d);
  }

  function waehlen(feldId: string | null) {
    if (feldId === aktiv) return;
    feldSichern();
    setAktiv(feldId);
    const f = feldId
      ? [...formularRef.current.anmeldung, ...formularRef.current.person].find(
          (x) => x.id === feldId,
        )
      : undefined;
    // Feste Felder (Name, E-Mail) lassen sich wählen, um sie zu verschieben – bearbeitet werden sie nicht.
    neuerEntwurf(f && !istFest(f) ? f : null);
  }

  // Zum gewählten Feld: wie oft beantwortet, und die IDs der Antworten (Umbenennen behält die Wahl).
  const ctId = aktiv ? ctFelder[aktiv] : undefined;
  const infoStand = useLaden(
    () =>
      !aktiv || ctId === undefined
        ? null
        : Promise.all([ctFelderLesen(id), antwortenZaehlen(id)]).then(
            ([felder, zahlen]): AntwortInfo => {
              const z = zahlen.get(ctId);
              return {
                feldId: aktiv,
                beantwortet: z?.gesamt ?? 0,
                jeAntwort: z?.jeOption ?? new Map<string, number>(),
                ct: (felder.get(ctId)?.options ?? []).map((o) => ({
                  id: String(o.id),
                  text: o.name,
                })),
              };
            },
          ),
    [id, aktiv, ctId],
  ).stand;
  // Ein anderes Feld lädt neu; `feldId` hält die Info beim Feld, zu dem sie gehört. Einen neuen Fragetyp gibt es nur
  // ohne Antworten – dort sagt die Info nichts (0 beantwortet), bis die neue Spalte da ist.
  const info = infoStand.art === 'fertig' ? infoStand.daten : null;
  // Kommen die IDs der Antworten, bekommt der Entwurf dieses Felds sie dazu (Umbenennen behält die Wahl).
  useEffect(() => {
    if (infoStand.art !== 'fertig') return;
    const { feldId, ct } = infoStand.daten;
    const d = entwurfRef.current;
    if (!d || d.feld.id !== feldId) return;
    const zuId = new Map(ct.map((o) => [o.text, o.id]));
    const mitIds = {
      ...d,
      antworten: d.antworten.map((a) =>
        a.altId || a.von === undefined ? a : { ...a, altId: zuId.get(a.von) },
      ),
    };
    entwurfRef.current = mitIds;
    setEntwurf(mitIds);
  }, [infoStand]);

  function aendern(d: FeldEntwurf) {
    entwurfRef.current = d;
    geaendert.current = true;
    setEntwurf(d);
    setHinweis(null);
    if (feldUhr.current) clearTimeout(feldUhr.current);
    feldUhr.current = setTimeout(feldSichern, PAUSE_FELD_MS);
  }

  /** Fragetyp ändern – mit allem, was gerade am Feld geändert ist (`feldTypAendern`: neue Spalte). */
  function typAendern(typ: Feldtyp) {
    const d = entwurfRef.current;
    if (!d || d.feld.typ === typ) return;
    if (feldUhr.current) clearTimeout(feldUhr.current);
    geaendert.current = false;
    const bisher = d.antworten.map((a) => a.text.trim()).filter(Boolean);
    const feld: Feld = {
      ...d.feld,
      typ,
      frage: d.feld.frage.trim(),
      antworten: mitAntworten({ ...d.feld, typ })
        ? bisher.length >= 2
          ? bisher
          : ['Antwort 1', 'Antwort 2']
        : [],
    };
    // Ein anderer Fragetyp kennt andere Vergleiche und Antworten – was nicht mehr passt, fällt weg (F1c).
    const { formular, weggefallen } = bedingungenNachziehen(ersetzeFeld(formularRef.current, feld));
    setLokalF(formular);
    neuerEntwurf(feldIn(formular, feld.id) ?? feld);
    const zusatz = weggefallenText(weggefallen);
    void tun(`Fragetyp von „${feld.frage}“ geändert.${zusatz ? ` ${zusatz}` : ''}`, () =>
      feldTypAendern(id, feld),
    );
  }

  /**
   * Haben sich die Bedingungen am gewählten Feld von außen geändert (eine Quelle entfernt, das Geburtsdatum
   * ausgeschaltet), übernimmt der Entwurf sie – sonst schriebe das nächste Speichern die alten zurück.
   */
  function bedingungenAuffrischen(fo: Formular) {
    const d = entwurfRef.current;
    const sauber = d ? feldIn(fo, d.feld.id) : undefined;
    if (!d || !sauber || (sauber.bed === d.feld.bed && sauber.antwortBed === d.feld.antwortBed))
      return;
    const neu = { ...d, feld: mitBedingungenVon(d.feld, sauber) };
    entwurfRef.current = neu;
    setEntwurf(neu);
  }

  /** Das gewählte Feld abwählen, ohne zu speichern – es wird gerade entfernt. */
  function verwerfen() {
    geaendert.current = false;
    if (feldUhr.current) clearTimeout(feldUhr.current);
    setAktiv(null);
    neuerEntwurf(null);
    setHinweis(null);
  }

  /**
   * Den Hinweis eines verlassenen Felds wegräumen, sobald danach etwas anderes gespeichert wird – aber erst, wenn er
   * zu sehen war: Fügt derselbe Klick ein neues Feld ein, kommt dessen Speichern im selben Zeichnen in die Schlange.
   * Darum EIN Effekt, der sich merkt, beim wievielten Auftrag der Hinweis erschien (zwei Effekte hingen an ihrer
   * Reihenfolge).
   */
  const erschienen = useRef<{ hinweis: Hinweis | null; auftraege: number } | null>(null);
  useEffect(() => {
    const vorher = erschienen.current;
    erschienen.current = { hinweis, auftraege };
    if (hinweis?.verlassen === undefined || vorher?.hinweis !== hinweis) return;
    if (auftraege > vorher.auftraege) setHinweis(null);
  }, [hinweis, auftraege]);

  return {
    aktiv,
    setAktiv,
    entwurf,
    entwurfRef,
    geaendert,
    hinweis: hinweisText(hinweis),
    info,
    feldSichern,
    neuerEntwurf,
    waehlen,
    aendern,
    typAendern,
    verwerfen,
    bedingungenAuffrischen,
  };
}

/**
 * **Das Design im Baukasten speichern** (#845, Scheibe 4b-2: aus der Komponente herausgezogen, unverändert): jede
 * Änderung gleich zeigen, gespeichert wird nach einer kurzen Pause (oder beim Verlassen, `designSichern`).
 */
export function useDesignEntwurf({
  id,
  tun,
  setLokalG,
}: {
  id: number;
  tun: ReturnType<typeof useSchlange>['tun'];
  setLokalG: (g: Gestaltung) => void;
}) {
  const designUhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const designWartet = useRef<Gestaltung | null>(null);

  const designSichern = useCallback(() => {
    if (designUhr.current) clearTimeout(designUhr.current);
    designUhr.current = null;
    const g = designWartet.current;
    if (!g) return;
    designWartet.current = null;
    void tun('Design gespeichert.', () =>
      aendereEinstellungen(id, (frisch) => ({ ...frisch, gestaltung: g })),
    );
  }, [id, tun]);

  function gestalten(g: Gestaltung) {
    setLokalG(g);
    designWartet.current = g;
    if (designUhr.current) clearTimeout(designUhr.current);
    designUhr.current = setTimeout(designSichern, PAUSE_DESIGN_MS);
  }

  return { designWartet, designSichern, gestalten };
}
