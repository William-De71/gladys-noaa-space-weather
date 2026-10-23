# NOAA Space Weather

## Présentation

Cette intégration amène dans Gladys la météo spatiale du [Space Weather Prediction Center de la NOAA](https://www.swpc.noaa.gov/) (SWPC) : l’indice Kp d’activité géomagnétique, les échelles NOAA des orages géomagnétiques (G), des tempêtes de radiations solaires (S) et des black-out radio (R), le vent solaire, les éruptions solaires, les messages du SWPC et la prévision d’aurores OVATION pour chacune de vos maisons. Vos scènes peuvent être prévenues quand un orage commence, quand une forte éruption a lieu, ou quand une aurore pourrait être visible chez vous cette nuit.

Transport : cloud. L’intégration lit des fichiers publics sur `services.swpc.noaa.gov` ; rien de vous n’est envoyé (ni compte, ni clé, jamais les coordonnées de vos maisons : la grille des aurores est téléchargée entière et lue sur place). Données : NOAA SWPC, domaine public. Cette intégration n’est pas affiliée à la NOAA.

**Les échelles en bref.** L’indice **Kp** va de 0 (calme) à 9 (orage extrême), par période de 3 heures ; Kp 5 est un orage **G1**, Kp 9 un orage **G5**. **S1–S5** mesurent les protons venus du Soleil (satellites, vols polaires), **R1–R5** les rayons X des éruptions (radio HF et GPS côté jour) : R1 correspond à une éruption M1, R3 à une éruption X1.

## Prérequis

- Gladys 5.1.0 ou plus récent (widgets et déclencheurs de scène).
- Pour les aurores : une maison localisée (Paramètres → Maisons). L’intégration demande l’accès aux coordonnées des maisons à l’installation.
- La latitude compte. Sous 55° de latitude magnétique environ, comme dans la plupart de la France, une aurore est rare : seuls les orages forts (G3 ou plus, quelques fois par cycle solaire) la font descendre aussi bas. En Scandinavie, en Islande, au Canada ou en Alaska, elle est fréquente.

## Configuration

| Champ             | Usage                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Langue des textes | Noms des appareils, phrases et erreurs des scènes. Automatique : la langue du dernier widget affiché.                                 |
| Seuil d’aurore    | 5 à 50 % : la probabilité OVATION à partir de laquelle une aurore est « possible » dans une maison, par nuit noire (10 % par défaut). |

Le bouton **Tester la connexion** lit les échelles NOAA et le Kp estimé, et liste les maisons localisées. **Diagnostic** écrit l’état de l’intégration dans ses journaux.

L’intégration lit chaque produit à son rythme : le Kp estimé chaque minute, le vent solaire, le champ magnétique, les éruptions et les échelles toutes les 5 minutes, les messages toutes les 10 minutes, le Kp sur 3 heures toutes les 30 minutes, la prévision toutes les heures, le flux radio toutes les 3 heures. La grille OVATION (environ 1 Mo) n’est lue toutes les 20 minutes **que** si un appareil Aurores existe ou si un widget aurore est affiché. Le serveur répond « non modifié » pour un fichier inchangé, un échec double l’attente (une heure au plus), et les dernières valeurs sont gardées dans le dossier de données de l’intégration.

## Utilisation

### Appareils

Dans l’écran de découverte : un appareil **Météo spatiale (NOAA)**, et un appareil **Aurores** par maison localisée. Créez ceux que vous voulez.

| Appareil              | Fonctionnalités                                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Météo spatiale (NOAA) | Kp estimé (dernières minutes), indice Kp (3 h), orage géomagnétique (G 0–5), tempête de radiations (S 0–5), black-out radio (R 0–5), vent solaire (km/s), champ magnétique Bz et Bt (nT), flux radio 10,7 cm (sfu), classe des rayons X (un texte, « B5.4 ») |
| Aurores – maison      | Probabilité d’aurore (%), nuit noire (1 = le soleil à plus de 6° sous l’horizon), Kp prévu cette nuit                                                                                                                                                        |

Gladys n’a pas d’unité pour les km/s, nT, sfu ni pour le Kp : ces fonctionnalités n’ont pas d’unité, elle est écrite dans leur nom. La probabilité est celle d’une aurore au zénith, la plus haute des neuf cases de 1° autour de la maison ; une aurore plus au nord peut tout de même se voir bas sur l’horizon.

### Widgets du tableau de bord

![Les trois widgets : la météo spatiale actuelle avec le Kp des derniers jours et des trois suivants, la prévision d’aurores d’une maison, les derniers messages du SWPC (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-noaa-space-weather/main/docs/assets/widgets.fr.png)

- **Météo spatiale** : une jauge du Kp, les niveaux G, S et R, le vent solaire, Bz, le Kp observé sur deux jours et prévu sur trois, les rayons X, la dernière éruption, le dernier message du SWPC.
- **Prévision d’aurores** : choisissez un appareil Aurores (vide : la première maison localisée) : probabilité, ciel noir ou clair, Kp prévu cette nuit, seuil, les dernières 24 heures, les heures de nuit noire.
- **Alertes du SWPC** : les derniers messages avec un titre court dans votre langue, le type en badge, le texte original en anglais à l’ouverture. Réglages : types, période.

### Scènes

Déclencheurs (chacun une fois par événement, jamais au démarrage) :

- **NOAA : orage géomagnétique** : l’échelle G atteint un nouveau niveau ; filtre par niveaux (pour « G3 ou plus », cochez G3, G4 et G5).
- **NOAA : fin d’orage géomagnétique** : retour à G0 depuis 3 heures.
- **NOAA : tempête de radiations** (S) et **NOAA : black-out radio** (R) : un nouveau niveau.
- **NOAA : éruption solaire** : une éruption atteint la classe M ou X (filtre : X seulement) ; une éruption qui passe de M à X redéclenche.
- **NOAA : aurore possible** : dans une maison avec un appareil Aurores, la probabilité atteint le seuil par nuit noire ; **NOAA : fin d’aurore possible** à l’aube ou quand elle retombe.
- **NOAA : message du SWPC** : chaque nouvelle veille, avertissement, alerte ou bilan, filtrés par type et par sujet.
- **NOAA : orage prévu** : un Kp de 5 ou plus prévu sous 3 jours, une fois par épisode.

Chaque déclencheur fournit une phrase prête, `{{triggerEvent.data.sentence}}`, dans la langue de la configuration.

Actions : **lire la météo spatiale**, **lire la prévision d’aurore** (une maison), **lire la prévision à 3 jours**, chacune avec une phrase `summary`. Elles répondent avec les derniers relevés, et ne relisent que ce qui est trop ancien.

Exemples :

1. Quand **orage géomagnétique** avec les niveaux G3, G4, G5 → envoyer la notification `{{triggerEvent.data.sentence}}`.
2. Quand **aurore possible** sur l’appareil Aurores du chalet → envoyer « Aurore possible cette nuit : {{triggerEvent.data.probability}} %, regardez vers le nord ».
3. Quand **éruption solaire** de classe X → envoyer « Éruption X : radio HF et GPS perturbés possibles ({{triggerEvent.data.class}}) » au radioamateur de la maison.

## Dépannage

- **Pas d’appareil Aurores** : la maison n’est pas localisée (Paramètres → Maisons), puis relancez un scan depuis l’écran de découverte.
- **Le widget aurore attend** : la grille OVATION est lue dans la minute qui suit le premier affichage ; elle apparaît en quelques minutes.
- **« Le SWPC de la NOAA ne répond plus »** : le service ou la connexion internet est coupé ; l’intégration réessaie seule, de moins en moins souvent (une heure au plus).
- **Une valeur reste vide** : un produit plus ancien que sa fraîcheur (une heure pour le vent solaire) n’est pas affiché comme « actuel » ; le SWPC interrompt parfois un flux.
- Journaux : Paramètres → Supervision ; ajoutez `DEBUG=gladys-integration-sdk` en mode développeur pour ceux du SDK. Problèmes : https://github.com/William-De71/gladys-noaa-space-weather/issues
