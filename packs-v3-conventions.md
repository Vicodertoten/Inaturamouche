# PK-40-PACKS-V3 Conventions

Status: canonical
Applies to: backend, frontend, QA
Date: 2026-02-19

## 1. Pack schema

```js
{
  id: string,
  type: 'custom' | 'dynamic' | 'list',
  titleKey: string,
  descriptionKey: string,
  region?: 'belgium' | 'europe' | 'world' | 'france',
  category: 'starter' | 'regional' | 'world' | 'threatened' | 'curated' | 'fun' | 'expert' | 'custom',
  level: 'beginner' | 'intermediate' | 'advanced',
  visibility: 'home' | 'catalog' | 'legacy',
  sortWeight: number,
  api_params?: Record<string, string>,
  taxa_ids?: number[],
  theme?: string,
  tags?: string[],
  healthMinTaxa?: number,
}
```

Compatibility rule: additional fields are optional and must not break current `/api/packs` consumers.

## 2. ID conventions
- Keep existing production IDs unchanged.
- New IDs are snake_case and immutable after release.
- Never repurpose an existing ID for another semantic pack.

## 3. Allowed values
- `category`: `starter`, `regional`, `world`, `threatened`, `curated`, `fun`, `expert`, `custom`
- `level`: `beginner`, `intermediate`, `advanced`
- `visibility`: `home`, `catalog`, `legacy`
- `tags`: controlled values only:
  - `threatened`
  - `edible`
  - `toxic`
  - `medicinal`
  - `invasive`
  - `fun`
  - `seasonal`
  - `lookalike`

## 4. Sort weights
- `10-99`: starter/discovery priority
- `100-189`: threatened
- `190-279`: curated list
- `280-319`: fun/seasonal
- `900+`: legacy

## 5. Migration policy (no-break)
Official rule:

> If a pack is removed from active rails, set `visibility=legacy`.
> Do not delete abruptly.

Additional rules:
- Quiz compatibility with historical `pack_id` must remain intact.
- Old IDs stay resolvable by `findPackById`.
- UI can hide legacy packs from Home while keeping API compatibility.

## 6. Region priority for Home ranking
1. explicit user region override
2. timezone-based region
3. language-based region
4. world fallback

## 7. QA acceptance checklist
- No duplicate IDs
- All title/description keys exist in `fr`, `en`, `nl`
- Home/Configurator order matches server ordering
- No pack-card badge introduced
- `/api/quiz-question?pack_id=...` still works for old + new IDs

## 8. Rollout / rollback
- Feature flag: `PACKS_V3_ENABLED`
- `true` (default): full V3 catalog enabled
- `false`: Home/Catalog falls back to legacy-safe visibility map while keeping all IDs resolvable for quiz compatibility
