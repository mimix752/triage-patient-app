# Notes de livraison — Triage Patient Intelligent

## Positionnement du prototype

Cette application constitue un **prototype opérationnel de triage médical assisté** destiné à fluidifier l’admission aux urgences grâce à trois modes de saisie d’identité, un questionnaire clinique guidé, une priorisation automatique et un tableau de bord de supervision. Le moteur de triage implémenté dans cette version repose sur une **logique simplifiée inspirée des protocoles de triage d’urgence**, avec pour objectif d’aider l’orientation initiale du patient, et non de remplacer la décision d’un professionnel de santé qualifié.

## Limites cliniques et réglementaires

La priorité calculée par l’application doit être interprétée comme une **aide à la décision**. Toute proposition de niveau d’urgence doit être **revue, confirmée ou corrigée par un personnel médical habilité** avant toute prise en charge définitive. Le prototype ne constitue pas un dispositif médical certifié, ne démontre pas à lui seul une conformité réglementaire complète, et nécessite avant un usage réel une validation clinique, une gouvernance médicale, des essais terrain, une analyse de risques et une revue juridique adaptées au pays de déploiement.

Les règles de priorisation intégrées sont volontairement prudentes et explicables, mais elles ne couvrent pas l’intégralité des cas complexes, des comorbidités lourdes, des populations pédiatriques spécifiques, des situations obstétricales spécialisées, ni l’ensemble des contextes psychiatriques ou toxiques. Une adaptation locale aux protocoles de l’établissement demeure nécessaire.

## Sécurité et protection des données

Le prototype a été structuré avec une attention particulière portée à la **confidentialité des données patient**. Les informations d’identité, les dossiers de triage, l’historique clinique et les événements de notification sont stockés côté serveur. Les flux applicatifs ont été conçus pour éviter l’exposition directe des traitements sensibles côté client. Les pièces transmises pour OCR ou transcription vocale doivent toutefois être traitées en production dans un cadre de sécurité renforcé incluant journalisation maîtrisée, contrôle d’accès, politique de conservation, chiffrement au repos, chiffrement en transit, rotation des secrets, gestion des habilitations et procédures d’audit.

Pour un déploiement réel, il conviendrait d’ajouter une politique stricte de minimisation des données, des durées de rétention configurables, des mécanismes d’anonymisation ou de pseudonymisation selon les usages, ainsi qu’un registre de traçabilité des accès aux données patients. Il faudrait également vérifier l’alignement avec les exigences applicables en matière de données de santé, notamment selon le cadre juridique du territoire cible.

## Hypothèses de conformité du prototype

Cette version suppose que l’établissement utilisateur dispose d’une organisation permettant la validation humaine des priorités, la gestion des droits d’accès, l’administration des comptes et la supervision des notifications critiques. Elle suppose également que les contenus OCR et vocaux soient utilisés uniquement dans un environnement contrôlé, avec information des utilisateurs concernés et base légale appropriée pour le traitement des données.

Le prototype n’intègre pas encore l’ensemble des briques attendues pour une mise en production hospitalière complète, notamment la gestion avancée du consentement, l’interopérabilité normalisée avec un dossier patient informatisé, la signature d’événements critiques, les audits réglementaires automatisés, la haute disponibilité certifiée, ni la reprise après sinistre documentée.

## Ce qui a été livré dans cette version

| Domaine | Contenu livré |
| --- | --- |
| Admission patient | Saisie par OCR de carte d’identité, saisie manuelle et saisie vocale avec transcription |
| Évaluation clinique | Questionnaire guidé sur symptômes, constantes et motifs de consultation |
| Triage | Moteur de priorisation automatique avec niveaux de gravité et justification |
| Supervision | Tableau de bord des patients en attente, statuts, temps d’attente et cas prioritaires |
| Alerting | Notifications destinées au personnel pour les situations urgentes |
| Données | Modèle de données patients, dossiers de triage, événements cliniques et notifications |
| Interface | Expérience responsive pensée pour desktop, tablette et smartphone |
| Qualité | Vérifications TypeScript et tests Vitest sur les modules critiques |

## Recommandations pour une version suivante

La prochaine étape pertinente serait de connecter le prototype à des protocoles cliniques validés par l’établissement, de renforcer les contrôles d’accès par rôle, d’ajouter un historique d’audit complet, puis d’intégrer des jeux de tests métier plus étendus sur des scénarios de triage réels. Une homologation organisationnelle et clinique serait indispensable avant toute utilisation sur patients réels.
