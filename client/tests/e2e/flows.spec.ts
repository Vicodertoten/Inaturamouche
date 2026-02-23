import { test, expect } from '@playwright/test';

const mockQuestion = {
  image_url: 'https://example.com/bee.jpg',
  image_urls: ['https://example.com/bee.jpg'],
  round_id: 'e2e-round-id-1234',
  round_signature: 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  choix_mode_facile: ['Abeille domestique', 'Gupe commune', 'Frelon europeen', 'Syrphe'],
  choix_mode_facile_ids: [1, 2, 3, 4],
  choice_taxa_details: [
    {
      taxon_id: 1,
      id: 1,
      name: 'Apis mellifera',
      preferred_common_name: 'Abeille domestique',
      wikipedia_url: 'https://fr.wikipedia.org/wiki/Abeille_domestique',
      url: 'https://www.inaturalist.org/taxa/1',
      default_photo: { url: 'https://example.com/bee.jpg' },
    },
    {
      taxon_id: 2,
      id: 2,
      name: 'Vespula vulgaris',
      preferred_common_name: 'Gupe commune',
      url: 'https://www.inaturalist.org/taxa/2',
      default_photo: { url: 'https://example.com/wasp.jpg' },
    },
    {
      taxon_id: 3,
      id: 3,
      name: 'Vespa crabro',
      preferred_common_name: 'Frelon europeen',
      url: 'https://www.inaturalist.org/taxa/3',
      default_photo: { url: 'https://example.com/hornet.jpg' },
    },
    {
      taxon_id: 4,
      id: 4,
      name: 'Episyrphus balteatus',
      preferred_common_name: 'Syrphe',
      url: 'https://www.inaturalist.org/taxa/4',
      default_photo: { url: 'https://example.com/hoverfly.jpg' },
    },
  ],
  inaturalist_url: 'https://www.inaturalist.org/observations/1',
};

const mockPacks = [
  { id: 'custom', type: 'custom', titleKey: 'packs.custom.title', descriptionKey: 'packs.custom.description', category: 'custom', level: 'beginner', visibility: 'home', sortWeight: 0 },
  { id: 'belgium_starter_mix', type: 'dynamic', titleKey: 'packs.belgium_starter_mix.title', descriptionKey: 'packs.belgium_starter_mix.description', region: 'belgium', category: 'starter', level: 'beginner', visibility: 'home', sortWeight: 10, api_params: { taxon_id: '3,40151,47126,47170', place_id: '7008', popular: 'true' } },
  { id: 'world_birds', type: 'dynamic', titleKey: 'packs.world_birds.title', descriptionKey: 'packs.world_birds.description', region: 'world', category: 'world', level: 'beginner', visibility: 'home', sortWeight: 20, api_params: { taxon_id: '3', popular: 'true' } },
  { id: 'world_mammals', type: 'dynamic', titleKey: 'packs.world_mammals.title', descriptionKey: 'packs.world_mammals.description', region: 'world', category: 'world', level: 'beginner', visibility: 'home', sortWeight: 30, api_params: { taxon_id: '40151', popular: 'true' } },
  { id: 'world_plants', type: 'dynamic', titleKey: 'packs.world_plants.title', descriptionKey: 'packs.world_plants.description', region: 'world', category: 'world', level: 'beginner', visibility: 'home', sortWeight: 40, api_params: { taxon_id: '47126', popular: 'true' } },
  { id: 'world_fungi', type: 'dynamic', titleKey: 'packs.world_fungi.title', descriptionKey: 'packs.world_fungi.description', region: 'world', category: 'world', level: 'intermediate', visibility: 'home', sortWeight: 50, api_params: { taxon_id: '47170', popular: 'true' } },
  { id: 'amazing_insects', type: 'dynamic', titleKey: 'packs.amazing_insects.title', descriptionKey: 'packs.amazing_insects.description', region: 'world', category: 'world', level: 'intermediate', visibility: 'home', sortWeight: 60, api_params: { taxon_id: '47158', popular: 'true' } },
  { id: 'europe_birds', type: 'dynamic', titleKey: 'packs.europe_birds.title', descriptionKey: 'packs.europe_birds.description', region: 'europe', category: 'regional', level: 'beginner', visibility: 'home', sortWeight: 70, api_params: { taxon_id: '3', place_id: '67952', popular: 'true' } },
  { id: 'europe_mammals', type: 'dynamic', titleKey: 'packs.europe_mammals.title', descriptionKey: 'packs.europe_mammals.description', region: 'europe', category: 'regional', level: 'beginner', visibility: 'home', sortWeight: 80, api_params: { taxon_id: '40151', place_id: '67952', popular: 'true' } },
  { id: 'europe_plants', type: 'dynamic', titleKey: 'packs.europe_plants.title', descriptionKey: 'packs.europe_plants.description', region: 'europe', category: 'regional', level: 'beginner', visibility: 'home', sortWeight: 90, api_params: { taxon_id: '47126', place_id: '67952', popular: 'true' } },
  { id: 'belgium_birds', type: 'dynamic', titleKey: 'packs.belgium_birds.title', descriptionKey: 'packs.belgium_birds.description', region: 'belgium', category: 'regional', level: 'beginner', visibility: 'home', sortWeight: 96, api_params: { taxon_id: '3', place_id: '7008', popular: 'true' } },
  { id: 'belgium_plants', type: 'dynamic', titleKey: 'packs.belgium_plants.title', descriptionKey: 'packs.belgium_plants.description', region: 'belgium', category: 'regional', level: 'beginner', visibility: 'home', sortWeight: 98, api_params: { taxon_id: '47126', place_id: '7008', popular: 'true' } },
  { id: 'world_threatened_birds', type: 'dynamic', titleKey: 'packs.world_threatened_birds.title', descriptionKey: 'packs.world_threatened_birds.description', region: 'world', category: 'threatened', level: 'intermediate', visibility: 'catalog', sortWeight: 100, api_params: { taxon_id: '3', threatened: 'true' } },
  { id: 'belgium_threatened_birds', type: 'dynamic', titleKey: 'packs.belgium_threatened_birds.title', descriptionKey: 'packs.belgium_threatened_birds.description', region: 'belgium', category: 'threatened', level: 'intermediate', visibility: 'catalog', sortWeight: 140, api_params: { taxon_id: '3', place_id: '7008', threatened: 'true' } },
  { id: 'belgium_edible_plants', type: 'list', titleKey: 'packs.belgium_edible_plants.title', descriptionKey: 'packs.belgium_edible_plants.description', region: 'belgium', category: 'curated', level: 'beginner', visibility: 'catalog', sortWeight: 190, taxa_ids: [47126, 51727, 131013] },
  { id: 'europe_lookalikes_edible_vs_toxic_mushrooms', type: 'list', titleKey: 'packs.europe_lookalikes_edible_vs_toxic_mushrooms.title', descriptionKey: 'packs.europe_lookalikes_edible_vs_toxic_mushrooms.description', region: 'europe', category: 'curated', level: 'advanced', visibility: 'catalog', sortWeight: 279, taxa_ids: [54824, 54733, 53599] },
];

const findPack = (id: string) => mockPacks.find((pack) => pack.id === id);
const mockHomeCatalog = {
  sections: [
    {
      id: 'starter',
      titleKey: 'home.section_starter',
      packs: [
        findPack('belgium_starter_mix'),
        findPack('world_birds'),
        findPack('world_mammals'),
        findPack('world_plants'),
        findPack('world_fungi'),
        findPack('amazing_insects'),
        findPack('europe_birds'),
        findPack('europe_mammals'),
      ].filter(Boolean),
    },
    {
      id: 'near_you',
      titleKey: 'home.section_near_you',
      packs: [
        findPack('belgium_birds'),
        findPack('belgium_plants'),
        findPack('europe_plants'),
        findPack('belgium_threatened_birds'),
      ].filter(Boolean),
    },
    {
      id: 'explore',
      titleKey: 'home.section_explore',
      packs: [
        findPack('world_threatened_birds'),
        findPack('belgium_edible_plants'),
        findPack('europe_lookalikes_edible_vs_toxic_mushrooms'),
      ].filter(Boolean),
    },
  ],
  customEntry: {
    id: 'custom',
    titleKey: 'home.custom_create_title',
    descriptionKey: 'home.custom_create_desc',
  },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('inaturamouche_tutorial_seen', 'true');
    window.localStorage.setItem('SEEDING_COMPLETE_V1', '1');
    window.localStorage.setItem('RARITY_REBUILD_V6', '1');
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (pathname === '/api/packs') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPacks),
      });
      return;
    }

    if (pathname === '/api/packs/home') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHomeCatalog),
      });
      return;
    }

    if (/^\/api\/packs\/[^/]+\/preview$/.test(pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          photos: [
            { url: 'https://example.com/bee.jpg', attribution: 'mock', name: 'Mock species' },
            { url: 'https://example.com/wasp.jpg', attribution: 'mock', name: 'Mock species 2' },
          ],
        }),
      });
      return;
    }

    if (pathname === '/api/quiz-question') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockQuestion),
      });
      return;
    }

    if (pathname === '/api/quiz/submit' && request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'win',
          is_correct: true,
          correct_taxon_id: '1',
          correct_answer: {
            id: 1,
            name: 'Apis mellifera',
            preferred_common_name: 'Abeille domestique',
            rank: 'species',
            observations_count: 1000,
            default_photo: {
              url: 'https://example.com/bee.jpg',
            },
            wikipedia_url: 'https://fr.wikipedia.org/wiki/Abeille_domestique',
            url: 'https://www.inaturalist.org/taxa/1',
          },
          inaturalist_url: 'https://www.inaturalist.org/observations/1',
          attempts_used: 0,
          attempts_remaining: 0,
          round_consumed: true,
        }),
      });
      return;
    }

    if (pathname === '/api/reports' && request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          reportId: 'e2e-report-id',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
});

test('smoke flow: Home -> Play -> End -> Home', async ({ page, baseURL }) => {
  await page.goto(baseURL || '/');
  await expect(page).toHaveURL(/\/?$/);

  const resumeButton = page.locator('.hero-cta--resume');
  if (await resumeButton.isVisible().catch(() => false)) {
    await resumeButton.click();
  } else {
    await page.locator('.tutorial-hero-cta').click();
  }
  await expect(page).toHaveURL(/\/play$/);

  await expect(page.locator('.action-button.quit')).toBeVisible();
  await page.locator('.action-button.quit').click();

  await expect(page).toHaveURL(/\/end$/);
  const achievementCloseButton = page.locator('.achievement-modal .achievement-close-btn');
  if (await achievementCloseButton.isVisible()) {
    await achievementCloseButton.click();
  }
  await expect(page.locator('.end-actions .btn--secondary')).toBeVisible();
  await page.locator('.end-actions .btn--secondary').click({ force: true });

  await expect(page).toHaveURL(/\/?$/);
});

test('smoke flow: report modal submission', async ({ page, baseURL }) => {
  await page.goto(baseURL || '/');
  await expect(page).toHaveURL(/\/?$/);

  await page.locator('.footer-report-btn:visible').first().click();
  await expect(page.locator('.report-modal')).toBeVisible();

  await page.locator('#report-description').fill('Signalement e2e: comportement inattendu sur la page de jeu.');
  await page.locator('.report-modal button[type="submit"]').click();

  await expect(page.locator('.report-modal')).toHaveCount(0);
});

test('homepage shows 3 rails max and an explicit custom pack entry', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(baseURL || '/');
  await expect(page.locator('.home-hero .home-chips')).toBeVisible();
  await expect(page.locator('.home-custom-card')).toBeVisible();
  await expect(page.locator('.home-pack-region')).toHaveCount(3);
});

test('desktop rails keep see-more expansion after selecting a revealed pack', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(baseURL || '/');

  const firstRail = page.locator('.home-pack-region').first();
  const seeMoreButton = firstRail.locator('.home-region-see-more');
  await expect(seeMoreButton).toBeVisible();
  await expect(firstRail.locator('.pack-card')).toHaveCount(6);

  await seeMoreButton.click();
  await expect(firstRail.locator('.pack-card')).toHaveCount(8);

  const revealedPack = firstRail.locator('.pack-card').nth(7);
  await revealedPack.click();
  await expect(revealedPack).toHaveClass(/selected/);
  await expect(firstRail.locator('.pack-card')).toHaveCount(8);
});

test('home pack cards render without badges', async ({ page, baseURL }) => {
  await page.goto(baseURL || '/');
  await expect(page.locator('.pack-card .pack-card-check')).toHaveCount(0);
  await expect(page.locator('.pack-card [class*="badge"]')).toHaveCount(0);
  await expect(page.locator('.pack-card', { hasText: /Nouveau|Populaire|Facile/i })).toHaveCount(0);
});

// Regression test for #issue where AI explanation frame could be clipped on very wide
// viewports.  We simulate a wrong answer and supply a lengthy explanation to force
// scrolling; the modal should render the full box and allow scrolling instead of
// cutting the bottom/right edges off.
test('wide viewport shows whole explanation container and allows scroll', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(baseURL || '/');

  // override answer route so we fail the question
  await page.route('**/api/quiz/submit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'lose',
        is_correct: false,
        correct_taxon_id: '2',
        correct_answer: mockQuestion.choice_taxa_details[1],
        user_answer: mockQuestion.choice_taxa_details[0],
        attempts_used: 1,
        attempts_remaining: 0,
        round_consumed: true,
      }),
    });
  });

  // return a very long explanation so the section needs to scroll/expand
  const longExplanation = Array(200)
    .fill('Lorem ipsum dolor sit amet, consectetur adipiscing elit.')
    .join(' ');

  await page.route('**/api/quiz/explain', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        explanation: longExplanation,
        discriminant: 'Indice important',
        sources: ['Source A'],
      }),
    });
  });

  // start a round and select a wrong answer
  await page.locator('.hero-cta--resume, .tutorial-hero-cta').first().click();
  await expect(page).toHaveURL(/\/play$/);

  // pick first choice (wrong by our route logic)
  await page.locator('.answer-button').first().click();

  // the summary modal should appear
  const modal = page.locator('.summary-modal');
  await expect(modal).toBeVisible();

  const explanationCard = modal.locator('.explanation-section');
  await expect(explanationCard).toBeVisible();

  // check that bounding box is fully within viewport and content is scrollable
  const box = await explanationCard.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.width).toBeLessThanOrEqual(1920);
    expect(box.x + box.width).toBeLessThanOrEqual(1920);
    expect(box.y + box.height).toBeLessThanOrEqual(1080);
  }

  // the inner content should have overflow:auto style applied
  const overflow = await explanationCard.evaluate((el) => window.getComputedStyle(el).overflow);
  expect(overflow).toMatch(/auto|scroll/);
});

test('mobile pack cards keep compact mode without description panel', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL || '/');

  const firstRail = page.locator('.home-pack-region').first();
  const firstPackCard = firstRail.locator('.pack-card').first();
  await expect(firstPackCard).toBeVisible();
  await expect(firstRail.locator('.pack-card-info-trigger')).toHaveCount(0);
  await expect(firstRail.locator('.home-mobile-pack-detail')).toHaveCount(0);

  await firstPackCard.click();
  await expect(firstRail.locator('.home-mobile-pack-detail')).toHaveCount(0);
});
