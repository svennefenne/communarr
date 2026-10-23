"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/** "Back" above a page's title (Deck Force's Back pill): one step back in the site, or to `href`. */
export function BackPill({ href, label = "Back" }: { href: string; label?: string }) {
  const router = useRouter();
  return (
    <div className="back-row">
      <button
        type="button"
        className="back-pill"
        onClick={() => {
          const ref = document.referrer;
          if (ref && new URL(ref).origin === window.location.origin && window.history.length > 1) router.back();
          else router.push(href);
        }}
      >
        <ChevronLeft size={15} /> {label}
      </button>
    </div>
  );
}
