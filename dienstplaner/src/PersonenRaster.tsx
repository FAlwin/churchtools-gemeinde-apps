import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { modusWort } from '@shared/dienstplan/modusVorgabe';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { tagKurz } from '@shared/ct/datum';
import type { PlanZeile } from '@shared/dienstplan/plan';
import type { Besetzung } from '@shared/dienstplan/entwuerfe';
import { gruppenDerDienste } from '@shared/dienstplan/personenDaten';
import { antwortText, zahlenText } from '@shared/dienstplan/personenAntworten';
import {
  eintragenWarnung,
  platzDazuText,
  vollText,
  type EintragenWarnung,
  type ZellenAktion,
} from '@shared/dienstplan/personenEintragen';
import {
  offenText,
  personenRaster,
  plaetzeZelleText,
  rasterDienste,
  type RasterBlock,
  type RasterGast,
  type RasterZeile,
  type RasterZelle,
} from '@shared/dienstplan/personenRaster';
import { GastFenster } from './GastFenster';
import type { PersonenLader } from './ladePersonen';
import type { AntwortenLader } from './ladeAntworten';
import { VorgabeKnopf, ZauberKnopf } from './PlanAnsicht';
import { ANZAHL_FARBEN } from './personenFarben';
import { sperreText } from './plaetzeTexte';
import { blockSchluessel, type Sicht } from './planSicht';
import { useBisUnten } from './useBisUnten';
import { usePersonenDaten } from './usePersonenDaten';
import { usePersonenAntworten } from './usePersonenAntworten';
import planen from './Planen.module.scss';
import styles from './PersonenRaster.module.scss';

/** Die Klasse der Dienstfarbe (`.farbe0 …`) – die Zuordnung Dienst → Farbe kommt von außen (`personenFarben.ts`). */
const farbKlasse = (farbe: number) => styles[`farbe${farbe % ANZAHL_FARBEN}`];

/** Der Zustand in Worten (Tooltip, Vorleser) – bei einem Entwurf mit der Art: „Entwurf, Anfrage“ / „Entwurf, direkt“. */
const zustandText = (zustand: NonNullable<RasterZelle['zustand']>, modus: RasterZelle['modus']) =>
  zustand === 'entwurf'
    ? `Entwurf, ${modusWort(modus ?? 'anfrage')}`
    : zustand === 'zurueck'
      ? 'wird zurückgezogen'
      : zustand;

/**
 * Der Dienst als ChurchTools-Tag; das Symbol sagt den Zustand: Haken = zugesagt, Kreis mit ? = angefragt. Ein **Entwurf**
 * (blau) zeigt seine Art am Rahmen: gestrichelt mit „?“ = Anfrage, durchgezogen mit Haken = direkt (beide im gefüllten Kreis).
 * Wird die Einteilung von einem Entwurf **weggenommen** (`zurueck`, P2b), steht sie wie in der Matrix rot gestrichelt da,
 * mit „−“ und durchgestrichenem Namen.
 */
function DienstTag({
  name,
  farbe,
  zustand,
  modus = null,
}: {
  name: string;
  farbe: number;
  zustand?: RasterZelle['zustand'];
  modus?: RasterZelle['modus'];
}) {
  const direkt = zustand === 'entwurf' && modus === 'direkt';
  return (
    <span
      className={`${styles.tag} ${farbKlasse(farbe)}${zustand === 'entwurf' ? ' ' + styles.entwurf : ''}${direkt ? ' ' + styles.entwurfDirekt : ''}${zustand === 'zurueck' ? ' ' + styles.zurueck : ''}`}
      role={zustand ? 'img' : undefined}
      aria-label={zustand ? `${name}, ${zustandText(zustand, modus)}` : undefined}
      title={zustand ? `${name} – ${zustandText(zustand, modus)}` : undefined}
    >
      {zustand === 'zugesagt' && <Icon name="check" size={14} stroke={2.4} />}
      {(zustand === 'angefragt' || (zustand === 'entwurf' && !direkt)) && (
        <span className={styles.frage} aria-hidden="true">
          ?
        </span>
      )}
      {zustand === 'zurueck' && (
        <span className={styles.minus} aria-hidden="true">
          −
        </span>
      )}
      {direkt && (
        <span className={styles.haken} aria-hidden="true">
          <Icon name="check" size={9} stroke={3.4} />
        </span>
      )}
      <span className={styles.tagText}>{name}</span>
    </span>
  );
}

/**
 * Ein Gast in der Gäste-Zeile: das Entwurfs-Tag (blau, Stift) oder – wenn ein Entwurf ihn wegnimmt – rot gestrichelt wie
 * die Einteilung einer Person. Mit `onKlick` ein Knopf (P2b).
 */
function GastTag({ g, onKlick }: { g: RasterGast; onKlick?: () => void }) {
  const titel = g.zurueck
    ? `${g.name} (Gast) – wird zurückgezogen`
    : g.entwurf
      ? `${g.name} (Gast) – Entwurf`
      : `${g.name} (Gast)`;
  const Tag = onKlick ? 'button' : 'span';
  return (
    <Tag
      {...(onKlick
        ? { type: 'button' as const, onClick: onKlick, 'aria-label': `${titel}, öffnen` }
        : {})}
      className={`${styles.tag} ${styles.gastTag}${g.entwurf ? ` ${styles.entwurf} ${styles.entwurfDirekt}` : ''}${g.zurueck ? ' ' + styles.zurueck : ''}${onKlick ? ' ' + styles.tagKnopf : ''}`}
      title={titel}
    >
      {g.entwurf && <Icon name="pencil" size={14} stroke={2.4} />}
      {g.zurueck && (
        <span className={styles.minus} aria-hidden="true">
          −
        </span>
      )}
      <span className={styles.tagText}>{g.name}</span>
    </Tag>
  );
}

/**
 * Die Legende über dem Raster (E5c-3): was die Farbe einer Zelle heißt. Farbe allein trägt die Bedeutung nicht – darum
 * steht sie hier, und jede Zelle mit Antwort sagt sie auch im Tooltip.
 */
function Legende() {
  return (
    <div className={styles.legende} role="group" aria-label="Legende zu den Farben">
      <span className={styles.legendeTitel}>Antwort der Person:</span>
      <span className={styles.legendeEintrag}>
        <span className={`${styles.muster} ${styles.musterJa}`} aria-hidden="true" />
        Ja
      </span>
      <span className={styles.legendeEintrag}>
        <span className={`${styles.muster} ${styles.musterVielleicht}`} aria-hidden="true" />
        Vielleicht
      </span>
      <span className={styles.legendeEintrag}>
        <span className={`${styles.muster} ${styles.musterKeine}`} aria-hidden="true" />
        keine Antwort
      </span>
      <span className={styles.legendeEintrag}>
        <span className={`${styles.muster} ${styles.musterNein}`} aria-hidden="true" />
        Nein oder abwesend
      </span>
      <span className={styles.legendeEintrag}>
        <span className={`${styles.muster} ${styles.musterEntwurf}`} aria-hidden="true" />
        Entwurf
      </span>
    </div>
  );
}

function Zelle({ z, dienst, farbe }: { z: RasterZelle; dienst: string; farbe: number }) {
  // Abwesend UND eingeteilt (Warnfall, P2m): nur das durchgestrichene Symbol – davor, ohne Text; der Grund steht im
  // Tooltip und Namen (und im Warnfenster). Sonst Symbol und Grund als Text.
  const abwesend = z.abwesend && (
    <span
      className={styles.abwesend}
      role="img"
      aria-label={`Abwesend: ${z.abwesend.grund}${z.warnung ? ' – trotzdem eingeteilt' : ''}`}
      title={z.warnung ? `${z.abwesend.grund} – trotzdem eingeteilt` : z.abwesend.grund}
    >
      <Icon name="user-slash" size={14} />
      {!z.warnung && <span className={styles.tagText}>{z.abwesend.grund}</span>}
    </span>
  );
  return (
    <>
      {z.warnung && abwesend}
      {z.zustand && <DienstTag name={dienst} farbe={farbe} zustand={z.zustand} modus={z.modus} />}
      {!z.warnung && abwesend}
      {z.weitere.map((w) => (
        <span
          key={w.dienst}
          className={`${styles.dazu}${w.fremd ? ' ' + styles.fremd : ''}`}
          title={
            w.fremd
              ? w.gruppe
                ? `${w.dienst} gehört zu „${w.gruppe}“ (ausgeblendet)`
                : `${w.dienst} (ausgeblendet)`
              : undefined
          }
        >
          + {w.dienst}
          {w.fremd && w.gruppe ? ` (${w.gruppe})` : ''}
        </span>
      ))}
    </>
  );
}

/**
 * **Die Ansicht „Personen“** (Wunsch 5, Scheibe P1 – nur ansehen): Zeilen = Personen, Spalten = die Termine der Matrix
 * (gleicher Zeitraum, gleiche Filter), Blöcke je Dienst. Gerechnet wird in `shared/dienstplan/personenRaster.ts`, geladen
 * (Mitglieder, Abwesenheiten) in `ladePersonen.ts`; hier steht nur die Darstellung.
 *
 * **Eintragen per Klick (P2a):** Eine leere Zelle, in der man den Dienst planen darf, legt mit einem Klick einen Entwurf auf
 * einen freien Platz an (`sicht.personen`, dieselbe Funktion wie „Wer kann?“); ein Klick auf den eigenen Entwurf
 * schaltet ihn weiter (P2m, unten). Ein Fenster kommt nur bei einer Warnung (am Tag schon in einem anderen Dienst, abwesend) oder wenn der
 * Dienst voll ist.
 *
 * **Bestehende Einteilung anklicken (P2b):** zugesagt, angefragt oder ein Gast öffnet **dasselbe Fenster wie das Antippen
 * eines belegten Platzes in der Matrix** („zurückziehen“, „Andere Person wählen“); eine Einteilung, die ein Entwurf
 * wegnimmt, steht rot gestrichelt und durchgestrichen da, ihr Klick öffnet das Entwurfs-Fenster. Rechte und Regeln
 * wie in der Matrix (`useEinteilen`, `personenErlaubt`); der Klick auf den Namen setzt weiter den Fokus.
 *
 * **Klick-Zyklus (P2m):** leere Zelle → Entwurf (womit er beginnt, sagt die Vorgabe des Dienstes: Anfrage „?“ oder direkt),
 * ein zweiter Klick stellt eine Anfrage auf „direkt“ um (Haken, kräftiger), der nächste nimmt den Entwurf weg. Das
 * Warnfenster kommt nur beim ersten Klick. **Abwesend** ist die Zelle schraffiert, der Grund steht als Text; abwesend UND
 * eingeteilt: rote Schraffur und roter Rahmen um die Zelle.
 */
export function PersonenRaster({
  sicht,
  lader,
  antwortenLader,
  farbe,
}: {
  sicht: Sicht;
  /** Lädt Mitglieder und Abwesenheiten – ohne bleibt es bei den Eingeteilten. */
  lader?: PersonenLader;
  /** Lädt die Antworten aus „Wann kann ich?“ (E5c-3) – ohne gibt es keine Farbe aus Antworten. */
  antwortenLader?: AntwortenLader;
  /** Die Farbe eines Dienstes (`personenFarben.ts`). */
  farbe: (dienstId: number) => number;
}) {
  const { plan, spalten, gruppen, zugeklappt, onUmschalten } = sicht;
  const bisUnten = useBisUnten();
  // Hervorheben mit der Maus über dem Namen (nur echte Maus – am Handy erzeugt Antippen sonst Eintreten UND Klick):
  // schwach, nur solange man darüber ist. Das **Festhalten** ist seit Wunsch 11 der Fokus-Modus (`sicht.fokusId`):
  // Antippen des Namens nimmt die Person in den Fokus – kräftig gelb, in allen ihren Zeilen, über die Ansichten hinweg.
  const [ueber, setUeber] = useState<number | null>(null);
  const hervor = ueber;
  const fokusId = sicht.fokusId ?? null;

  // Geladen wird für die Gruppen der gezeigten Dienste, über den ganzen geladenen Zeitraum der Matrix – Blättern im
  // Fenster lädt also nichts neu.
  const gruppenIds = gruppenDerDienste(
    rasterDienste(plan, spalten, gruppen).map((x) => x.zeile.dienst),
  );
  const zeitraum = plan.spalten.length
    ? { von: plan.spalten[0].tag, bis: plan.spalten[plan.spalten.length - 1].tag }
    : null;
  const { daten, laedt, fehler, neuFehler, neuLaden, nochmal, ladend } = usePersonenDaten(
    lader,
    gruppenIds,
    zeitraum,
  );

  // Die Antworten aus „Wann kann ich?“ (E5c-3): je Dienstgruppe der gezeigten Dienste (nicht je Zeitraum – sie gelten je Termin).
  const antwortGruppen = [
    ...new Set(
      rasterDienste(plan, spalten, gruppen).flatMap((x) =>
        x.zeile.dienst.dienstgruppeId === null ? [] : [x.zeile.dienst.dienstgruppeId],
      ),
    ),
  ];
  const antw = usePersonenAntworten(antwortenLader, antwortGruppen);

  // Das Fenster zu einem Klick: Warnung (mit „Trotzdem eintragen“) oder „Dienst voll“.
  const [fenster, setFenster] = useState<
    | { art: 'warnung'; titel: string; warnung: EintragenWarnung; ok: () => void }
    | {
        art: 'voll';
        dienst: string;
        tag: string;
        /** Die Plätze des Dienstes – alle belegt oder von einem Entwurf gehalten. */
        von: number;
        /** Entwürfe an diesem Dienst und Termin – bei mehr als 0 gibt es kein „Platz dazunehmen“ (Sperre). */
        entwuerfe: number;
        /** Warnung „anderer Dienst am Tag“ / „abwesend“, die zusammen mit „voll“ gefragt wird. */
        warnung: EintragenWarnung | null;
        /** Wer eingetragen wird – `null` bei einem Gast, dessen Name erst im Fenster „Gast eintragen“ kommt. */
        wer: Besetzung | null;
        spalte: number;
        zeile: PlanZeile;
      }
    | {
        /** „Gast eintragen“ (P2d): Namensfeld; bei vollem Dienst mit „Platz dazunehmen“. */
        art: 'gast';
        dienst: string;
        tag: string;
        termin: string;
        uhrzeit: string;
        /** Die Plätze des Dienstes, wenn er voll ist – sonst `null`. */
        voll: { von: number } | null;
        spalte: number;
        zeile: PlanZeile;
      }
    | null
  >(null);
  // Während ein Entwurf angelegt oder weggenommen wird, zählt ein zweiter Klick nicht (sonst entstünden zwei).
  const [laeuft, setLaeuft] = useState(false);
  const personen = sicht.personen;

  const raster = personenRaster({
    plan,
    spalten,
    gruppen,
    daten,
    antworten: antw.antworten,
    entwurf: sicht.entwurf,
  });
  if (raster.blocks.length === 0) {
    return (
      <p className={styles.leer}>
        An den gezeigten Terminen ist in diesen Gruppen kein Dienst vorgesehen.
      </p>
    );
  }
  const termine = spalten.map((i) => plan.spalten[i]);
  // Die Zeile der Matrix zu jedem Block – der Platz, auf den eingetragen wird, gehört zu ihr.
  const diensteDa = rasterDienste(plan, spalten, gruppen);
  const zeileJe = new Map<number, PlanZeile>(diensteDa.map((x) => [x.zeile.dienst.id, x.zeile]));
  // Die Gruppe zu jedem Block – der Zauberstab rechnet je Gruppe und Dienst (dieselbe Funktion wie in der Matrix).
  const gruppeJe = new Map(diensteDa.map((x) => [x.zeile.dienst.id, x.gruppe]));

  const aktionFuer = (b: RasterBlock, r: RasterZeile, pos: number): ZellenAktion => {
    const zl = zeileJe.get(b.dienst.id);
    return personen && zl
      ? personen.aktion(spalten[pos], zl, r.personId, r.zellen[pos].zustand)
      : null;
  };

  /** Der Klick auf einen Gast – `undefined`, wo er nichts tut (kein Recht, Entwurf veraltet). */
  const gastKlick = (b: RasterBlock, g: RasterGast, pos: number) => {
    const zl = zeileJe.get(b.dienst.id);
    const a = personen && zl ? personen.gast(spalten[pos], zl, g) : null;
    if (!zl || !a) return undefined;
    if (a.art === 'belegt') return () => sicht.onBelegt(spalten[pos], zl, a.nr);
    if (a.art === 'entwurfFach') return () => sicht.onEntwurf(spalten[pos], zl, a.nr);
    return undefined;
  };

  /** Die Aktion der leeren Gäste-Zelle (P2d) – `null`, wo man dort nichts eintragen darf. */
  const gastNeuFuer = (b: RasterBlock, pos: number): ZellenAktion => {
    const zl = zeileJe.get(b.dienst.id);
    return personen && zl ? personen.gastNeu(spalten[pos], zl) : null;
  };

  /**
   * Ein Klick in eine leere Gäste-Zelle oder auf das „+“ (P2d): das Fenster „Gast eintragen“ – bei vollem Dienst mit „Platz
   * dazunehmen“; liegt an diesem Dienst und Termin schon ein Entwurf, die Sperre wie bei den Personen („Ansehen und senden“).
   */
  const gastNeuKlick = (b: RasterBlock, pos: number) => {
    const zl = zeileJe.get(b.dienst.id);
    const a = gastNeuFuer(b, pos);
    if (!zl || !a || laeuft || (a.art !== 'eintragen' && a.art !== 'voll')) return;
    const i = spalten[pos];
    const tag = plan.spalten[i].tag;
    if (a.art === 'voll' && a.entwuerfe > 0) {
      setFenster({
        art: 'voll',
        dienst: b.dienst.name,
        tag,
        von: a.von,
        entwuerfe: a.entwuerfe,
        warnung: null,
        wer: null,
        spalte: i,
        zeile: zl,
      });
      return;
    }
    setFenster({
      art: 'gast',
      dienst: b.dienst.name,
      tag,
      termin: plan.spalten[i].name,
      uhrzeit: plan.spalten[i].uhrzeit,
      voll: a.art === 'voll' ? { von: a.von } : null,
      spalte: i,
      zeile: zl,
    });
  };

  const tue = async (arbeit: () => Promise<void>) => {
    setLaeuft(true);
    try {
      await arbeit();
    } finally {
      setLaeuft(false);
    }
  };

  /** Ein Klick in eine Zelle – `aktionFuer` hat schon gesagt, dass es etwas zu tun gibt. */
  const klick = (b: RasterBlock, r: RasterZeile, pos: number) => {
    const zl = zeileJe.get(b.dienst.id);
    const a = aktionFuer(b, r, pos);
    if (!personen || !zl || !a || laeuft) return;
    const i = spalten[pos];
    const tag = plan.spalten[i].tag;
    if (a.art === 'belegt') {
      // Bestehende Einteilung (P2b): dasselbe Fenster wie beim Antippen eines belegten Platzes in der Matrix.
      sicht.onBelegt(i, zl, a.nr);
    } else if (a.art === 'entwurfFach') {
      // Von einem Entwurf weggenommen (rot durchgestrichen): das Entwurfs-Fenster der Matrix.
      sicht.onEntwurf(i, zl, a.nr);
    } else if (a.art === 'wegnehmen') {
      void tue(() => personen.wegnehmen(zl, a.entwurf));
    } else if (a.art === 'direkt') {
      void tue(() => personen.direkt(zl, a.entwurf));
    } else if (a.art === 'voll') {
      setFenster({
        art: 'voll',
        dienst: b.dienst.name,
        tag,
        von: a.von,
        entwuerfe: a.entwuerfe,
        warnung: eintragenWarnung({
          name: r.name,
          dienst: b.dienst.name,
          tag,
          zelle: r.zellen[pos],
        }),
        wer: { art: 'person', personId: r.personId, name: r.name },
        spalte: i,
        zeile: zl,
      });
    } else {
      const eintragen = () =>
        // Noch einmal fragen: Zwischen Klick und „Trotzdem“ kann sich der Platz geändert haben.
        void tue(async () => {
          const jetzt = personen.aktion(i, zl, r.personId, null);
          if (jetzt?.art === 'eintragen')
            await personen.eintragen(
              i,
              zl,
              jetzt.nr,
              { art: 'person', personId: r.personId, name: r.name },
              jetzt.ersetzt,
            );
        });
      const warnung = eintragenWarnung({
        name: r.name,
        dienst: b.dienst.name,
        tag,
        zelle: r.zellen[pos],
      });
      if (warnung) setFenster({ art: 'warnung', titel: 'Bitte prüfen', warnung, ok: eintragen });
      else eintragen();
    }
  };

  const zeile = (b: RasterBlock, r: RasterZeile, nr: number) => (
    <tr
      key={r.schluessel}
      className={`${nr % 2 === 1 ? styles.z2 : ''}${hervor === r.personId ? ' ' + styles.hervor : ''}${fokusId === r.personId ? ' ' + styles.fokus : ''}`}
      data-person={r.personId}
    >
      <th scope="row" className={styles.name}>
        <button
          type="button"
          className={styles.namenKnopf}
          aria-pressed={fokusId === r.personId}
          title={
            fokusId === r.personId
              ? 'Fokus aus'
              : 'Im Plan hervorheben – alle Zeilen dieser Person, auch in der Matrix'
          }
          onPointerEnter={(e) => e.pointerType === 'mouse' && setUeber(r.personId)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setUeber(null)}
          onClick={() =>
            fokusId === r.personId ? sicht.onFokusAus?.() : sicht.onFokus?.(r.personId, r.name)
          }
        >
          <span className={styles.avatar} aria-hidden="true">
            {r.initialen}
          </span>
          <span className={styles.personName}>{r.name}</span>
          {r.auch.length > 0 && (
            <span className={styles.auch} title={`auch ${r.auch.join(', ')}`}>
              auch {r.auch.join(', ')}
            </span>
          )}
          {!r.mitglied && <span className={styles.keinMitglied}>nicht in der Gruppe</span>}
        </button>
      </th>
      <td className={styles.einsaetze}>{r.einsaetze}</td>
      {r.zellen.map((z, pos) => {
        const a = aktionFuer(b, r, pos);
        const name = `${r.name} für ${b.dienst.name} am ${tagKurz(termine[pos].tag)}`;
        const klasse = [
          termine[pos].abgesagt ? styles.abgesagtSpalte : '',
          a ? styles.klick : '',
          a && (a.art === 'eintragen' || a.art === 'voll') ? styles.leerKlick : '',
          a && (a.art === 'belegt' || a.art === 'entwurfFach') ? styles.belegtKlick : '',
          z.abwesend ? styles.abwZelle : '',
          z.flaeche === 'ja' ? styles.antwortJa : '',
          z.flaeche === 'vielleicht' ? styles.antwortVielleicht : '',
          z.warnung ? styles.warnZelle : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <td
            key={termine[pos].id}
            className={klasse || undefined}
            // Die Antwort aus „Wann kann ich?“ in Worten – die Farbe allein trägt die Bedeutung nicht (Notiz, „nur für …“).
            title={z.antwort ? antwortText(z.antwort) : undefined}
            aria-label={z.antwort ? antwortText(z.antwort) : undefined}
            // Ein Klick irgendwo in der Zelle (auch auf einem Tag darin) – der Knopf darunter ist für Tastatur und Vorleser;
            // sein Klick steigt hierher auf, so wird nichts doppelt gerechnet.
            onClick={a ? () => klick(b, r, pos) : undefined}
          >
            {a && (
              <button
                type="button"
                className={styles.zellKnopf}
                aria-label={
                  a.art === 'wegnehmen'
                    ? `${name}: Entwurf wegnehmen`
                    : a.art === 'direkt'
                      ? `${name}: auf direkt umstellen`
                      : a.art === 'belegt'
                        ? `${name}: Einteilung öffnen`
                        : a.art === 'entwurfFach'
                          ? `${name}: Entwurf öffnen`
                          : `${name} eintragen`
                }
                title={
                  a.art === 'wegnehmen'
                    ? 'Entwurf wegnehmen'
                    : a.art === 'direkt'
                      ? 'Auf direkt umstellen (ohne Rückfrage zugesagt) – noch ein Klick nimmt den Entwurf weg'
                      : undefined
                }
              >
                {(a.art === 'eintragen' || a.art === 'voll') && (
                  <span className={styles.plus} aria-hidden="true">
                    <Icon name="plus" size={16} />
                  </span>
                )}
              </button>
            )}
            <Zelle z={z} dienst={b.dienst.name} farbe={farbe(b.dienst.id)} />
          </td>
        );
      })}
    </tr>
  );

  const blockKopf = (b: RasterBlock) => {
    const n = b.zeilen.length;
    const offen = !zugeklappt.has(blockSchluessel(b.dienst.id));
    const zauberGruppe = gruppeJe.get(b.dienst.id);
    const vorgabeZeile = zeileJe.get(b.dienst.id);
    return (
      <tr key={`k-${b.dienst.id}`}>
        <td className={styles.blockKopf} colSpan={termine.length + 2}>
          <div className={styles.blockInnen}>
            {/* Zuklappen ist kein Ausblenden: Der Kopf bleibt, „Noch offen“ zählt den Dienst weiter (Wunsch 10). */}
            <button
              type="button"
              className={styles.blockKnopf}
              aria-expanded={offen}
              aria-label={`${b.dienst.name}, ${n} ${n === 1 ? 'Person' : 'Personen'}`}
              onClick={() => onUmschalten(blockSchluessel(b.dienst.id))}
            >
              <span className={styles.chev}>
                <Icon name="chev-down" size={16} />
              </span>
              <DienstTag name={b.dienst.name} farbe={farbe(b.dienst.id)} />
              <span className={styles.zahl}>
                {n} {n === 1 ? 'Person' : 'Personen'}
              </span>
            </button>
            {/* Vorgabe „Anfrage | direkt“ (P2m) – dasselbe Symbol und Fenster wie in der Matrix. */}
            {vorgabeZeile && <VorgabeKnopf sicht={sicht} z={vorgabeZeile} spalten={termine} />}
            {/* Zauberstab für diesen Dienst über alle gezeigten Termine – dasselbe Fenster wie in der Matrix. */}
            {zauberGruppe && (
              <ZauberKnopf
                onKlick={sicht.onZauberstab(spalten, zauberGruppe, b.dienst.id)}
                text={`Zauberstab: ${b.dienst.name} für alle gezeigten Termine vorschlagen`}
              />
            )}
            {b.abwesenheit !== 'ok' && (
              <span className={styles.blockHinweis}>
                {b.abwesenheit === 'nichtSichtbar'
                  ? 'Abwesenheiten nicht sichtbar'
                  : 'Abwesenheiten nur teilweise sichtbar'}
              </span>
            )}
            {antwortenLader && !antw.laedt && !antw.fehler && b.antworten === 'nichtSichtbar' && (
              <span className={styles.blockHinweis}>Antworten nicht sichtbar</span>
            )}
            {b.mitgliederVerborgen && (
              <span className={styles.blockHinweis}>
                Mitglieder einer Gruppe nicht sichtbar – es stehen nur die Eingeteilten da
              </span>
            )}
            {b.fehler && (
              <span className={styles.blockFehler} role="alert">
                {b.fehler.text}
                {b.fehler.nochmal && (
                  <button
                    type="button"
                    className={styles.nochmal}
                    disabled={b.fehler.gruppenIds.some((id) => ladend.has(id))}
                    onClick={() => void nochmal(b.fehler?.gruppenIds ?? [])}
                  >
                    Nochmal versuchen
                  </button>
                )}
              </span>
            )}
          </div>
        </td>
      </tr>
    );
  };

  /**
   * Die Zeile „Gäste“ eines Dienst-Blocks: Gäste (bestehend oder Entwurf) als Tags; wo man eintragen darf (`gastNeu`: dieselben
   * Rechte wie bei den Personen-Zellen), gibt es sie **in jedem Block**, auch ohne Gast (P2d) – die leere Zelle trägt mit
   * einem Klick einen Gast ein, eine Zelle mit Gästen hat ein kleines „+“ für einen weiteren.
   */
  const gaesteZeile = (b: RasterBlock) => {
    const neu = b.gaeste.map((_, pos) => gastNeuFuer(b, pos));
    const eintragbar = neu.map((a) => a?.art === 'eintragen' || a?.art === 'voll');
    if (!b.gaeste.some((g) => g.length > 0) && !eintragbar.some(Boolean)) return [];
    const zl = zeileJe.get(b.dienst.id);
    return [
      <tr key={`g-${b.dienst.id}`}>
        <th scope="row" className={`${styles.name} ${styles.gaesteName}`}>
          Gäste
        </th>
        <td className={styles.einsaetze} />
        {b.gaeste.map((liste, pos) => {
          const abgesagt = termine[pos].abgesagt ? styles.abgesagtSpalte : '';
          const name = `${b.dienst.name} am ${tagKurz(termine[pos].tag)}`;
          const leer = liste.length === 0 && eintragbar[pos];
          return (
            <td
              key={termine[pos].id}
              className={
                `${abgesagt}${leer ? ` ${styles.klick} ${styles.leerKlick}` : ''}` || undefined
              }
              // Eine leere Gäste-Zelle zählt überall; der Knopf darin ist für Tastatur und Vorleser, sein Klick steigt hierher auf.
              onClick={leer ? () => gastNeuKlick(b, pos) : undefined}
            >
              {leer && (
                <button
                  type="button"
                  className={styles.zellKnopf}
                  aria-label={`Gast für ${name} eintragen`}
                >
                  <span className={styles.plus} aria-hidden="true">
                    <Icon name="plus" size={16} />
                  </span>
                </button>
              )}
              {liste.length > 0 && (
                <div className={styles.gastInnen}>
                  {liste.map((g) => (
                    <GastTag
                      key={`${g.name}-${g.entwurf}-${g.zurueck}-${g.nr}`}
                      g={g}
                      // Ein Klick öffnet dasselbe Fenster wie in der Matrix (P2b) – nur, wo man es dort auch darf.
                      onKlick={personen && zl ? gastKlick(b, g, pos) : undefined}
                    />
                  ))}
                  {liste.length > 0 && eintragbar[pos] && (
                    <button
                      type="button"
                      className={styles.gastPlus}
                      aria-label={`Weiteren Gast für ${name} eintragen`}
                      title="Weiteren Gast eintragen"
                      onClick={() => gastNeuKlick(b, pos)}
                    >
                      +
                    </button>
                  )}
                </div>
              )}
            </td>
          );
        })}
      </tr>,
    ];
  };

  /**
   * Die Zeile „Plätze“ am Ende eines Dienst-Blocks (P2c): je Termin „belegt von Plätzen“ – gezählt wie „Noch offen“ (Entwürfe
   * zählen mit). Freie Plätze rot (wie die roten Tags in „Noch offen“; an einem abgesagten Termin nicht), voll neutral, ohne
   * Plätze „aus“. Ein Klick öffnet den Regler dieses Dienstes an diesem Termin – wo man ihn bedienen darf (`sicht.onPlatz`).
   */
  const plaetzeZeile = (b: RasterBlock) => {
    const zl = zeileJe.get(b.dienst.id);
    return (
      <tr key={`p-${b.dienst.id}`}>
        <th scope="row" className={`${styles.name} ${styles.gaesteName}`}>
          Plätze
        </th>
        <td className={styles.einsaetze} />
        {b.plaetze.map((p, pos) => {
          const text = plaetzeZelleText(p);
          const abgesagt = termine[pos].abgesagt;
          const oeffnen = zl ? sicht.onPlatz?.(spalten[pos], zl) : undefined;
          const tag = (
            <span
              className={`${styles.tag}${p.frei > 0 && !abgesagt ? ' ' + styles.offenTag : ''}`}
              title={
                p.anzahl === 0
                  ? 'Dienst an diesem Termin aus'
                  : `${p.belegt} belegt, ${p.frei} frei`
              }
            >
              <span className={styles.tagText}>{text}</span>
            </span>
          );
          return (
            <td
              key={termine[pos].id}
              className={`${abgesagt ? styles.abgesagtSpalte : ''}${oeffnen ? ' ' + styles.plaetzeKlick : ''}`}
              // Ein Klick irgendwo in der Zelle zählt; der Knopf darin ist für Tastatur und Vorleser, sein Klick steigt hierher auf.
              onClick={oeffnen}
            >
              {oeffnen ? (
                <button
                  type="button"
                  className={styles.plaetzeKnopf}
                  aria-label={`Plätze ${b.dienst.name} am ${tagKurz(termine[pos].tag)}: ${text} – ändern`}
                >
                  {tag}
                </button>
              ) : (
                tag
              )}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <>
      {!lader && (
        <p className={styles.status} role="status">
          Mitglieder und Abwesenheiten stehen hier nicht zur Verfügung – gezeigt werden nur die
          Eingeteilten.
        </p>
      )}
      {laedt && gruppenIds.length > 0 && (
        <p className={styles.status} role="status">
          Mitglieder und Abwesenheiten werden geladen …
        </p>
      )}
      {fehler && <FehlerKasten fehler={fehler} onNochmal={neuLaden} />}
      {neuFehler && <FehlerKasten fehler={neuFehler} onNochmal={neuLaden} />}
      {antw.fehler && <FehlerKasten fehler={antw.fehler} onNochmal={antw.neuLaden} />}
      {antw.neuFehler && <FehlerKasten fehler={antw.neuFehler} onNochmal={antw.neuLaden} />}
      {raster.antwortZahlen.some((z) => z !== null) && <Legende />}
      <div className={planen.rahmen} ref={bisUnten.ref} style={bisUnten.style}>
        <table
          className={styles.raster}
          style={{
            ['--n' as string]: termine.length,
            width: 'calc(var(--namew) + var(--einw) + var(--n) * var(--cw))',
          }}
          aria-label="Personen und ihre Einsätze"
        >
          <thead>
            <tr>
              <th scope="col" className={styles.name}>
                Name
              </th>
              <th scope="col" className={styles.einsaetze}>
                Einsätze
              </th>
              {termine.map((s, pos) => (
                <th
                  key={s.id}
                  scope="col"
                  className={`${styles.termin}${s.abgesagt ? ' ' + styles.abgesagtSpalte : ''}`}
                >
                  <b>{tagKurz(s.tag)}</b>
                  {s.name}
                  <i>{s.abgesagt ? 'abgesagt' : `${s.uhrzeit} Uhr`}</i>
                  {raster.antwortZahlen[pos] && (
                    <b className={styles.antwortZahl}>{zahlenText(raster.antwortZahlen[pos])}</b>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {raster.blocks.flatMap((b) => [
              blockKopf(b),
              ...(zugeklappt.has(blockSchluessel(b.dienst.id))
                ? []
                : b.zeilen.map((r, nr) => zeile(b, r, nr))),
              ...(zugeklappt.has(blockSchluessel(b.dienst.id)) ? [] : gaesteZeile(b)),
              ...(zugeklappt.has(blockSchluessel(b.dienst.id)) ? [] : [plaetzeZeile(b)]),
            ])}
            <tr className={styles.fuss}>
              <th scope="row" className={styles.name}>
                Noch offen
              </th>
              <td className={styles.einsaetze} />
              {raster.offen.map((o, pos) => (
                <td key={termine[pos].id}>
                  <div className={styles.offenTags}>
                    {o.abgesagt ? (
                      <span className={styles.blockHinweis}>abgesagt</span>
                    ) : (
                      o.dienste.map((d) => {
                        // Der rote Tag öffnet den Regler dieses Dienstes an diesem Termin (P2c) – wo man ihn bedienen darf.
                        const zl = zeileJe.get(d.serviceId);
                        const oeffnen = zl ? sicht.onPlatz?.(spalten[pos], zl) : undefined;
                        return oeffnen ? (
                          <button
                            key={d.dienst}
                            type="button"
                            className={`${styles.tag} ${styles.offenTag} ${styles.tagKnopf}`}
                            aria-label={`Plätze ${d.dienst} am ${tagKurz(termine[pos].tag)} ändern`}
                            title={`Plätze ${d.dienst} ändern`}
                            onClick={oeffnen}
                          >
                            <span className={styles.tagText}>{offenText(d)}</span>
                          </button>
                        ) : (
                          <span key={d.dienst} className={`${styles.tag} ${styles.offenTag}`}>
                            <span className={styles.tagText}>{offenText(d)}</span>
                          </span>
                        );
                      })
                    )}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {fenster?.art === 'warnung' && (
        <ConfirmDialog
          title={fenster.titel}
          message={`${fenster.warnung.saetze.join(' ')} ${fenster.warnung.frage}`}
          confirmLabel="Trotzdem eintragen"
          harmlos
          onConfirm={() => {
            setFenster(null);
            fenster.ok();
          }}
          onCancel={() => setFenster(null)}
        />
      )}
      {fenster?.art === 'gast' &&
        (() => {
          const f = fenster;
          const dazunehmen = personen?.dazunehmen;
          // Voll, aber „Platz dazunehmen“ gibt es hier nicht (kein Anschluss zum Ändern der Plätze): nur die Auskunft.
          if (f.voll && !dazunehmen)
            return (
              <ConfirmDialog
                title={`${f.dienst} ist voll`}
                message={vollText(f.dienst, f.tag, f.voll.von)}
                confirmLabel="Schließen"
                cancelLabel={null}
                harmlos
                onConfirm={() => setFenster(null)}
                onCancel={() => setFenster(null)}
              />
            );
          return (
            <GastFenster
              titel={`Gast eintragen – ${f.dienst} · ${tagKurz(f.tag)}`}
              unter={`${f.termin} · ${f.uhrzeit} Uhr`}
              voll={
                f.voll
                  ? {
                      text: vollText(f.dienst, f.tag, f.voll.von),
                      hinweis: platzDazuText(f.dienst, f.voll.von + 1, 'Der Gast'),
                      neu: f.voll.von + 1,
                    }
                  : null
              }
              onClose={() => setFenster(null)}
              onEintragen={(name) => {
                setFenster(null);
                const wer: Besetzung = { art: 'gast', name };
                if (f.voll && dazunehmen) void tue(() => dazunehmen(f.spalte, f.zeile, wer));
                else if (!f.voll)
                  // Noch einmal fragen: Zwischen Klick und „Eintragen“ kann sich der Platz geändert haben.
                  void tue(async () => {
                    const jetzt = personen?.gastNeu(f.spalte, f.zeile);
                    if (jetzt?.art === 'eintragen')
                      await personen?.eintragen(f.spalte, f.zeile, jetzt.nr, wer, jetzt.ersetzt);
                  });
              }}
            />
          );
        })()}
      {fenster?.art === 'voll' &&
        (() => {
          const f = fenster;
          const voll = vollText(f.dienst, f.tag, f.von);
          // Sperre: Liegt an diesem Dienst und Termin ein Entwurf, nimmt „Platz dazunehmen“ nichts an – ChurchTools nummeriert
          // die Plätze beim Ändern neu, der Entwurf fände seinen Platz nicht mehr (wie beim Regler, `sperreText`).
          if (f.entwuerfe > 0) {
            const senden = personen?.sendenOeffnen;
            return (
              <ConfirmDialog
                title={`${f.dienst} ist voll`}
                message={`${voll} Erst senden oder Entwürfe entfernen.`}
                confirmLabel={senden ? 'Ansehen und senden' : 'Schließen'}
                cancelLabel={senden ? 'Schließen' : null}
                harmlos
                onConfirm={() => {
                  setFenster(null);
                  senden?.();
                }}
                onCancel={() => setFenster(null)}
              >
                <p className={styles.dazuHinweis}>{sperreText(f.entwuerfe)}</p>
              </ConfirmDialog>
            );
          }
          const dazunehmen = personen?.dazunehmen;
          const wer = f.wer;
          if (!dazunehmen || !wer)
            return (
              <ConfirmDialog
                title={`${f.dienst} ist voll`}
                message={voll}
                confirmLabel="Schließen"
                cancelLabel={null}
                harmlos
                onConfirm={() => setFenster(null)}
                onCancel={() => setFenster(null)}
              />
            );
          return (
            <ConfirmDialog
              title={f.warnung ? 'Bitte prüfen' : `${f.dienst} ist voll`}
              message={`${[...(f.warnung?.saetze ?? []), voll].join(' ')} ${
                f.warnung
                  ? 'Platz dazunehmen und trotzdem eintragen?'
                  : 'Platz dazunehmen und eintragen?'
              }`}
              confirmLabel={`Platz dazunehmen (${f.von + 1})`}
              harmlos
              onConfirm={() => {
                setFenster(null);
                void tue(() => dazunehmen(f.spalte, f.zeile, wer));
              }}
              onCancel={() => setFenster(null)}
            >
              <p className={styles.dazuHinweis}>{platzDazuText(f.dienst, f.von + 1, wer.name)}</p>
            </ConfirmDialog>
          );
        })()}
    </>
  );
}
