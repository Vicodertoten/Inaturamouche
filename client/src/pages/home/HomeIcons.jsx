/* ═══════════════════════════════════════════════════════
   HomeIcons — SVG icons used by HomePage sub-components
   ═══════════════════════════════════════════════════════ */

export const ResumeIcon = () => (
  <svg className="hero-inline-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M8 5v14l11-7z" fill="currentColor" />
  </svg>
);

export const TargetIcon = () => (
  <svg className="hero-inline-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const QuestionIcon = () => (
  <svg className="hero-inline-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M9.2 9.1a2.8 2.8 0 1 1 4.5 2.2c-.9.7-1.6 1.3-1.6 2.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="17.2" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export const MediaIcon = () => (
  <svg className="hero-inline-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 8h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 8l1.3-2h5.4L16 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="13.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const PackSettingsIcon = () => (
  <svg className="hero-inline-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7 7h10v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M9 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M10 12h4M10 15h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const CloseIcon = () => (
  <svg className="close-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const SaveIcon = ({ className = '' }) => (
  <svg className={`action-inline-icon ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M7 3v6h8V3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <circle cx="12" cy="15" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const ShareLinkIcon = ({ className = '' }) => (
  <svg className={`action-inline-icon ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const MyPacksIcon = ({ className = '' }) => (
  <svg className={`action-inline-icon ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

export const DeleteIcon = ({ className = '' }) => (
  <svg className={`action-inline-icon ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const CheckIcon = ({ className = '' }) => (
  <svg className={`action-inline-icon ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 12l5 5L19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const WarningIndicatorIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 3.7 21 19.2a1.2 1.2 0 0 1-1 1.8H4a1.2 1.2 0 0 1-1-1.8L12 3.7Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M12 9.1v5.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="17.6" r="1.05" fill="currentColor" stroke="none" />
  </svg>
);

export const DropdownChevronIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M7 10.5 12 15.5 17 10.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
