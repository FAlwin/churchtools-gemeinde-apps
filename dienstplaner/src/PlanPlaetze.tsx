import { Fragment } from 'react';
import { Icon } from '@ui/icons/icons';
import type { PlanPlatz, PlanSpalte, PlanZeile } from '@shared/dienstplan/plan';
import { zielText, type Entwurf } from '@shared/dienstplan/entwuerfe';
import { darfPlanen, type EntwurfAmPlatz, type Sicht } from './planSicht';
import styles from './Planen.module.scss';

/** Was die Plätze zum Einteilen brauchen – aus `useEinteilen` (Matrix und Termin-Ansicht, F1). */
export type AmPlatz = Pick<
  Sicht,
  | 'onFrei'
  | 'entwurf'
  | 'ohnePlatz'
  | 'onOhnePlatz'
  | 'onBelegt'
  | 'onEntwurf'
  | 'darfAendern'
  | 'ichId'
>;

/**
 * **Die Plätze einer Zelle zum Einteilen** – mit genau den Knöpfen, die man dort haben darf. **Eine** Regel für die
 * Tabelle und das Handy in „Planen“ und für die Termin-Ansicht (F1, 09.11.2026; vorher stand sie zweimal in
 * `PlanAnsicht`): freier und belegter Platz, wo man den Dienst planen darf (`darfPlanen`); Entwurf und Schild nur, wo man
 * die Entwürfe der Gruppe auch ändern darf.
 */
export function EinteilPlaetze({
  am,
  s,
  i,
  z,
}: {
  am: AmPlatz;
  s: PlanSpalte;
  /** Die Spalte in `plan.spalten`. */
  i: number;
  z: PlanZeile;
}) {
  const planen = darfPlanen(z, s);
  const aendern = planen && am.darfAendern(z);
  return (
    <Plaetze
      plaetze={z.zellen[i] ?? []}
      onFrei={planen ? (nr) => am.onFrei(i, z, nr) : undefined}
      entwurf={(p) => am.entwurf(i, z, p)}
      ohnePlatz={am.ohnePlatz(i, z)}
      onOhnePlatz={aendern ? (e) => am.onOhnePlatz(i, z, e) : undefined}
      onBelegt={planen ? (nr) => am.onBelegt(i, z, nr) : undefined}
      onEntwurf={aendern ? (nr) => am.onEntwurf(i, z, nr) : undefined}
      ichId={am.ichId}
    />
  );
}

/** Die Plätze eines Dienstes am Termin – ohne Knöpfe nur zum Ansehen (Termin-Ansicht ohne Planen-Recht). */
export function Plaetze({
  plaetze,
  onFrei,
  entwurf,
  onEntwurf,
  onBelegt,
  ohnePlatz = [],
  onOhnePlatz,
  ichId = null,
}: {
  plaetze: PlanPlatz[];
  /** Entwürfe dieses Dienstes am Termin, deren Platz es nicht mehr gibt (#582) – als Schild darunter. */
  ohnePlatz?: Entwurf[];
  onOhnePlatz?: (e: Entwurf) => void;
  /** Nur wo man planen darf: freier Platz wird ein Knopf (Platz 1 … n). */
  onFrei?: (nr: number) => void;
  /** Nur wo man planen darf: ein belegter Platz (ohne Entwurf, Name sichtbar) wird ein Knopf (E4-5). */
  onBelegt?: (nr: number) => void;
  /** Der Entwurf an einem Platz (E4-3) – gültig steht er statt „frei“ da, veraltet als Schild darunter. */
  entwurf?: (p: PlanPlatz) => EntwurfAmPlatz | null;
  /** Entwurf bzw. Schild antippen → Entwurfs-Fach (nur wo man planen und ändern darf). */
  onEntwurf?: (nr: number) => void;
  ichId?: number | null;
}) {
  return (
    <div className={styles.plaetze}>
      {plaetze.map((p, i) => {
        const a = entwurf?.(p) ?? null;
        const oeffnen = onEntwurf ? () => onEntwurf(i + 1) : undefined;
        if (a && !a.veraltet) {
          return (
            <EntwurfPlatz
              key={i}
              e={a.entwurf}
              bisher={p.art === 'frei' || p.verborgen ? null : p.name}
              eigener={a.entwurf.von.personId === ichId}
              onOeffnen={oeffnen}
            />
          );
        }
        const platz =
          p.art === 'frei' && onFrei ? (
            <button
              type="button"
              className={`${styles.platz} ${styles.frei} ${styles.freiKnopf}`}
              onClick={() => onFrei(i + 1)}
              aria-label={`frei – Wer kann? (Platz ${i + 1} von ${plaetze.length})`}
            >
              frei
            </button>
          ) : p.art !== 'frei' && !p.verborgen && !a && onBelegt ? (
            <Platz p={p} onAntippen={() => onBelegt(i + 1)} />
          ) : (
            <Platz p={p} />
          );
        if (!a) return <Fragment key={i}>{platz}</Fragment>;
        // Veraltet: ChurchTools gilt – darunter ein Schild, das zum Entwurf führt (Alwin, 14.10.2026).
        const text = `Entwurf veraltet: „${zielText(a.entwurf.ziel)}“ von ${a.entwurf.von.name}`;
        return (
          <Fragment key={i}>
            {platz}
            {oeffnen ? (
              <button
                type="button"
                className={`${styles.veraltet} ${styles.veraltetKnopf}`}
                onClick={oeffnen}
                aria-label={text}
              >
                <Icon name="pencil" size={10} /> Entwurf veraltet
              </button>
            ) : (
              <span className={styles.veraltet} title={text}>
                <Icon name="pencil" size={10} /> Entwurf veraltet
              </span>
            )}
          </Fragment>
        );
      })}
      {ohnePlatz.map((e) => {
        // Entwurf ohne Platz (#582): Platzzahl in ChurchTools geändert – Schild wie „veraltet“.
        const text = `Entwurf ohne Platz: „${zielText(e.ziel)}“ von ${e.von.name}`;
        const k = `ohne-${e.ort.index ?? '-'}`;
        return onOhnePlatz ? (
          <button
            key={k}
            type="button"
            className={`${styles.veraltet} ${styles.veraltetKnopf}`}
            onClick={() => onOhnePlatz(e)}
            aria-label={text}
          >
            <Icon name="pencil" size={10} /> Entwurf ohne Platz
          </button>
        ) : (
          <span key={k} className={styles.veraltet} title={text}>
            <Icon name="pencil" size={10} /> Entwurf ohne Platz
          </span>
        );
      })}
    </div>
  );
}

/** Ein Entwurf – noch nicht gesendet: gestrichelt mit Stift, „von …“ wenn von jemand anderem (E4-3). */
function EntwurfPlatz({
  e,
  bisher,
  eigener,
  onOeffnen,
}: {
  e: Entwurf;
  /** Wer in ChurchTools dort steht (E4-5): wird zurückgezogen bzw. ersetzt. */
  bisher: string | null;
  eigener: boolean;
  /** Antippen öffnet das Entwurfs-Fach (E4-3-3) – nur wo man ändern darf. */
  onOeffnen?: () => void;
}) {
  const gast = e.ziel.art === 'gast';
  // Zurückziehen (rot, der Name durchgestrichen) oder Ersetzen („Neu statt Alt“) – Entwurf Abschnitt 2.
  const zurueck = e.ziel.art === 'frei';
  const statt = !zurueck && e.gesehen.art !== 'frei' ? bisher : null;
  const was = zurueck
    ? `${bisher ?? 'Einteilung'} zurückziehen`
    : `${zielText(e.ziel)}${gast ? ' (Gast)' : ''}${statt ? ` statt ${statt}` : ''}`;
  const Tag = onOeffnen ? 'button' : 'span';
  return (
    <Tag
      {...(onOeffnen
        ? {
            type: 'button' as const,
            onClick: onOeffnen,
            'aria-label': `Entwurf von ${e.von.name}: ${was}`,
          }
        : {})}
      className={`${styles.platz} ${zurueck ? styles.zurueck : styles.entwurf}${onOeffnen ? ' ' + styles.entwurfKnopf : ''}`}
      title={
        zurueck
          ? `Wird zurückgezogen – Entwurf von ${e.von.name}, noch nicht gesendet`
          : `Entwurf von ${e.von.name} – noch nicht gesendet`
      }
    >
      <span className={styles.ic} aria-label="Entwurf, noch nicht gesendet">
        {zurueck ? '−' : <Icon name="pencil" size={11} />}
      </span>
      {zurueck ? (
        // Kein Textschild: In schmalen Spalten bliebe vom Namen sonst nur ein Buchstabe (Browser-Check 15.10.) –
        // rot, „−“ und durchgestrichen sagen „kommt weg“, der Vorleser sagt es über `aria-label`.
        <span className={`${styles.name} ${styles.durch}`}>{bisher ?? 'Einteilung'}</span>
      ) : (
        <span className={styles.name}>
          {zielText(e.ziel)}
          {statt && <span className={styles.statt}> statt {statt}</span>}
        </span>
      )}
      {gast && <span className={styles.gast}>Gast</span>}
      {!gast && e.modus === 'direkt' && <span className={styles.direkt}>direkt</span>}
      {!eigener && <span className={styles.von}>{e.von.name}</span>}
    </Tag>
  );
}

/** Ein Platz – zugesagt (Haken), angefragt („?“), frei, verborgen oder Gast. */
function Platz({ p, onAntippen }: { p: PlanPlatz; onAntippen?: () => void }) {
  if (p.art === 'frei') return <span className={`${styles.platz} ${styles.frei}`}>frei</span>;
  const stand = p.art === 'zugesagt' ? 'zugesagt' : 'angefragt';
  // Antippbar (E4-5): zurückziehen oder ersetzen – ein Knopf mit demselben Aussehen.
  const Tag = onAntippen ? 'button' : 'span';
  return (
    <Tag
      {...(onAntippen
        ? {
            type: 'button' as const,
            onClick: onAntippen,
            'aria-label': `${p.name ?? ''}${p.gast ? ' (Gast)' : ''} – ${stand}: zurückziehen oder ersetzen`,
          }
        : {})}
      className={`${styles.platz} ${styles[p.art]}${p.ich ? ' ' + styles.ich : ''}${onAntippen ? ' ' + styles.belegtKnopf : ''}`}
      title={stand}
    >
      <span className={styles.ic} aria-label={p.art}>
        {p.art === 'zugesagt' ? <Icon name="check" size={11} /> : '?'}
      </span>
      {p.verborgen ? (
        <span className={`${styles.name} ${styles.leise}`}>Nicht sichtbar</span>
      ) : (
        <span className={styles.name}>{p.name}</span>
      )}
      {p.gast && <span className={styles.gast}>Gast</span>}
    </Tag>
  );
}
