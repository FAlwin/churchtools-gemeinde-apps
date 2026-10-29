import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
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
 * Form (`TerminAblauf schmal` – dieselbe Stelle wie die Termin-Ansicht). **Ein Stift** links in der Gruppenzeile öffnet
 * alle Termine, die man bearbeiten darf (Variante A); zugeklappt merkt sich das Gerät (`PlanenAnsicht.ablaufZu`).
 * Am Handy steht der Ablauf des gewählten Termins wie in der Termin-Ansicht.
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

/** Stift (bearbeiten) bzw. „Fertig“ – wie in der Termin-Ansicht, hier für alle gezeigten Termine. */
function StiftKnopf({ ma, fuer }: { ma: MatrixAblauf; fuer: string }) {
  if (ma.bearbeiten) {
    return (
      <button type="button" className={styles.fertig} onClick={() => ma.setBearbeiten(false)}>
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
      onClick={() => {
        ma.setBearbeiten(true);
        ma.setZu(false); // zugeklappt sähe man nicht, was sich öffnet
      }}
    >
      <Icon name="pencil" size={15} />
    </button>
  );
}

/** Der Ablauf eines Termins in seiner Zelle: wird geladen, Fehler mit „Erneut versuchen“ oder der Ablauf selbst. */
function AblaufZelle({ ma, s, schmal }: { ma: MatrixAblauf; s: PlanSpalte; schmal: boolean }) {
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
 * Die zwei Zeilen „Ablauf“ oben in der Tabelle: die Gruppenzeile (aufklappen, Stift, „N Punkte“ je Termin, Schloss
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
  const darfIrgendwo = spalten.some((i) => darfBearbeiten(ma, plan.spalten[i]));
  const [frage, setFrage] = useState<Frage | null>(null);
  const { toast: hinweis, showToast: zeigeHinweis } = useToast();

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
            {darfIrgendwo && <StiftKnopf ma={ma} fuer="alle gezeigten Termine" />}
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
                  <AblaufZelle ma={ma} s={s} schmal />
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
