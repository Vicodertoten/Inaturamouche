# 🎨 Styling Architecture Guide – Inaturamouche

**Last Updated**: January 17, 2026  
**CSS Files**: 33 total  
**Architecture**: Transitioning from Traditional CSS → CSS Modules

## Table of Contents

1. [Current CSS Architecture](#current-css-architecture)
2. [File Organization](#file-organization)
3. [CSS Conventions](#css-conventions)
4. [Migration to CSS Modules](#migration-to-css-modules)
5. [Responsive Design Strategy](#responsive-design-strategy)
6. [Theming System](#theming-system)
7. [Performance Optimization](#performance-optimization)
8. [Best Practices](#best-practices)

---

## Current CSS Architecture

### Overview

Inaturamouche uses a **hybrid CSS approach**:
- **Component-scoped CSS**: Co-located with React components
- **Global CSS**: Layout, resets, and cross-cutting concerns in `/src/styles/`
- **No CSS-in-JS**: Pure CSS files for simplicity and performance

### Architecture Status

| Approach | Files | Status | Purpose |
|----------|-------|--------|---------|
| **Component CSS** | 25 files | ✅ Active | Component-specific styles |
| **Global CSS** | 8 files | ✅ Active | Layout, resets, utilities |
| **CSS Modules** | 0 files | 🚧 Planned | Scoped styles with guaranteed uniqueness |
| **CSS-in-JS** | N/A | ❌ Not used | Not in scope |

---

## File Organization

### Component-Scoped CSS

**Pattern**: Each component has a co-located CSS file

```
src/components/
├── ImageViewer.jsx
├── ImageViewer.css       ← Component styles
├── GameHeader.jsx
├── GameHeader.css
└── EndScreen.jsx
    └── EndScreen.css
```

**Import Pattern**:
```jsx
// ImageViewer.jsx
import './ImageViewer.css';

function ImageViewer({ imageUrls, alt }) {
  return <div className="image-viewer">{...}</div>;
}
```

**Naming Convention**:
- Root class: `.component-name` (kebab-case)
- Child elements: `.component-name__element` (BEM-style)
- Modifiers: `.component-name--modifier`

**Example**:
```css
/* ImageViewer.css */
.image-viewer {
  position: relative;
  width: 100%;
  max-width: 600px;
}

.image-viewer__image {
  width: 100%;
  height: auto;
  object-fit: cover;
}

.image-viewer__controls {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
}

.image-viewer--fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1000;
}
```

### Global CSS Files

**Location**: `/src/styles/`

| File | Purpose | Lines | Scope |
|------|---------|-------|-------|
| `MobileGameLayout.css` | Game screen layout (mobile) | ~150 | Mobile viewport |
| `TouchOptimization.css` | Touch interactions, tap targets | ~100 | Mobile/tablet |
| `BottomNavigationBar.css` | Bottom nav styling | ~80 | Mobile |
| `animations.css` | Reusable animations | ~60 | Global |
| `reset.css` | CSS reset/normalize | ~40 | Global |
| `variables.css` | CSS custom properties | ~50 | Global |
| `utilities.css` | Utility classes | ~30 | Global |

**Import Order** (in `main.jsx`):
```jsx
// 1. Reset and variables
import './styles/reset.css';
import './styles/variables.css';

// 2. Global layout
import './styles/MobileGameLayout.css';
import './styles/TouchOptimization.css';

// 3. Utilities
import './styles/utilities.css';
import './styles/animations.css';

// 4. Component imports
import App from './App';
```

---

## CSS Conventions

### Naming Rules

#### ✅ **Component Classes** (BEM-inspired)
```css
/* Block */
.game-header { }

/* Element */
.game-header__title { }
.game-header__score { }
.game-header__timer { }

/* Modifier */
.game-header--paused { }
.game-header__timer--warning { }
```

#### ✅ **Utility Classes**
```css
/* Layout */
.flex { display: flex; }
.grid { display: grid; }
.hidden { display: none; }

/* Spacing */
.mt-1 { margin-top: 0.5rem; }
.p-2 { padding: 1rem; }

/* Typography */
.text-center { text-align: center; }
.font-bold { font-weight: 700; }
```

#### ❌ **Avoid** (Global namespace pollution)
```css
/* Too generic - conflicts likely */
.button { }
.title { }
.content { }
.active { }

/* Use scoped names instead */
.modal-button { }
.game-title { }
.quiz-content { }
.tab--active { }
```

### CSS Variables

**Location**: `/src/styles/variables.css`

```css
:root {
  /* Colors - Brand */
  --color-primary: #0E7C86;
  --color-primary-dark: #0A5F68;
  --color-primary-light: #12A3B0;
  
  /* Colors - Semantic */
  --color-success: #10B981;
  --color-error: #EF4444;
  --color-warning: #F59E0B;
  --color-info: #3B82F6;
  
  /* Colors - UI */
  --color-background: #FFFFFF;
  --color-surface: #F9FAFB;
  --color-border: #E5E7EB;
  --color-text: #111827;
  --color-text-muted: #6B7280;
  
  /* Spacing */
  --spacing-xs: 0.25rem;  /* 4px */
  --spacing-sm: 0.5rem;   /* 8px */
  --spacing-md: 1rem;     /* 16px */
  --spacing-lg: 1.5rem;   /* 24px */
  --spacing-xl: 2rem;     /* 32px */
  
  /* Typography */
  --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-mono: 'Courier New', monospace;
  
  --font-size-xs: 0.75rem;   /* 12px */
  --font-size-sm: 0.875rem;  /* 14px */
  --font-size-base: 1rem;    /* 16px */
  --font-size-lg: 1.125rem;  /* 18px */
  --font-size-xl: 1.25rem;   /* 20px */
  --font-size-2xl: 1.5rem;   /* 24px */
  
  /* Borders */
  --border-radius-sm: 4px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
  --border-radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  
  /* Z-index layers */
  --z-dropdown: 1000;
  --z-modal: 2000;
  --z-toast: 3000;
  --z-tooltip: 4000;
  
  /* Animations */
  --transition-fast: 150ms;
  --transition-base: 250ms;
  --transition-slow: 400ms;
}
```

**Usage**:
```css
.button-primary {
  background-color: var(--color-primary);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--border-radius-md);
  transition: background-color var(--transition-base);
}

.button-primary:hover {
  background-color: var(--color-primary-dark);
}
```

---

## Migration to CSS Modules

### Why CSS Modules?

**Current Issues**:
- ❌ Global namespace pollution (class name conflicts)
- ❌ No guaranteed scoping (`.active` used in multiple components)
- ❌ Difficult to track unused CSS
- ❌ Specificity wars (`!important` overuse)

**CSS Modules Benefits**:
- ✅ **Automatic scoping**: `.button` becomes `.ImageViewer_button__a3d1e`
- ✅ **Zero conflicts**: Guaranteed unique class names
- ✅ **Tree shaking**: Unused styles removed in production
- ✅ **Explicit dependencies**: Import only what you need
- ✅ **TypeScript support**: Type-safe class names

### Migration Strategy

#### Phase 1: New Components (Immediate)

All new components use CSS Modules:

```jsx
// NewComponent.jsx
import styles from './NewComponent.module.css';

function NewComponent() {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Title</h2>
      <button className={styles.button}>Click</button>
    </div>
  );
}
```

```css
/* NewComponent.module.css */
.container {
  padding: var(--spacing-md);
}

.title {
  font-size: var(--font-size-xl);
  color: var(--color-primary);
}

.button {
  background: var(--color-primary);
  padding: var(--spacing-sm) var(--spacing-md);
}
```

#### Phase 2: Incremental Migration (1-2 months)

Migrate existing components **one by one**:

**Before**:
```jsx
// ImageViewer.jsx
import './ImageViewer.css';

<div className="image-viewer">
  <img className="image-viewer__image" />
</div>
```

**After**:
```jsx
// ImageViewer.jsx
import styles from './ImageViewer.module.css';

<div className={styles.container}>
  <img className={styles.image} />
</div>
```

**Priority Order**:
1. High-traffic components (ImageViewer, GameHeader, EndScreen)
2. Components with naming conflicts
3. Components with complex selectors
4. Low-traffic components

#### Phase 3: Global Styles (Ongoing)

Keep global styles in `/src/styles/` for:
- CSS reset/normalize
- CSS variables
- Layout utilities (`.flex`, `.grid`)
- Animations (`@keyframes`)

**Do NOT migrate to modules**:
- `variables.css`
- `reset.css`
- `utilities.css`
- `animations.css`

### Composition & Mixins

**Combining styles**:
```jsx
// Multiple classes
<div className={`${styles.card} ${styles.featured}`}>

// Conditional classes
<div className={`${styles.button} ${isActive ? styles.active : ''}`}>

// Using classnames library (recommended)
import classNames from 'classnames';

<div className={classNames(styles.button, {
  [styles.active]: isActive,
  [styles.disabled]: isDisabled
})}>
```

**Global styles in modules** (use sparingly):
```css
/* Component.module.css */
.container {
  /* Local styles */
  padding: 1rem;
}

.container :global(.external-class) {
  /* Style external classes */
  color: red;
}
```

---

## Responsive Design Strategy

### Mobile-First Approach

**Breakpoints**:
```css
/* Mobile (default) */
.component { 
  font-size: 14px; 
}

/* Tablet */
@media (min-width: 768px) {
  .component { 
    font-size: 16px; 
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .component { 
    font-size: 18px; 
  }
}

/* Large Desktop */
@media (min-width: 1440px) {
  .component { 
    font-size: 20px; 
  }
}
```

**Custom breakpoint variables**:
```css
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
}
```

### Container Queries (Future)

When browser support improves, use container queries for truly modular components:

```css
.card {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card__title {
    font-size: 1.5rem;
  }
}
```

### Touch-Friendly Design

**Minimum tap targets**: 44x44px (iOS), 48x48px (Material)

```css
/* TouchOptimization.css */
.touch-target {
  min-width: 48px;
  min-height: 48px;
  padding: var(--spacing-sm);
}

.button-touch {
  padding: var(--spacing-md);
  font-size: var(--font-size-lg);
}
```

**Hover states** (desktop only):
```css
@media (hover: hover) and (pointer: fine) {
  .button:hover {
    background-color: var(--color-primary-dark);
  }
}
```

---

## Theming System

### Dark Mode Support (Planned)

**Approach**: CSS variables with `prefers-color-scheme`

```css
/* variables.css */
:root {
  --color-background: #FFFFFF;
  --color-text: #111827;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #1F2937;
    --color-text: #F9FAFB;
  }
}

/* Manual toggle */
[data-theme="dark"] {
  --color-background: #1F2937;
  --color-text: #F9FAFB;
}
```

**Toggle in React**:
```jsx
function ThemeToggle() {
  const [theme, setTheme] = useState('light');
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  
  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Toggle Theme
    </button>
  );
}
```

### Custom Themes (Per Pack)

Allow packs to override color scheme:

```css
/* Pack: Fungi */
[data-pack="fungi"] {
  --color-primary: #8B4513;
  --color-primary-light: #A0522D;
}

/* Pack: Birds */
[data-pack="birds"] {
  --color-primary: #3B82F6;
  --color-primary-light: #60A5FA;
}
```

---

## Performance Optimization

### CSS Loading Strategy

**Critical CSS**: Inline in `<head>` (first paint optimization)

```html
<!-- index.html -->
<head>
  <style>
    /* Critical CSS: above-the-fold styles */
    body { margin: 0; font-family: system-ui; }
    .app-shell { min-height: 100vh; }
  </style>
</head>
```

**Non-critical CSS**: Load asynchronously

```html
<link rel="preload" href="/styles/main.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
```

### Unused CSS Removal

**Vite automatically tree-shakes CSS Modules** ✅

For traditional CSS, use PurgeCSS (optional):

```javascript
// vite.config.js (if needed)
import { purgeCss } from 'vite-plugin-purge';

export default {
  plugins: [
    purgeCss({
      content: ['./src/**/*.jsx', './index.html'],
    })
  ]
}
```

### CSS Minification

**Automatic in production** (Vite + Lightning CSS):
- Remove whitespace
- Shorten class names (CSS Modules)
- Merge duplicate rules
- Remove unused `@keyframes`

### Font Loading

**Strategy**: `font-display: swap` for performance

```css
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap; /* Show fallback font immediately */
  font-weight: 400;
}
```

**Preload critical fonts**:
```html
<link rel="preload" href="/fonts/custom.woff2" as="font" type="font/woff2" crossorigin>
```

---

## Best Practices

### 1. Avoid Deep Nesting

❌ **Bad** (specificity hell):
```css
.game-header .header-content .score-display .score-value .number {
  color: red;
}
```

✅ **Good** (flat structure):
```css
.game-header__score-number {
  color: red;
}
```

### 2. Use Logical Properties

Supports RTL languages automatically:

```css
/* Old */
.box {
  margin-left: 10px;
  padding-right: 20px;
}

/* New (logical properties) */
.box {
  margin-inline-start: 10px;
  padding-inline-end: 20px;
}
```

### 3. Prefer Flexbox/Grid over Floats

```css
/* Layout with Flexbox */
.container {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

/* Layout with Grid */
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-lg);
}
```

### 4. Avoid !important

Only use `!important` for utility classes:

```css
/* Utility class - OK */
.hidden {
  display: none !important;
}

/* Component styles - AVOID */
.button {
  background: red !important; /* ❌ Bad */
}
```

### 5. Use Modern CSS Features

**Aspect Ratio**:
```css
.video-container {
  aspect-ratio: 16 / 9;
}
```

**Clamp for Responsive Typography**:
```css
.title {
  font-size: clamp(1.5rem, 4vw, 3rem);
}
```

**Custom Properties for Dynamic Styles**:
```css
.progress-bar {
  width: calc(var(--progress) * 1%);
}
```

### 6. Organize Styles Logically

**Order within a rule**:
```css
.component {
  /* 1. Positioning */
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
  
  /* 2. Box Model */
  display: flex;
  width: 100%;
  padding: 1rem;
  margin: 0 auto;
  
  /* 3. Typography */
  font-size: 1rem;
  line-height: 1.5;
  color: black;
  
  /* 4. Visual */
  background: white;
  border: 1px solid gray;
  border-radius: 4px;
  
  /* 5. Misc */
  cursor: pointer;
  transition: all 0.3s;
}
```

---

## Accessibility & CSS

### Focus Styles

Always provide visible focus indicators:

```css
.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Never remove outline without alternative */
.button:focus {
  outline: none; /* ❌ Bad */
}
```

### Color Contrast

Ensure WCAG AA compliance (4.5:1 for text):

```css
/* Good contrast */
.text {
  color: #111827; /* Dark gray */
  background: #FFFFFF; /* White */
  /* Contrast ratio: 16.8:1 ✅ */
}

/* Poor contrast */
.text-bad {
  color: #D1D5DB; /* Light gray */
  background: #FFFFFF; /* White */
  /* Contrast ratio: 1.8:1 ❌ */
}
```

**Tools**: Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Reduced Motion

Respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Tools & Workflow

### Linting

**Stylelint** configuration:

```json
// .stylelintrc.json
{
  "extends": "stylelint-config-standard",
  "rules": {
    "selector-class-pattern": "^[a-z][a-z0-9-]*(__[a-z0-9-]+)?(--[a-z0-9-]+)?$",
    "no-descending-specificity": null,
    "custom-property-pattern": "^[a-z][a-z0-9-]*$"
  }
}
```

### Browser DevTools

**Chrome DevTools Tips**:
1. **Coverage tab**: Find unused CSS
2. **Rendering panel**: Emulate dark mode, reduced motion
3. **Lighthouse**: CSS performance audit
4. **Layout Shift**: Debug CLS issues

### VS Code Extensions

Recommended:
- **Stylelint**: Real-time CSS linting
- **CSS Peek**: Jump to CSS definitions
- **Color Highlight**: Preview color values
- **IntelliSense for CSS class names**: Autocomplete

---

## Migration Checklist

When converting a component to CSS Modules:

- [ ] Rename: `Component.css` → `Component.module.css`
- [ ] Update import: `import './Component.css'` → `import styles from './Component.module.css'`
- [ ] Replace class names: `className="class-name"` → `className={styles.className}`
- [ ] Update tests: Mock CSS Modules if needed
- [ ] Remove BEM naming (use simple names)
- [ ] Test in dev and production builds
- [ ] Verify no styling regressions
- [ ] Update COMPONENTS.md documentation

---

## Questions & Support

**CSS Architecture Questions?** Open a discussion in GitHub  
**Found a styling bug?** Create an issue with screenshots  
**Want to contribute?** See [CONTRIBUTING.md](../CONTRIBUTING.md)

---

**Maintained by**: Inaturamouche Core Team  
**Last Review**: January 17, 2026  
**Next Review**: Quarterly (April 2026)
