import React from 'react';

export const HomeIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
);

export const CollectionIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
  </svg>
);

export const ProfileIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
    />
  </svg>
);

export const SettingsIcon = ({ className }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
    <path
      fill="currentColor"
      d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l1.72-1.35c.15-.12.19-.34.1-.51l-1.63-2.83c-.12-.22-.37-.29-.59-.22l-2.03.81c-.42-.32-.9-.6-1.44-.81l-.3-2.16c-.04-.24-.24-.41-.48-.41h-3.26c-.24 0-.43.17-.47.41l-.3 2.16c-.54.21-1.02.49-1.44.81l-2.03-.81c-.22-.09-.47 0-.59.22L2.74 8.87c-.12.22-.08.44.1.51l1.72 1.35c-.05.3-.07.62-.07.94s.02.64.07.94l-1.72 1.35c-.15.12-.19.34-.1.51l1.63 2.83c.12.22.37.29.59.22l2.03-.81c.42.32.9.6 1.44.81l.3 2.16c.04.24.24.41.48.41h3.26c.24 0 .43-.17.47-.41l.3-2.16c.54-.21 1.02-.49 1.44-.81l2.03.81c.22.09.47 0 .59-.22l1.63-2.83c.12-.22.08-.44-.1-.51l-1.72-1.35zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
    />
  </svg>
);

export const ReportIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"
    />
  </svg>
);

export const HelpIcon = ({ className = 'help-icon' }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
    <path
      fill="currentColor"
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-4.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm0-10c-2.02 0-3.25 1.17-3.55 2.76-.06.3.14.59.44.65l1.23.25c.3.06.59-.13.66-.43.18-.8.72-1.28 1.51-1.28.86 0 1.48.58 1.48 1.4 0 .75-.4 1.15-1.2 1.72-.98.7-1.7 1.38-1.7 2.64v.3c0 .28.22.5.5.5h1.38c.28 0 .5-.22.5-.5v-.18c0-.64.32-.98 1.08-1.52.9-.64 1.82-1.36 1.82-2.96 0-1.95-1.56-3.35-3.65-3.35z"
    />
  </svg>
);

export default {
  HomeIcon,
  CollectionIcon,
  ProfileIcon,
  SettingsIcon,
  ReportIcon,
  HelpIcon,
};
