# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive documentation organization in /docs/archives/ and /docs/architecture/
- Added .codex-logs/ to .gitignore to prevent development logs from being versioned

### Changed
- Moved historical documentation to /docs/archives/ for better organization
- Moved technical documentation to /docs/architecture/

## [Recent Changes]

### Mobile UI Refactoring
**Reference**: [GIT_COMMIT_MESSAGE.txt](docs/archives/GIT_COMMIT_MESSAGE.txt)

#### Added
- Bottom Navigation Bar component for mobile-first experience
- Glassmorphism styling with backdrop-filter blur effects
- Immersive gameplay layout optimized for mobile devices
- Touch-optimized interface with 44px minimum touch targets
- Safe area insets support for notches and home indicators

#### Changed
- Complete mobile interface redesign for native app feel
- Responsive layout with 768px breakpoint for mobile/desktop
- Game layout maximizes image display on mobile (60-70% screen height)
- Enhanced accessibility with ARIA labels and semantic HTML

### XP System Implementation
**Reference**: [XP_SYSTEM_IMPLEMENTATION.md](docs/architecture/XP_SYSTEM_IMPLEMENTATION.md)

#### Added
- Comprehensive leveling system with XP progression
- Dynamic scoring based on taxon rank and difficulty
- Achievement system integration
- Visual feedback for XP gains with FloatingXPIndicator component

#### Changed
- Hard Mode now displays real-time XP feedback
- Protection against race conditions in guess handling
- Improved XP calculation accuracy

### Streak System Refactoring
**Reference**: [STREAK_REFONTE_SUMMARY.md](docs/archives/STREAK_REFONTE_SUMMARY.md)

#### Added
- Shield system for streak protection (1 shield per 5 streak)
- Permanent shield achievement (STREAK_GUARDIAN)
- In-game shield tracking and display
- Streak persistence between game sessions

#### Changed
- Streak no longer resets completely on first error
- Shields consume before streak breaks
- Maximum 3 shields can be accumulated
- Improved user experience with more forgiving streak mechanics

### Hard Mode Optimizations
**Reference**: [MODIFICATIONS_SUMMARY_FR.md](docs/archives/MODIFICATIONS_SUMMARY_FR.md)

#### Added
- Real-time XP visual feedback in Hard Mode
- FloatingXPIndicator component for immediate gratification
- Race condition protection with isGuessing lock

#### Changed
- Improved feedback visibility in Hard Mode
- More engaging gameplay experience with visual cues
- Better synchronization of async operations

### Technical Improvements

#### Added
- Audit reports and technical documentation
- Comprehensive testing plans and checklists

#### Changed
- Improved code organization and documentation structure
- Better separation of concerns in documentation

## Historical Changes

For detailed historical changes, see the archived documentation in `/docs/archives/`:
- [HARD_MODE_XP_AUDIT_REPORT.md](docs/archives/HARD_MODE_XP_AUDIT_REPORT.md)
- [MODIFICATIONS_SUMMARY_FR.md](docs/archives/MODIFICATIONS_SUMMARY_FR.md)
- [STREAK_REFONTE_SUMMARY.md](docs/archives/STREAK_REFONTE_SUMMARY.md)
- [GIT_COMMIT_MESSAGE.txt](docs/archives/GIT_COMMIT_MESSAGE.txt)

---

**Note**: This CHANGELOG consolidates information from various summary files that were previously in the root directory. For detailed technical implementation notes, refer to the specific documentation files linked above.
