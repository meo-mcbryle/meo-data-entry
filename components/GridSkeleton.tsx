import React from 'react';

const SKEL_COLS = 9;   // number of shimmer columns (index col + 8 data cols)
const SKEL_ROWS = 20;  // number of shimmer rows

// Column label widths to mirror a realistic spreadsheet layout
const COL_WIDTHS = [38, 90, 110, 140, 100, 120, 130, 100, 110];
const COL_LABELS = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// Per-column shimmer bar widths (in %) for visual variety
const BAR_WIDTHS = [70, 80, 55, 90, 60, 75, 85, 65, 50];

export const GridSkeleton = React.memo(function GridSkeleton() {
  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none">
      <table className="border-separate border-spacing-0 table-fixed min-w-full">

        {/* Colgroup to define column widths */}
        <colgroup>
          {COL_WIDTHS.map((w, i) => (
            <col key={i} style={{ width: `${w}px`, minWidth: `${w}px` }} />
          ))}
        </colgroup>

        {/* Header row */}
        <thead>
          <tr className="sticky top-0 z-40">
            {COL_LABELS.map((label, ci) => (
              <th
                key={ci}
                className="border-b border-r border-border bg-card px-2 py-1.5 text-center"
                style={{ height: '30px' }}
              >
                {ci === 0 ? (
                  <span className="block w-4 h-3 rounded skeleton-shimmer opacity-50 mx-auto" />
                ) : (
                  <span className="text-[11px] font-bold tracking-wider text-muted/60 uppercase">
                    {label}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>

        {/* Skeleton body rows */}
        <tbody>
          {Array.from({ length: SKEL_ROWS }, (_, ri) => (
            <tr key={ri}>
              {Array.from({ length: SKEL_COLS }, (_, ci) => {
                const isRowIndex = ci === 0;
                return (
                  <td
                    key={ci}
                    className="border-b border-r border-border bg-card px-2"
                    style={{ height: '30px', verticalAlign: 'middle' }}
                  >
                    {isRowIndex ? (
                      <span className="block text-[10px] font-semibold text-muted/40 text-right pr-1 tabular-nums">
                        {ri + 1}
                      </span>
                    ) : (
                      <span
                        className="block h-3 rounded skeleton-shimmer"
                        style={{
                          width: `${BAR_WIDTHS[ci]}%`,
                          animationDelay: `${((ri * SKEL_COLS + ci) * 40) % 600}ms`,
                          opacity: Math.max(0.2, 1 - ri * 0.035),
                        }}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>

      </table>
    </div>
  );
});
