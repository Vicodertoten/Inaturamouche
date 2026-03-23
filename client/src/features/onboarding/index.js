export { default as Onboarding } from './Onboarding';

const ONBOARDING_STORAGE_KEY = 'inaturamouche_onboarding_done';

export function isOnboardingDone() {
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
