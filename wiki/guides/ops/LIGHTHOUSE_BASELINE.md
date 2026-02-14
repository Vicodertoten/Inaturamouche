# Lighthouse Baseline (staging)

Gate configure via:
- `.lighthouserc.json`
- `.github/workflows/deploy.yml` (job `lighthouse-staging`)

## Seuils actuels

- Performance >= 0.75
- Accessibilite >= 0.90
- Best Practices >= 0.85
- SEO >= 0.90

Checks critiques:
- `meta-description`
- `document-title`
- `html-has-lang`
- `is-crawlable`
- `robots-txt`

## Procedure

1. deploy staging
2. lancer job lighthouse
3. verifier artifacts CI
4. bloquer la promotion prod si seuils non atteints
