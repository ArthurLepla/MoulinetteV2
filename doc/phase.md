Réflexion durant 4 secondes


## 🛣️ Feuille de route « IIH Playground » v0 → v1

> **Objectif V1** : depuis l’interface Next 15 + ShadCN, un utilisateur importe un Excel, mappe dynamiquement les colonnes à une hiérarchie, valide (dry-run) puis pousse en bulk : *assets → variables → agrégations* ; il peut ensuite ajuster la data-retention et voir le résultat dans un tableau de bord.

---

### Phase 0 – 👌 État actuel (terminé)

* Auth par cookie `authToken`
* Route guard (`/middleware.ts`)
* Tabs **Dashboard / Import** fonctionnels
* `<ExcelDropzone>` + store Zustand pour `parsedData`

---

### Phase 1 – 🧭 Mapping Wizard (Excel → Hiérarchie)

| Tâche | Détails techniques                                                                                                                                 | End-points concernés                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1.1   | **Preview Table** (20 lignes) après parse                                                                                                          | —                                                    |
| 1.2   | **`<MappingModal>`** :<br>• Sélecteurs par colonne → *Level 0…N*, *Tag*, *Topic*, *DataType*<br>• Validation Zod (colonnes dupliquées, vides)      | —                                                    |
| 1.3   | Stocker `mappingConfig` dans **store Zustand**                                                                                                     | —                                                    |
| 1.4   | Bouton **Dry-run** → construit localement un arbre et détecte :<br>• doublons names / parentIds<br>• longueurs > 50 car.<br>• caractères interdits | `GET /AssetService/Assets` (pour vérifier existence) |

---

### Phase 2 – ⚙️ Bulk Assets

| Tâche | Implémentation                                                       | End-point                               |
| ----- | -------------------------------------------------------------------- | --------------------------------------- |
| 2.1   | `useBulkAssets()` (React-Query mutation) :<br>chunk par 1 000 lignes | `POST /AssetService/Assets/Bulk/Create` |
| 2.2   | **Progress bar** + toast `results[] / errors[]`                      | —                                       |
| 2.3   | Cache local *excelRow ↔ assetId* (IndexedDB) pour rollback           | —                                       |

---

### Phase 3 – 🔗 Variables & Tags

| Tâche | Implémentation                                                                           | End-points                                |
| ----- | ---------------------------------------------------------------------------------------- | ----------------------------------------- |
| 3.1   | Récupérer **tags / connectionName** dynamiquement : dropdown autocomplété par adaptateur | `GET /DataService/Adapters/{id}/browse`   |
| 3.2   | Générer payload `Variable[]` depuis mapping                                              | —                                         |
| 3.3   | Bulk create variables (1 000 / chunk) + affichage erreurs                                | `POST /DataService/Variables/Bulk/Create` |

---

### Phase 4 – 📊 Agrégations

| Tâche | Implémentation                                                          | End-points                       |
| ----- | ----------------------------------------------------------------------- | -------------------------------- |
| 4.1   | UI « Add standard aggregations » (Sum, Avg, Min, Max) + cycles proposés | —                                |
| 4.2   | Mutation bulk (pas d’endpoint bulk natif → loop promises)               | `POST /DataService/Aggregations` |
| 4.3   | Tableau de suivi `GET /DataService/Aggregations`                        | —                                |

---

### Phase 5 – ⏳ Data Retention

| Tâche | Implémentation                                                         | End-points                        |
| ----- | ---------------------------------------------------------------------- | --------------------------------- |
| 5.1   | Formulaire Retention (base + factor) par **asset / aspect / variable** | `GET /DataService/DataRetentions` |
| 5.2   | Mutation PUT + retour visuel                                           | `PUT /DataService/DataRetentions` |

---

### Phase 6 – 🛡 Rollback & Logs

| Tâche | Implémentation                                                         |
| ----- | ---------------------------------------------------------------------- |
| 6.1   | Stocker la liste `createdIds` et proposer **Undo** (DELETE en cascade) |
| 6.2   | WebSocket / SSE listener → flux logs backend dans un panneau latéral   |

---

### Phase 7 – 🎨 Polish & Prod-ready

| Tâche | Détails                                                             |
| ----- | ------------------------------------------------------------------- |
| 7.1   | Tests unitaires (Vitest) sur `useExcelParse`, `useHierarchyBuilder` |
| 7.2   | E2E Playwright : login, import, bulk                                |
| 7.3   | Storybook pour les composants (Dropzone, Wizard, Progress)          |
| 7.4   | CI GitHub Actions : lint → test → build                             |
| 7.5   | Déploiement Vercel / Docker (EDGE ou on-prem)                       |

---

## Prochaine action immédiate

> **Commencer Phase 1**

1. **Branch** `feature/mapping-wizard`.
2. Créer `<MappingModal>` + state `mappingConfig`.
3. Activer le preview table dans l’onglet **Import**.

Dès que tu as le squelette du wizard, envoie-le et on itérera sur la validation/dry-run !
