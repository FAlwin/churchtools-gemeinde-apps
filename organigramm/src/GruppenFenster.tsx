import { useEffect, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { RueckgaengigImFenster } from '@ui/fenster/Rueckgaengig';
import type { Aenderung } from '@ui/fenster/aenderung';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { GruppenKachel } from '@ui/bedienung/GruppenKachel';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { ctBasis } from '@ui/ct/basis';
import { gruppenFarbe } from '@shared/organigramm/farbe';
import type { Knoten, OrgGruppe } from '@shared/organigramm/gruppen';
import {
  anlegbareTypenAus,
  darfStruktur,
  KEINE_GRUPPENRECHTE,
  mitgliederRechte,
  type GruppenRechte,
} from '@shared/organigramm/rechte';
import {
  aufnehmen,
  aufnehmenZurueck,
  beenden,
  beendenZurueck,
  rolleAendern,
} from '@shared/organigramm/mitgliedschaft';
import { heuteImKalender } from '@shared/ct/zeit';
import {
  gruppeWiederLoeschen,
  obergruppeAendern,
  obergruppeDazu,
  obergruppeLoesen,
  untergruppeAnlegen,
  weiterSichtbarUeber,
} from '@shared/organigramm/struktur';
import { rollenRang } from '@shared/organigramm/mitglieder';
import { gruppenPersonen } from '@shared/organigramm/personen';
import type { MitgliederDaten } from './ladeMitglieder';
import type { Start } from './start';
import { ladeAktivStatus, strukturZugriff as z } from './struktur';
import { Anlegen, Bestaetigen, ZielWaehlen } from './StrukturSchritte';
import { PersonAufnehmen, RolleWaehlen } from './MitgliedSchritte';
import { ladeGruppenRechte, mitgliedZugriff as mz } from './mitgliedschaft';
import styles from './GruppenFenster.module.scss';

const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

interface Props {
  start: Start;
  knoten: Knoten;
  mitglieder: MitgliederDaten | null;
  onGruppe: (id: number) => void;
  onNachladen: () => void;
  onSchliessen: () => void;
  /**
   * „Im Organigramm hier anfangen“ (O7b-2): diese Gruppe als Spitze des Baums. Fehlt, wenn es nichts darunter gibt
   * oder die Gruppe im Baum gerade nicht zu sehen ist (Typ ausgeblendet).
   */
  onHierAnfangen?: () => void;
  /** Gruppen und Hierarchie neu laden (nach einer Änderung) – `false`, wenn das gerade nicht ging. */
  onStruktur: () => Promise<boolean>;
  /** Die Mitglieder DIESER Gruppe neu laden (nach einer Änderung an ihnen, O6) – `false`, wenn das gerade nicht ging. */
  onMitgliederNeu: () => Promise<boolean>;
}

/** Was das Fenster gerade zeigt: die Gruppe – oder einen Schritt, der die Struktur ändert (O5). */
type Modus =
  | { art: 'ansehen' }
  | { art: 'waehlen'; zweck: 'aendern'; alt: OrgGruppe }
  | { art: 'waehlen'; zweck: 'dazu' }
  | { art: 'aendern'; alt: OrgGruppe; neu: OrgGruppe }
  | { art: 'dazu'; neu: OrgGruppe }
  | { art: 'loesen'; alt: OrgGruppe }
  | { art: 'anlegen' }
  | { art: 'aufnehmen' }
  | { art: 'rolle'; personId: number }
  | { art: 'austragen'; personId: number };

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
  onHierAnfangen,
  onStruktur,
  onMitgliederNeu,
}: Props) {
  const g = knoten.gruppe;
  const stand = mitglieder?.je.get(g.id);
  const [modus, setModus] = useState<Modus>({ art: 'ansehen' });
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aenderung, setAenderung] = useState<Aenderung | null>(null);
  const darf = darfStruktur(start.rechte, g);
  // ALLE Obergruppen aus der Hierarchie (auch unsichtbare) – EINE Quelle für „erste?“, „letzte?“ und „weiter sichtbar?“.
  const alleEltern = start.eltern.get(g.id) ?? [];
  const ohneObergruppe = alleEltern.length === 0;
  const typen = darf ? anlegbareTypenAus(start.rechte, start.typNamen.keys()) : [];

  // Mitglieder pflegen (O6): global ODER was die eigene Rolle in dieser Gruppe erlaubt. Die Rechte je Gruppe kommen nur
  // dann aus ChurchTools, wenn die globalen nicht schon alles erlauben. Nicht ladbar → nur die globalen (sicher zu).
  const global = mitgliederRechte(start.rechte, KEINE_GRUPPENRECHTE, g);
  const allesGlobal = global.aufnehmen && global.rolleAendern && global.beenden;
  const [intern, setIntern] = useState<GruppenRechte | 'laedt' | 'fehler'>(
    allesGlobal ? KEINE_GRUPPENRECHTE : 'laedt',
  );
  useEffect(() => {
    if (allesGlobal) return;
    let aktiv = true;
    ladeGruppenRechte(g.id).then(
      (r) => aktiv && setIntern(r),
      () => aktiv && setIntern('fehler'),
    );
    return () => {
      aktiv = false;
    };
  }, [g.id, allesGlobal]);
  const pflege =
    stand?.art === 'sichtbar'
      ? mitgliederRechte(start.rechte, typeof intern === 'string' ? KEINE_GRUPPENRECHTE : intern, g)
      : KEINE_GRUPPENRECHTE;
  // Was nach „Rückgängig“ neu geladen wird – dasselbe wie nach der Änderung selbst.
  const [ladenNachZurueck, setLadenNachZurueck] = useState<() => Promise<boolean>>(
    () => onStruktur,
  );

  /** Einen neuen Schritt beginnen – die Meldung der letzten Änderung gehört dann nicht mehr dazu. */
  const beginnen = (m: Modus) => {
    setAenderung(null);
    setFehler(null);
    setModus(m);
  };
  /** Nach einer Änderung (oder einem Fehlschlag) den echten Stand zeigen; scheitert das Neuladen, sagen wir es. */
  const neuLaden = async (laden: () => Promise<boolean>) => {
    if (!(await laden())) {
      setFehler(
        'Gespeichert – aber die Anzeige ließ sich gerade nicht neu laden. Bitte die Seite neu laden.',
      );
    }
  };
  /** Eine Änderung ausführen: schreiben, neu laden, „Rückgängig“ anbieten – oder den Fehler zeigen. */
  const ausfuehren = async (
    tun: () => Promise<unknown>,
    text: string,
    zurueck: (() => Promise<unknown>) | null,
    /** Was danach neu geladen wird: die Struktur (O5) oder die Mitglieder dieser Gruppe (O6). */
    laden: () => Promise<boolean> = onStruktur,
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
      setLadenNachZurueck(() => laden);
      await neuLaden(laden);
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
      setModus({ art: 'ansehen' });
      // Auch nach einem Fehlschlag: Was ChurchTools jetzt hat, zeigt die neu geladene Anzeige.
      await laden();
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
  // ── Mitglieder (O6) – danach nur die Mitglieder dieser Gruppe neu laden ──
  const personName = (id: number) => mitglieder?.personen.get(id)?.name ?? `Person ${id}`;
  const rollenName = (id: number | null) =>
    (id !== null ? start.rollen.get(id)?.name : undefined) ?? 'Mitglied';
  const personAufnehmen = (personId: number, anzeige: string, rolleId: number) => {
    let vorher: Awaited<ReturnType<typeof aufnehmen>> = null;
    void ausfuehren(
      async () => {
        vorher = await aufnehmen(mz, g.id, personId, rolleId);
      },
      `„${anzeige}“ ist jetzt in „${g.name}“ (${rollenName(rolleId)}).`,
      () => aufnehmenZurueck(mz, g.id, personId, vorher),
      onMitgliederNeu,
    );
  };
  const rolleSetzen = (personId: number, alt: number | null, neu: number) =>
    void ausfuehren(
      () => rolleAendern(mz, g.id, personId, neu),
      `„${personName(personId)}“ ist jetzt ${rollenName(neu)}.`,
      alt === null ? null : () => rolleAendern(mz, g.id, personId, alt),
      onMitgliederNeu,
    );
  const austragen = (personId: number) =>
    void ausfuehren(
      () => beenden(mz, g.id, personId, heuteImKalender()),
      `„${personName(personId)}“ ist ausgetragen – die Mitgliedschaft endet heute.`,
      () => beendenZurueck(mz, g.id, personId),
      onMitgliederNeu,
    );

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
                  <span className={styles.personName}>{name(id)}</span>
                  {modus.art === 'ansehen' && pflege.rolleAendern && (
                    <button
                      type="button"
                      className={styles.klein}
                      aria-label={`Rolle von ${name(id)}`}
                      onClick={() => beginnen({ art: 'rolle', personId: id })}
                    >
                      Rolle
                    </button>
                  )}
                  {modus.art === 'ansehen' && pflege.beenden && (
                    <button
                      type="button"
                      className={styles.klein}
                      aria-label={`${name(id)} austragen`}
                      onClick={() => beginnen({ art: 'austragen', personId: id })}
                    >
                      Austragen
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {modus.art === 'ansehen' && pflege.aufnehmen && (
        <button
          type="button"
          className={styles.dazu}
          onClick={() => beginnen({ art: 'aufnehmen' })}
        >
          ＋ Person aufnehmen
        </button>
      )}
      {stand?.art === 'sichtbar' && intern === 'fehler' && (
        <p className={styles.leise}>
          Deine Rechte für diese Gruppe ließen sich gerade nicht laden – Mitglieder pflegen geht
          hier erst nach dem Neuladen.
        </p>
      )}
      {modus.art === 'aufnehmen' && (
        <PersonAufnehmen
          start={start}
          gruppe={g}
          dabei={new Set(liste.map((m) => m.personId))}
          arbeitet={arbeitet}
          onAufnehmen={(p, rolle) =>
            personAufnehmen(p.personId, `${p.vor} ${p.nach}`.trim(), rolle.id)
          }
          onZurueck={() => setModus({ art: 'ansehen' })}
        />
      )}
      {modus.art === 'rolle' && (
        <RolleWaehlen
          start={start}
          gruppe={g}
          name={personName(modus.personId)}
          jetzt={liste.find((m) => m.personId === modus.personId)?.rolleId ?? null}
          arbeitet={arbeitet}
          onAendern={(rolle) =>
            rolleSetzen(
              modus.personId,
              liste.find((m) => m.personId === modus.personId)?.rolleId ?? null,
              rolle.id,
            )
          }
          onZurueck={() => setModus({ art: 'ansehen' })}
        />
      )}
      {modus.art === 'austragen' && (
        <Bestaetigen
          frage={`„${personName(modus.personId)}“ aus „${g.name}“ austragen?`}
          folgen="Die Mitgliedschaft endet heute; in ChurchTools bleibt sie in der Historie stehen. Über diese Gruppe sieht die Person danach nichts mehr."
          knopf="Austragen"
          arbeitet={arbeitet}
          onZurueck={() => setModus({ art: 'ansehen' })}
          onJa={() => austragen(modus.personId)}
        />
      )}

      {aenderung && (
        <RueckgaengigImFenster
          key={aenderung.text}
          aenderung={aenderung}
          onRueckgaengig={() => void neuLaden(ladenNachZurueck)}
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
          {onHierAnfangen && (
            <button type="button" className={styles.dazu} onClick={onHierAnfangen}>
              Im Organigramm hier anfangen
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
              : ohneObergruppe
                ? `„${g.name}“ unter …`
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
          folgen={`Rechte wirken in ChurchTools nach unten: Wer in „${modus.neu.name}“ ist, sieht danach auch „${g.name}“ samt Untergruppen; ${
            weiterSichtbarUeber(start.eltern, modus.alt.id, [
              modus.neu.id,
              ...alleEltern.filter((e) => e !== modus.alt.id),
            ])
              ? `wer in „${modus.alt.name}“ ist, sieht es weiterhin – „${modus.neu.name}“ liegt darunter.`
              : `wer es nur über „${modus.alt.name}“ sah, sieht es nicht mehr.`
          }`}
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
          frage={
            ohneObergruppe
              ? `„${g.name}“ unter „${modus.neu.name}“ hängen?`
              : `„${g.name}“ zusätzlich unter „${modus.neu.name}“ hängen?`
          }
          folgen={`Rechte wirken in ChurchTools nach unten: Wer in „${modus.neu.name}“ ist, sieht danach auch „${g.name}“ samt Untergruppen.`}
          knopf={ohneObergruppe ? 'Einhängen' : 'Hinzufügen'}
          arbeitet={arbeitet}
          onZurueck={() => setModus({ art: 'ansehen' })}
          onJa={() => {
            const { neu } = modus;
            void ausfuehren(
              () => obergruppeDazu(z, g.id, neu.id),
              ohneObergruppe
                ? `„${g.name}“ hängt jetzt unter „${neu.name}“.`
                : `„${g.name}“ hängt jetzt auch unter „${neu.name}“.`,
              () => obergruppeLoesen(z, g.id, neu.id),
            );
          }}
        />
      )}
      {modus.art === 'loesen' && (
        <Bestaetigen
          frage={`„${g.name}“ von „${modus.alt.name}“ lösen?`}
          folgen={`${alleEltern.length === 1 ? `„${g.name}“ ist danach ein eigener Bereich. ` : ''}${
            weiterSichtbarUeber(
              start.eltern,
              modus.alt.id,
              alleEltern.filter((e) => e !== modus.alt.id),
            )
              ? `Wer in „${modus.alt.name}“ ist, sieht „${g.name}“ weiterhin – über eine andere Obergruppe darunter.`
              : `Wer „${g.name}“ nur über „${modus.alt.name}“ sah, sieht es danach nicht mehr.`
          }`}
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
