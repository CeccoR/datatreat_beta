# Avvisi ed errori: revisione (v565 → v573)

Mappa rifatta dal codice di v565 (331 voci: 309 messaggi con testo, 3 flash, 4 solo tooltip, 15 casi muti). Sostituisce la revisione di v540: delle sue 79 proposte 73 valevano ancora, sono riprese qui sotto. I testi dell'interfaccia restano in inglese.

## Regole

**R1. Tipo: dice che cosa è successo ai dati.**

| Tipo | Quando |
|---|---|
| error ✕ | L'azione non ha prodotto nulla (file non caricato, raffinamento, export o integrazione falliti, valore rifiutato) oppure il risultato è sbagliato |
| warn ⚠ | Il risultato c'è, ma può essere sbagliato o incompleto e l'utente può controllare o correggere |
| info ⓘ | Scelta automatica o lettura corretta nel caso normale: da sapere, niente da fare |
| grigio | Stato, avanzamento, stato vuoto, come procedere. Mai un problema |

Solo questi quattro aspetti: via le righe ambra senza box, il testo rosso senza box, il "⚠" in una riga grigia, `alert()`. Nelle card il box compatto (stessa icona e colori, padding ridotto: `.alert.compact`; markup `boxHtml` in `alerts.js`, senza ×).

**R2. Posto.** Avvisi su un file: sotto la drop zone che lo ha ricevuto, un box per tipo, nell'ordine error → warn → info. Avvisi su un'analisi: nella card, sotto ciò di cui parlano, box compatti. Valore rifiutato: flash e, dove la regola non è ovvia, una riga rossa sotto il campo. Progetto, memoria del browser, altre finestre: banner in alto; domande: banner (finestra centrale solo prima di un lavoro lungo).

**R3. Durata.** Box dei file calcolati dai file presenti; la × marca quel file come visto e regge undo e redo. Rifiuti e "già caricato" valgono fino alla drop successiva, che li sostituisce anche quando fallisce. Box nelle card ricalcolati col risultato, senza ×. Banner: OK o ×.

**R4. Testo.**

| Caso | Intestazione | Riga |
|---|---|---|
| Rifiuto (error) | `Not loaded:` | `{file}: {reason}.` col motivo scritto dall'app, mai il messaggio grezzo del browser |
| Caricato, da controllare (warn) | `Loaded, to check:` | `{file}: {what happened}: {consequence}.` |
| Lettura neutra (info) | `How these files were read:` | `{file}: {how}.` |
| Doppione (info) | `Already loaded, not loaded again:` | `{file}.` |
| Riapertura con perdite o letture cambiate (warn) | `Opened, to check:` | `{file}: {what}.` / `{n} files left out: {why}.` |

Due punti tra nome e motivo, niente parentesi intorno al motivo, niente "—" né "!", niente numeri di versione, ogni riga col punto. Una cosa ha un nome solo (es. "the GC software's scale (k)"). In codice: `utils.js` FILE ALERTS (`fileAlertHtml`, `fileLine`, `NOT_READ`, `bytesOf`).

## Decisioni (U1–U8)

| U | Decisione |
|---|---|
| U1 | "Già caricato": ogni modulo tiene il suo criterio (nome, file sorgente, radice, contenuto); si unifica solo il testo |
| U2 | Mezza coppia: nella Calibration GC il file aspetta l'altra metà; in EPR è rifiutato, nel box `Not loaded:` col motivo (`its .DSC is missing: drop the two together.`) |
| U3 | Avvisi di lettura calcolati dai file presenti in tutti i moduli, × per file che regge undo/redo (X04, S04, D02) |
| U4 | Classificazione info/warn degli avvisi di Rietveld e CIF come in X11/X12; risultati salvati senza tipo letti come warn |
| U5 | Tassi negativi in GC: nessun nuovo avviso; domanda aperta all'utente (BACKLOG) |
| U6 | Assunzioni dello strumento: riga grigia coi soli fatti, sotto un box compatto info (neutre) e uno warn (possono essere sbagliate) |
| U7 | Vocabolario approvato: `Not loaded:`, `Loaded, to check:`, `How these files were read:`, `Already loaded, not loaded again:`, `Opened, to check:` |
| U8 | File persi alla riapertura: warn (il progetto si apre) |

## Modifiche

ID della mappa tra parentesi. Fase: 1 file illeggibile, 2 drop zone e testi, 3 card e righe di stato, 4 persistenza e risultati salvati.

### Condiviso

| ID | Modifica | Stato |
|---|---|---|
| C01 | Rifiuti (SH01 e motivi di tutti i moduli, GI27) → `Not loaded:` + `{file}: {reason}.` | fatto in v567 |
| C02 | Rifiuti senza motivo → GC `not a GC table: no injection date and H₂ or O₂ column under a header`, EPR `not a .DTA or .DSC file`, lettore che lancia `could not be read: {message}` | fatto in v567 |
| C03 | File illeggibile (sparito dal disco, permessi; SH06 IO02 SE18 GI41 XR13 EP02) → `{file}: could not be read from the disk (moved, deleted or not accessible).`, gli altri file della drop caricati | fatto in v567 (tutti i moduli, finestre Calibration e standard comprese) |
| C04 | Ogni drop sostituisce rifiuti e doppioni della drop precedente, anche quando fallisce | fatto in v567 |
| C05 | "Already loaded" (SH03 XR24 SE10 GI31) → info `Already loaded, not loaded again:` | fatto in v567 |
| C06 | Intestazione di default mai usata (SH02) → via (con `buildAlertsHtml`) | fatto in v567 |
| C07 | File persi alla riapertura (SH05 XR29 SE14) → warn `Opened, to check:` + `{n} files left out: {no data in the project \| their stored bytes no longer read}.` | fatto in v567 |
| C08 | `alert()` del download (SH08 SH09) → banner | fatto in v567 |
| C09 | Byte non più salvati (SH15 SH19 SH27 SH30, GI07) → una frase: `“{title}”: {n} of its files are not stored in this browser any more: {it opens \| it comes back \| the file holds them} without their bytes.` | fatto in v567 |
| C10 | `Project file list is empty.` → `No data loaded in {Module}.` | fatto in v567 |
| C11 | CSV dalla lista progetti, byte illeggibili → `“{title}” could not be exported: …` | fatto in v567 |
| C12 | `“{file}” is not a DataTreat project.` → `…: it cannot be read as one.` | fatto in v567 |
| C13 | `Are you sure to delete…` → `Delete project “{title}”? This cannot be undone.` | fatto in v567 |
| C14 | Salvataggio rifiutato da IndexedDB (muto) → banner `“{title}” could not be saved ({reason}): your work is still in its tab.` | fatto in v567 |
| C15 | Rinomina su un nome esistente, palette con nome esistente (muti) → domanda | fatto in v567 |
| C16 | Copy image fallito, compositore che non si carica (muti) → `Copy failed` accanto al bottone; banner | fatto in v567 |
| C17 | Testo rosso senza box (compositore, GI02, IO09) → error compatto | fatto in v571 (IO09: la retta che non è una retta; il campo senza numero va in C19) |
| C18 | `vNNN` nei testi (XR26–XR28 XS05 GI35 SH33 XE26) → `an older version` | fatto in v567 |
| C19 | Campo rifiutato: flash + riga rossa sotto il campo (GC10 GI14 XV32 IO09) | fatto in v571; flash generico (`guardNumericInput`, compositore, SEM): la regola in rosso sotto il campo, fluttuante (`flashFieldInvalid(el, rule)`, `numRule`) |

### XRPD

| ID | Modifica | Stato |
|---|---|---|
| X01 | `Loaded, with a caveat:` → info `How these files were read:` (più scansioni, tempi diversi, tempo stimato) + warn `Loaded, to check:` (scansione non letta, punti tolti, fattori o tempi mancanti) | fatto in v567 |
| X02 | Finestra dello standard: più file, più scansioni → info | fatto in v567; v573: calcolati dal file dello standard, × per file (sotto) |
| X03 | `Restored, with a caveat:` → `Opened, to check:`, senza vNNN | fatto in v567 |
| X04 | Avvisi di lettura calcolati dai file, × per file | fatto in v572 (dai byte letti: scansioni, note, scansioni non lette; `Opened, to check:` dal record, `oldData`; la riga dei file lasciati fuori resta della riapertura) |
| X05 | Riga dello strumento "— ⚠ …" → fatti in grigio + box compatti info/warn | fatto in v571 (`instrNoteKind`: info XI03–XI06 XI08 XI09 XI14, warn il resto) |
| X06 | Assunzione dello strumento detta subito (XE04) | fatto in v571 (tolto dai risultati alla vista, il motore lo scrive ancora); v572: non per un pattern riaperto senza i suoi byte (già detto dal banner) |
| X07 | Fallimenti nella riga di stato → error compatto | fatto in v571 (anche XV10: gave no profile e failed; stopped resta grigio) |
| X08 | `No phase ticked…` un testo solo | fatto in v571 |
| X09 | XV02 XV03 → info compatto | fatto in v571 |
| X10 | Profilo strumentale mancante detto una volta, warn | fatto in v571 (XE07 XE15 nel box; profilo rifiutato: solo l'elenco; tabella: titolo `(not corrected for the instrument)`); v572: riconosciuti dalla chiave del motore, le parole solo per i risultati salvati prima |
| X11 | Avvisi del raffinamento → box info/warn (tipo dato dal motore) | fatto in v572 (`{ kind, text }`, `xrd-math.js` MSG: info XE01 XE05 XE06 XE10 XE16–XE18 XE23–XE27, error XE21, warn il resto; salvati così; risultati senza tipo letti come warn; XV20 nel box warn, XV22 nei box; anche il lettore dei CIF e dello strumento danno il tipo, `instrNoteKind` resta per gli strumenti salvati prima, `cifNoteKind` tolto) |
| X12 | Avvisi dei CIF → box compatti per fase | fatto in v571 (`cifNoteKind`); v572: il tipo dal lettore dei CIF |
| X13 | XV37 → warn | fatto in v571 (nel box Structure) |
| X14 | Curva persa in silenzio (XV39) → warn | fatto in v571 |
| X15 | XS07 → warn | fatto in v571 |
| X16 | XS01 stile inline → txt-meta | fatto in v571 |
| X17 | XV32 → riga rossa sotto il campo (C19) | fatto in v571 |

### SEM, DRS

| ID | Modifica | Stato |
|---|---|---|
| S01 | `{file} — {reason}` → `{file}: {reason}.` | fatto in v567 |
| S02 | `Loaded, but check:` → `Loaded, to check:` | fatto in v567 |
| S03 | `⚠ narrowed to fit` → ⓘ, info | fatto in v567 |
| S04 | Avvisi calcolati dai file (non legati alla linea della storia) | fatto in v572 (l'avviso dell'immagine; rifiuti e doppioni restano della drop, per linea) |
| D01 | `Verify how these files were read:` → info `How these files were read:` (formati) + warn `Loaded, to check:` (punti tolti) | fatto in v567 |
| D02 | × per file che regge undo/redo | fatto in v572 |
| D03 | `…for the regression!` → `…for the regression.` | fatto in v567 |
| D04 | E_g o E_U negativi: warn → error | fatto in v567 |

### GC

| ID | Modifica | Stato |
|---|---|---|
| G01 | Date: info `{file}: dates read as day/month.` + warn `{file}: {n} rows left out: their injection date does not exist.` | fatto in v567 |
| G02 | Righe senza gas → riga a parte `{file}: {n} rows with no gas value left out.` | fatto in v567 |
| G03 | Export alternativo → `How these files were read:` + `{file}: the alternative export (Inject Time, Amount in ppm).` | fatto in v567 |
| G04 | Coppie da controllare: warn alla drop zone e tooltip; nella card Integration solo `{label}: shown here, no injection times.` in grigio | fatto in v567 |
| G05 | Sempre `{n} injections in the table, {m} chromatograms`; GC12 rimanda alla card Integration | fatto in v567 |
| G06 | Un nome: `the GC software's scale (k)`; GI13 via, i rischi nominati nelle righe di GC11 | fatto in v567 |
| G07–G12 | × che non regge (GI07 GI08), righe ambra → warn compatto, "Suspicious" in un colore, "Method changed" una volta, campi rifiutati (C19) | fatto in v571 (G07: ogni box della card Integration compatto, senza ×) |
| G13 | `Light-on time is before first injection` → `Light-on at or before the first injection: no point before light-on.` | fatto in v567 (vedi nota) |
| G14 | GI35 → `Opened, to check:` + `{file}: saved by an older version without its GC table: …`, con la sua × | fatto in v567; v573: la × marca il file e regge (sotto) |
| G15 | Results nascosta senza motivo → grigio `No rate to show: no sample's interval overlaps its injections.` sotto la card | fatto in v567 |

Nota G13: la proposta diceva "at or after"; la condizione del codice (nessuna iniezione prima dell'accensione) è "at or before", ed è quella scritta.

Trovati dopo la mappa, fatti in v571: (i) tabella GC con date ma nessun valore di gas → `no injection to read: {n} rows with an injection date and no gas value` (era "not a GC table…"; nella Calibration senza "neither… nor a GC table"); (ii) SE19 compositore SEM che non si carica → banner come C16; (iii) Calibration GC dopo un'integrazione fallita → error compatto col motivo (era "Stopped…").

### EPR, Iodometria

| ID | Modifica | Stato |
|---|---|---|
| E01 | Coppia rifiutata nominata dai file: `{stem}.DTA + {stem}.DSC: {reason}.` | fatto in v567 |
| E02 | Mezza coppia nel box `Not loaded:`: `{file}: its .DSC is missing: drop the two together.` (e simmetrico) | fatto in v567 |
| E03 | Senza MWFQ (muto) → info `{file}: no microwave frequency (MWFQ): plotted on the field measured, not at 9.5 GHz; no g axis.` | fatto in v567 |
| I01 | Coppie di colonne scartate (muto) → warn `{file}: {n} pairs of columns left out: fewer than 3 points.` | fatto in v567 |
| I02 | `none: click the plot` → `none` | fatto in v567 |
| I03 | Lettura oltre la fine della traccia, calibrazione incompleta: grigio → warn compatto | fatto in v567 |
| I04 | Meno di due standard: grigio → error compatto | fatto in v567 |

Custom non ha modifiche proprie: le prende da C01–C05.

## Fase 4 (v572): fatta

Persistenza (U3, R3): in ogni modulo gli avvisi di lettura sono note calcolate dai file presenti (`alerts.js`: `{ what, line, files }`, `notesFor`, `markSeen`; `utils.js` `notesHtml`; modkit `o.notes`); la × marca i file della sua box (`seen` nel record), in tutti gli stati della storia (`UndoStack.patch`, nessun passo), quindi regge undo e redo e si salva col progetto (una modifica da salvare, come un'etichetta). GC: i segni in memoria (`S.seen`) sostituiti dal record. Iodometria: le coppie di colonne lasciate fuori dalla tabella letta (`pairsOut`). EPR e DRS: niente più flag del modulo. X11 come sopra.

Restavano fuori, fatti in v573 (sotto): la box della finestra Calibration GC per le calibrazioni di v544–v548, gli avvisi della finestra dello standard XRPD, tre testi del motore con "—" (XE14, XE30, XE39).

## Residui della fase 4 (v573): fatti

| Cosa | Fatto |
|---|---|
| XE14 XE30 XE39 col "—" | `{fase}: where it is alone it shows n % of the intensity the fit gives it: its fraction rests mostly on peaks it shares.`; `{fase}: not detected: {perché}.` (i due punti in cui il motore lo scrive); `Not determined by the data (no esd): {parametri}: the pattern sees only a combination of {…}.` Trovato nello stesso giro e cambiato allo stesso modo: l'occupanza oltre 1 (`…alone can: a heavier species on it, …`). Golden: autorefine e stages cambiano solo in quelle stringhe (i loro dump, v572 con le stringhe sostituite, sono quelli di v573 byte per byte); gli altri tre testi non compaiono nei golden |
| Finestra dello standard XRPD (X02, R3) | Avvisi calcolati dal file dello standard presente (`xrd-html.js` `stdNotes`: scansioni, quella presa, note della sua scansione), nelle due finestre; × per file (`seen` nel record `std`, `inKeys(['std'])`), regge undo/redo e la riapertura; tolto lo standard, tolti gli avvisi. Restano della drop, nella finestra che l'ha ricevuta, il rifiuto e la riga `{n} files dropped: …` (nella box info), fino alla drop successiva, allo standard tolto o a un ripristino |
| Box della Calibration GC per v544–v548 (G14) | La × marca il file della calibrazione (`seen`, `gc-integ-model.js` `inCal`: la calibrazione della card in ogni stato della storia), senza passo; regge undo/redo, la finestra riaperta e il progetto riaperto. Golden integmodel: cambia solo la × di quella box (`data-action` al posto di `data-dismiss-alert`) |
| `seen` letto da un progetto | Tenuti solo i segni che lo sono (`alerts.js` `seenIn`, `keepSeen`: stringhe `check`, `read`, `opened`, sole o seguite da `:` e una chiave), una volta; il resto tolto. In tutti i ripristini: modkit (DRS, GC, EPR, Iodometria, Custom; in GC anche il file in coppia), XRPD (file e standard), SEM, la calibrazione GC |
| Segno legato al problema | Ogni nota può avere una `key`, il problema che nomina dove questo cambia restando il file (`alerts.js` `markOf`: `{box}:{key}`; senza key il nome della box, come in v572). La riga di una coppia GC ha `pair:{file in coppia}` o `alone`: rifatta male con un altro file, o lasciati soli i cromatogrammi, si dice di nuovo; la stessa coppia rifatta resta vista. Un segno di v572 (`check`) non nasconde più una coppia. Altri casi non ce ne sono: le altre note sono fissate dai byte del file (date, celle vuote, formati, scansioni, punti tolti, MWFQ, coppie di colonne, barra delle info SEM, ciò che ha trovato una riapertura) |
