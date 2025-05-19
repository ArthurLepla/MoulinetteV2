# Avancement & Points Bloquants

## Points Bloquants

- [ ] **Redirection vers la page de login non fonctionnelle lors du premier accès à localhost:3000**
    - Lors du premier lancement de l'application, si l'utilisateur n'est pas authentifié, il devrait être automatiquement redirigé vers `/login`. Or, actuellement, ce n'est pas le cas : la page d'accueil ne s'affiche pas correctement ou reste vide.
    - À investiguer : vérifier la logique d'initialisation de l'authentification et la gestion du chargement (`isLoading`) dans le contexte d'authentification et dans la page d'accueil (`src/app/page.tsx`).

## Améliorations à faire

- (À compléter au fil de l'eau)
