# History Explorer Card (fork Cook23) — aperçu des fonctionnalités

## Ajout et organisation des entités

Les entités peuvent être ajoutées via un menu déroulant permettant la recherche par nom convivial (l'entity ID reste disponible dans une infobulle) et affichant la valeur d'état actuelle de chaque entité, ou définies statiquement en YAML — les deux peuvent être librement combinés sur la même carte. Les motifs avec wildcard (`sensor.*power*`) ajoutent toutes les entités correspondantes en une fois, triées par ordre alphabétique. Survoler une entrée à la souris ou la surligner au clavier montre par avance si elle sera ajoutée ou si elle est déjà présente, avant même de valider la sélection ; si elle est déjà sur la carte, une infobulle et un surlignage du graphe concerné signalent le doublon.

Chaque entité ajoutée passe par le menu de choix du type d'affichage — ligne (intelligente, courbe, droite ou escalier), histogramme, flèches de direction, ou chronologie — le type le plus adapté présélectionné, pour vérifier l'affichage avant que rien ne soit ajouté ; le menu s'ouvre même quand l'entité ne peut être affichée qu'en chronologie. Ce même menu se rouvre à tout moment ensuite pour changer le type, choisir l'interpolation d'une courbe, ou supprimer l'entité.

Avec `combineSameUnits`, les entités ajoutées depuis l'interface avec des unités compatibles (y compris les préfixes SI comme W/kW) se combinent automatiquement sur le même graphe. Un graphe défini en YAML affiche toujours toutes ses entités ensemble, quelles que soient leurs unités — et il peut mélanger barres et courbes : les courbes sont tracées par-dessus les barres, ne sont jamais empilées, et gardent leur propre mode de tracé.

## Édition interactive directement sur les graphes

Un simple clic sur une courbe ou une étiquette d'entité l'affiche ou la masque. Un double-clic extrait une entité d'un graphe combiné vers son propre graphe ; sur un graphe YAML, la courbe extraite lui reste *liée* — une icône chaîne relie les deux graphes, ils se déplacent d'un bloc, et un double-clic sur la chaîne (ou un glisser de l'étiquette en retour) les fusionne à nouveau. Changer le type d'affichage d'une courbe fonctionne de la même façon : une courbe qui ne peut pas partager son graphe passe dans un graphe lié, et y revient quand on lui rend son type. Un clic long sur une légende ou une étiquette timeline/arrowline ouvre le menu de type d'affichage pour cette entité, avec une option Supprimer pour la retirer entièrement du graphe. Les étiquettes de courbe et d'entité peuvent être glissées pour les réordonner au sein d'un graphe, ou glissées vers un autre graphe pour les y déplacer (au sein d'un bloc de graphes liés, quelles que soient les unités ; ailleurs, même type et unités compatibles uniquement — avec un retour visuel indiquant si le dépôt est autorisé), et des graphes entiers peuvent être glissés par une poignée pour les réordonner sur la carte. L'axe Y peut être glissé pour le faire défiler (pan), et zoomé par pincement sur mobile, avec un clic sur le cadenas pour verrouiller la plage à sa vue actuelle.

## Apparence des lignes et statistiques

Les courbes peuvent être tracées entre leurs valeurs par quatre algorithmes d'interpolation — `monotone` (par défaut), `steffen`, `makima` ou `catmullrom` — choisis avec l'option `interpolation` ou depuis le menu de type.

Le mode de ligne *intelligent* (`smart`) trace une courbe tant que le capteur envoie des valeurs à son rythme habituel, et une ligne plate en pointillé — la dernière valeur connue maintenue — pendant chaque silence, au lieu d'une longue courbe ou diagonale suggérant une évolution progressive qui n'a jamais eu lieu (même détection des silences que l'intégration [lowpass_dt](https://github.com/Cook23/lowpass_dt)).

Les angles — une direction de vent, par exemple — ne sautent pas d'un bord à l'autre du graphe à chaque passage par 0/360 : ils sont tracés comme une courbe continue autour de leur direction moyenne, tandis que l'infobulle et l'axe Y affichent toujours les valeurs réelles. Automatique pour les entités en `°` ou de classe d'état `measurement_angle`, réglable par entité avec `circular` (autre période, `2pi`, ou désactivé).

Les graphes en ligne prennent aussi en charge une bande statistique min/max ombrée (calculée soit à partir des statistiques long terme, soit de l'historique complet), des points de mesure permanents à chaque échantillon, et des motifs de tirets personnalisés (y compris un tableau Canvas de tirets entièrement personnalisé, pas seulement les styles nommés intégrés). Les options d'affichage — couleur, remplissage, épaisseur de ligne, style de tirets, et plus — peuvent être définies par entité, ou ciblées sur toute une famille de capteurs à la fois via la forme liste d'`entityOptions`, en filtrant par classe d'appareil, domaine, ou motif glob/wildcard (ex. `match: "sensor.*_power"`). Les graphes timeline disposent d'un large jeu de couleurs d'état par défaut couvrant la plupart des domaines Home Assistant (vert pour actif/bon état, rouge pour arrêté/armé/verrouillé, ambre pour une transition, gris pour inconnu), personnalisables état par état via `stateColors`.

## Persistance et synchronisation multi-appareils

Les entités ajoutées depuis la carte — et tous les changements interactifs qui leur sont faits : leur ordre, leur regroupement, leur type d'affichage, leur interpolation, l'intervalle des histogrammes et leur visibilité — sont mémorisés automatiquement et synchronisés sur tous les appareils connectés au même compte Home Assistant, via le stockage utilisateur propre à HA. Quelle que soit la source — le YAML, cet appareil, ou un autre — le dernier qui parle a raison : modifier le YAML l'applique, et un changement fait sur un appareil arrive sur les autres. Pour les entités définies en YAML, la persistance peut être activée ou désactivée champ par champ, afin qu'un tableau de bord puisse soit toujours revenir à ses valeurs YAML par défaut, soit mémoriser des ajustements utilisateur spécifiques, selon le besoin.

## Remplacement du popup d'historique natif de Home Assistant

La carte peut se substituer entièrement au popup "plus d'infos" natif de Home Assistant — le popup de chaque entité bénéficie alors des mêmes capacités de pan/zoom/menu de type que la carte principale. Une option YAML permet d'activer ce comportement par défaut sur tout le tableau de bord, plutôt que de devoir l'activer manuellement pour chaque carte.

## Flexibilité de configuration

Chaque option d'affichage peut être définie sur une entité, comme valeur par défaut d'un graphe entier, dans `entityOptions`, ou une seule fois pour toute la carte, la valeur la plus spécifique l'emportant toujours — et toutes les orthographes d'une option sont acceptées à tous les niveaux. Le filtrage des entités (`filterEntities`, `excludeFilterEntities`, et `exclude` par entité) accepte une simple chaîne, une liste de chaînes, ou une forme objet plus explicite, selon ce qui est le plus pratique dans chaque cas.

Un YAML mal formé — un `exclude:` de forme incorrecte, par exemple — est consigné dans la console et ignoré pour cette seule entrée, plutôt que de casser toute la carte.
