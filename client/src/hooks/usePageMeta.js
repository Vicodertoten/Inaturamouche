import { useEffect } from 'react';

function ensureMeta(attr, key) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  return el;
}

function setMeta(attr, key, value) {
  if (!value) return;
  const el = ensureMeta(attr, key);
  el.setAttribute('content', value);
}

function ensureCanonicalLink() {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  return link;
}

const OG_LOCALE_BY_LANG = {
  fr: 'fr_FR',
  en: 'en_US',
  nl: 'nl_NL',
};

export function usePageMeta({
  title,
  description,
  canonicalPath = '/',
  robots = 'index,follow,max-image-preview:large',
  imagePath = '/android-chrome-512x512.png',
  language = 'fr',
}) {
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const origin = window.location.origin;
    const canonicalUrl = new URL(canonicalPath || '/', origin).toString();
    const imageUrl = new URL(imagePath || '/android-chrome-512x512.png', origin).toString();
    const resolvedTitle = title || 'iNaturaQuizz';
    const resolvedDescription = description || '';
    const ogLocale = OG_LOCALE_BY_LANG[language] || OG_LOCALE_BY_LANG.fr;

    document.title = resolvedTitle;
    setMeta('name', 'description', resolvedDescription);
    setMeta('name', 'robots', robots);

    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', 'iNaturaQuizz');
    setMeta('property', 'og:locale', ogLocale);
    setMeta('property', 'og:title', resolvedTitle);
    setMeta('property', 'og:description', resolvedDescription);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', imageUrl);
    setMeta('property', 'og:image:alt', resolvedTitle);

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', resolvedTitle);
    setMeta('name', 'twitter:description', resolvedDescription);
    setMeta('name', 'twitter:image', imageUrl);
    setMeta('name', 'twitter:image:alt', resolvedTitle);

    const canonicalLink = ensureCanonicalLink();
    canonicalLink.setAttribute('href', canonicalUrl);
  }, [canonicalPath, description, imagePath, language, robots, title]);
}

export default usePageMeta;
