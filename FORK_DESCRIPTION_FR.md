# History Explorer Card (fork Cook23) — aperçu des fonctionnalités

## Ajout et organisation des entités

Les entités peuvent être ajoutées via un menu déroulant permettant la recherche par nom convivial (l'entity ID reste disponible dans une infobulle) et affichant la valeur d'état actuelle de chaque entité, ou définies statiquement en YAML — les deux peuvent être librement combinés sur la même carte. Les motifs avec wildcard (`sensor.*power*`) ajoutent toutes les entités correspondantes en une fois, triées par ordre alphabétique. Survoler une entrée à la souris ou la surligner au clavier montre par avance si elle sera ajoutée ou si elle est déjà présente, avant même de valider la sélection ; si elle est déjà sur la carte, une infobulle et un surlignage du graphe concerné signalent le doublon.

Chaque nouvelle entité numérique passe par un menu de choix du type d'affichage — ligne (droite, courbe, ou en escalier), barre, flèche (arrowline), ou timeline — et ce même menu se rouvre à tout moment ensuite pour changer le type, ou supprimer l'entité d'un graphe combiné.

Les entités partageant des unités compatibles (y compris les préfixes SI comme W/kW) se combinent automatiquement sur le même graphe, qu'elles soient définies en YAML ou ajoutées dynamiquement.

## Édition interactive directement sur les graphes

Un simple clic sur une courbe ou une étiquette d'entité l'affiche ou la masque. Un double-clic extrait une entité d'un graphe combiné vers son propre graphe. Un clic long sur une légende ou une étiquette timeline/arrowline ouvre le menu de type d'affichage pour cette entité, avec une option Supprimer pour la retirer entièrement du graphe. Les étiquettes de courbe et d'entité peuvent être glissées pour les réordonner au sein d'un graphe, ou glissées vers un autre graphe pour les y déplacer (unités/types compatibles uniquement, avec un retour visuel indiquant si le dépôt est autorisé), et des graphes entiers peuvent être glissés par une poignée pour les réordonner sur la carte. L'axe Y peut être glissé pour le faire défiler (pan), et zoomé par pincement sur mobile, avec un clic sur le cadenas pour verrouiller la plage à sa vue actuelle.

## Apparence des lignes et statistiques

Les graphes en ligne prennent en charge une bande statistique min/max ombrée (calculée soit à partir des statistiques long terme, soit de l'historique complet), des points de mesure permanents à chaque échantillon, et des motifs de tirets personnalisés (y compris un tableau Canvas de tirets entièrement personnalisé, pas seulement les styles nommés intégrés). Les options d'affichage — couleur, remplissage, épaisseur de ligne, style de tirets, et plus — peuvent être définies par entité, ou ciblées sur toute une famille de capteurs à la fois via la forme liste d'`entityOptions`, en filtrant par classe d'appareil, domaine, ou motif glob/wildcard (ex. `match: "sensor.*_power"`). Les graphes timeline disposent d'un large jeu de couleurs d'état par défaut couvrant la plupart des domaines Home Assistant (vert pour actif/bon état, rouge pour arrêté/armé/verrouillé, ambre pour une transition, gris pour inconnu), personnalisables état par état via `stateColors`.

## Persistance et synchronisation multi-appareils

Les changements interactifs — entités ajoutées, leur ordre, leur regroupement, et leur visibilité — sont mémorisés automatiquement et synchronisés sur tous les appareils connectés au même compte Home Assistant, via le stockage utilisateur propre à HA. Pour les entités définies en YAML, la persistance peut être activée ou désactivée champ par champ, afin qu'un tableau de bord puisse soit toujours revenir à ses valeurs YAML par défaut, soit mémoriser des ajustements utilisateur spécifiques, selon le besoin.

## Remplacement du popup d'historique natif de Home Assistant

La carte peut se substituer entièrement au popup "plus d'infos" natif de Home Assistant — le popup de chaque entité bénéficie alors des mêmes capacités de pan/zoom/menu de type que la carte principale. Une option YAML permet d'activer ce comportement par défaut sur tout le tableau de bord, plutôt que de devoir l'activer manuellement pour chaque carte.

## Flexibilité de configuration

Les options de style — remplissage, bande min/max, style de tirets, mode d'interpolation de ligne, épaisseur de ligne, points d'échantillon, décimation, et mode de comptage net — peuvent être définies une seule fois comme valeur par défaut partagée pour un graphe entier, une seule fois pour toute la carte, ou sur une entité individuelle, la valeur la plus spécifique l'emportant toujours. Le filtrage des entités (`filterEntities`, `excludeFilterEntities`, et `exclude` par entité) accepte une simple chaîne, une liste de chaînes, ou une forme objet plus explicite, selon ce qui est le plus pratique dans chaque cas.

Un YAML mal formé — un `exclude:` de forme incorrecte, par exemple — est désormais consigné dans la console et ignoré pour cette seule entrée, plutôt que de casser toute la carte.
