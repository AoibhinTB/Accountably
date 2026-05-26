"use client";

import { ReactNode } from "react";
import { OPEN_EDIT_PACT_EVENT } from "./edit-pact-dialog";

// Wraps the pact-hero icon so tapping it opens the edit dialog. The dialog
// itself lives elsewhere on the page and listens for OPEN_EDIT_PACT_EVENT
// on window, so this trigger doesn't need to know about its state.
export function IconEditTrigger({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel: string;
}) {
  const open = () => {
    window.dispatchEvent(new CustomEvent(OPEN_EDIT_PACT_EVENT));
  };
  return (
    <button
      type="button"
      onClick={open}
      aria-label={ariaLabel}
      className="press"
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        display: "inline-flex",
      }}
    >
      {children}
    </button>
  );
}
