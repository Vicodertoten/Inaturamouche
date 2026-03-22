import React, { useEffect, useRef, useCallback, useState } from 'react';
import './BottomSheet.css';

/**
 * Snap point presets (% of viewport height the sheet occupies).
 * Custom snap points can be passed via the `snapPoints` prop.
 */
const DEFAULT_SNAP_POINTS = [0.45, 0.80, 1]; // 45%, 80%, full
const DRAG_THRESHOLD = 40; // px – minimum drag to trigger snap change
const DISMISS_VELOCITY = 600; // px/s – fast swipe-down dismisses
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Reusable BottomSheet component.
 *
 * Features:
 * - Drag handle with touch & mouse support
 * - Snap point system (default 45/80/100%)
 * - Swipe-down to dismiss
 * - Overlay tap to close
 * - Focus trap + Escape key
 * - prefers-reduced-motion support (instant transitions)
 * - Accessible: role="dialog", aria-modal, aria-label
 *
 * Props:
 *  - open {boolean}        – controls visibility
 *  - onClose {function}    – callback when dismissed
 *  - children {ReactNode}  – sheet content
 *  - initialSnap {number}  – index into snapPoints (default: 1 → 80%)
 *  - snapPoints {number[]} – ascending array of fractions (0–1)
 *  - className {string}    – extra class on the sheet panel
 *  - ariaLabel {string}    – accessible label
 *  - hideHandle {boolean}  – hide the drag handle bar
 *  - overlayClose {boolean} – close on overlay tap (default: true)
 */
function BottomSheet({
  open,
  onClose,
  children,
  initialSnap = 1,
  snapPoints = DEFAULT_SNAP_POINTS,
  className = '',
  ariaLabel = '',
  hideHandle = false,
  overlayClose = true,
}) {
  const sheetRef = useRef(null);
  const contentRef = useRef(null);
  const previousFocusRef = useRef(null);
  const dragState = useRef(null);
  const [currentSnap, setCurrentSnap] = useState(initialSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Compute sheet height from snap point
  const snapHeight = snapPoints[currentSnap] ?? snapPoints[snapPoints.length - 1];

  // ─── Open / close lifecycle ────────────────────────────────
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
      setCurrentSnap(initialSnap);
      setIsClosing(false);
      setDragOffset(0);
      // Trigger enter animation on next frame
      requestAnimationFrame(() => setIsVisible(true));
      // Lock body scroll
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, initialSnap]);

  // Focus management
  useEffect(() => {
    if (open && isVisible && contentRef.current) {
      const firstFocusable = contentRef.current.querySelector(FOCUSABLE_SELECTOR);
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        contentRef.current.focus();
      }
    }
  }, [open, isVisible]);

  // Restore focus on close
  useEffect(() => {
    if (!open) {
      previousFocusRef.current?.focus?.();
    }
  }, [open]);

  // ─── Dismiss with animation ────────────────────────────────
  const dismiss = useCallback(() => {
    setIsClosing(true);
    const afterAnimation = () => {
      setIsClosing(false);
      setIsVisible(false);
      onClose();
    };
    // Wait for CSS transition to finish
    const sheet = sheetRef.current;
    if (sheet) {
      const onEnd = () => {
        sheet.removeEventListener('transitionend', onEnd);
        afterAnimation();
      };
      sheet.addEventListener('transitionend', onEnd);
      // Fallback if transitionend never fires
      setTimeout(afterAnimation, 400);
    } else {
      afterAnimation();
    }
  }, [onClose]);

  // ─── Keyboard handling ─────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        dismiss();
        return;
      }
      // Focus trap
      if (e.key === 'Tab' && contentRef.current) {
        const focusable = [...contentRef.current.querySelectorAll(FOCUSABLE_SELECTOR)];
        if (focusable.length === 0) { e.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [dismiss],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  // ─── Drag handling (touch + mouse) ─────────────────────────
  const getY = (e) => (e.touches ? e.touches[0].clientY : e.clientY);

  const handleDragStart = useCallback((e) => {
    // Only start drag from the handle or top area
    dragState.current = {
      startY: getY(e),
      startTime: Date.now(),
      startSnapHeight: snapPoints[currentSnap] ?? 0.8,
    };
    setIsDragging(true);
  }, [currentSnap, snapPoints]);

  const handleDragMove = useCallback((e) => {
    if (!dragState.current) return;
    const deltaY = getY(e) - dragState.current.startY;
    // Only allow downward drag or upward for expanding
    setDragOffset(deltaY);
  }, []);

  const handleDragEnd = useCallback((e) => {
    if (!dragState.current) return;
    const endY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const deltaY = endY - dragState.current.startY;
    const elapsed = Date.now() - dragState.current.startTime;
    const velocity = Math.abs(deltaY) / (elapsed / 1000);

    setIsDragging(false);
    setDragOffset(0);

    // Fast swipe down → dismiss
    if (deltaY > DRAG_THRESHOLD && velocity > DISMISS_VELOCITY) {
      dismiss();
      dragState.current = null;
      return;
    }

    const vh = window.innerHeight;
    const currentSheetPx = dragState.current.startSnapHeight * vh;
    const newSheetPx = currentSheetPx - deltaY;
    const newRatio = newSheetPx / vh;

    // Find closest snap point
    if (Math.abs(deltaY) > DRAG_THRESHOLD) {
      let bestIdx = currentSnap;
      let bestDist = Infinity;
      snapPoints.forEach((sp, idx) => {
        const dist = Math.abs(sp - newRatio);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      });

      // If dragged below lowest snap, dismiss
      if (newRatio < snapPoints[0] * 0.5) {
        dismiss();
      } else {
        setCurrentSnap(bestIdx);
      }
    }

    dragState.current = null;
  }, [currentSnap, dismiss, snapPoints]);

  // Global move/end listeners while dragging
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => handleDragMove(e);
    const onEnd = (e) => handleDragEnd(e);

    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchend', onEnd);
    window.addEventListener('mouseup', onEnd);

    return () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('mouseup', onEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // ─── Render ────────────────────────────────────────────────
  if (!open && !isClosing) return null;

  const sheetPx = snapHeight * 100; // as vh percentage
  const translateY = isClosing
    ? '100%'
    : isVisible
      ? `${Math.max(0, dragOffset)}px`
      : '100%';

  return (
    <div className={`bottom-sheet-overlay ${isVisible && !isClosing ? 'is-visible' : ''}`}
      onClick={overlayClose ? dismiss : undefined}
    >
      <div
        ref={sheetRef}
        className={`bottom-sheet ${isVisible && !isClosing ? 'is-open' : ''} ${isDragging ? 'is-dragging' : ''} ${className}`}
        style={{
          height: `${sheetPx}vh`,
          transform: `translateY(${translateY})`,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        {!hideHandle && (
          <div
            className="bottom-sheet__handle-zone"
            onTouchStart={handleDragStart}
            onMouseDown={handleDragStart}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize sheet"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (currentSnap > 0) setCurrentSnap(currentSnap - 1);
                else dismiss();
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (currentSnap < snapPoints.length - 1) setCurrentSnap(currentSnap + 1);
              }
            }}
          >
            <div className="bottom-sheet__handle" />
          </div>
        )}

        {/* Scrollable content */}
        <div
          ref={contentRef}
          className="bottom-sheet__content"
          tabIndex={-1}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default BottomSheet;
