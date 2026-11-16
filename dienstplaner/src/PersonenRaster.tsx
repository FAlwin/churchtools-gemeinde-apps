import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { tagKurz } from '@shared/ct/datum';
import { gruppenDerDienste } from '@shared/dienstplan/personenDaten';
import {
  offenText,
  personenRaster,
  rasterDienste,
  type RasterBlock,
  type RasterZeile,
  type RasterZelle,
} from '@shared/dienstplan/personenRaster';
import type { PersonenLader } from './ladePersonen';
import { ANZAHL_FARBEN } from './personenFarben';
import { blockSchluessel, type Sicht } from './planSicht';
import { useBisUnten } from './useBisUnten';
import { usePersonenDaten } from './usePersonenDaten';
import planen from './Planen.module.scss';
import styles from './PersonenRaster.module.scss';

/** Die Klasse der Dienstfarbe (`.farbe0 …`) – die Zuordnung Dienst → Farbe kommt von außen (`personenFarben.ts`). */
const farbKlasse = (farbe: number) => styles[`farbe${farbe % ANZAHL_FARBEN}`];

const ZUSTAND_TEXT = { zugesagt: 'zugesagt', angefragt: 'angefragt', entwurf: 'Entwurf' } as const;

/** Der Dienst als ChurchTools-Tag; das Symbol sagt den Zustand: Haken = zugesagt, Kreis mit ? = angefragt, Stift = Entwurf. */
function DienstTag({
  name,
  farbe,
  zustand,
}: {
  name: string;
  farbe: number;
  zustand?: RasterZelle['zustand'];
}) {
  return (
    <span
      className={`${styles.tag} ${farbKlasse(farbe)}${zustand === 'entwurf' ? ' ' + styles.entwurf : ''}`}
      role={zustand ? 'img' : undefined}
      aria-label={zustand ? `${name}, ${ZUSTAND_TEXT[zustand]}` : undefined}
      title={zustand ? `${name} – ${ZUSTAND_TEXT[zustand]}` : undefined}
    >
      {zustand === 'zugesagt' && <Icon name="check" size={14} stroke={2.4} />}
      {zustand === 'angefragt' && (
        <span className={styles.frage} aria-hidden="true">
          ?
        </span>
      )}
      {zustand === 'entwurf' && <Icon name="pencil" size={14} stroke={2.4} />}
      <span className={styles.tagText}>{name}</span>
    </span>
  );
}

function Zelle({ z, dienst, farbe }: { z: RasterZelle; dienst: string; farbe: number }) {
  return (
    <>
      {z.zustand && <DienstTag name={dienst} farbe={farbe} zustand={z.zustand} />}
      {z.abwesend && (
        <span
          className={`${styles.tag} ${styles.abwesend}${z.warnung ? ' ' + styles.warnung : ''}`}
          role="img"
          aria-label={`Abwesend: ${z.abwesend.grund}${z.warnung ? ' – trotzdem eingeteilt' : ''}`}
          title={z.warnung ? `${z.abwesend.grund} – trotzdem eingeteilt` : z.abwesend.grund}
        >
          <Icon name="user-slash" size={14} />
          <span className={styles.tagText}>{z.abwesend.grund}</span>
        </span>
      )}
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
 * (Mitglieder, Abwesenheiten) in `ladePersonen.ts`; hier steht nur die Darstellung. Ein Klick in eine Zelle tut nichts –
 * Eintragen kommt mit P2.
 */
export function PersonenRaster({
  sicht,
  lader,
  farbe,
}: {
  sicht: Sicht;
  /** Lädt Mitglieder und Abwesenheiten – ohne bleibt es bei den Eingeteilten. */
  lader?: PersonenLader;
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

  const raster = personenRaster({ plan, spalten, gruppen, daten, entwurf: sicht.entwurf });
  if (raster.blocks.length === 0) {
    return (
      <p className={styles.leer}>
        An den gezeigten Terminen ist in diesen Gruppen kein Dienst vorgesehen.
      </p>
    );
  }
  const termine = spalten.map((i) => plan.spalten[i]);

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
      {r.zellen.map((z, pos) => (
        <td
          key={termine[pos].id}
          className={termine[pos].abgesagt ? styles.abgesagtSpalte : undefined}
        >
          <Zelle z={z} dienst={b.dienst.name} farbe={farbe(b.dienst.id)} />
        </td>
      ))}
    </tr>
  );

  const blockKopf = (b: RasterBlock) => {
    const n = b.zeilen.length;
    const offen = !zugeklappt.has(blockSchluessel(b.dienst.id));
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
            {b.abwesenheit !== 'ok' && (
              <span className={styles.blockHinweis}>
                {b.abwesenheit === 'nichtSichtbar'
                  ? 'Abwesenheiten nicht sichtbar'
                  : 'Abwesenheiten nur teilweise sichtbar'}
              </span>
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
              {termine.map((s) => (
                <th
                  key={s.id}
                  scope="col"
                  className={`${styles.termin}${s.abgesagt ? ' ' + styles.abgesagtSpalte : ''}`}
                >
                  <b>{tagKurz(s.tag)}</b>
                  {s.name}
                  <i>{s.abgesagt ? 'abgesagt' : `${s.uhrzeit} Uhr`}</i>
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
              ...(!zugeklappt.has(blockSchluessel(b.dienst.id)) &&
              b.gaeste.some((g) => g.length > 0)
                ? [
                    <tr key={`g-${b.dienst.id}`}>
                      <th scope="row" className={`${styles.name} ${styles.gaesteName}`}>
                        Gäste
                      </th>
                      <td className={styles.einsaetze} />
                      {b.gaeste.map((liste, pos) => (
                        <td key={termine[pos].id}>
                          {liste.map((g) => (
                            <span
                              key={`${g.name}-${g.entwurf}`}
                              className={`${styles.tag} ${styles.gastTag}${g.entwurf ? ' ' + styles.entwurf : ''}`}
                              title={g.entwurf ? `${g.name} (Gast) – Entwurf` : `${g.name} (Gast)`}
                            >
                              {g.entwurf && <Icon name="pencil" size={14} stroke={2.4} />}
                              <span className={styles.tagText}>{g.name}</span>
                            </span>
                          ))}
                        </td>
                      ))}
                    </tr>,
                  ]
                : []),
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
                      o.dienste.map((d) => (
                        <span key={d.dienst} className={`${styles.tag} ${styles.offenTag}`}>
                          <span className={styles.tagText}>{offenText(d)}</span>
                        </span>
                      ))
                    )}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
