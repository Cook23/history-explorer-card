# Revue indépendante — history-explorer-card 1.2.72 (`v1.2-dev`, commit 39f242b)

Revue en lecture seule, faite le 2026-11-12. Aucun fichier du dépôt modifié, rien commité.
Rapport destiné à être remis tel quel à un modèle chargé des corrections. La section 4 (propositions de correction) a été ajoutée à la demande de l'utilisateur, après la revue.

## 1. Synthèse

### État de la suite de tests, avant analyse

| Passe | Résultat |
|---|---|
| `lint`, `architecture`, `store` (lancés d'abord) | 81 réussis, 0 échec |
| Suite complète, 1re passe (`lint` … `features`, début de `panel`) | 391 réussis, 0 échec, interrompue par un redémarrage du conteneur |
| Suite complète, reprise (`panel` … `menus`) | 607 réussis, 0 échec |
| Ignoré | 1 : `yscale` « a real month of history » (fichier privé `tests/data/history-month.csv` absent de la machine) |

Aucun échec. Le build (`yarn build`) reproduit octet pour octet le fichier `history-explorer-card.js` commité. La version 1.2.72 est la même dans `package.json`, `src/version.js`, le fichier construit et la section de tête du CHANGELOG.

### Périmètre réellement lu

Tous les `.md` (CLAUDE, BRANCH, ARCHITECTURE, README, README_Full, CHANGELOG en tête, FORK_DESCRIPTION, tests/README, `deps/Chart Custom.js.md`), les 31 fichiers `src/*.js` en entier, `deps/chart-hec.js` en entier, les tests `architecture`, `yscale`, `points`, `mouse`, `features`, `pen`, `lib`, `mock-ha`. Six sondes temporaires ont été écrites hors dépôt (scratchpad de la session) ; le dépôt est intact (`git status` vide).

### Non examiné

Le fork Chart.js 2.7.1 lui-même (hors `chart-hec.js`) ; la branche `v1.1-legacy` ; le rendu réel sur la tablette (les quatre rapports Performance de l'utilisateur en tiennent lieu : téléphone 1 an, tablette 3 j et 24 h, PC 5 ans).

### Les rapports Performance de l'utilisateur, en deux lignes

Ils sont conformes aux règles de chargement de BRANCH.md (phases, blocs, ordre écran d'abord, sources par colonne, apprentissage des historiques vides). Ils apportent trois faits exploités ci-dessous : le gel « Back on the page » égal au temps d'absence (R10, trois fois), les rafales de redessins « a graph come near the screen » sans mouvement de page (R12), et la fenêtre de 5 ans gelée 43 à 76 % du temps avec un cache de 705 959 lignes (R13).

## 2. Constats, par gravité décroissante

Les identifiants (R01…R13) sont stables ; l'ordre ci-dessous est celui de la gravité.

### R01 — Dépassement de pile dans `_autoYAxis` quand une courbe a ≥ 130 000 voisins en cache

- **Fichier** : `src/card-charts.js:466` (`curves.get(j)?.push(...a)`), `:470`.
- **Catégorie** : logique.
- **Description** : les valeurs voisines d'une courbe (`_yScaleNeighbours`, jusqu'à HORIZON fenêtres de chaque côté) sont injectées dans `push()` par un spread. V8 limite les arguments d'un appel (dans ce Chromium : 100 000 passent, 130 000 échouent). Au-delà, `RangeError: Maximum call stack size exceeded`, et le redessin s'arrête net.
- **Comportement attendu** (BRANCH.md phase 2 : « the Y axis worked out here when there was no phase 1 » ; ARCHITECTURE.md : la carte calcule les axes depuis le cache) : l'axe automatique se calcule quel que soit le nombre de lignes en cache.
- **Statut** : prouvé par un test.
- **Preuve** (sonde `probe6` : capteur toutes les 2 s, fenêtre 3 j, statistiques désactivées, 60 s pour que l'arrière-plan remplisse les côtés) :

  ```
  rows: 284301, neighbours: [129672], loading: false
  redraw: ERR Maximum call stack size exceeded @ at ao._autoYAxis
  pageErrors: ["Maximum call stack size exceeded"]  (spontanée, sans le redessin demandé)
  ```

  Même pattern à `src/card-history.js:1111` et `:1185` (`rows.push(...(this.cache[i][layer].get(id) ?? []))`), par créneau d'un jour : plus petit, mais sans borne non plus (un capteur à 1 s donne 86 400 lignes par jour).
- **Sur la carte de l'utilisateur** : non atteint dans les rapports. La fenêtre 24 h de la tablette charge 7 315 valeurs pour 35 entités ; 3 j et 1 an tracent les capteurs rapides depuis les statistiques. Le seuil est à 130 000 lignes d'une même courbe dans fenêtre ± HORIZON.
- **Vérification attendue** : un test `yscale` avec un capteur dense (≥ 130 000 lignes dans fenêtre ± voisinage), un redessin après le remplissage de l'arrière-plan : aucune erreur de page, un axe calculé ; le même pour `cachedHistory` sur un jour dense.
- **Dépendances** : aucune.

### R02 — La boîte élastique ne zoome pas sur « la durée ronde qui la couvre » : une liste écrite à la main, à trous, qui rétrécit parfois

- **Fichier** : `src/card-timerange.js:452` (commentaire : « the nearest preset covering it »), `:468-491`.
- **Catégorie** : logique + écart doc-code + test faible.
- **Description** : au-delà de 12 h, une cascade `if` codée à la main. Avec `d` = jours arrondis au supérieur : 8 à 12 j → 168 h (1 semaine, plus court que la boîte) ; 15 à 19 j → 2 semaines ; 22 à 27 j → 3 semaines ; 31 à 44 j → 30 j ; 92 à 104 j → 91 j ; ≥ 105 j → 182 j quelle que soit la boîte (300 j → 6 mois). La branche `d < 1 → 12 h` après `ceil(d/24)` est du code mort (`d ≥ 12` implique `ceil(d/24) ≥ 1`). Sous 12 h la durée n'est pas un « preset » mais l'heure arrondie.
- **Comportement attendu** (README_Full l.142 : « the round duration that covers it, centred on it ») : la durée obtenue couvre toujours la boîte.
- **Statut** : certain à la lecture (la table ci-dessus se lit directement dans le code) ; constaté aussi par la sonde `probe1` de la première passe.
- **Test faible** : `tests/mouse.cjs:215` ne vérifie que `span(r1) < span(r0)` (la fenêtre a rétréci), jamais qu'elle couvre la boîte.
- **Vérification attendue** : pour une série de boîtes (10 j, 15 j, 25 j, 40 j, 100 j, 300 j), la fenêtre obtenue contient `[st0, st1]`. Liste des durées écrite une fois comme constante nommée (ARCHITECTURE règle 3, `lists-once`).
- **Dépendances** : aucune.

### R03 — Les défauts de niveau carte sont figés dans les entrées persistées ; un changement de YAML est alors ignoré, et pas de la même façon pour chaque option

- **Fichier** : `src/card-graphs.js:598` (`e.width = e.width ?? entityOptions?.lineWidth ?? this.pconfig.defaultLineWidth`), lignes voisines pour les autres champs ; `src/card-storage.js:233` (ce qui est écrit).
- **Catégorie** : logique + architecture (STANDARD).
- **Description** : `_applyEntityDefaults` résout le défaut carte dans l'entrée de l'entité, qui est ensuite sauvegardée telle quelle. Au rechargement, la valeur sauvée gagne sur un YAML modifié.
- **Preuve** (sonde `probe4` B, `enable_persistence: entities`) :

  ```
  avant :                 entryWidth 2, drawnWidth 2 (clés sauvées : …,width)
  YAML lineWidth: 6, dashMode: shortlines, rechargé :
                          entryWidth 2, drawnWidth 2, entryDash "shortlines"
  localStorage vidé :     entryWidth 6, drawnWidth 6
  ```

  `dashMode` est repris (il n'était pas sauvé) ; `width` ne l'est pas (il l'était). Deux options de même famille, deux comportements.
- **Comportement attendu** (CLAUDE.md Persistence : « By default the YAML is the source of truth » ; STANDARD : « same storage, same persistence rules, same defaults ») : un défaut de carte n'est le choix de personne ; seul un choix fait pour l'entité est persisté, le défaut se résout au tracé. C'est une lecture de CLAUDE.md, à confirmer par l'utilisateur : la règle « last one to speak wins » entre images YAML/HA/local pourrait aussi se lire comme couvrant ce cas.
- **Statut** : comportement prouvé ; règle attendue : à confirmer.
- **Vérification attendue** : avec persistance, changer `lineWidth` (et chaque défaut de même famille) dans le YAML change la courbe au rechargement, sauf si l'entité a son propre choix.
- **Dépendances** : à décider avec R06 (ce qui est écrit).

### R04 — `statistics.period: 5minute` : une valeur non documentée qui contourne la sonde de validité

- **Fichier** : `src/card-history.js:884` (`_probing` vide dès qu'aucune source n'est de kind `fine`) ; README_Full l.1158 (« hour, day or month »).
- **Catégorie** : écart doc-code + logique.
- **Description** : avec `period: 5minute`, la sonde n'est pas faite, aucun verdict n'est gardé, et les statistiques 5 min d'un capteur que la sonde juge invalide sont demandées et tracées.
- **Preuve** (sonde `probe4` C, capteur à 1 valeur/h, fenêtre 7 j) :

  ```
  5minute : requests [frontend, recorder:5minute, history], fineValid true,  probeKept null, statsPoints 182, source "stats"
  default : requests [frontend, history, recorder:hour],   fineValid false, probeKept {fine:false,hour:false}, statsPoints 0, source "fine"
  ```

- **Comportement attendu** (README_Full l.1134 : « 5-minute statistics not valid are never used: neither drawn nor exported ») : la règle vaut pour toute valeur de `period`, ou la valeur `5minute` est refusée comme les autres valeurs inconnues.
- **Statut** : prouvé par un test.
- **Vérification attendue** : avec `period: 5minute` et un capteur invalide pour 5 min, aucun `recorder:5minute` ; ou une valeur rejetée avec avertissement.

### R05 — Le placement circulaire dans Chart.js prend une moyenne vectorielle, interdite par CLAUDE.md

- **Fichier** : `deps/chart-hec.js:720-722` (`sS += Math.sin(...)`, `atan2(sS, sC)`), `:736` (`mean = sum / (last - first + 1)` sur les valeurs déroulées).
- **Catégorie** : écart doc-code (règle « lowpass_dt est la référence »).
- **Description** : `Chart.hecCircular.place` calcule le centre du tour par `atan2` des sommes de sinus et cosinus (sans pondération par la durée), puis une moyenne arithmétique des valeurs déroulées. CLAUDE.md §4 : « lowpass_dt's algorithm is the one to use — never another one (no sin/cos vector mean, no mean of unwrapped values) ».
- **Nuance** : ce centre sert à choisir le tour d'affichage (`base`), pas une valeur montrée à l'utilisateur ; `history-stats.js` et `card-datasets.js` appliquent bien la règle lowpass_dt pour les moyennes affichées. Reste que la règle est écrite sans exception et que deux algorithmes coexistent pour « la moyenne d'un angle ».
- **Statut** : certain à la lecture.
- **Vérification attendue** : l'utilisateur décide si le placement est une « moyenne » au sens de la règle. Si oui, un test où les deux méthodes divergent (valeurs inégalement espacées dans le temps) vérifie que le tour choisi suit la règle lowpass_dt.

### R06 — Les champs « confort de visualisation » sont envoyés dans les données utilisateur de Home Assistant

- **Fichier** : `src/card-storage.js:225-247` (`writeLocalState` : `data = this._keepLocal()` puis `frontend/set_user_data` avec `data` entier).
- **Catégorie** : écart doc-code (Persistence).
- **Description** : le même objet est écrit en localStorage et envoyé à HA ; il contient les champs locaux (`hidden`, `showPoints`, modes tooltip, `yAxisLock`, `exportStatsPeriod`) et les images `yaml_*` / `ha_*`. À la lecture, `_resolveEntity` ignore les champs locaux venus de HA (ENTITY_FIELD_SCOPE), donc l'effet visible est nul ; mais CLAUDE.md dit « kept on this device, never synced » et ce qui est stocké chez HA contredit « never ».
- **Statut** : certain à la lecture (les tests `store` passent : ils vérifient la lecture, pas le contenu envoyé).
- **Vérification attendue** : un test `store` qui inspecte le payload de `set_user_data` : aucun champ de LOCAL_ONLY_FIELDS, aucune image.
- **Dépendances** : R03.

### R13 — Fenêtre de 5 ans : la page gelée 43 à 76 % du temps, un gel de 10,5 s inexpliqué, un cache au-delà de sa limite

- **Source** : rapport Performance PC de l'utilisateur (3072 px, Chrome 157), fenêtre 1825 j, colonne 977 min.
- **Catégorie** : logique (performance) ; écart doc-code pour la limite.
- **Faits** : 705 959 valeurs chargées ; redessin complet 767 à 951 ms dont la carte 528 à 547 ms (lecture du cache 284 à 335 ms, points 195 à 227 ms) ; 52 redessins pendant le chargement, 6,7 s ; 11 gels, 15,5 s (43 %), le plus long 10 473 ms ; `<` ×3 : 73 % gelé ; drag de 8 pas : 76 % gelé, 1,1 s par pas.
- **Lecture du code** :
  - `_purge` (`src/card-history.js:1016-1036`) ne purge que les créneaux hors `[t0 − r, t1 + r]`. Fenêtre de 5 ans avec 4 ans de données : rien n'est hors de cette plage, le cache reste à 705 959 > CACHE_MAX_ROWS 500 000, et `cacheRows()` est recalculé à chaque réponse. README_Full : « kept under a number of rows, the least useful purged » — faux dans ce cas. Certain à la lecture.
  - Le gel de 10,5 s n'est couvert ni par les redessins (max 1 021 ms) ni par les mises en cache (217 ms en tout) : une étape non mesurée. Suspecté : le traitement des réponses hourly de 33 000 lignes (parse, `_cacheVersion`, exports' probes), ou GC. Trois requêtes « took 10.8–10.9 s » coïncident : le temps mesuré inclut le gel.
  - Chaque redessin relit le cache et recalcule tous les points des graphes concernés (`generateGraphDataFromCache` → `cachedHistory` par entité → `buildChartData`) : la part carte croît avec le cache, pas avec ce qui a changé.
- **Statut** : faits observés (rapport de l'utilisateur) ; limite du cache non tenue : certain à la lecture ; cause du gel de 10,5 s : suspecté.
- **Vérification attendue** : un test de charge (mock `historyDays`, 35 entités, 5 ans, 3000 px) mesurant le gel le plus long et le nombre de lignes après chargement (≤ CACHE_MAX_ROWS ou la doc corrigée) ; `perf.add` autour du traitement d'une réponse pour nommer l'étape de 10 s.

### R10 — Le test de performance compte le temps « page cachée » comme un gel

- **Fichier** : `src/card-tests.js:452` (le `setInterval` du pouls : tout écart > PERF_FREEZE_MS + PERF_TICK_MS devient un gel).
- **Catégorie** : test faible (l'outil de mesure).
- **Description** : un onglet en arrière-plan voit ses timers bridés (Chrome : 1/s, puis 1/min). Les rapports : « froze 29175 ms » (téléphone), « 59034 ms » après 59,1 s d'absence, « 36985 ms » après 37,0 s, et sur PC 21 gels de ~950 ms chaque seconde puis « 39715 ms ». Ce sont les absences, pas des gels.
- **Comportement attendu** : un gel est mesuré page visible seulement (`document.visibilityState`), ou la section « Back on the page » exclut l'absence.
- **Statut** : certain à la lecture, confirmé par quatre rapports.
- **Vérification attendue** : un test qui masque la page 3 s (`visibilitychange` / CDP) : aucun gel enregistré.

### R12 — « a graph come near the screen » étiquette aussi les graphes hors écran dessinés « quand la page est libre »

- **Fichier** : `src/card-history.js:466` (`_drawStaleSoon` appelle `generateGraphDataFromCache(REDRAW_CAUSES.near, …)`), `src/card-charts.js:1073` (le vrai « near »).
- **Catégorie** : écart doc-code (le rapport ment) + observation.
- **Description** : les rapports montrent 14 à 15 redessins « near the screen » après chaque rafale de réponses, page immobile : ce sont les 14 graphes hors écran (24 − 10) redessinés un à un après ceux de l'écran. Sur 30 s de temps réel : 42 « near » = 3 rafraîchissements × 14. L'étiquette a trompé la lecture des deux premiers rapports (lus comme des défilements).
- **Comportement attendu** : une cause distincte (« a graph off the screen, drawn after those on it ») ou la doc du rapport le dit.
- **Statut** : certain à la lecture.
- **Observation liée** : les 14 graphes hors écran sont bien redessinés à chaque rafraîchissement (toutes les ~9 s sur la tablette, 10 à 20 ms chacun). C'est conforme à README_Full l.1138. À l'utilisateur de dire si un graphe hors écran doit être redessiné à chaque rafraîchissement ou seulement quand il revient.

### R08 — Des défauts métier écrits hors de leur famille (ARCHITECTURE règle 9)

- `src/history-explorer-card.js:520` : `config.uiColors?.closeButton ?? '#0000001f'` ; `:167-169` couleurs en dur dans `applyTheme`.
- `src/card-config.js:340` : `?? { action: 'more-info' }` ; `:323` : `?? 'auto'` pour l'axe Y.
- **Catégorie** : architecture. **Statut** : certain à la lecture. Non vu par `tests/architecture.cjs` (pas de règle « un littéral de défaut hors OPTION_DEFAULTS ») : c'est le cas « a deviation the test can't see » de CLAUDE.md, qui demande une règle.
- **Vérification attendue** : ces défauts dans `OPTION_DEFAULTS` / les couleurs par défaut ; une règle `architecture` qui repère `?? '<littéral>'` sur une option.

### R09 — Une implémentation en double et du code mort

- `src/card-config.js:34` `getEntityOptionsPure` et `:205` `getEntityOptions` : deux implémentations de la même résolution (règle 3).
- `src/history-info-panel.js:281-283` : `entityOptions` et `type` calculés, non utilisés ; `:98` `labelAreaWidth = … ? 0 : 55`, littéral hors famille.
- **Statut** : certain à la lecture. **Vérification** : une seule implémentation ; `lint` signale les variables inutilisées (vérifier sa config : elle ne les a pas vues).

### R07 — Écarts de documentation

- ARCHITECTURE.md l.60 : « the sparse ones' last 8 hours » ; code `PROBE_LONG_MS = 24 h` (`src/card-history.js:68`), README_Full l.1134 dit 24 h. Doc ARCHITECTURE fausse.
- ARCHITECTURE.md l.60, ordre de l'arrière-plan : « angle's history, then sides, then the exports' probes » ; code `_background` (l.986-1011) : angles, exports' probes, sides. BRANCH.md suit le code. Deux docs, deux ordres.
- Le rapport Performance affiche « phase 3 » (PHASE_SIDES) ; aucune doc ne nomme une phase 3.
- README_Full ne dit pas que `defaultTimeRange` est arrondi au preset (`'36h'` → 48 h, documenté seulement par `tests/features.cjs:133`).
- FORK_DESCRIPTION.md et `tests/README.md` (liste des suites) ne correspondent plus à `tests/run.cjs`.
- **Statut** : certain à la lecture.

### R11 — Points bas

- `mapStartTimeToCacheSlot` (`src/card-history.js:265`) et `_slotAt` (`:595`) : deux conversions temps → créneau (règle 3).
- La liste des noms de tirets (dash) écrite deux fois (`card-graphs.js` et `history-options.js`), non vue par `lists-once` car l'une est dans un objet.
- Sonde de validité : `d < gap` strict (`_speaks`). Un capteur exactement à 240 s (`sensor.sun_azimuth`, visible dans le rapport téléphone) bascule d'un verdict à l'autre selon la minute : « 5 min valid » sur la tablette (sondée 09:21) et « not valid » sur le PC (14:57). Cinq autres entités diffèrent aussi entre les deux appareils (`prioritaires`, `solar_irradiance`, `puissance_2`, `ev_2`, `ev_3`) : le verdict est un instantané d'une heure, conforme à la doc (« once a session »), mais la même carte se trace alors depuis des sources différentes selon l'appareil. Suspecté pour la cause du seuil, observé pour la divergence.
- Pas de constat sur `rangeIndex` reconstruit à chaque redessin : les rapports montrent la part carte à 11 à 26 ms sur la tablette ; le coût n'est significatif qu'à 5 ans (R13).

## 3. Points examinés sans constat

- **Chargement par phases** contre les quatre rapports : phase 1 absente à 3 j et 24 h (72 points horaires < 100, conforme), blocs d'un jour depuis la droite, la queue des statistiques 5 min demandée en history pour les 9 entités concernées, les graphes de l'écran servis avant les autres, `<`/`>` servis par le cache, côtés en arrière-plan, historiques vides mémorisés (`_histFrom`) à 5 ans après deux blocs à 0 valeur.
- **Rafraîchissement automatique** : une requête « background history +1.6 d → +1.6 d, 34 entités, 34 valeurs » quand la fenêtre ne contient pas le présent (rapport 24 h après `>`). Non tracée dans le code (valeurs courantes probables) ; signalée sans verdict.
- **Règle des silences** (`_applySilencePlateaus`) : identique à la règle commune de lowpass_dt ; les différences (seed médiane, pas de cap `tau`) sont celles que CLAUDE.md documente.
- **`circular`** : parsing (`OPTION_VALUES.circular`) et auto-détection conformes à la règle 1 ; attributs conformes à la règle 3.
- **Moyennes circulaires affichées** (`history-stats.js`, `card-datasets.js`) : la règle lowpass_dt (itération sur `wrap`, pondération par la durée).
- **Persistance** : fusion « last one to speak » des trois images, KEPT_KEYS / DERIVED_KEYS, purge à version nouvelle, `stored-keys` : conformes, suite `store` verte.
- **Picking** (`_hecPickNearest`, PICK_BETWEEN, marge élargie par la taille), **hover stylet** (`hecUi.hover`, `penHover` 500 ms, type lu sur les moves), **tooltips X-et-Y / X seul** : conformes à CLAUDE.md ; les tests de régression 1.2.44 sont présents dans `tests/points.cjs`.
- **Menus** : la cascade, la largeur du dernier item, la fermeture au défilement, un seul code path : conformes, suite `menus` verte à 400 et 1000 px.
- **Icônes flottantes** : aucune réservation de place ; `_hecIconMargin` = ½ max(souris, doigt).
- **Architecture** : `node tests/run.cjs lint architecture` vert ; les frontières carte / Chart.js / opérations respectées dans ce qui a été lu, hors R08 et R09.
- **Versions** : 1.2.72 cohérent partout ; CHANGELOG daté, sans `[Unreleased]`.

## 4. Propositions de correction

Ajoutées à la demande de l'utilisateur, après la revue. Ce sont des propositions : rien n'a été codé. Chacune dit dans quelle partie la correction va (ARCHITECTURE.md), la règle qu'elle suit, et le test de non-régression attendu. Les extraits sont des esquisses, pas du code final. Là où une décision revient à l'utilisateur (règle « Code what is asked » de CLAUDE.md), elle est nommée **Décision**.

### R01 — `_autoYAxis` : plus de spread dans `push()`

- **Partie** : `src/card-charts.js` (l'axe automatique) et `src/card-history.js` (la lecture du cache) ; un seul utilitaire.
- **Règle** : une implémentation (ARCHITECTURE règle 3) ; un cas général, pas une rustine sur `_autoYAxis` seul.
- **Proposition** :
  1. Un utilitaire `appendAll(dst, src)` écrit une fois (dans le module des utilitaires de tableaux déjà existant, ou `card-history.js` s'il n'y en a pas), une boucle `for…of` sans spread :
     ```js
     // Appends every element of src to dst — never push(...src): V8 limits an
     // argument list to ~100 000 entries, a dense curve's rows exceed it
     export const appendAll = (dst, src) => { for( const v of src ) dst.push(v); return dst; };
     ```
  2. Remplacer les trois spreads sur des tableaux de lignes : `card-charts.js:466` (`curves.get(j)?.push(...a)`), `card-history.js:1111` et `:1185` (`rows.push(...(this.cache[i][layer].get(id) ?? []))`).
  3. Les spreads sur des listes d'identifiants (`card-history.js:938`, `:968`, `:1000`, `card-graphs.js:175`) sont bornés par le nombre d'entités ; les remplacer aussi pour n'avoir qu'une façon de faire, ou les laisser : au choix de l'utilisateur. Une règle `architecture` « pas de `.push(...` dans `src/` » (regex `\.push\(\.\.\.`) empêche le retour du pattern ; elle n'est tenable que si tous sont remplacés.
- **Test** : dans `tests/yscale.cjs`, un capteur à 1 s (`historyStep: 1`), une fenêtre de 3 jours, statistiques désactivées, attendre que `_yScaleNeighbours` dépasse 130 000 lignes (sonde `probe6` comme modèle), puis `generateGraphDataFromCache` : pas d'erreur de page, `chart.scales['y-axis-0'].min/max` finis.

### R02 — La boîte élastique prend le premier preset qui la couvre, depuis `TIME_RANGES`

- **Partie** : `src/card-timerange.js` `zoomToSelection`.
- **Règle** : une liste écrite une fois (règle 3, `lists-once`) : `TIME_RANGES` dans `history-options.js` existe déjà et sert au sélecteur et à la loupe ; la cascade `if` est cette même liste réécrite à la main, incomplète.
- **Proposition** : la durée de la boîte en heures (fractionnaire), puis le premier `TIME_RANGES[k].hours` qui lui est supérieur ou égal ; sous une heure, les minutes arrondies au supérieur (déjà le cas) ; au-delà du plus grand preset, la durée elle-même arrondie au jour supérieur (elle couvre toujours).
  ```js
  const hours = dt / 60;
  if( hours < 1 ) { this.applyTimeRangeMinutes(Math.ceil(dt), true, tm); }
  else {
      const r = TIME_RANGES.find(x => x.hours >= hours);
      this.applyTimeRange(r ? r.hours : 24 * Math.ceil(hours / 24), true, tm);
  }
  ```
  **Décision** : la liste de la loupe exclut les presets `step: false` (2 h, 6 h, 12 h sont `step: true`, les autres heures non) ; faut-il filtrer de même ici (`ranges` de la ligne 14 du fichier) ou prendre tous les presets ? Le résultat couvre dans les deux cas ; la finesse change (une boîte de 3 h 10 → 4 h ou 6 h).
- **Test** : `tests/mouse.cjs`, pour des boîtes de 3 h, 10 j, 15 j, 25 j, 40 j, 100 j, 300 j, 6 ans : `startTime ≤ st0` et `endTime ≥ st1`, et la durée obtenue appartient à `TIME_RANGES` (ou est un nombre entier de jours au-delà). Le test actuel (`span(r1) < span(r0)`) reste, complété.

### R03 — Les défauts de carte résolus au tracé, jamais écrits dans l'entrée

- **Partie** : `src/card-config.js` (la résolution d'une option à ses niveaux : la chaîne entité → graphe → `entityOptions` → carte existe déjà dans `resolveYAxis` et `tapActionOf`) ; `src/card-graphs.js` `_applyEntityDefaults` ; `src/card-datasets.js` (le tracé lit la valeur résolue).
- **Règle** : « Every option may be at every level — the most precise one always wins » (CLAUDE.md) ; STANDARD : même mécanisme pour `width`, `dashMode`, `fill`, `showPoints`, `lineMode`… ; Persistence : le YAML source de vérité par défaut.
- **Proposition** :
  1. Une fonction unique `resolveOption(entity, graph, name)` dans `card-config.js`, qui applique la chaîne entité → graphe → `entityOptions` → carte → `OPTION_DEFAULTS[name]`. `resolveYAxis` et `tapActionOf` deviennent des appels à elle (une implémentation).
  2. `_applyEntityDefaults` ne remplit plus que l'identité de l'entrée (entité, type, groupe, index) ; les champs d'apparence restent `undefined` tant que l'utilisateur n'a rien choisi (menu, sélecteur).
  3. Le tracé (`buildChartData` / `card-datasets.js`) lit `resolveOption(e, g, 'lineWidth')` etc. au lieu de `e.width`.
  4. Ce qui est sauvé ne contient alors que des choix : un YAML modifié s'applique partout où rien n'a été choisi.
- **Décision (pas de rustine pour un cas particulier)** : les entrées déjà sauvées chez les utilisateurs contiennent les défauts figés (`width: 2`…). Après la correction elles seront lues comme des choix : un `lineWidth` changé dans le YAML ne s'appliquera pas chez eux tant que l'entrée sauvée existe. Trois issues, à trancher par l'utilisateur, aucune à coder seul : (a) l'accepter et le dire dans le CHANGELOG ; (b) à la version nouvelle (`versionIsNew`), oublier des entrées sauvées les champs égaux à l'ancien défaut (une migration unique, explicite, pas une exception permanente) ; (c) purger les entrées sauvées à cette version.
- **Test** : la sonde `probe4` B transformée en test `store` : YAML `lineWidth: 6` après une sauvegarde faite avec `lineWidth` par défaut → courbe à 6 ; puis un choix de largeur dans le menu → sauvé, et gagnant sur le YAML ; le même scénario pour `dashMode` et `fill` (STANDARD : un test paramétré, une liste d'options écrite une fois).

### R04 — La sonde court dès qu'une statistique 5 min ou horaire peut servir

- **Partie** : `src/card-history.js` (`_probing`, l.884) ; `src/history-options.js` (les valeurs de `statistics.period`) ; README_Full.
- **Règle** : « 5-minute statistics not valid are never used » sans exception ; une liste de valeurs écrite une fois (`OPTION_VALUES`).
- **Proposition**, deux volets qui ne s'excluent pas :
  1. Ne plus dériver `_probing` de « une source de kind `fine` existe » mais de « une entité avec statistiques n'a pas encore de verdict » : `_statIds.filter(id => !SENSOR_GAPS.has(id) && this._verdict(id) == null)`. La sonde ne dépend plus de la fenêtre ni de `period` ; ses verdicts sont lus par `_relevant` quelle que soit la source demandée (déjà le cas pour `hour`).
  2. `statistics.period` : soit `5minute` est une valeur acceptée, documentée (README_Full l.1158) et testée ; soit `OPTION_VALUES.period` la refuse avec l'avertissement standard des valeurs inconnues. **Décision** : laquelle. Dans les deux cas, la règle de validité s'applique.
- **Test** : `probe4` C en test `features` : avec `period: 5minute` et un capteur à une valeur par heure, aucune requête `recorder:5minute` ; avec un capteur rapide, les 5 min sont demandées.

### R05 — Une seule moyenne circulaire, la règle lowpass_dt, aussi pour le placement

- **Partie** : `deps/chart-hec.js` `Chart.hecCircular` (public) ; `src/history-stats.js`.
- **Règle** : « lowpass_dt's algorithm is the one to use — never another one » ; une implémentation.
- **Décision préalable** : le centre du tour (`place()`) est-il « une moyenne d'un angle » au sens de la règle ? S'il ne l'est pas, rien à changer sauf un commentaire disant pourquoi (le centre ne sert qu'à choisir le tour, les valeurs affichées suivent la règle).
- **Si oui, proposition** : une seule fonction `Chart.hecCircular.mean(values, weights, Q)` — la forme batch de CLAUDE.md §4 : première estimation = moyenne des valeurs déroulées (`un`), puis `m ← m + Σ w·wrap(x − m) / Σ w` jusqu'à stabilité (1 ou 2 passes), résultat dans `[0, Q)` — utilisée par `place()` (poids 1 faute de durées : `place` ne reçoit pas les temps ; **Décision** : lui passer les durées, ou accepter des poids égaux pour le seul choix du tour) et par `history-stats.js` (qui a les durées), à la place de l'`atan2`.
- **Test** : `tests/circular` (ou le test existant des angles) : un jeu de valeurs où moyenne vectorielle et règle lowpass_dt divergent (valeurs inégalement espacées, par ex. 350°, 10°, 10°, 10° avec durées 1, 1, 1, 10) : le tour choisi et la moyenne affichée sont ceux de la règle ; comparé au résultat du même jeu passé à lowpass_dt (`filter.py`), à faire une fois à la main et figer la valeur.

### R06 — Ce qui part chez Home Assistant est filtré par le périmètre des champs

- **Partie** : `src/card-storage.js` (`writeLocalState`, `_savedNow`).
- **Règle** : Persistence : « kept on this device, never synced » ; une implémentation : `ENTITY_FIELD_SCOPE` et `LOCAL_ONLY_FIELDS` existent déjà pour la lecture, les réutiliser pour l'écriture.
- **Proposition** : `_savedNow(scope)` prend le périmètre (`'local'` : tout, images comprises ; `'devices'` : les entrées sans les champs de périmètre `local`, sans `exportStatsPeriod`, sans les images `yaml_*` / `ha_*`). `writeLocalState` envoie `_savedNow('devices')` à `set_user_data` et garde `_savedNow('local')` en localStorage. Pas de deuxième liste de champs : le filtrage lit `ENTITY_FIELD_SCOPE`.
- **Test** : `tests/store.cjs` : intercepter `frontend/set_user_data` (le mock enregistre `window.__ws`) et vérifier qu'aucune clé de `LOCAL_ONLY_FIELDS` ni `yaml_*` / `ha_*` n'y figure, et que `hidden` changé sur un appareil n'est pas lu comme changé sur un autre (déjà couvert à la lecture).

### R13 — Fenêtre de 5 ans : mesurer d'abord, puis deux corrections sûres

- **Partie** : `src/card-history.js` (`_onAnswer` : `_purge`, `_askMissing`, `cacheVersion()`, `cacheRows()`), `src/card-perf.js`, README_Full.
- **Proposition** :
  1. **Mesurer** (avant tout) : `perf.add` autour de `_purge()`, `_askMissing()` et `cacheVersion()` après chaque réponse (l.1359-1363) : ces trois étapes courent 78 fois pendant le chargement de 5 ans et ne sont pas dans « answers put in the cache » (217 ms). C'est le suspect principal du gel de 10,5 s ; le rapport nommera l'étape.
  2. **`cacheRows()` et `cacheVersion()` mémorisés** : tenus à jour à l'insertion (`_mergeLayer`) et à la purge au lieu d'un parcours du cache entier à chaque réponse. Sûr, sans changement de comportement.
  3. **La limite du cache** : `_purge` ne touche jamais fenêtre ± une largeur ; avec 5 ans affichés, tout y est. **Décision** : soit la doc dit la vérité (« kept under a number of rows, outside the window and a width each side ») ; soit, au-delà de CACHE_MAX_ROWS, la purge continue dans les côtés puis dans la fenêtre par la couche la plus fine en commençant par les créneaux les plus loin du centre — ce qui redemande des données montrées : à discuter, pas à coder seul.
  4. **Le coût d'un redessin** (538 ms carte) : `cachedHistory(id, c0, c1, layers)` mémorisé par `(id, c0, c1, couche, _cacheVersion)` ne gagnerait qu'entre deux réponses (la version change à chaque réponse). La vraie économie serait de ne recalculer que les séries touchées : `_dirty` le fait déjà pour les réponses ; pendant un drag et après un `<`, tout est recalculé par construction (la fenêtre a changé). Pas de proposition au-delà de la mesure : un changement ici touche ARCHITECTURE (qui calcule les points) et se décide sur des chiffres.
- **Test** : un test de charge dans `tests/perf` (ou `features`) : mock `historyDays: 1500`, 35 entités dont 28 avec statistiques, fenêtre 5 ans, 3000 px ; après chargement : aucune étape non mesurée (la somme des `perf.add` ≥ 90 % du temps main-thread observé), le gel le plus long sous un seuil fixé par l'utilisateur.

### R10 — Un gel n'est compté que page visible

- **Partie** : `src/card-tests.js` (le pouls, l.452 ; `_onVis` existe déjà l.663).
- **Proposition** : le pouls note les transitions `visibilitychange` ; un écart qui chevauche une période `hidden` n'est pas un gel (il est soustrait, ou l'écart est ignoré et la mesure reprend au retour). La section « Back on the page » garde « after N s away » et ne liste plus le gel égal à l'absence. Sur PC, les 21 gels de ~950 ms pendant l'absence (timers bridés à 1/s) disparaissent de même.
- **Test** : `tests/perf` : masquer la page 3 s (Playwright : `page.evaluate` ne peut pas changer la visibilité ; utiliser CDP `Emulation.setFocusEmulationEnabled` / `Page.setWebLifecycleState('hidden')`) : `freezes` vide.

### R12 — Une cause de redessin par chemin

- **Partie** : `src/card-perf.js` `REDRAW_CAUSES` ; `src/card-history.js:466`.
- **Proposition** : `REDRAW_CAUSES.later: 'a graph off the screen, drawn after those on it'`, utilisée par `_drawStaleSoon` ; `near` reste à `_watchShown`. Le rapport compte alors séparément les deux. Une ligne dans README_Full (le rapport Performance) nomme les cinq causes.
- **Test** : `tests/perf` : 24 graphes dont 10 à l'écran, une réponse : 10 redessins `answers` groupés en un, 14 `later`, 0 `near` sans défilement ; un défilement : des `near`.
- **Décision liée** : faut-il redessiner les 14 graphes hors écran à chaque rafraîchissement (toutes les ~9 s) ou seulement quand ils reviennent (`_watchShown` les redessinerait alors, `_staleGraphs` les gardant marqués) ? Le second cas économise ~150 ms par rafraîchissement sur la tablette ; il change la règle de README_Full l.1138 (« the others right after, one at a time when the page is free »).

### R08 — Les défauts dans leur famille, et une règle qui les y garde

- **Partie** : `src/history-options.js` (`OPTION_DEFAULTS`), `src/history-default-colors.js`, `tests/architecture.cjs`.
- **Proposition** :
  - `OPTION_DEFAULTS.tapAction = { action: 'more-info' }`, `OPTION_DEFAULTS.yAxis = 'auto'`, `OPTION_DEFAULTS.closeButtonColor` (ou `uiColors.closeButton`) `= '#0000001f'` ; les trois `??` de `card-config.js:323`, `:340` et `history-explorer-card.js:520` lisent `OPTION_DEFAULTS` (ou disparaissent si `normalizeOptions` applique déjà les défauts : alors la valeur ne peut plus être `undefined` là).
  - Les couleurs en dur de `applyTheme` (`history-explorer-card.js:167-169`) dans `history-default-colors.js`, nommées.
  - Une règle `architecture` `defaults-in-family` : dans `src/*.js` hors `history-options.js` et `history-default-colors.js`, une ligne contenant `pconfig.<x> ??` ou `config.<x> ??` suivi d'un littéral (`'`, `"`, `{`, `[`, un chiffre, `true`/`false`) est une déviation. Les repli de module « jamais utilisés en pratique » (CLAUDE.md) s'ajoutent à une liste d'exceptions explicite dans le test, chacune avec sa raison — à faire approuver par l'utilisateur (règle : jamais d'exception sans accord).
- **Test** : la règle elle-même ; `node tests/run.cjs architecture` vert après déplacement.

### R09 — Une résolution des `entityOptions`, pas de variable morte

- **Partie** : `src/card-config.js`, `src/history-info-panel.js`.
- **Proposition** : garder la fonction pure `getEntityOptions(hass, entityOptions, entity)` comme implémentation unique ; la méthode de la carte `getEntityOptions(entity)` l'appelle avec `this._hass, this.pconfig.entityOptions` ; le panneau l'appelle avec son propre `config.entityOptions` (il n'est pas la carte : il ne doit pas appeler la méthode de la carte). Supprimer `entityOptions` et `type` inutilisés en `history-info-panel.js:281-283` ; `labelAreaWidth` 55 rejoint les constantes de mise en page de sa famille (`card-charts.js`, où la largeur des étiquettes d'axe est définie) sous un nom.
- **Test** : `lint` avec `no-unused-vars` actif sur `src/` (vérifier la config ESLint : ces deux variables n'ont pas été signalées).

### R07 — Documentation

- ARCHITECTURE.md l.60 : « last 8 hours » → « last 24 hours » ; l'ordre de l'arrière-plan aligné sur le code et BRANCH.md (angles, sondes des exports, côtés) — ou le code aligné sur ARCHITECTURE si l'ordre documenté est celui voulu (**Décision**).
- Le rapport Performance : « phase 3 » → le nom de BRANCH.md pour PHASE_SIDES (« phase 1, sides » ou « the sides of phase 1 ») ; une constante de libellé à côté de `REDRAW_CAUSES`.
- README_Full, section de `defaultTimeRange` : « une durée hors presets est arrondie au preset supérieur (`36h` → 2 jours) ».
- FORK_DESCRIPTION.md et `tests/README.md` : la liste des suites générée depuis `tests/run.cjs` ou vérifiée par un test (`lists-once` sur les noms de suites).

### R11 — Points bas

- `mapStartTimeToCacheSlot` → un alias supprimé, `_slotAt` seul (ou l'inverse : un nom public, une implémentation).
- La liste des tirets : une constante `DASH_MODES` dans `history-options.js`, lue par `card-graphs.js` ; `lists-once` étendu aux listes dans un objet littéral si la règle actuelle ne les voit pas.
- Le seuil strict `d < gap` de `_speaks` : **Décision** de l'utilisateur. `d <= gap` rend un capteur exactement à 240 s valide pour les 5 min ; la règle des deux côtés (README_Full l.1134 : « each under 4 minutes ») serait alors « 4 minutes at most » — à changer dans la doc en même temps. Le caractère « instantané d'une heure » du verdict (six entités jugées différemment sur deux appareils) est conforme à la doc ; s'il gêne (une même carte tracée de deux sources selon l'appareil), la sonde pourrait porter sur les dernières 24 h pour tous — c'est un changement de règle, pas une correction, et il coûte une requête plus lourde : à décider, pas proposé ici.

## Annexe — Les sondes temporaires (hors dépôt)

| Sonde | Ce qu'elle a montré |
|---|---|
| `probe1` | Première apparition du `RangeError` dans `_autoYAxis` via `zoomToSelection` ; la boîte élastique ne couvrant pas la sélection |
| `probe3` | Rejeu de probe1 sans reproduction (maxPush 4 372) |
| `probe4` B | R03 : `width` figé, `dashMode` repris, appareil neuf à 6 |
| `probe4` C | R04 : `period: 5minute` sans sonde, 5 min tracées pour un capteur invalide |
| `probe5` | Limite V8 du spread dans ce Chromium : 100 000 ok, 130 000 échec |
| `probe6` | R01 reproduit de façon déterministe (129 672 voisins → erreur de page) |
