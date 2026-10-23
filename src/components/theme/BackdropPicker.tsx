"use client";

import { useT } from "@/components/app/AppProvider";
import { BACKDROPS, type Backdrop, type LibraryBackdrop } from "@/lib/theme";

/** The built-in backdrops, then the pictures an admin uploaded (Admin → Colours & background). */
export function BackdropPicker({ value, onChange, library }: { value: Backdrop; onChange: (b: Backdrop) => void; library: LibraryBackdrop[] }) {
  const t = useT();
  return (
    <div className="stack tight">
      <div className="pills">
        {BACKDROPS.map((b) => (
          <button key={b.id} type="button" className={`pill ${value === b.id ? "active" : ""}`} aria-pressed={value === b.id} onClick={() => onChange(b.id)}>
            {t(b.label)}
          </button>
        ))}
      </div>
      {library.length ? (
        <div className="backdrop-tiles">
          {library.map((b) => {
            const id: Backdrop = `pic:${b.id}`;
            return (
              <button
                key={b.id}
                type="button"
                className={`backdrop-tile ${value === id ? "active" : ""}`}
                aria-pressed={value === id}
                onClick={() => onChange(id)}
                style={{ backgroundImage: `url("${b.desktop || b.mobile}")` }}
              >
                <span>{b.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
