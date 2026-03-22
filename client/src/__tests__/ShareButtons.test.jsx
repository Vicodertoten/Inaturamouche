import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ShareButtons from '../components/ShareButtons.jsx';
import { nativeShare as nativeShareMock } from '../utils/shareCard';

const notifyMock = vi.fn();
const copyToClipboardMock = vi.fn();
const openMock = vi.fn();
const matchMediaMock = vi.fn();

Object.defineProperty(window, 'open', {
  value: openMock,
  writable: true,
});

Object.defineProperty(window, 'matchMedia', {
  value: matchMediaMock,
  writable: true,
});

Object.defineProperty(navigator, 'share', {
  value: vi.fn(),
  writable: true,
  configurable: true,
});

vi.mock('../context/LanguageContext.jsx', () => ({
  useLanguage: () => ({
    t: (_key, _params, fallback) => fallback || _key,
  }),
}));

vi.mock('../services/notifications', () => ({
  notify: (...args) => notifyMock(...args),
}));

vi.mock('../utils/shareCard', async () => {
  const actual = await vi.importActual('../utils/shareCard');
  return {
    ...actual,
    generateShareCard: vi.fn(async () => new Blob(['fake'], { type: 'image/png' })),
    nativeShare: vi.fn(async () => ({ status: 'unavailable' })),
    copyToClipboard: (...args) => copyToClipboardMock(...args),
  };
});

describe('ShareButtons', () => {
  beforeEach(() => {
    notifyMock.mockReset();
    copyToClipboardMock.mockReset();
    openMock.mockReset();
    matchMediaMock.mockReset();
    matchMediaMock.mockReturnValue({ matches: false });
    copyToClipboardMock.mockResolvedValue(true);
    openMock.mockReturnValue({});
    nativeShareMock.mockClear();
  });

  it('opens the share sheet on desktop and copies a social share text with the recap URL', async () => {
    render(
      <ShareButtons
        score={8}
        total={10}
        packName="Oiseaux de Belgique"
        topSpecies="Mésange bleue"
        isDaily={false}
        mode="Facile"
        shareUrl="https://inaturaquizz.com/results/share/abc123"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Partager mon récap' }));
    expect(screen.getByRole('dialog', { name: 'Partager mon récap' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Copier le message de partage/i }));

    await waitFor(() => {
      expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
    });

    const copiedText = copyToClipboardMock.mock.calls[0][0];
    expect(copiedText).toContain('https://inaturaquizz.com/results/share/abc123');
    expect(copiedText).toContain('Oiseaux de Belgique');
    expect(copiedText).toContain('Regarde mon récap et essaie toi aussi');
  });

  it('opens the recap page when copying the share text fails', async () => {
    copyToClipboardMock.mockResolvedValue(false);

    render(
      <ShareButtons
        score={5}
        total={10}
        packName="Oiseaux de Belgique"
        topSpecies="Mésange bleue"
        isDaily={false}
        mode="Facile"
        shareUrl="https://inaturaquizz.com/results/share/fallback123"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Partager mon récap' }));
    fireEvent.click(screen.getByRole('button', { name: /Copier le message de partage/i }));

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith(
        'https://inaturaquizz.com/results/share/fallback123',
        '_blank',
        'noopener,noreferrer',
      );
    });
  });

  it('tries native share first on mobile and falls back to the sheet when unavailable', async () => {
    matchMediaMock.mockReturnValue({ matches: true });

    render(
      <ShareButtons
        score={6}
        total={10}
        packName="Oiseaux de Belgique"
        topSpecies="Mésange bleue"
        isDaily={false}
        mode="Facile"
        shareUrl="https://inaturaquizz.com/results/share/mobile123"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Partager mon récap' }));

    await waitFor(() => {
      expect(nativeShareMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('dialog', { name: 'Partager mon récap' })).toBeInTheDocument();
  });
});
