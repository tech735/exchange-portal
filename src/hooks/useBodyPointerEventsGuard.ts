import { useEffect } from 'react';

/**
 * Radix's modal layers (Dialog/Sheet/AlertDialog/DropdownMenu/Select) lock
 * `pointer-events: none` onto <body> while open, and release it on unmount.
 * When two of those layers overlap — e.g. a DropdownMenuItem that opens a
 * Sheet — or when a layer is torn out of the tree instead of being closed,
 * the release can be skipped and <body> stays permanently unclickable.
 *
 * This guard watches <body>'s style attribute and strips a `pointer-events:
 * none` that no longer has an open overlay backing it. It never touches the
 * lock while a real overlay is on screen, so open modals still behave.
 */

// Elements that legitimately justify a body-level pointer-events lock.
const OPEN_OVERLAY_SELECTOR = [
  '[data-radix-popper-content-wrapper]', // dropdown / popover / select / tooltip content
  '[role="dialog"][data-state="open"]', // Dialog + Sheet content
  '[role="alertdialog"][data-state="open"]', // AlertDialog content
  '[role="menu"][data-state="open"]', // menu content rendered without popper
  '[role="listbox"][data-state="open"]', // item-aligned Select content
].join(',');

function releaseStaleLock() {
  if (document.body.style.pointerEvents !== 'none') return;
  if (document.querySelector(OPEN_OVERLAY_SELECTOR)) return;
  document.body.style.removeProperty('pointer-events');
}

export function useBodyPointerEventsGuard() {
  useEffect(() => {
    let frame = 0;

    // Radix removes the overlay and the body lock in separate DOM writes, so
    // settle to the end of the frame before judging whether the lock is stale.
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(releaseStaleLock);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style'],
      childList: true,
      subtree: true,
    });

    schedule();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
}
