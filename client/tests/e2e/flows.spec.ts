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
        body: JSON.stringify([]),
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

  await page.locator('.tutorial-start-game').click();
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

  await page.locator('.tutorial-nav-report:visible').first().click();
  await expect(page.locator('.report-modal')).toBeVisible();

  await page.locator('#report-description').fill('Signalement e2e: comportement inattendu sur la page de jeu.');
  await page.locator('.report-modal button[type="submit"]').click();

  await expect(page.locator('.report-modal')).toHaveCount(0);
});
