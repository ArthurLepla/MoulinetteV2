Réflexion durant quelques secondes


## 🛣️ Feuille de route « IIH Playground » — *édition Anchor API* (v2.1.x)

> **Objectif V1-Anchor** : l’utilisateur importe un Excel, mappe sa hiérarchie, puis pousse ― via `/DataService/anchor/v1/*` ―
> **assets → attributs (variable, energyType, etc.) → agrégations → retention**.
> Toute la stack reste Next 15 + ShadCN UI, React Query 5 et IndexedDB pour le cache.

---

### Phase 0 – 👌 État actuel (inchangé)

* Auth cookie `authToken`   •  Route-guard  •  Tabs Dashboard / Import
* `<ExcelDropzone>` + store Zustand

---

## Phase 1 – 🧭 Mapping Wizard (Excel → Hiérarchie)

| Tâche | Détails techniques                                                                 | End-points                                           |
| ----- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1.1   | Preview table (20 lignes)                                                          | —                                                    |
| 1.2   | `<MappingModal>` (Levels 0-N + EnergyType) — Validation Zod                        | —                                                    |
| 1.3   | Stocker `mappingConfig`                                                            | —                                                    |
| 1.4   | **Dry-run**<br>• doublons nom/parent<br>• longueur > 50 car.<br>• charset interdit | `GET /DataService/anchor/v1/assets?namefilter=<...>` |

---

## Phase 2 – ⚙️ Création des **assets** (Anchor)

> Il n’existe plus de `/bulkCreate` : on enchaîne **niveau par niveau** (parents avant enfants).

| Étape | Implémentation                                                                                  | Endpoint                             |
| ----- | ----------------------------------------------------------------------------------------------- | ------------------------------------ |
| 2.1   | `buildAssetLevels()` → tableau `AnchorEntity[]` **sans** `"$anchor"`                            | —                                    |
| 2.2   | `useCreateAssets()` (React-Query) : POST un niveau → récupère `"$anchor"` → alimente `idOfPath` | `POST /DataService/anchor/v1/assets` |
| 2.3   | Progress bar + toast succès/erreurs                                                             | —                                    |
| 2.4   | Cache IndexedDB `fullPath ↔ $anchor`                                                            | —                                    |

**Corps envoyé :**

```jsonc
{
  "$concept": "asset",
  "name": "FACILITIES",
  "parent": { "$anchor": "65b4e18b..." }   // ou { "$anchor": "0" } pour la racine
}
```

Réponse : même objet + `"$anchor"` généré.

---

## Phase 3 – 🔗 Variables & attributs

Dans Anchor, une **variable** est un asset enfant ou un attribut ?
👉 Choix simple : on garde le modèle « Variable = attribut de l’asset capteur ».

| Tâche | Implémentation                                                                   | Endpoint                      |
| ----- | -------------------------------------------------------------------------------- | ----------------------------- |
| 3.1   | Sélecteur adaptateur / connectionName<br>`GET /anchors/v1/adaptermgmt/adapters`  | `/adaptermgmt/adapters`       |
| 3.2   | Construire `Attribute[]` ({ name:"topic", value:"PLC::TAG" }, …)                 | —                             |
| 3.3   | `POST /DataService/anchor/v1/assets/{assetAnchor}/attributes` (boucle, 1000 max) | `/assets/{anchor}/attributes` |
| 3.4   | Toast résultat + cache (row → attributeAnchor si besoin)                         | —                             |

---

## Phase 4 – 📊 Agrégations

Les agrégations restent encore dans l’ancien service (pas encore porté en Anchor).
On garde donc :

| Étape | Endpoint                                           |
| ----- | -------------------------------------------------- |
| 4.1   | `POST /DataService/Aggregations` (loop)            |
| 4.2   | `GET  /DataService/Aggregations?variableIds=[...]` |

*Dès qu’un `/anchor/v1/datamgmt/aggregations` apparaîtra, on branchera dessus.*

---

## Phase 5 – ⏳ Data Retention (Anchor-ex)

La v 2.1 ajoute `/anchor-ex/v1/retentions`.

| Tâche | Endpoint                                                                          | Payload minimal                                                                                |
| ----- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 5.1   | Lire : `GET /DataService/anchor-ex/v1/retentions?owner=<assetAnchor>`             | —                                                                                              |
| 5.2   | Écrire : `POST /DataService/anchor-ex/v1/retentions`<br>ou `PATCH /…/{retAnchor}` | `{ "owner": { "$anchor": "…" }, "timeSettings": { "timeRange":{"base":"month","factor":1} } }` |

UI : form Retention (base + factor) + bouton Delete (met `timeSettings: null`).

---

## Phase 6 – 🛡 Rollback & Logs

| Tâche | Détails                                                                                      |
| ----- | -------------------------------------------------------------------------------------------- |
| 6.1   | Stocker tous les `$anchor` créés →  `DELETE /DataService/anchor/v1/assets/{anchor}` récursif |
| 6.2   | SSE `/system/v1/events` (si activé) → panneau log temps réel                                 |

---

## Phase 7 – 🎨 Polish & Prod-ready

| Tâche | Détails                     |
| ----- | --------------------------- |
| 7.1   | Tests unitaires (Vitest)    |
| 7.2   | E2E Playwright              |
| 7.3   | Storybook composants        |
| 7.4   | CI GitHub Actions           |
| 7.5   | Déploiement Vercel / Docker |

---

## Prochaine action **Phase 1**

1. **Branch** `feature/mapping-wizard`.
2. `<MappingModal>` + Zod ready (Levels 0-N, EnergyType).
3. Preview table.

Une fois valide, on branchera **Phase 2** avec `POST /DataService/anchor/v1/assets` niveau par niveau.

Dis-moi si ce plan Anchor te convient ou si tu veux directement attaquer le refactor `useCreateAssets()` !
