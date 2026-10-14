import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import { Segment } from '@ui/bedienung/Segment';
import { Sheet } from '@ui/fenster/Sheet';
import { AnmeldeFormular, type BaukastenHaken } from '@ui/anmeldeformular/AnmeldeFormular';
import { musterAntworten } from '@ui/anmeldeformular/daten';
import {
  platzBelegt,
  type Feld,
  type Feldtyp,
  type Formular,
  type Gestaltung,
  type OeffentlicheEinstellungen,
} from '@shared/anmeldung/formular';
import {
  amEnde,
  bereichVon,
  einordnen,
  naechsteId,
  neueFeldKennung,
  verschiebbar,
  type Bereich,
} from '@shared/anmeldung/baukasten';
import {
  antwortenZaehlen,
  ctFelderLesen,
  feldEinordnen,
  feldEntfernen,
  feldSpeichern,
  feldTypAendern,
} from './formularFelder';
import {
  aendereEinstellungen,
  bildEntfernen,
  bildHochladen,
  gemeindeLogo,
  umbenennen,
} from './einrichten';
import { FeldBearbeiten } from './FeldBearbeiten';
import { BausteineTafel, type NeuerBaustein } from './BaukastenLeiste';
import { DesignTafel } from './DesignTafel';
import { entwurfFehler, mitAntworten, type FeldEntwurf } from './baukastenEntwurf';
import { BausteinSymbol } from './bausteinIcons';
import { useSchlange } from './useSchlange';
import k from './Baukasten.module.scss';

/**
 * **Der Formular-Baukasten** (A5, umgebaut nach Alwins Wunsch vom 13.10.2026: „Ich will das richtige Formular
 * da sehen … ein bisschen näher an Jotform“). In der Mitte steht das echte Formular (`AnmeldeFormular`, dieselbe
 * Darstellung wie für Gäste); rechts die Leiste mit Bausteinen (wie Campflow) und Design (wie Jotform). Bausteine
 * werden ins Formular gezogen oder angetippt, Felder direkt im Formular bearbeitet (wie Google Forms).
 *
 * **Gespeichert wird von selbst** – nach dem Ziehen, beim Verlassen eines Felds und nach einer Pause beim Tippen,
 * eins nach dem anderen (`useSchlange`). Bis ChurchTools geantwortet hat, zeigt der Baukasten den Zwischenstand
 * (`lokal…`); danach gilt wieder, was gespeichert ist.
 */

/** Pause beim Tippen, nach der ein Feld gespeichert wird. */
export const PAUSE_FELD_MS = 1500;
/** Pause nach einer Änderung am Design (Farbe, Vorlage …), nach der gespeichert wird. */
export const PAUSE_DESIGN_MS = 700;

type Gezogen = { art: 'neu'; b: NeuerBaustein } | { art: 'feld'; id: string };
/**
 * Wo abgelegt wird: vor `vorId` im Bereich (`null` = ganz unten im Bereich, auch unter den Bemerkungen). Immer
 * so ausgedrückt – „nach Feld A“ und „vor Feld B“ sind dieselbe Stelle, sonst spränge die Lücke.
 */
interface Ziel {
  bereich: Bereich;
  vorId: string | null;
}

/** Wo ein Feld beim Start des Ziehens stand – relativ zur Bühne (scrollt mit). */
interface Platz {
  id: string;
  bereich: Bereich;
  oben: number;
  unten: number;
}

/** Abstand zum Rand, ab dem beim Ziehen mitgescrollt wird, und das Tempo ganz am Rand (Pixel je Bild). */
const RAND_SCROLL = 80;
const TEMPO_SCROLL = 18;
/** Wie lange die Felder zu ihrem neuen Platz gleiten, wenn die Lücke wandert. */
const GLEITEN_MS = 160;

/** Das nächste Element darüber, das scrollt (in ChurchTools ist das nicht das Fenster, sondern der Rahmen). */
function scrollEltern(el: HTMLElement | null): HTMLElement {
  for (let x = el?.parentElement; x; x = x.parentElement) {
    const o = getComputedStyle(x).overflowY;
    if ((o === 'auto' || o === 'scroll') && x.scrollHeight > x.clientHeight) return x;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}
interface AntwortInfo {
  feldId: string;
  beantwortet: number;
  jeAntwort: Map<string, number>;
  /** Die Antworten in ChurchTools: ID und Text. */
  ct: { id: string; text: string }[];
}

const sichtbar = (f: Feld) => f.zustand !== 'aus';
const ersetzeFeld = (fo: Formular, feld: Feld): Formular => ({
  anmeldung: fo.anmeldung.map((f) => (f.id === feld.id ? feld : f)),
  person: fo.person.map((f) => (f.id === feld.id ? feld : f)),
});

/** Ein Textfeld so hoch wie sein Inhalt (nicht jeder Browser kann `field-sizing: content`). */
function hoeheAnpassen(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/** Setzt `inert`: Die Felder im Baukasten zeigen nur, wie es aussieht – Klicks gehen an die Hülle. */
const inert = (el: HTMLElement | null) => el?.setAttribute('inert', '');

export function Baukasten({
  id,
  name,
  gemeinde,
  einstellungen: e,
  bildUrl,
  darf,
  heute,
  onGespeichert,
}: {
  id: number;
  name: string;
  gemeinde: string | null;
  einstellungen: OeffentlicheEinstellungen;
  bildUrl: string | null;
  darf: boolean;
  heute: string;
  /** Nach jedem Speichern: neu laden und – wenn `umkehrbar` – „Rückgängig“ anbieten. */
  onGespeichert: (text: string, umkehrbar: boolean) => void;
}) {
  const { stand, tun, laeuft } = useSchlange(onGespeichert);
  const [lokalF, setLokalF] = useState<Formular | null>(null);
  const [lokalG, setLokalG] = useState<Gestaltung | null>(null);
  const [nameEntwurf, setNameEntwurf] = useState(name);
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<FeldEntwurf | null>(null);
  const [info, setInfo] = useState<AntwortInfo | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [geraet, setGeraet] = useState<'computer' | 'handy'>('computer');
  const [vorschau, setVorschau] = useState(false);
  const [reiter, setReiter] = useState<'bausteine' | 'design'>('bausteine');
  const [blatt, setBlatt] = useState<'bausteine' | 'design' | null>(null);
  const [bildArbeitet, setBildArbeitet] = useState(false);
  /** Das Feld, das gerade gezogen wird – es wird blass, damit man sieht, was man bewegt. */
  const [ziehtFeld, setZiehtFeld] = useState<string | null>(null);
  const [ziel, setZiel] = useState<Ziel | null>(null);

  const formular = lokalF ?? e.formular;
  const gestaltung = lokalG ?? e.gestaltung;

  // Refs für die Zeitgeber: Sie feuern später und brauchen den Stand von dann, nicht den beim Anlegen.
  const formularRef = useRef(formular);
  formularRef.current = formular;
  const entwurfRef = useRef<FeldEntwurf | null>(null);
  const geaendert = useRef(false);
  const feldUhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const designUhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const designWartet = useRef<Gestaltung | null>(null);
  const gezogen = useRef<Gezogen | null>(null);
  const bildDatei = useRef<HTMLInputElement>(null);
  /** Ein neu eingefügtes Feld nach dem Zeichnen ins Bild holen (beim Antippen liegt es oft außer Sicht). */
  const insBild = useRef<string | null>(null);
  useEffect(() => {
    const feldId = insBild.current;
    if (!feldId) return;
    insBild.current = null;
    document
      .querySelector(`[data-feld="${feldId}"]`)
      ?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  });

  // Das Gemeindelogo aus ChurchTools einmal holen (`undefined` = lädt noch, `null` = keins hinterlegt).
  const [ctLogo, setCtLogo] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let aktuell = true;
    gemeindeLogo().then(
      (url) => aktuell && setCtLogo(url),
      () => aktuell && setCtLogo(null),
    );
    return () => {
      aktuell = false;
    };
  }, []);

  // Neuer gespeicherter Stand: den Zwischenstand verwerfen – aber nur, wenn nichts mehr läuft oder wartet.
  useEffect(() => {
    if (laeuft() || designWartet.current) return;
    setLokalF(null);
    setLokalG(null);
  }, [e, laeuft]);
  useEffect(() => setNameEntwurf(name), [name]);

  /** Das bearbeitete Feld speichern, falls es sich geändert hat und in Ordnung ist. */
  const feldSichern = useCallback(() => {
    if (feldUhr.current) clearTimeout(feldUhr.current);
    feldUhr.current = null;
    const d = entwurfRef.current;
    if (!d || !geaendert.current) return;
    const fehler = entwurfFehler(d);
    if (fehler) {
      setHinweis(`Nicht gespeichert: ${fehler}`);
      return;
    }
    geaendert.current = false;
    const mit = mitAntworten(d.feld);
    const feld: Feld = {
      ...d.feld,
      frage: d.feld.frage.trim(),
      antworten: mit ? d.antworten.map((a) => a.text.trim()) : d.feld.antworten,
    };
    const bereich = bereichVon(formularRef.current, feld.id) ?? 'person';
    setLokalF(ersetzeFeld(formularRef.current, feld));
    setHinweis(null);
    void tun(`„${feld.frage || 'Trennlinie'}“ gespeichert.`, () =>
      feldSpeichern(
        id,
        bereich,
        feld,
        mit ? d.antworten.map((a) => ({ text: a.text.trim(), altId: a.altId })) : undefined,
      ),
    );
  }, [id, tun]);

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

  // Beim Verlassen des Reiters nichts liegen lassen.
  useEffect(
    () => () => {
      feldSichern();
      designSichern();
    },
    [feldSichern, designSichern],
  );

  function neuerEntwurf(f: Feld | null) {
    const d = f ? { feld: f, antworten: f.antworten.map((t) => ({ text: t, von: t })) } : null;
    entwurfRef.current = d;
    geaendert.current = false;
    setEntwurf(d);
  }

  function waehlen(feldId: string | null) {
    if (feldId === aktiv) return;
    feldSichern();
    setAktiv(feldId);
    setInfo(null);
    const f = feldId
      ? [...formularRef.current.anmeldung, ...formularRef.current.person].find(
          (x) => x.id === feldId,
        )
      : undefined;
    neuerEntwurf(f ?? null);
  }

  // Zum gewählten Feld: wie oft beantwortet, und die IDs der Antworten (Umbenennen behält die Wahl).
  const ctId = aktiv ? e.ctFelder[aktiv] : undefined;
  useEffect(() => {
    if (!aktiv || ctId === undefined) return;
    let aktuell = true;
    Promise.all([ctFelderLesen(id), antwortenZaehlen(id)]).then(
      ([felder, zahlen]) => {
        if (!aktuell) return;
        const ct = (felder.get(ctId)?.options ?? []).map((o) => ({
          id: String(o.id),
          text: o.name,
        }));
        const z = zahlen.get(ctId);
        setInfo({
          feldId: aktiv,
          beantwortet: z?.gesamt ?? 0,
          jeAntwort: z?.jeOption ?? new Map<string, number>(),
          ct,
        });
        const d = entwurfRef.current;
        if (d && d.feld.id === aktiv) {
          const zuId = new Map(ct.map((o) => [o.text, o.id]));
          const mitIds = {
            ...d,
            antworten: d.antworten.map((a) =>
              a.altId || a.von === undefined ? a : { ...a, altId: zuId.get(a.von) },
            ),
          };
          entwurfRef.current = mitIds;
          setEntwurf(mitIds);
        }
      },
      () => {},
    );
    return () => {
      aktuell = false;
    };
  }, [id, aktiv, ctId]);

  function aendern(d: FeldEntwurf) {
    entwurfRef.current = d;
    geaendert.current = true;
    setEntwurf(d);
    setHinweis(null);
    if (feldUhr.current) clearTimeout(feldUhr.current);
    feldUhr.current = setTimeout(feldSichern, PAUSE_FELD_MS);
  }

  function gestalten(g: Gestaltung) {
    setLokalG(g);
    designWartet.current = g;
    if (designUhr.current) clearTimeout(designUhr.current);
    designUhr.current = setTimeout(designSichern, PAUSE_DESIGN_MS);
  }

  // Ist „Gemeindelogo“ gewählt und hat sich die Adresse in ChurchTools geändert (oder fehlt sie noch), gleich
  // übernehmen – sonst zeigte das öffentliche Formular ein altes oder keins. Nur, wer bearbeiten darf.
  const logoGeprueft = useRef(false);
  useEffect(() => {
    if (!darf || ctLogo === undefined || logoGeprueft.current) return;
    logoGeprueft.current = true;
    const g = lokalG ?? e.gestaltung;
    if (g.logo === 'ct' && ctLogo && g.logoUrl !== ctLogo) gestalten({ ...g, logoUrl: ctLogo });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur einmal, sobald das Logo bekannt ist
  }, [ctLogo, darf]);

  /** Einen Baustein ins Formular setzen – vor `vorId` in `bereich`, sonst unter das gewählte Feld. */
  function einfuegen(b: NeuerBaustein, wohin?: { bereich: Bereich; vorId: string | null }) {
    feldSichern();
    const fo = formularRef.current;
    const da = aktiv ? bereichVon(fo, aktiv) : null;
    const bereich = wohin?.bereich ?? da ?? b.bereich;
    const vorId = wohin ? wohin.vorId : aktiv && da ? naechsteId(fo, aktiv) : null;
    // Die Kennung erst jetzt vergeben: Zwei Bausteine kurz nacheinander dürfen sich nicht in die Quere kommen.
    const feld = b.feld.art === 'eigen' ? { ...b.feld, id: neueFeldKennung(fo) } : b.feld;
    const neu = einordnen(ersetzeFeld(fo, feld), feld.id, bereich, vorId, feld);
    setLokalF(neu);
    setAktiv(feld.id);
    setInfo(null);
    neuerEntwurf(feld);
    insBild.current = feld.id;
    void tun(`„${b.name}“ hinzugefügt.`, () => feldSpeichern(id, bereich, feld, undefined, vorId));
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
    setLokalF(ersetzeFeld(formularRef.current, feld));
    neuerEntwurf(feld);
    setInfo(null);
    void tun(`Fragetyp von „${feld.frage}“ geändert.`, () => feldTypAendern(id, feld));
  }

  function verschieben(feldId: string, bereich: Bereich, vorId: string | null) {
    if (vorId === feldId) return;
    feldSichern();
    const fo = formularRef.current;
    const neu = einordnen(fo, feldId, bereich, vorId);
    if (JSON.stringify(neu) === JSON.stringify(fo)) return;
    setLokalF(neu);
    void tun('Verschoben.', () => feldEinordnen(id, feldId, bereich, vorId));
  }

  function entfernen(f: Feld) {
    if (aktiv === f.id) {
      geaendert.current = false;
      if (feldUhr.current) clearTimeout(feldUhr.current);
      setAktiv(null);
      neuerEntwurf(null);
    } else feldSichern();
    const fo = formularRef.current;
    setLokalF(
      f.art === 'eigen'
        ? {
            anmeldung: fo.anmeldung.filter((x) => x.id !== f.id),
            person: fo.person.filter((x) => x.id !== f.id),
          }
        : ersetzeFeld(fo, { ...f, zustand: 'aus' }),
    );
    void tun(
      (ergebnis) => {
        const r = ergebnis as Awaited<ReturnType<typeof feldEntfernen>>;
        if (r.art === 'geloescht') return `„${f.frage || 'Trennlinie'}“ entfernt.`;
        if (r.antworten === 0) return `„${f.frage}“ ausgeschaltet.`;
        return `„${f.frage}“ ausgeblendet – ${r.antworten === 1 ? 'die Antwort bleibt' : `die ${r.antworten} Antworten bleiben`} in ChurchTools.`;
      },
      () => feldEntfernen(id, f.id),
    );
  }

  function kopieren(f: Feld) {
    feldSichern();
    const fo = formularRef.current;
    const quelle = entwurfRef.current?.feld.id === f.id ? entwurfRef.current.feld : f;
    const kopie: Feld = {
      ...quelle,
      id: neueFeldKennung(fo),
      art: 'eigen',
      frage: quelle.frage ? `${quelle.frage} (Kopie)` : '',
    };
    delete kopie.verborgen;
    einfuegen(
      { name: kopie.frage || 'Trennlinie', feld: kopie, bereich: bereichVon(fo, f.id) ?? 'person' },
      { bereich: bereichVon(fo, f.id) ?? 'person', vorId: naechsteId(fo, f.id) },
    );
  }

  /** Die sichtbaren Felder eines Bereichs – so, wie das Formular sie zeigt. */
  const sichtbareListe = (bereich: Bereich) => formular[bereich].filter(sichtbar);
  /** Die Felder, zwischen die abgelegt werden kann (ohne Preis und Datenschutz am Ende). */
  const ablageListe = (bereich: Bereich) => sichtbareListe(bereich).filter((x) => !amEnde(x));

  function hochRunter(f: Feld, bereich: Bereich, um: -1 | 1) {
    const liste = sichtbareListe(bereich).filter(verschiebbar);
    const i = liste.findIndex((x) => x.id === f.id);
    if (um === -1 && i > 0) verschieben(f.id, bereich, liste[i - 1].id);
    if (um === 1 && i >= 0 && i < liste.length - 1)
      verschieben(f.id, bereich, liste[i + 2]?.id ?? null);
  }

  // ── Ziehen und Ablegen: Wo der Mauszeiger ist, öffnet sich eine Lücke (wie bei Campflow) ──
  //
  // Die Stelle wird an den Plätzen ausgerechnet, die die Felder beim START des Ziehens hatten – nicht an den
  // Feldern, wie sie gerade stehen. Sonst verschiebt die Lücke die Felder, die neue Rechnung sieht eine andere
  // Stelle, die Lücke springt dorthin … (Alwin, 13.10.2026: „Lücke springt“). So macht es auch SortableJS.
  const plaetze = useRef<Platz[]>([]);
  const buehneRef = useRef<HTMLDivElement>(null);

  function plaetzeMerken() {
    const b = buehneRef.current;
    if (!b) return;
    const oben = b.getBoundingClientRect().top;
    lagen.current = new Map(
      [...b.querySelectorAll<HTMLElement>('[data-feld]')].map((el) => [
        el.dataset.feld!,
        el.getBoundingClientRect().top - oben,
      ]),
    );
    plaetze.current = [...b.querySelectorAll<HTMLElement>('[data-feld][data-bereich]')]
      .filter((el) => el.dataset.ende === undefined)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.dataset.feld!,
          bereich: el.dataset.bereich as Bereich,
          oben: r.top - oben,
          unten: r.bottom - oben,
        };
      });
  }

  /** Die Stelle für eine Höhe `y` (relativ zur Bühne): vor dem ersten Feld, dessen Mitte darunter liegt. */
  function zielAus(y: number): Ziel | null {
    const liste = plaetze.current;
    for (let i = 0; i < liste.length; i++) {
      const p = liste[i];
      if (y >= (p.oben + p.unten) / 2) continue;
      // Zwischen zwei Bereichen entscheidet, welchem der Mauszeiger näher ist.
      const davor = liste[i - 1];
      if (davor && davor.bereich !== p.bereich && y < (davor.unten + p.oben) / 2)
        return { bereich: davor.bereich, vorId: null };
      return { bereich: p.bereich, vorId: p.id };
    }
    const letzte = liste.at(-1);
    return letzte ? { bereich: letzte.bereich, vorId: null } : null;
  }

  function ablegen(z: Ziel | null) {
    const g = gezogen.current;
    gezogen.current = null;
    setZiehtFeld(null);
    setZiel(null);
    if (!g || !z) return;
    // „Ganz unten“ heißt beim Ziehen wirklich ganz unten – auch unter den Bemerkungen, aber vor Preis und
    // Datenschutz (`einordnen` setzt nichts dahinter). Ohne Angabe käme es VOR die Bemerkungen (Antippen).
    const vorId = z.vorId ?? formularRef.current[z.bereich].find(amEnde)?.id ?? null;
    const wohin = { bereich: z.bereich, vorId };
    if (g.art === 'neu') einfuegen(g.b, wohin);
    else verschieben(g.id, z.bereich, vorId);
  }

  // ── Gleiten statt Springen (Alwin: „manchmal ruckelt es noch kräftig“) ──
  // Wandert die Lücke, gleiten die Felder von ihrem alten zu ihrem neuen Platz (FLIP über die Web Animations
  // API), statt schlagartig zu springen. Die Rechnung oben benutzt weiter die Plätze vom Start.
  const lagen = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const b = buehneRef.current;
    if (!b || !gezogen.current) return;
    const oben = b.getBoundingClientRect().top;
    const neu = new Map<string, number>();
    for (const el of b.querySelectorAll<HTMLElement>('[data-feld]')) {
      const id = el.dataset.feld!;
      const jetzt = el.getBoundingClientRect().top - oben;
      neu.set(id, jetzt);
      const vorher = lagen.current.get(id);
      if (vorher !== undefined && Math.abs(vorher - jetzt) > 1)
        el.animate?.([{ transform: `translateY(${vorher - jetzt}px)` }, { transform: 'none' }], {
          duration: GLEITEN_MS,
          easing: 'ease-out',
        });
    }
    lagen.current = neu;
  }, [ziel]);

  // Gleichmäßig mitscrollen, solange der Mauszeiger am Rand ist – je näher am Rand, desto schneller. Vorher
  // gab es je Mausereignis einen festen Schritt, das ruckelte.
  const scrollen = useRef<{ el: HTMLElement; tempo: number; laeuft: boolean }>({
    el: document.documentElement,
    tempo: 0,
    laeuft: false,
  });
  function scrollSchritt() {
    const s = scrollen.current;
    if (!gezogen.current || s.tempo === 0) {
      s.laeuft = false;
      return;
    }
    // `?.`: Nicht jede Umgebung kennt `scrollBy` an Elementen (jsdom) – dann eben ohne Mitscrollen.
    s.el.scrollBy?.(0, s.tempo);
    requestAnimationFrame(scrollSchritt);
  }

  function ueberBuehne(ev: React.DragEvent<HTMLDivElement>) {
    if (!gezogen.current) return;
    ev.preventDefault();
    // Am Rand mitscrollen – in ChurchTools scrollt der Rahmen, nicht das Fenster.
    const sc = scrollEltern(ev.currentTarget);
    const r =
      sc === document.scrollingElement
        ? { top: 0, bottom: window.innerHeight }
        : sc.getBoundingClientRect();
    const vonOben = ev.clientY - r.top;
    const vonUnten = r.bottom - ev.clientY;
    const tempo =
      vonOben < RAND_SCROLL
        ? -Math.ceil(((RAND_SCROLL - vonOben) / RAND_SCROLL) * TEMPO_SCROLL)
        : vonUnten < RAND_SCROLL
          ? Math.ceil(((RAND_SCROLL - vonUnten) / RAND_SCROLL) * TEMPO_SCROLL)
          : 0;
    const s = scrollen.current;
    s.el = sc;
    s.tempo = tempo;
    if (tempo !== 0 && !s.laeuft) {
      s.laeuft = true;
      s.el.scrollBy?.(0, tempo);
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(scrollSchritt);
    }
    const z = zielAus(ev.clientY - ev.currentTarget.getBoundingClientRect().top);
    if (z) zielSetzen(z);
  }

  function zielSetzen(z: Ziel) {
    setZiel((alt) => (alt && alt.bereich === z.bereich && alt.vorId === z.vorId ? alt : z));
  }

  /** Die Lücke selbst – nur zu sehen; abgelegt wird über die Bühne (`ueberBuehne`, `onDrop`). */
  const luecke = () => (
    <div key="luecke" className={k.luecke}>
      Hier loslassen
    </div>
  );

  const ziehenBeginnen = (g: Gezogen) => {
    gezogen.current = g;
    plaetzeMerken();
    setZiehtFeld(g.art === 'feld' ? g.id : null);
  };
  const ziehenEnde = () => {
    scrollen.current.tempo = 0;
    gezogen.current = null;
    setZiehtFeld(null);
    setZiel(null);
  };

  // ── Speichern von Name und Titelbild ──
  function nameSichern() {
    const neu = nameEntwurf.trim();
    if (!neu || neu === name) {
      setNameEntwurf(name);
      return;
    }
    void tun(`Umbenannt in „${neu}“.`, () => umbenennen(id, neu));
  }

  async function bild(tunBild: () => Promise<unknown>, text: string) {
    setBildArbeitet(true);
    // Ein Bild lässt sich nicht über „Rückgängig“ zurückholen – ChurchTools hebt das alte nicht auf.
    // Fehler zeigt die Schlange (oben, mit „Nochmal“).
    await tun(text, tunBild, false);
    setBildArbeitet(false);
  }
  const bildWaehlen = (d: File) => void bild(() => bildHochladen(id, d), 'Titelbild hochgeladen.');
  const bildWeg = () => void bild(() => bildEntfernen(id), 'Titelbild entfernt.');

  // ── Die Hülle um jedes Feld ──
  function huelle(f: Feld, bereich: Bereich, inhalt: ReactNode): ReactNode {
    const beweglich = verschiebbar(f);
    const istAktiv = aktiv === f.id && entwurf?.feld.id === f.id;
    // Name, E-Mail, Datenschutz: verschiebbar (außer Datenschutz), aber nicht zu bearbeiten oder zu entfernen.
    const fest = f.art === 'fest' || f.art === 'preis';
    const liste = sichtbareListe(bereich).filter(verschiebbar);
    const i = liste.findIndex((x) => x.id === f.id);
    const hierLuecke = !!ziel && ziel.bereich === bereich;
    const lueckeDavor = hierLuecke && ziel.vorId === f.id;
    const lueckeDanach =
      hierLuecke && ziel.vorId === null && ablageListe(bereich).at(-1)?.id === f.id;
    const entfernt = info && info.feldId === f.id ? info : null;
    const entferntGewaehlt =
      entfernt && entwurf
        ? entfernt.ct
            .filter(
              (o) =>
                !entwurf.antworten.some((a) => a.altId === o.id) &&
                (entfernt.jeAntwort.get(o.id) ?? 0) > 0,
            )
            .map((o) => o.text)
        : [];
    const werkzeug = (
      <>
        {beweglich && (
          <>
            <button
              type="button"
              aria-label={`${f.frage || 'Trennlinie'} nach oben`}
              disabled={i <= 0}
              onClick={(ev) => {
                ev.stopPropagation();
                hochRunter(f, bereich, -1);
              }}
            >
              <Icon name="chev-down" size={16} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <button
              type="button"
              aria-label={`${f.frage || 'Trennlinie'} nach unten`}
              disabled={i < 0 || i >= liste.length - 1}
              onClick={(ev) => {
                ev.stopPropagation();
                hochRunter(f, bereich, 1);
              }}
            >
              <Icon name="chev-down" size={16} />
            </button>
          </>
        )}
        {f.art === 'eigen' && (
          <button
            type="button"
            aria-label={`${f.frage || 'Trennlinie'} kopieren`}
            title="Kopieren"
            onClick={(ev) => {
              ev.stopPropagation();
              kopieren(f);
            }}
          >
            <BausteinSymbol name="kopie" size={16} />
          </button>
        )}
        {!fest && (
          <button
            type="button"
            aria-label={`${f.frage || 'Trennlinie'} entfernen`}
            title={f.art === 'eigen' ? 'Entfernen' : 'Ausschalten'}
            onClick={(ev) => {
              ev.stopPropagation();
              entfernen(f);
            }}
          >
            <Icon name="trash" size={16} />
          </button>
        )}
      </>
    );
    // Das ganze Feld lässt sich greifen, nicht nur der kleine Griff (Alwin: „hakelig“) – außer beim Bearbeiten,
    // sonst ließe sich im Text nichts markieren.
    const ziehbar = beweglich && !istAktiv;
    return [
      lueckeDavor && luecke(),
      <div
        key="feld"
        className={`${k.huelle} ${istAktiv ? k.aktiv : ''} ${fest ? k.fest : ''} ${ziehbar ? k.ziehbar : ''} ${ziehtFeld === f.id ? k.wirdGezogen : ''}`}
        data-feld={f.id}
        data-bereich={bereich}
        data-ende={amEnde(f) ? '' : undefined}
        draggable={ziehbar}
        onClick={(ev) => {
          ev.stopPropagation();
          if (!fest) waehlen(f.id);
        }}
        onDragStart={(ev) => {
          if (!ziehbar) return;
          ev.stopPropagation();
          ev.dataTransfer.effectAllowed = 'move';
          ev.dataTransfer.setData('text/plain', f.id);
          ev.dataTransfer.setDragImage(ev.currentTarget, 24, 24);
          // Das Feld wird nur blass, es klappt NICHT weg: Chrome bricht das Ziehen sofort ab, sobald das gezogene
          // Element ausgeblendet wird (13.10.2026 – „Ziehen geht jetzt gar nicht mehr“, mit echter Maus
          // nachgestellt: dragstart, sofort dragend). In jsdom nicht prüfbar.
          ziehenBeginnen({ art: 'feld', id: f.id });
        }}
        onDragEnd={ziehenEnde}
      >
        {beweglich && (
          <span className={k.griff} aria-hidden="true">
            <Icon name="grip" size={16} />
          </span>
        )}
        {fest && !beweglich && <span className={k.festSchild}>gehört immer dazu</span>}
        {(beweglich || !fest) && !istAktiv && <div className={k.werkzeug}>{werkzeug}</div>}
        {istAktiv && entwurf ? (
          <FeldBearbeiten
            entwurf={entwurf}
            onAendern={aendern}
            beantwortet={entfernt ? entfernt.beantwortet : null}
            entferntGewaehlt={entferntGewaehlt}
            altersPreise={e.preis.alter.length > 0}
            werkzeug={werkzeug}
            onTyp={typAendern}
          />
        ) : (
          <div ref={inert} className={k.inhalt}>
            {inhalt}
          </div>
        )}
      </div>,
      lueckeDanach && luecke(),
    ];
  }

  // Das bearbeitete Feld so zeigen, wie es gerade im Baukasten steht (für die Vorschau).
  const anzeigeFormular = entwurf
    ? ersetzeFeld(formular, {
        ...entwurf.feld,
        antworten: mitAntworten(entwurf.feld)
          ? entwurf.antworten.map((a) => a.text)
          : entwurf.feld.antworten,
      })
    : formular;
  const ansicht = {
    name: nameEntwurf || name,
    gemeinde,
    einstellungen: { ...e, formular: anzeigeFormular, gestaltung },
    bildUrl,
  };

  const haken: BaukastenHaken = {
    feld: huelle,
    // Ein mehrzeiliges Feld, damit lange Namen umbrechen wie im Formular (am Handy wurde „TEST A5 Bauka…“
    // abgeschnitten); Enter speichert statt einer neuen Zeile.
    titel: (
      <textarea
        ref={hoeheAnpassen}
        className={k.titel}
        value={nameEntwurf}
        maxLength={100}
        rows={1}
        aria-label="Name der Veranstaltung"
        onChange={(ev) => {
          setNameEntwurf(ev.target.value.replace(/\n/g, ' '));
          hoeheAnpassen(ev.target);
        }}
        onBlur={nameSichern}
        onKeyDown={(ev) => {
          if (ev.key !== 'Enter') return;
          ev.preventDefault();
          ev.currentTarget.blur();
        }}
      />
    ),
    einleitung: (
      <textarea
        className={k.einleitung}
        value={gestaltung.text}
        maxLength={1200}
        rows={Math.max(2, gestaltung.text.split('\n').length)}
        placeholder="+ Begrüßungstext hinzufügen"
        aria-label="Begrüßungstext"
        onChange={(ev) => gestalten({ ...gestaltung, text: ev.target.value })}
        onBlur={designSichern}
      />
    ),
    // Das Titelbild gibt es nur hier, direkt im Bild (Alwin: „Titelbild ändern gibt es zweimal“).
    bild: (
      <div className={k.bildKnoepfe}>
        <button
          type="button"
          className={k.bildKnopf}
          disabled={bildArbeitet}
          onClick={() => bildDatei.current?.click()}
        >
          <BausteinSymbol name="bild" size={16} />
          {bildArbeitet
            ? 'Wird hochgeladen …'
            : bildUrl
              ? 'Titelbild ändern'
              : 'Titelbild hochladen'}
        </button>
        {bildUrl && !bildArbeitet && (
          <button
            type="button"
            className={k.bildKnopf}
            aria-label="Titelbild entfernen"
            title="Titelbild entfernen – dann gilt das Bild der Vorlage"
            onClick={bildWeg}
          >
            <Icon name="trash" size={16} />
          </button>
        )}
      </div>
    ),
  };

  const ausgeblendet = [...formular.anmeldung, ...formular.person].filter(
    (f) => f.art === 'eigen' && f.zustand === 'aus',
  );

  const tafelBausteine = (
    <BausteineTafel
      formular={formular}
      wer={e.wer}
      onNeu={(b) => {
        setBlatt(null);
        einfuegen(b);
      }}
      onZiehen={(b) => ziehenBeginnen({ art: 'neu', b })}
      ausgeblendet={ausgeblendet}
      onWiederZeigen={(f) => {
        const b = bereichVon(formular, f.id) ?? 'person';
        einfuegen({ name: f.frage, feld: { ...f, zustand: 'freiwillig' }, bereich: b });
      }}
      platz={platzBelegt({ ...e, formular, gestaltung })}
    />
  );
  const tafelDesign = (
    <DesignTafel gestaltung={gestaltung} onGestaltung={gestalten} ctLogo={ctLogo} />
  );

  const wartet = stand.art === 'arbeitet' || !!designWartet.current || geaendert.current;
  const status =
    stand.art === 'fehler' ? (
      <span className={k.statusFehler} role="alert">
        {stand.text}{' '}
        <button type="button" onClick={stand.nochmal}>
          Nochmal
        </button>
      </span>
    ) : hinweis ? (
      <span className={k.statusFehler} role="alert">
        {hinweis}
      </span>
    ) : (
      <span className={k.status} aria-live="polite">
        {wartet ? 'Wird gespeichert …' : 'Änderungen werden von selbst gespeichert'}
      </span>
    );

  const zeigeVorschau = vorschau || !darf;

  return (
    <div className={k.baukasten} onDragEnd={ziehenEnde}>
      <div className={k.kopfleiste}>
        {darf ? (
          status
        ) : (
          <span className={k.status}>Nur die Leitung kann das Formular ändern.</span>
        )}
        <div className={k.rechts}>
          <Segment
            ariaLabel="Größe der Ansicht"
            value={geraet}
            onChange={setGeraet}
            options={[
              { value: 'computer', label: 'Computer' },
              { value: 'handy', label: 'Handy' },
            ]}
          />
          {darf && (
            <button
              type="button"
              className={k.schalterZeile}
              aria-pressed={vorschau}
              onClick={() => {
                feldSichern();
                setAktiv(null);
                neuerEntwurf(null);
                setVorschau(!vorschau);
              }}
            >
              Vorschau
              <span className={`${k.miniSchalter} ${vorschau ? k.an : ''}`} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className={`${k.flaeche} ${zeigeVorschau ? k.ohneLeiste : ''}`}>
        <div
          ref={buehneRef}
          className={`${k.buehne} ${geraet === 'handy' ? k.handy : ''}`}
          onClick={() => !zeigeVorschau && waehlen(null)}
          // Schon beim Hineinziehen „hier darf abgelegt werden“ melden – sonst legt der Browser nicht ab, wenn
          // zwischen Hineinziehen und Loslassen kein `dragover` kam (gefunden beim Durchklicken 13.10.2026).
          onDragEnter={ueberBuehne}
          onDragOver={ueberBuehne}
          onDrop={(ev) => {
            if (!gezogen.current) return;
            ev.preventDefault();
            // Dort, wo die Lücke zu sehen ist; ohne Lücke (kein `dragover` vorher) aus dem Ereignis selbst.
            ablegen(ziel ?? zielAus(ev.clientY - ev.currentTarget.getBoundingClientRect().top));
          }}
        >
          {zeigeVorschau ? (
            <AnmeldeFormular
              key={`vorschau-${gestaltung.vorlage}`}
              ansicht={ansicht}
              heute={heute}
              vorschau
              start={musterAntworten(e, heute)}
            />
          ) : (
            <AnmeldeFormular
              ansicht={ansicht}
              heute={heute}
              vorschau
              start={musterAntworten(e, heute)}
              baukasten={haken}
            />
          )}
        </div>

        {!zeigeVorschau && (
          <aside className={k.leiste} aria-label="Bausteine und Design">
            <Segment
              ariaLabel="Leiste"
              value={reiter}
              onChange={setReiter}
              options={[
                { value: 'bausteine', label: 'Bausteine' },
                { value: 'design', label: 'Design' },
              ]}
            />
            {reiter === 'bausteine' ? tafelBausteine : tafelDesign}
          </aside>
        )}
      </div>

      {!zeigeVorschau && (
        <div className={k.mobil}>
          <button type="button" onClick={() => setBlatt('bausteine')}>
            <Icon name="plus" size={18} /> Baustein
          </button>
          <button type="button" onClick={() => setBlatt('design')}>
            Design
          </button>
        </div>
      )}
      {blatt && (
        <Sheet
          title={blatt === 'bausteine' ? 'Baustein hinzufügen' : 'Design'}
          onClose={() => setBlatt(null)}
          cancelLabel="Fertig"
        >
          {blatt === 'bausteine' ? tafelBausteine : tafelDesign}
        </Sheet>
      )}

      <input
        ref={bildDatei}
        type="file"
        accept="image/*"
        hidden
        aria-label="Titelbild hochladen"
        onChange={(ev) => {
          const d = ev.target.files?.[0];
          ev.target.value = '';
          if (d) bildWaehlen(d);
        }}
      />
    </div>
  );
}
