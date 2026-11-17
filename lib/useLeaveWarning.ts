"use client";

import { useEffect } from "react";

const MESSAGE = "A game is in progress. If you leave this page, the game stops for your students. Leave anyway?";

// While `active`, asks before the page is left by accident:
//  * closing the tab, reloading or typing another address → the browser's
//    own "Leave site?" dialog (beforeunload; browsers show their own text);
//  * clicking an in-app link (Next.js navigates without unloading the page,
//    so beforeunload never fires) → a confirm() with MESSAGE.
// The browser Back button isn't covered: Next.js handles it client-side and
// it can't be cancelled.
export function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Older browsers need returnValue set to show the dialog.
      e.returnValue = "";
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      // Opening in a new tab or window doesn't leave this page.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return; // beforeunload covers it
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    // Capture phase, so this runs before Next.js's <Link> handler.
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);
}
