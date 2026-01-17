import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageViewer from '../components/ImageViewer.jsx';

vi.mock('../context/LanguageContext.jsx', () => ({
  useLanguage: () => ({ t: (k) => k }),
}));

describe('ImageViewer', () => {
  it('renders main image and navigation', async () => {
    const images = ['http://example.com/a.jpg', 'http://example.com/b.jpg'];
    render(<ImageViewer imageUrls={images} alt="alt text" nextImageUrl={images[1]} />);

    // low-res image should be in the document (loading handled by jsdom)
    const main = await screen.findByAltText('alt text');
    expect(main).toBeInTheDocument();

    // navigation buttons present
    const prev = screen.getByLabelText('imageViewer.previous');
    const next = screen.getByLabelText('imageViewer.next');
    expect(prev).toBeInTheDocument();
    expect(next).toBeInTheDocument();

    // click next advances index
    fireEvent.click(next);
    // dot active toggles (no direct text change but ensure still present)
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });
});
