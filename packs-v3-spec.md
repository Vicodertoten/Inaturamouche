# PK-40-PACKS-V3 Specification (Freeze)

Status: approved
Frozen on: 2026-02-19
Version: V3

## Goal
Deliver 40 base packs + 4 creative packs (44 total), localized and robust, while preserving quiz compatibility.

## Non-negotiable invariants
1. Existing IDs stay unchanged. New IDs can be added, but never rename IDs already in production.
2. `pack_id` remains compatible on `/api/quiz-question`.
3. Home and Configurator must use the exact same server-defined ordering logic.
4. No UI badge on pack cards.
5. Daily challenge and Review remain separate actions.

## Naming rules
- ID format: lowercase snake_case
- Prefix by scope when relevant: `belgium_`, `europe_`, `world_`
- Dynamic packs must define explicit query params in `api_params`
- List packs must use a curated dataset with traceable sources

## A. Discovery dynamic packs (14)
1. `belgium_starter_mix` - dynamic - `taxon_id=3,40151,47126,47170&place_id=7008&popular=true`
2. `world_birds` - dynamic - `taxon_id=3&popular=true`
3. `world_mammals` - dynamic - `taxon_id=40151&popular=true`
4. `world_plants` - dynamic - `taxon_id=47126&popular=true`
5. `world_fungi` - dynamic - `taxon_id=47170&popular=true`
6. `amazing_insects` - dynamic - `taxon_id=47158&popular=true`
7. `world_herps` - dynamic - `taxon_id=26036,20978&popular=true`
8. `world_fish` - dynamic - `taxon_id=47178&popular=true`
9. `europe_birds` - dynamic - `taxon_id=3&place_id=67952&popular=true`
10. `europe_mammals` - dynamic - `taxon_id=40151&place_id=67952&popular=true`
11. `europe_plants` - dynamic - `taxon_id=47126&place_id=67952&popular=true`
12. `europe_fungi` - dynamic - `taxon_id=47170&place_id=67952&popular=true`
13. `belgium_birds` - dynamic - `taxon_id=3&place_id=7008&popular=true`
14. `belgium_plants` - dynamic - `taxon_id=47126&place_id=7008&popular=true`

## B. Threatened dynamic packs (12)
15. `world_threatened_birds` - dynamic - `taxon_id=3&threatened=true`
16. `world_threatened_mammals` - dynamic - `taxon_id=40151&threatened=true`
17. `world_threatened_insects` - dynamic - `taxon_id=47158&threatened=true`
18. `world_threatened_plants` - dynamic - `taxon_id=47126&threatened=true`
19. `world_threatened_fish` - dynamic - `taxon_id=47178&threatened=true`
20. `world_threatened_herps` - dynamic - `taxon_id=26036,20978&threatened=true`
21. `europe_threatened_birds` - dynamic - `taxon_id=3&place_id=67952&threatened=true`
22. `europe_threatened_mammals` - dynamic - `taxon_id=40151&place_id=67952&threatened=true`
23. `europe_threatened_insects` - dynamic - `taxon_id=47158&place_id=67952&threatened=true`
24. `europe_threatened_plants` - dynamic - `taxon_id=47126&place_id=67952&threatened=true`
25. `belgium_threatened_birds` - dynamic - `taxon_id=3&place_id=7008&threatened=true`
26. `belgium_threatened_mammals` - dynamic - `taxon_id=40151&place_id=7008&threatened=true`

## C. Curated high-value list packs (14)
27. `belgium_edible_plants` - list
28. `belgium_edible_flowers` - list
29. `europe_edible_plants` - list
30. `world_edible_plants_basics` - list
31. `mediterranean_edible_plants` - list
32. `belgium_edible_mushrooms` - list
33. `europe_edible_mushrooms` - list
34. `world_edible_mushrooms_basics` - list
35. `belgium_toxic_mushrooms` - list
36. `europe_toxic_mushrooms` - list
37. `world_medicinal_plants` - list
38. `europe_medicinal_plants` - list
39. `europe_invasive_plants` - list
40. `europe_lookalikes_edible_vs_toxic_mushrooms` - list

## Creative packs (4)
41. `europe_dragons_and_monsters` - dynamic - `taxon_id=47792,26036,20978&place_id=67952&popular=true`
42. `world_weird_invertebrates` - dynamic - `taxon_id=47158,47118,47115&popular=true`
43. `europe_autumn_colors` - dynamic - `taxon_id=47126&place_id=67952&month=9,10,11&popular=true`
44. `world_night_choir` - dynamic - `taxon_id=3,20978&sounds=true&popular=true`

## Validation notes
- Correction applied: rails and defaults should prioritize Belgium/Europe flows (no France-focused priority rail in V3).
- Existing production IDs remain immutable.

## Sign-off
- Product: approved
- Backend: approved
- Frontend: approved
- QA: approved
