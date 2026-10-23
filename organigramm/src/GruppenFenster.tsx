import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { RueckgaengigImFenster } from '@ui/fenster/Rueckgaengig';
import type { Aenderung } from '@ui/fenster/aenderung';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { GruppenKachel } from '@ui/bedienung/GruppenKachel';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { ctBasis } from '@ui/ct/basis';
import { gruppenFarbe } from '@shared/organigramm/farbe';
import type { Knoten, OrgGruppe } from '@shared/organigramm/gruppen';
import { anlegbareTypenAus, darfStruktur } from '@shared/organigramm/rechte';
import {
  gruppeWiederLoeschen,
  obergruppeAendern,
  obergruppeDazu,
  obergruppeLoesen,
  untergruppeAnlegen,
} from '@shared/organigramm/struktur';
import { rollenRang } from '@shared/organigramm/mitglieder';
import { gruppenPersonen } from '@shared/organigramm/personen';
import type { MitgliederDaten } from './ladeMitglieder';
import type { Start } from './start';
import { ladeAktivStatus, strukturZugriff as z } from './struktur';
import { Anlegen, Bestaetigen, ZielWaehlen } from './StrukturSchritte';
import styles from './GruppenFenster.module.scss';

const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

interface Props {
  start: Start;
  knoten: Knoten;
  mitglieder: MitgliederDaten | null;
  onGruppe: (id: number) => void;
  onNachladen: () => void;
  onSchliessen: () => void;
  /** Gruppen und Hierarchie neu laden (nach einer Änderung) – `false`, wenn das gerade nicht ging. */
  onStruktur: () => Promise<boolean>;
}

/** Was das Fenster gerade zeigt: die Gruppe – oder einen Schritt, der die Struktur ändert (O5). */
type Modus =
  | { art: 'ansehen' }
  | { art: 'waehlen'; zweck: 'aendern'; alt: OrgGruppe }
  | { art: 'waehlen'; zweck: 'dazu' }
  | { art: 'aendern'; alt: OrgGruppe; neu: OrgGruppe }
  | { art: 'dazu'; neu: OrgGruppe }
  | { art: 'loesen'; alt: OrgGruppe }
  | { art: 'anlegen' };

/**
 * **Das Gruppenfenster** (O2): Mitglieder nach Rollen (Leitung zuerst, Reihenfolge wie in ChurchTools), Ober- und
 * Untergruppen zum Weiterklicken, die Dienste der Gruppe und „In ChurchTools öffnen“. Modal in der Mitte (`Sheet`),
 * wie alle Fenster der Gemeinde-Apps.
 *
 * **Seit O5** (Alwin, 23.10.2026) für alle, die es in ChurchTools dürfen (`darfStruktur`): Obergruppe ändern, lösen,
 * eine weitere dazu, Untergruppe anlegen – mit Bestätigung (was sich an den Rechten ändert), Nachlesen und
 * „Rückgängig“ im Fenster. Leitungen dürfen das in ChurchTools nicht; sie sehen keine Knöpfe.
 */
export function GruppenFenster({
  start,
  knoten,
  mitglieder,
  onGruppe,
  onNachladen,
  onSchliessen,
  onStruktur,
}: Props) {
  const g = knoten.gruppe;
  const [modus, setModus] = useState<Modus>({ art: 'ansehen' });
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aenderung, setAenderung] = useState<Aenderung | null>(null);
  const darf = darfStruktur(start.rechte, g);
  const typen = darf ? anlegbareTypenAus(start.rechte, start.typNamen.keys()) : [];

  /** Einen neuen Schritt beginnen – die Meldung der letzten Änderung gehört dann nicht mehr dazu. */
  const beginnen = (m: Modus) => {
    setAenderung(null);
    setFehler(null);
    setModus(m);
  };
  /** Nach einer Änderung (oder einem Fehlschlag) den echten Stand zeigen; scheitert das Neuladen, sagen wir es. */
  const neuLaden = async () => {
    if (!(await onStruktur())) {
      setFehler(
        'Gespeichert – aber der Baum ließ sich gerade nicht neu laden. Bitte die Seite neu laden.',
      );
    }
  };
  /** Eine Änderung ausführen: schreiben, neu laden, „Rückgängig“ anbieten – oder den Fehler zeigen. */
  const ausfuehren = async (
    tun: () => Promise<unknown>,
    text: string,
    zurueck: (() => Promise<unknown>) | null,
  ) => {
    setArbeitet(true);
    setFehler(null);
    setAenderung(null);
    try {
      await tun();
      setAenderung({
        text,
        rueckgaengig: zurueck
          ? async () => {
              await zurueck();
            }
          : null,
      });
      setModus({ art: 'ansehen' });
      await neuLaden();
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
      setModus({ art: 'ansehen' });
      // Auch nach einem Fehlschlag: Was ChurchTools jetzt hat, zeigt der neu geladene Baum.
      await onStruktur();
    } finally {
      setArbeitet(false);
    }
  };
  const anlegen = async (name: string, typId: number) => {
    let neueId: number | null = null;
    await ausfuehren(
      async () => {
        const statusId = await ladeAktivStatus(g.statusId);
        if (statusId === null) throw new Error('ChurchTools nennt keinen Status „aktiv“.');
        neueId = await untergruppeAnlegen(z, { name, typId, statusId, elternId: g.id });
      },
      `„${name}“ ist angelegt.`,
      () => (neueId === null ? Promise.resolve() : gruppeWiederLoeschen(z, neueId)),
    );
  };
  const stand = mitglieder?.je.get(g.id);
  const rang = rollenRang(start.rollen);
  const person = (id: number) => mitglieder?.personen.get(id);
  const name = (id: number) => person(id)?.name ?? '';
  const liste = stand?.art === 'sichtbar' ? gruppenPersonen(stand.mitglieder, name, rang) : [];

  // Abschnitte je Rolle, in der Reihenfolge von ChurchTools
  const abschnitte: { rolle: string; ids: number[] }[] = [];
  for (const m of liste) {
    const rolle = (m.rolleId !== null ? start.rollen.get(m.rolleId)?.name : null) ?? 'Mitglied';
    const letzter = abschnitte[abschnitte.length - 1];
    if (letzter?.rolle === rolle) letzter.ids.push(m.personId);
    else abschnitte.push({ rolle, ids: [m.personId] });
  }

  const obergruppen = (start.eltern.get(g.id) ?? [])
    .map((id) => start.gruppen.find((x) => x.id === id))
    .filter((x) => x !== undefined);
  const dienste = start.dienste
    ? [...start.dienste.values()].filter((d) => d.gruppenIds.includes(g.id))
    : [];
  const typ = g.typId !== null ? start.typNamen.get(g.typId) : undefined;

  return (
    <Sheet title={g.name} onClose={onSchliessen} cancelLabel="Schließen">
      <div className={styles.kopf}>
        <GruppenKachel name={g.name} farbe={gruppenFarbe(g, start.typFarben)} groesse={40} />
        <p className={styles.meta}>
          {[typ, stand?.art === 'sichtbar' ? anzahl(liste.length, 'Person', 'Personen') : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {!mitglieder && <p className={styles.leise}>Mitglieder werden geladen …</p>}
      {stand?.art === 'verborgen' && (
        <p className={styles.leise}>
          Die Mitglieder dieser Gruppe darfst du in ChurchTools nicht sehen.
        </p>
      )}
      {stand?.art === 'fehler' && (
        <p className={styles.leise}>
          Die Mitglieder ließen sich gerade nicht laden.{' '}
          <button type="button" className={styles.link} onClick={onNachladen}>
            Erneut versuchen
          </button>
        </p>
      )}
      {stand?.art === 'sichtbar' && liste.length === 0 && (
        <p className={styles.leise}>Keine Mitglieder sichtbar.</p>
      )}

      {abschnitte.map((a) => (
        <section key={a.rolle} className={styles.abschnitt} aria-label={a.rolle}>
          <h3>
            {a.rolle} · {a.ids.length}
          </h3>
          <ul className={styles.personen}>
            {a.ids.map((id) => {
              const p = person(id);
              return (
                <li key={id}>
                  {p && <PersonBild name={p.name} bild={p.bild} initialen={p.initialen} />}
                  <span>{name(id)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {aenderung && (
        <RueckgaengigImFenster
          key={aenderung.text}
          aenderung={aenderung}
          onRueckgaengig={() => void neuLaden()}
        />
      )}
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}

      {modus.art === 'ansehen' && (obergruppen.length > 0 || knoten.kinder.length > 0 || darf) && (
        <section className={styles.abschnitt}>
          {(obergruppen.length > 0 || darf) && <h3>Gehört zu</h3>}
          {obergruppen.length === 0 && darf && (
            <p className={styles.leise}>Keiner Gruppe – „{g.name}“ ist ein eigener Bereich.</p>
          )}
          <div className={styles.gruppen}>
            {obergruppen.map((o) => (
              <span key={o.id} className={styles.mitAktion}>
                <button type="button" className={styles.gruppe} onClick={() => onGruppe(o.id)}>
                  <GruppenKachel
                    name={o.name}
                    farbe={gruppenFarbe(o, start.typFarben)}
                    groesse={20}
                  />
                  {o.name}
                </button>
                {darf && (
                  <>
                    <button
                      type="button"
                      className={styles.klein}
                      onClick={() => beginnen({ art: 'waehlen', zweck: 'aendern', alt: o })}
                    >
                      Ändern
                    </button>
                    <button
                      type="button"
                      className={styles.klein}
                      onClick={() => beginnen({ art: 'loesen', alt: o })}
                    >
                      Lösen
                    </button>
                  </>
                )}
              </span>
            ))}
          </div>
          {darf && (
            <button
              type="button"
              className={styles.dazu}
              onClick={() => beginnen({ art: 'waehlen', zweck: 'dazu' })}
            >
              {obergruppen.length ? '＋ Weitere Obergruppe' : '＋ Unter eine Gruppe hängen'}
            </button>
          )}
          {(knoten.kinder.length > 0 || typen.length > 0) && <h3>Untergruppen</h3>}
          <div className={styles.gruppen}>
            {knoten.kinder.map((k) => (
              <button
                key={k.gruppe.id}
                type="button"
                className={styles.gruppe}
                onClick={() => onGruppe(k.gruppe.id)}
              >
                <GruppenKachel
                  name={k.gruppe.name}
                  farbe={gruppenFarbe(k.gruppe, start.typFarben)}
                  groesse={20}
                />
                {k.gruppe.name}
              </button>
            ))}
          </div>
          {typen.length > 0 && (
            <button
              type="button"
              className={styles.dazu}
              onClick={() => beginnen({ art: 'anlegen' })}
            >
              ＋ Untergruppe anlegen
            </button>
          )}
        </section>
      )}

      {modus.art === 'waehlen' && (
        <ZielWaehlen
          start={start}
          gruppe={g}
          titel={
            modus.zweck === 'aendern'
              ? `Statt „${modus.alt.name}“ unter …`
              : `„${g.name}“ zusätzlich unter …`
          }
          onWahl={(neu) =>
            setModus(
              modus.zweck === 'aendern'
                ? { art: 'aendern', alt: modus.alt, neu }
                : { art: 'dazu', neu },
            )
          }
          onZurueck={() => setModus({ art: 'ansehen' })}
        />
      )}
      {modus.art === 'aendern' && (
        <Bestaetigen
          frage={`„${g.name}“ unter „${modus.neu.name}“ hängen statt unter „${modus.alt.name}“?`}
          folgen={`Rechte wirken in ChurchTools nach unten: Wer in „${modus.neu.name}“ ist, sieht danach auch „${g.name}“ samt Untergruppen; wer es nur über „${modus.alt.name}“ sah, sieht es nicht mehr.`}
          knopf="Umhängen"
          arbeitet={arbeitet}
          onZurueck={() => setModus({ art: 'ansehen' })}
          onJa={() => {
            const { alt, neu } = modus;
            void ausfuehren(
              () => obergruppeAendern(z, g.id, alt.id, neu.id),
              `„${g.name}“ hängt jetzt unter „${neu.name}“.`,
              () => obergruppeAendern(z, g.id, neu.id, alt.id),
            );
          }}
        />
      )}
      {modus.art === 'dazu' && (
        <Bestaetigen
          frage={`„${g.name}“ zusätzlich unter „${modus.neu.name}“ hängen?`}
          folgen={`Rechte wirken in ChurchTools nach unten: Wer in „${modus.neu.name}“ ist, sieht danach auch „${g.name}“ samt Untergruppen.`}
          knopf="Hinzufügen"
          arbeitet={arbeitet}
          onZurueck={() => setModus({ art: 'ansehen' })}
          onJa={() => {
            const { neu } = modus;
            void ausfuehren(
              () => obergruppeDazu(z, g.id, neu.id),
              `„${g.name}“ hängt jetzt auch unter „${neu.name}“.`,
              () => obergruppeLoesen(z, g.id, neu.id),
            );
          }}
        />
      )}
      {modus.art === 'loesen' && (
        <Bestaetigen
          frage={`„${g.name}“ von „${modus.alt.name}“ lösen?`}
          folgen={`${
            obergruppen.length === 1 ? `„${g.name}“ ist danach ein eigener Bereich. ` : ''
          }Wer „${g.name}“ nur über „${modus.alt.name}“ sah, sieht es danach nicht mehr.`}
          knopf="Lösen"
          arbeitet={arbeitet}
          onZurueck={() => setModus({ art: 'ansehen' })}
          onJa={() => {
            const { alt } = modus;
            void ausfuehren(
              () => obergruppeLoesen(z, g.id, alt.id),
              `„${g.name}“ hängt nicht mehr unter „${alt.name}“.`,
              () => obergruppeDazu(z, g.id, alt.id),
            );
          }}
        />
      )}
      {modus.art === 'anlegen' && (
        <Anlegen
          start={start}
          obergruppe={g}
          typen={typen}
          arbeitet={arbeitet}
          onAnlegen={(name, typId) => void anlegen(name, typId)}
          onZurueck={() => setModus({ art: 'ansehen' })}
        />
      )}

      {modus.art === 'ansehen' && dienste.length > 0 && (
        <section className={styles.abschnitt}>
          <h3>Dienste aus dieser Gruppe</h3>
          <p className={styles.dienste}>{dienste.map((d) => d.name).join(' · ')}</p>
        </section>
      )}

      <a className={styles.oeffnen} href={`${ctBasis()}/groups/${g.id}/dashboard`} target="_top">
        In ChurchTools öffnen
      </a>
    </Sheet>
  );
}
