# Notes d’implémentation

Le projet utilise un socle React, Express, tRPC, Drizzle et authentification intégrée. Le composant `DashboardLayout` existe déjà et convient au tableau de bord interne du personnel soignant, avec une navigation latérale, une gestion de session et un rendu mobile. Il faudra toutefois remplacer les libellés génériques du menu et y brancher les écrans métier de triage.

Le fichier `client/src/index.css` expose déjà les variables de thème nécessaires. L’application pourra adopter une direction visuelle médicale élégante à partir de ces tokens sans casser l’infrastructure existante. Un thème clair premium, avec accents sobres et hiérarchie forte, est donc compatible avec le template.

Les helpers serveur disponibles couvrent les besoins principaux : appel LLM, transcription vocale, notifications au propriétaire et stockage S3. Les procédures `protectedProcedure` et `adminProcedure` sont disponibles pour séparer les usages du personnel médical et de l’administration. Il reste à créer le modèle métier du triage, les tables de base de données, les procédures tRPC et les écrans applicatifs.
