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
  { id: 'european_trees', type: 'list', titleKey: 'packs.european_trees.title', descriptionKey: 'packs.european_trees.description', region: 'europe', category: 'starter', level: 'beginner', visibility: 'home', sortWeight: 20, taxa_ids: [1, 2] },
  { id: 'european_mushrooms', type: 'list', titleKey: 'packs.european_mushrooms.title', descriptionKey: 'packs.european_mushrooms.description', region: 'europe', category: 'starter', level: 'beginner', visibility: 'home', sortWeight: 25, taxa_ids: [3, 4] },
  { id: 'world_birds', type: 'dynamic', titleKey: 'packs.world_birds.title', descriptionKey: 'packs.world_birds.description', region: 'world', category: 'world', level: 'beginner', visibility: 'home', sortWeight: 30, api_params: { taxon_id: '3' } },
  { id: 'france_mammals', type: 'dynamic', titleKey: 'packs.france_mammals.title', descriptionKey: 'packs.france_mammals.description', region: 'france', category: 'regional', level: 'beginner', visibility: 'home', sortWeight: 35, api_params: { taxon_id: '40151', place_id: '6753' } },
  { id: 'belgium_birds', type: 'dynamic', titleKey: 'packs.belgium_birds.title', descriptionKey: 'packs.belgium_birds.description', region: 'belgium', category: 'regional', level: 'beginner', visibility: 'home', sortWeight: 40, api_params: { taxon_id: '3', place_id: '7008' } },
  { id: 'belgium_wildflowers', type: 'dynamic', titleKey: 'packs.belgium_wildflowers.title', descriptionKey: 'packs.belgium_wildflowers.description', region: 'belgium', category: 'regional', level: 'beginner', visibility: 'home', sortWeight: 45, api_params: { taxon_id: '47125', place_id: '7008' } },
  { id: 'belgium_mammals', type: 'dynamic', titleKey: 'packs.belgium_mammals.title', descriptionKey: 'packs.belgium_mammals.description', region: 'belgium', category: 'regional', level: 'intermediate', visibility: 'home', sortWeight: 50, api_params: { taxon_id: '40151', place_id: '7008' } },
  { id: 'belgium_trees', type: 'dynamic', titleKey: 'packs.belgium_trees.title', descriptionKey: 'packs.belgium_trees.description', region: 'belgium', category: 'regional', level: 'beginner', visibility: 'home', sortWeight: 55, api_params: { taxon_id: '47126', place_id: '7008' } },
  { id: 'world_mammals', type: 'dynamic', titleKey: 'packs.world_mammals.title', descriptionKey: 'packs.world_mammals.description', region: 'world', category: 'world', level: 'beginner', visibility: 'home', sortWeight: 60, api_params: { taxon_id: '40151' } },
  { id: 'world_plants', type: 'dynamic', titleKey: 'packs.world_plants.title', descriptionKey: 'packs.world_plants.description', region: 'world', category: 'world', level: 'intermediate', visibility: 'catalog', sortWeight: 65, api_params: { taxon_id: '47126' } },
];

const findPack = (id: string) => mockPacks.find((pack) => pack.id === id);
const mockHomeCatalog = {
  sections: [
    {
      id: 'starter',
      titleKey: 'home.section_starter',
      packs: [
        findPack('belgium_starter_mix'),
        findPack('european_trees'),
        findPack('european_mushrooms'),
        findPack('world_birds'),
        findPack('france_mammals'),
        findPack('belgium_birds'),
        findPack('belgium_wildflowers'),
        findPack('belgium_mammals'),
      ].filter(Boolean),
    },
    {
      id: 'near_you',
      titleKey: 'home.section_near_you',
      packs: [
        findPack('belgium_birds'),
        findPack('belgium_wildflowers'),
        findPack('belgium_mammals'),
        findPack('belgium_trees'),
      ].filter(Boolean),
    },
    {
      id: 'explore',
      titleKey: 'home.section_explore',
      packs: [
        findPack('world_mammals'),
        findPack('world_plants'),
        findPack('world_birds'),
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

test('desktop rails show 6 cards max before see more expansion', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(baseURL || '/');

  const firstRail = page.locator('.home-pack-region').first();
  const seeMoreButton = firstRail.locator('.home-region-see-more');
  await expect(seeMoreButton).toBeVisible();
  await expect(firstRail.locator('.pack-card')).toHaveCount(6);

  await seeMoreButton.click();
  await expect(firstRail.locator('.pack-card')).toHaveCount(8);
});

test('home pack cards render without badges', async ({ page, baseURL }) => {
  await page.goto(baseURL || '/');
  await expect(page.locator('.pack-card .pack-card-check')).toHaveCount(0);
  await expect(page.locator('.pack-card [class*="badge"]')).toHaveCount(0);
  await expect(page.locator('.pack-card', { hasText: /Nouveau|Populaire|Facile/i })).toHaveCount(0);
});
