# 📦 Component Catalogue – Inaturamouche

**Last Updated**: January 17, 2026  
**Location**: `/client/src/components/`  
**Total Components**: 48

## Table of Contents

1. [Overview](#overview)
2. [Component Categories](#component-categories)
3. [Core Game Components](#core-game-components)
4. [UI Components](#ui-components)
5. [Modal Components](#modal-components)
6. [Layout Components](#layout-components)
7. [Import Path Convention](#import-path-convention)
8. [Best Practices](#best-practices)

---

## Overview

This document provides a comprehensive catalogue of all reusable React components in Inaturamouche. Each component follows functional programming principles with hooks, and is designed for modularity and reusability.

**Architecture Principles**:
- ✅ Functional components with hooks (no class components)
- ✅ Co-located CSS files for component-specific styles
- ✅ Context API for global state (no prop drilling)
- ✅ PropTypes or JSDoc for documentation
- ✅ Minimal external dependencies

---

## Component Categories

| Category | Count | Purpose |
|----------|-------|---------|
| **Game Components** | 12 | Quiz gameplay, questions, answers, scoring |
| **UI Components** | 15 | Reusable UI elements (buttons, inputs, badges) |
| **Modals** | 8 | Overlays for achievements, help, details |
| **Layout** | 6 | Page structure, navigation, headers |
| **Visualizations** | 3 | Phylogenetic tree, XP progress, charts |
| **Feedback** | 4 | Toasts, spinners, notifications |

---

## Core Game Components

### 🎮 **GameHeader.jsx**

**Purpose**: Displays game state during quiz (score, streak, level, timer)

**Props**:
```javascript
{
  score: number,           // Current game score
  streak: number,          // Current win streak
  level: number,           // Player level
  timer: number,           // Seconds elapsed
  isPaused: boolean,       // Pause state
  onPause: () => void,     // Pause handler
}
```

**Usage**:
```jsx
import GameHeader from '@components/GameHeader';

<GameHeader 
  score={850} 
  streak={5} 
  level={12} 
  timer={45} 
  isPaused={false}
  onPause={() => console.log('Paused')} 
/>
```

**Features**:
- ✅ Real-time score display
- ✅ Streak counter with fire emoji
- ✅ Level badge
- ✅ Timer with color coding (green → yellow → red)
- ✅ Responsive design (mobile/desktop variants)

**CSS**: `GameHeader.css`, `GameHeaderMobile.css`

---

### 🖼️ **ImageViewer.jsx**

**Purpose**: Displays observation photos with swipe/zoom capabilities

**Props**:
```javascript
{
  imageUrls: string[],     // Array of image URLs
  alt: string,             // Alt text for accessibility
  onImageLoad: () => void, // Callback when image loads
  loading: 'lazy' | 'eager', // Loading strategy
}
```

**Usage**:
```jsx
import ImageViewer from '@components/ImageViewer';

<ImageViewer 
  imageUrls={[
    'https://static.inaturalist.org/photos/12345/medium.jpg',
    'https://static.inaturalist.org/photos/12346/medium.jpg'
  ]} 
  alt="Amanita muscaria" 
  loading="eager"
/>
```

**Features**:
- ✅ Multi-image carousel (swipe to navigate)
- ✅ Pinch-to-zoom on mobile
- ✅ Lazy loading with skeleton
- ✅ Fallback for missing images
- ✅ Optimized for iNaturalist CDN

**CSS**: `ImageViewer.css`

**Performance**:
- Uses `IntersectionObserver` for lazy loading
- Prefetches next image in carousel
- PWA caches images (CacheFirst strategy)

---

### 🌳 **PhylogeneticTree.jsx**

**Purpose**: Visualizes taxonomic relationships using D3.js

**Props**:
```javascript
{
  targetTaxon: object,     // Correct answer taxon
  lureTaxa: object[],      // Distractor taxa
  selectedTaxonId: number, // User's selected taxon ID
  showLabels: boolean,     // Show scientific names
}
```

**Usage**:
```jsx
import PhylogeneticTree from '@components/PhylogeneticTree';

<PhylogeneticTree 
  targetTaxon={{ id: 48250, name: 'Amanita muscaria', rank: 'species' }}
  lureTaxa={[
    { id: 48251, name: 'Amanita pantherina', rank: 'species' },
    { id: 54743, name: 'Russula emetica', rank: 'species' }
  ]}
  selectedTaxonId={48251}
  showLabels={true}
/>
```

**Features**:
- ✅ Hierarchical tree visualization (kingdom → species)
- ✅ Color-coded branches (target = green, lures = red)
- ✅ Interactive tooltips with rank/name
- ✅ Highlights LCA (Lowest Common Ancestor)
- ✅ Responsive SVG with zoom

**Dependencies**: `d3` (tree layout)

---

### 📝 **AutocompleteInput.jsx**

**Purpose**: Taxon search input with autocomplete (Hard Mode)

**Location**: `/shared/ui/AutocompleteInput.jsx`

**Props**:
```javascript
{
  onSelect: (taxon) => void, // Callback when taxon selected
  placeholder: string,        // Input placeholder
  disabled: boolean,          // Disable input
  filters: object,            // iNaturalist API filters
}
```

**Usage**:
```jsx
import AutocompleteInput from '@shared/ui/AutocompleteInput';

<AutocompleteInput 
  onSelect={(taxon) => console.log('Selected:', taxon)}
  placeholder="Search for a species..."
  filters={{ rank: 'species', iconic_taxa: 'Fungi' }}
/>
```

**Features**:
- ✅ Debounced API requests (300ms)
- ✅ Keyboard navigation (arrow keys, enter, escape)
- ✅ Displays common name + scientific name
- ✅ Rank badge (species, genus, family)
- ✅ Loading spinner during search
- ✅ Empty state when no results

**API**: `GET /api/taxa/autocomplete?q={query}`

---

### 🎯 **RoundSummaryModal.jsx**

**Purpose**: Shows question result with detailed feedback

**Props**:
```javascript
{
  isVisible: boolean,
  result: 'correct' | 'incorrect',
  targetTaxon: object,
  selectedTaxon: object,
  xpEarned: number,
  multipliers: object,
  onContinue: () => void,
}
```

**Usage**:
```jsx
import RoundSummaryModal from '@components/RoundSummaryModal';

<RoundSummaryModal 
  isVisible={true}
  result="correct"
  targetTaxon={{ id: 48250, name: 'Amanita muscaria' }}
  selectedTaxon={{ id: 48250, name: 'Amanita muscaria' }}
  xpEarned={45}
  multipliers={{ base: 15, streak: 1.2, timer: 1.0 }}
  onContinue={() => console.log('Next question')}
/>
```

**Features**:
- ✅ Animated entrance (slide up)
- ✅ XP breakdown with multipliers
- ✅ Phylogenetic tree comparison
- ✅ Taxon details (rank, common name, wikipedia link)
- ✅ Continue button with haptic feedback

**CSS**: `RoundSummaryModal.css`

---

### 📊 **EndScreen.jsx**

**Purpose**: Displays game summary with stats and achievements

**Props**:
```javascript
{
  stats: object,           // Game statistics
  newAchievements: array,  // Unlocked achievements
  onRestart: () => void,   // Restart game
  onHome: () => void,      // Return to home
}
```

**Usage**:
```jsx
import EndScreen from '@components/EndScreen';

<EndScreen 
  stats={{
    totalQuestions: 10,
    correctAnswers: 8,
    totalXP: 450,
    averageTime: 12.5,
    perfectStreak: 5
  }}
  newAchievements={[
    { id: 'streak_5', name: 'Hot Streak', icon: '🔥' }
  ]}
  onRestart={() => console.log('Restart')}
  onHome={() => navigate('/')}
/>
```

**Features**:
- ✅ Animated stats reveal
- ✅ Achievement popups
- ✅ Share button (Web Share API)
- ✅ Performance grade (A+, A, B, C)
- ✅ Collection additions highlighted

**CSS**: `EndScreen.css`

---

## UI Components

### 🏆 **DailyStreakBadge.jsx**

**Purpose**: Displays current daily streak with shield indicator

**Props**:
```javascript
{
  days: number,            // Streak length in days
  shields: number,         // Available streak shields
  onClick: () => void,     // Badge click handler
}
```

**Usage**:
```jsx
import DailyStreakBadge from '@components/DailyStreakBadge';

<DailyStreakBadge 
  days={12} 
  shields={2} 
  onClick={() => console.log('Show streak details')} 
/>
```

**Features**:
- ✅ Animated fire emoji for active streaks
- ✅ Shield icons (🛡️) for protection
- ✅ Color changes based on streak length
- ✅ Tooltip with streak explanation

**CSS**: `DailyStreakBadge.css`

---

### 📈 **XPProgressBar.jsx**

**Purpose**: Shows progress toward next level

**Props**:
```javascript
{
  currentXP: number,       // Current XP in level
  requiredXP: number,      // XP needed for next level
  level: number,           // Current level
  animated: boolean,       // Animate progress
}
```

**Usage**:
```jsx
import XPProgressBar from '@components/XPProgressBar';

<XPProgressBar 
  currentXP={350} 
  requiredXP={500} 
  level={12} 
  animated={true} 
/>
```

**Features**:
- ✅ Smooth progress animation
- ✅ Percentage display
- ✅ Level badge
- ✅ Color gradient (green → blue)

**CSS**: `XPProgressBar.css`

---

### ✨ **FloatingXPIndicator.jsx**

**Purpose**: Floating XP gain animation during gameplay

**Props**:
```javascript
{
  xp: number,              // XP amount
  x: number,               // Screen X position
  y: number,               // Screen Y position
  onComplete: () => void,  // Animation complete callback
}
```

**Usage**:
```jsx
import FloatingXPIndicator from '@components/FloatingXPIndicator';

<FloatingXPIndicator 
  xp={45} 
  x={150} 
  y={300} 
  onComplete={() => console.log('Animation done')} 
/>
```

**Features**:
- ✅ Float-up animation (CSS transform)
- ✅ Fade out effect
- ✅ Auto-removes after 2s
- ✅ Color-coded (green for gain, red for loss)

**CSS**: `FloatingXPIndicator.css`

---

### 🎴 **CollectionCard.jsx**

**Purpose**: Displays a collected species in user's collection

**Props**:
```javascript
{
  taxon: object,           // Taxon data
  observations: number,    // Number of observations
  firstSeen: string,       // ISO date string
  onClick: () => void,     // Card click handler
}
```

**Usage**:
```jsx
import CollectionCard from '@components/CollectionCard';

<CollectionCard 
  taxon={{
    id: 48250,
    name: 'Amanita muscaria',
    commonName: 'Fly Agaric',
    image: 'https://...'
  }}
  observations={5}
  firstSeen="2026-01-15T10:30:00Z"
  onClick={() => console.log('Show details')}
/>
```

**Features**:
- ✅ Thumbnail image with lazy loading
- ✅ Scientific + common name
- ✅ Observation count badge
- ✅ First seen date
- ✅ Hover effects

**CSS**: `CollectionCard.css`

---

### 🔔 **ToastContainer.jsx**

**Purpose**: Global toast notification system

**Usage**:
```jsx
import { ToastContainer, showToast } from '@components/ToastContainer';

// In App.jsx
<ToastContainer />

// Anywhere in the app
showToast('Achievement unlocked!', 'success');
showToast('Network error', 'error');
showToast('Loading...', 'info');
```

**Toast Types**:
- `success` – Green with checkmark
- `error` – Red with X icon
- `info` – Blue with info icon
- `warning` – Yellow with warning icon

**Features**:
- ✅ Auto-dismiss (3s default)
- ✅ Stacking multiple toasts
- ✅ Swipe to dismiss (mobile)
- ✅ Pause on hover

**CSS**: `ToastContainer.css`

---

## Modal Components

### 🏅 **AchievementModal.jsx**

**Purpose**: Celebrates newly unlocked achievements

**Props**:
```javascript
{
  achievement: object,     // Achievement data
  isVisible: boolean,      // Modal visibility
  onClose: () => void,     // Close handler
}
```

**Usage**:
```jsx
import AchievementModal from '@components/AchievementModal';

<AchievementModal 
  achievement={{
    id: 'perfect_game',
    name: 'Perfect Game',
    description: 'Answer all questions correctly',
    icon: '🎯',
    rarity: 'epic'
  }}
  isVisible={true}
  onClose={() => console.log('Modal closed')}
/>
```

**Features**:
- ✅ Confetti animation (canvas-confetti)
- ✅ Rarity badge (common, rare, epic, legendary)
- ✅ Achievement icon (emoji)
- ✅ Share button
- ✅ Auto-closes after 5s

---

### ❓ **HelpModal.jsx**

**Purpose**: Context-sensitive help and tutorials

**Props**:
```javascript
{
  isVisible: boolean,
  topic: string,           // Help topic (game, scoring, streaks)
  onClose: () => void,
}
```

**Usage**:
```jsx
import HelpModal from '@components/HelpModal';

<HelpModal 
  isVisible={true}
  topic="scoring"
  onClose={() => setShowHelp(false)}
/>
```

**Topics**:
- `game` – How to play, controls, objectives
- `scoring` – XP calculation, multipliers, perks
- `streaks` – Daily streaks, shields, bonuses
- `hardmode` – Autocomplete input, advanced challenges
- `achievements` – Achievement system explanation

**CSS**: `HelpModal.css`

---

### 🔬 **SpeciesDetailModal.jsx**

**Purpose**: Shows detailed taxon information (taxonomy, observations, range map)

**Props**:
```javascript
{
  taxon: object,           // Taxon data
  isVisible: boolean,
  onClose: () => void,
}
```

**Usage**:
```jsx
import SpeciesDetailModal from '@components/SpeciesDetailModal';

<SpeciesDetailModal 
  taxon={{
    id: 48250,
    name: 'Amanita muscaria',
    commonName: 'Fly Agaric',
    rank: 'species',
    ancestry: 'Fungi/Basidiomycota/Agaricomycetes/...'
  }}
  isVisible={true}
  onClose={() => setShowDetail(false)}
/>
```

**Features**:
- ✅ Full taxonomic hierarchy
- ✅ Wikipedia excerpt
- ✅ iNaturalist link
- ✅ Range map (Leaflet.js)
- ✅ Conservation status

**CSS**: `SpeciesDetailModal.css`

---

### ⚙️ **PreferencesMenu.jsx**

**Purpose**: User preferences and settings

**Features**:
- ✅ Language selection (fr, en, nl)
- ✅ Haptic feedback toggle
- ✅ Sound effects toggle
- ✅ Theme selection (light, dark, auto)
- ✅ Data export (profile, collection)
- ✅ Reset progress with confirmation

**CSS**: `PreferencesMenu.css`

---

## Layout Components

### 📱 **AppLayout.jsx**

**Purpose**: Main app shell with navigation and offline indicator

**Structure**:
```jsx
<AppLayout>
  <Header />
  <main>
    {children}
  </main>
  <BottomNavigationBar />
  <OfflineIndicator />
</AppLayout>
```

**Features**:
- ✅ Responsive layout (mobile-first)
- ✅ Sticky navigation
- ✅ Safe area insets for iOS notch
- ✅ PWA install prompt

---

### 🧭 **BottomNavigationBar.jsx**

**Purpose**: Bottom tab navigation (mobile)

**Tabs**:
- 🏠 Home
- 🎮 Play
- 📚 Collection
- 👤 Profile

**Features**:
- ✅ Active tab highlighting
- ✅ Badge notifications
- ✅ Haptic feedback on tap
- ✅ Hidden during gameplay

---

### 📡 **OfflineIndicator.jsx**

**Purpose**: Shows network status (PWA offline support)

**States**:
- ✅ Online – Hidden
- ⚠️ Offline – Yellow banner "You're offline. Some features may be limited."
- 🔄 Syncing – Blue banner "Reconnecting..."

**Features**:
- ✅ Auto-hide after 3s when back online
- ✅ Persistent during offline state
- ✅ Click to retry connection

---

## Import Path Convention

With Vite path aliases configured in `vite.config.js`, use the following import patterns:

### ✅ **Recommended** (with aliases):
```javascript
// Components
import ImageViewer from '@components/ImageViewer';
import GameHeader from '@components/GameHeader';

// Services
import { fetchQuizQuestion } from '@services/api';

// Contexts
import { useGameData } from '@contexts/GameContext';

// Hooks
import useQuestionQueue from '@hooks/useQuestionQueue';

// Utils
import { computeScore } from '@utils/scoring';

// Shared UI
import AutocompleteInput from '@shared/ui/AutocompleteInput';
```

### ❌ **Deprecated** (relative paths):
```javascript
// Avoid deep relative imports
import ImageViewer from '../../../components/ImageViewer'; // DON'T
```

---

## Best Practices

### Component Design

1. **Single Responsibility**: Each component has one clear purpose
2. **Composition over Inheritance**: Build complex UIs from small components
3. **Props Validation**: Use PropTypes or JSDoc for type safety
4. **Controlled Components**: State managed by parent when possible
5. **Error Boundaries**: Wrap risky components (e.g., D3 visualizations)

### Performance

1. **React.memo**: Memoize expensive components (e.g., `PhylogeneticTree`)
2. **Lazy Loading**: Use `React.lazy()` for code splitting
3. **useCallback**: Memoize event handlers passed to children
4. **Virtual Scrolling**: Use for long lists (e.g., collection gallery)
5. **Debounce**: Debounce search inputs (AutocompleteInput)

### Accessibility

1. **Semantic HTML**: Use `<button>`, `<nav>`, `<main>` appropriately
2. **ARIA Labels**: Add `aria-label` for icon buttons
3. **Keyboard Navigation**: Ensure all interactive elements are keyboard-accessible
4. **Focus Management**: Trap focus in modals, restore on close
5. **Color Contrast**: Ensure WCAG AA compliance (4.5:1 minimum)

### Testing

1. **Unit Tests**: Test utility functions in isolation
2. **Component Tests**: Use React Testing Library
3. **Integration Tests**: Test user flows (e.g., complete quiz)
4. **Snapshot Tests**: Prevent unintended UI regressions
5. **E2E Tests**: Use Playwright for critical paths

---

## Adding New Components

When creating a new component, follow this checklist:

- [ ] Create component file: `ComponentName.jsx`
- [ ] Create CSS file (if needed): `ComponentName.css`
- [ ] Add JSDoc comments with `@param` and `@returns`
- [ ] Export component as default export
- [ ] Add PropTypes or TypeScript types
- [ ] Write unit tests: `ComponentName.test.jsx`
- [ ] Document in this file (COMPONENTS.md)
- [ ] Use Vite aliases for imports (`@components`, etc.)
- [ ] Ensure accessibility (keyboard, screen reader)
- [ ] Test on mobile and desktop viewports

---

## Future Improvements

### Planned Enhancements

1. **CSS Modules Migration**: Convert `ComponentName.css` → `ComponentName.module.css`
2. **TypeScript Migration**: Add type definitions for all props
3. **Storybook**: Add visual component documentation
4. **Snapshot Tests**: Prevent UI regressions
5. **Component Library**: Extract reusable components to separate package

### Component Requests

- [ ] `Tooltip.jsx` – Reusable tooltip with positioning
- [ ] `Dropdown.jsx` – Accessible dropdown menu
- [ ] `Skeleton.jsx` – Generic skeleton loader
- [ ] `EmptyState.jsx` – Consistent empty state UI
- [ ] `ErrorBoundary.jsx` – Global error boundary with fallback

---

**Maintained by**: Inaturamouche Core Team  
**Questions?**: See [CONTRIBUTING.md](../CONTRIBUTING.md) or open an issue.
