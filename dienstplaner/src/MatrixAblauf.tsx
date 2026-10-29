import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { BodyPortal } from '@ui/fenster/BodyPortal';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { Toast } from '@ui/fenster/Toast';
import { useToast } from '@ui/fenster/useToast';
import { AblaufZiehBereich } from '@ui/ablauf/AblaufZiehBereich';
import { useAblageFlaeche, type Ablegen } from '@ui/ablauf/ablaufZiehen';
import { browserSchreiber } from '@ui/ct/schreiber';
import { itemLabel } from '@shared/ct/ablaufZeile';
import { tagKurz } from '@shared/ct/datum';
import {
  ABLAUF_GETEILT,
  punktUebertragen,
  teilenAblauf,
  uebertragenZuruecknehmen,
  type UebertragArt,
} from '@shared/ct/punktUebertragen';
import type { Plan, PlanSpalte } from '@shared/dienstplan/plan';
import { GESPERRT } from './ablaufAktionen';
import { ablaufBearbeitbar } from './start';
import { TerminAblauf } from './TerminAblauf';
import type { AblaufZustand, MatrixAblauf } from './useMatrixAblauf';
import planStyles from './Planen.module.scss';
import styles from './MatrixAblauf.module.scss';

/**
 * **Der Ablauf in der Matrix** (Bauplan E6-6a, Entwurf `e6-6-entwurf-2.html`, abgenommen 28.10.2026): die Gruppe
 * „Ablauf“ **oben**, über den Dienstgruppen, mit „N Punkte“ je Termin; darunter je Spalte der Ablauf in der schmalen
 * Form (`TerminAblauf schmal` – dieselbe Stelle wie die Termin-Ansicht). **Ein „Ablauf bearbeiten“** oben in der Leiste
 * (`AblaufBearbeitenKnopf`) öffnet alle Termine, die man bearbeiten darf (Variante A); zugeklappt merkt sich das Gerät
 * (`PlanenAnsicht.ablaufZu`). Im Bearbeiten steht neben „N Punkte“ je Termin das grüne Plus mit seinem kleinen Menü
 * (E6-6c, Entwurf `e6-6-neuer-punkt.html` A, Alwin 29.10.2026 – vorher ein Stift links in der Gruppenzeile und
 * „+ Punkt“ unter dem Ablauf, das auch am Rechner das Blatt von unten öffnete). Am Handy steht der Ablauf des gewählten
 * Termins wie in der Termin-Ansicht.
 *
 * **Ziehen zwischen Terminen** (E6-6b, Entwurf Bild 3): alle Spalten in EINEM Zieh-Bereich (`AblaufZiehBereich`);
 * losgelassen in einem anderen Termin fragt die Matrix „Verschieben / Kopieren“ und überträgt über den Kern
 * (`punktUebertragen`: anlegen → nachlesen → erst dann im alten löschen). Nicht in Termine ohne Ablauf (Alwin,
 * 29.10.2026: erst anlegen), nicht zu abgeschlossenen oder geteilten. „Rückgängig“ wie beim Löschen (Alwin, 29.10.2026).
 */

/** „8 Punkte“, „kein Ablauf“ – was die Gruppenzeile je Termin zeigt. */
function anzahlText(z: AblaufZustand | undefined): string {
  if (!z || z.art === 'laedt') return '…';
  if (z.art === 'fehler') return 'nicht geladen';
  if (z.ablauf === null) return 'kein Ablauf';
  const n = z.ablauf.items.length;
  return n === 1 ? '1 Punkt' : `${n} Punkte`;
}

/** Darf man den Ablauf dieses Termins bearbeiten? Abgesagte Termine stehen nur zum Ansehen da (Entwurf E6-6). */
const darfBearbeiten = (ma: MatrixAblauf, s: PlanSpalte) =>
  !s.abgesagt && ablaufBearbeitbar(ma.start, s.ablaufTermin);

/** Bearbeiten an bzw. aus – eine Stelle für den Knopf in der Leiste und den Stift am Handy. */
function umschalten(ma: MatrixAblauf): void {
  if (ma.bearbeiten) {
    ma.setBearbeiten(false);
    return;
  }
  ma.setBearbeiten(true);
  ma.setZu(false); // zugeklappt sähe man nicht, was sich öffnet
}

/** Am Handy: Stift (bearbeiten) bzw. „Fertig“ – wie in der Termin-Ansicht. */
function StiftKnopf({ ma, fuer }: { ma: MatrixAblauf; fuer: string }) {
  if (ma.bearbeiten) {
    return (
      <button type="button" className={styles.fertig} onClick={() => umschalten(ma)}>
        <Icon name="check" size={14} /> Fertig
      </button>
    );
  }
  return (
    <button
      type="button"
      className={styles.stift}
      aria-label={`Ablauf bearbeiten – ${fuer}`}
      title={`Ablauf bearbeiten – ${fuer}`}
      onClick={() => umschalten(ma)}
    >
      <Icon name="pencil" size={15} />
    </button>
  );
}

/**
 * Am Rechner: **„Ablauf bearbeiten“ oben in der Leiste** neben Spaltenbreite und Filter, mit Wort wie in der Musik-App – grau,
 * blau erst „Fertig“ (E6-6c; der Stift allein war zu unscheinbar, Alwin 29.10.2026). Neben „Ablauf“ in der Gruppenzeile
 * passte der Knopf nicht: Die erste Spalte ist 178 px breit (Alwin: lieber in die Leiste als die Spalte breiter). Gilt
 * für alle gezeigten Termine; nur, wo man mindestens einen davon bearbeiten darf.
 */
export function AblaufBearbeitenKnopf({
  ma,
  plan,
  spalten,
}: {
  ma: MatrixAblauf;
  plan: Plan;
  spalten: number[];
}) {
  if (!spalten.some((i) => darfBearbeiten(ma, plan.spalten[i]))) return null;
  return (
    <KopfKnopf
      onClick={() => umschalten(ma)}
      label={ma.bearbeiten ? 'Fertig' : 'Ablauf bearbeiten'}
      title={ma.bearbeiten ? 'Fertig' : 'Ablauf bearbeiten – alle gezeigten Termine'}
      haupt={ma.bearbeiten}
      symbol={<Icon name={ma.bearbeiten ? 'check' : 'pencil'} size={16} stroke={2.2} />}
    />
  );
}

/**
 * Der Ablauf eines Termins in seiner Zelle: wird geladen, Fehler mit „Erneut versuchen“ oder der Ablauf selbst. Das
 * grüne Plus der Liste (`kopfKnopf`) steht nicht in der Zelle, sondern an `plusOrt` in der Gruppenzeile darüber (E6-6c).
 */
function AblaufZelle({
  ma,
  s,
  schmal,
  plusOrt,
}: {
  ma: MatrixAblauf;
  s: PlanSpalte;
  schmal: boolean;
  plusOrt?: HTMLElement;
}) {
  const z = ma.zustand(s.id);
  if (!z || z.art === 'laedt') return <p className={styles.leise}>Ablauf wird geladen …</p>;
  if (z.art === 'fehler') {
    return (
      <p className={styles.leise}>
        Ablauf nicht geladen.{' '}
        <button type="button" className={styles.nochmal} onClick={() => ma.nochmal(s.id)}>
          Erneut versuchen
        </button>
      </p>
    );
  }
  return (
    <TerminAblauf
      key={s.id}
      start={ma.start}
      zeitzone={ma.zeitzone}
      termin={s}
      ablauf={z.ablauf}
      onAblauf={(neu) => ma.setzen(s.id, neu)}
      bearbeiten={ma.bearbeiten && darfBearbeiten(ma, s)}
      // Nach „Ablauf anlegen“ bleibt die Matrix im Bearbeiten; ein inzwischen gelöschter Ablauf schließt es nicht für
      // die anderen Termine.
      onBearbeiten={(an) => an && ma.setBearbeiten(true)}
      musikApp={ma.musikApp}
      schmal={schmal}
      mitNeuAufsetzen={false}
    >
      {(teile) => (
        <>
          {teile.inhalt}
          {teile.ueberlagerung}
          {plusOrt && teile.kopfKnopf && createPortal(teile.kopfKnopf, plusOrt)}
        </>
      )}
    </TerminAblauf>
  );
}

/** „So, 01.11.“ – mit Uhrzeit, wenn beide Termine am selben Tag sind. */
function wann(s: PlanSpalte, andere: PlanSpalte): string {
  return s.tag === andere.tag ? `${tagKurz(s.tag)} ${s.uhrzeit} Uhr` : tagKurz(s.tag);
}

/** Wohin ein Punkt aus `von` nicht darf – `true`, wenn er darf. Eine Stelle für die Ablage-Stelle und das Loslassen. */
function ablegenErlaubt(ma: MatrixAblauf, plan: Plan, von: number, nach: number): true | string {
  const zq = ma.zustand(von);
  const zz = ma.zustand(nach);
  if (zq?.art !== 'fertig' || zz?.art !== 'fertig' || !zq.ablauf) {
    return 'Der Ablauf wird noch geladen.';
  }
  if (zz.ablauf === null) {
    return 'Dieser Termin hat noch keinen Ablauf – erst „+ Ablauf anlegen“, dann hineinziehen.';
  }
  const ziel = plan.spalten.find((s) => s.id === nach);
  if (!ziel || !darfBearbeiten(ma, ziel)) return 'Diesen Ablauf darfst du nicht bearbeiten.';
  if (zz.ablauf.isLocked || zq.ablauf.isLocked) return GESPERRT;
  if (teilenAblauf(zq.ablauf, von, zz.ablauf, nach)) return ABLAUF_GETEILT;
  return true;
}

/** Die Zelle eines Termins in der Ablauf-Zeile – im Bearbeiten zugleich die Fläche zum Ablegen (auch unter dem Ende). */
function AblageZelle({
  s,
  an,
  className,
  children,
}: {
  s: PlanSpalte;
  an: boolean;
  className: string;
  children: ReactNode;
}) {
  const ref = useAblageFlaeche(s.id, an);
  return (
    <td ref={ref} className={className}>
      {children}
    </td>
  );
}

interface Frage {
  a: Ablegen;
  laeuft: UebertragArt | null;
  fehler: string | null;
}

/**
 * Die Frage nach dem Loslassen in einem anderen Termin (Entwurf Bild 3). Nach einem Fehler bleibt nur „OK“ – ein
 * zweiter Versuch könnte den Punkt doppelt anlegen (z. B. wenn nur das Löschen im alten Termin scheiterte).
 */
function UebertragenFrage({
  frage,
  plan,
  onArt,
  onClose,
}: {
  frage: Frage;
  plan: Plan;
  onArt: (art: UebertragArt) => void;
  onClose: () => void;
}) {
  const { a, laeuft, fehler } = frage;
  const titel = itemLabel(a.punkt);
  const q = plan.spalten.find((s) => s.id === a.von);
  const z = plan.spalten.find((s) => s.id === a.nach);
  if (fehler) {
    return (
      <BodyPortal>
        <ConfirmDialog
          title="Das hat nicht geklappt"
          message={fehler}
          confirmLabel="OK"
          cancelLabel={null}
          harmlos
          onConfirm={onClose}
          onCancel={onClose}
        />
      </BodyPortal>
    );
  }
  const wo = a.hinter ? `nach „${itemLabel(a.hinter)}“` : 'ganz an den Anfang';
  return (
    <BodyPortal>
      <ConfirmDialog
        title={`„${titel}“ verschieben?`}
        message={
          q && z ? `Vom ${wann(q, z)} zum ${wann(z, q)} – ${wo}.` : `Zum anderen Termin – ${wo}.`
        }
        fuss={q ? `„Kopieren“ lässt ihn zusätzlich am ${wann(q, z ?? q)} stehen.` : undefined}
        confirmLabel={laeuft === 'verschieben' ? 'Verschiebe …' : 'Verschieben'}
        zweit={{
          label: laeuft === 'kopieren' ? 'Kopiere …' : 'Kopieren',
          onClick: () => onArt('kopieren'),
        }}
        harmlos
        beschaeftigt={laeuft !== null}
        onConfirm={() => onArt('verschieben')}
        onCancel={onClose}
      />
    </BodyPortal>
  );
}

/**
 * Die zwei Zeilen „Ablauf“ oben in der Tabelle: die Gruppenzeile (aufklappen, „N Punkte“ und Plus je Termin, Schloss
 * beim Bearbeiten) und darunter die Abläufe. `zelleKlasse` wie die Dienst-Zellen (abgesagt, andere Veranstaltung).
 */
export function AblaufZeilen({
  ma,
  plan,
  spalten,
  zelleKlasse,
}: {
  ma: MatrixAblauf;
  plan: Plan;
  spalten: number[];
  zelleKlasse: (s: PlanSpalte) => string;
}) {
  const ids = spalten.map((i) => plan.spalten[i].id);
  const schluessel = ids.join(',');
  const { laden } = ma;
  useEffect(() => {
    laden(schluessel ? schluessel.split(',').map(Number) : []);
  }, [laden, schluessel]);
  const [frage, setFrage] = useState<Frage | null>(null);
  const { toast: hinweis, showToast: zeigeHinweis } = useToast();
  // Wo das grüne Plus jedes Termins steht (E6-6c): eine Stelle in der Gruppenzeile, gefüllt von der Liste darunter.
  // Je Termin eine feste Ref-Funktion – eine neue je Darstellung riefe React jedes Mal mit `null` und neu auf.
  const [plusOrte, setPlusOrte] = useState<ReadonlyMap<number, HTMLElement>>(new Map());
  const plusRefs = useRef(new Map<number, (el: HTMLElement | null) => void>());
  const plusOrtRef = useCallback((id: number) => {
    let ref = plusRefs.current.get(id);
    if (!ref) {
      ref = (el) =>
        setPlusOrte((alt) => {
          if ((alt.get(id) ?? null) === el) return alt;
          const neu = new Map(alt);
          if (el) neu.set(id, el);
          else neu.delete(id);
          return neu;
        });
      plusRefs.current.set(id, ref);
    }
    return ref;
  }, []);

  /**
   * Verschieben oder kopieren über den Kern; danach beide Spalten neu lesen – auch nach einem Fehler (dann stimmt der
   * Stand des Geräts nicht mehr sicher). „Rückgängig“ steht in der Ziel-Spalte, wo der Punkt jetzt ist.
   */
  async function uebertragen(art: UebertragArt): Promise<void> {
    if (!frage) return;
    const { a } = frage;
    const titel = itemLabel(a.punkt);
    setFrage({ a, laeuft: art, fehler: null });
    try {
      const u = await punktUebertragen(browserSchreiber, art, a.von, a.punkt.id, a.nach, a.ablage);
      setFrage(null);
      a.quelle.verwerfen();
      a.ziel.anbieten(`„${titel}“ ${art === 'verschieben' ? 'verschoben' : 'kopiert'}`, () =>
        uebertragenZuruecknehmen(browserSchreiber, u, titel).finally(() => {
          a.quelle.neuLaden();
          a.ziel.neuLaden();
        }),
      );
    } catch (e) {
      setFrage({
        a,
        laeuft: null,
        fehler: e instanceof Error ? e.message : 'Übertragen hat nicht geklappt.',
      });
    } finally {
      a.quelle.neuLaden();
      a.ziel.neuLaden();
    }
  }

  return (
    <>
      <tr className={planStyles.gruppe}>
        <th className={planStyles.svc} style={{ padding: 0 }} scope="row">
          <div className={planStyles.gruppenKopfZeile}>
            <button
              type="button"
              className={planStyles.gruppenKnopf}
              aria-expanded={!ma.zu}
              onClick={() => ma.setZu(!ma.zu)}
            >
              <span className={planStyles.chev}>
                <Icon name="chev-down" size={16} />
              </span>
              Ablauf
            </button>
          </div>
        </th>
        {spalten.map((i) => {
          const s = plan.spalten[i];
          const z = ma.zustand(s.id);
          const gesperrt = z?.art === 'fertig' && z.ablauf?.isLocked === true;
          return (
            <td key={s.id}>
              <div className={planStyles.gruppenZelle}>
                <span
                  className={`${styles.anzahl}${z?.art === 'fertig' && z.ablauf === null ? ` ${styles.ohne}` : ''}`}
                >
                  {anzahlText(z)}
                </span>
                {ma.bearbeiten && (gesperrt || !darfBearbeiten(ma, s)) && (
                  <span
                    className={styles.schloss}
                    title={gesperrt ? 'Abgeschlossen – nur ansehen' : 'Nur ansehen'}
                    aria-label={gesperrt ? 'Abgeschlossen – nur ansehen' : 'Nur ansehen'}
                  >
                    <Icon name="lock" size={14} />
                  </span>
                )}
                {/* Abgeschlossen: das Schloss statt des Plus – es sagt schon, warum hier nichts dazukommt. Ohne Recht
                    liefert die Liste gar kein Plus. */}
                {ma.bearbeiten && !gesperrt && (
                  <span className={styles.plusOrt} ref={plusOrtRef(s.id)} />
                )}
              </div>
            </td>
          );
        })}
      </tr>
      {!ma.zu && (
        <AblaufZiehBereich
          darfAblegen={(von, nach) => ablegenErlaubt(ma, plan, von, nach)}
          onAblegen={(a) => setFrage({ a, laeuft: null, fehler: null })}
          onHinweis={zeigeHinweis}
        >
          <tr className={styles.ablaufZeile}>
            <th className={planStyles.svc} scope="row">
              <span className={styles.unsichtbar}>Ablauf</span>
              {frage && (
                <UebertragenFrage
                  frage={frage}
                  plan={plan}
                  onArt={(art) => void uebertragen(art)}
                  onClose={() => setFrage(null)}
                />
              )}
              {ma.bearbeiten && <Toast message={hinweis} />}
            </th>
            {spalten.map((i) => {
              const s = plan.spalten[i];
              return (
                <AblageZelle
                  key={s.id}
                  s={s}
                  an={ma.bearbeiten && darfBearbeiten(ma, s)}
                  className={`${styles.zelle}${zelleKlasse(s)}`}
                >
                  <AblaufZelle ma={ma} s={s} schmal plusOrt={plusOrte.get(s.id)} />
                </AblageZelle>
              );
            })}
          </tr>
        </AblaufZiehBereich>
      )}
    </>
  );
}

/** Am Handy: der Ablauf des gewählten Termins wie in der Termin-Ansicht – oben in der Karte, zuklappbar wie die Gruppen. */
export function HandyAblauf({ ma, s }: { ma: MatrixAblauf; s: PlanSpalte }) {
  const { laden } = ma;
  useEffect(() => {
    laden([s.id]);
  }, [laden, s.id]);
  const z = ma.zustand(s.id);
  const darf = darfBearbeiten(ma, s) && z?.art === 'fertig' && z.ablauf !== null;
  return (
    <div className={planStyles.handyGruppe}>
      <div className={planStyles.handyGruppenKopf}>
        <button
          type="button"
          className={planStyles.gruppenKnopf}
          aria-expanded={!ma.zu}
          onClick={() => ma.setZu(!ma.zu)}
        >
          <span className={planStyles.chev}>
            <Icon name="chev-down" size={16} />
          </span>
          Ablauf
        </button>
        <span className={`${styles.anzahl} ${styles.handyAnzahl}`}>{anzahlText(z)}</span>
        {darf && <StiftKnopf ma={ma} fuer={s.name} />}
      </div>
      {!ma.zu && (
        <div className={styles.handyInhalt}>
          <AblaufZelle ma={ma} s={s} schmal={false} />
        </div>
      )}
    </div>
  );
}
