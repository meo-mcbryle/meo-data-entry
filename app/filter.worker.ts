/**
 * Web Worker for off-main-thread filtering of large datasets.
 * This prevents the main UI thread from blocking during heavy search operations.
 */

const toA1Key = (row: number, col: number): string => {
  let colLabel = "";
  let n = col;
  while (n >= 0) {
    colLabel = String.fromCharCode((n % 26) + 65) + colLabel;
    n = Math.floor(n / 26) - 1;
  }
  return `${colLabel}${row + 1}`;
};

self.onmessage = (e: MessageEvent) => {
  const { rowCount, rowFilter, allHeaders, masterColumnOrder, gridData } = e.data;

  if (!rowFilter) {
    const indices = Array.from({ length: rowCount }, (_, i) => i);
    self.postMessage(indices);
    return;
  }

  const lowerCaseFilter = rowFilter.toLowerCase();
  const results: number[] = [];

  for (let i = 0; i < rowCount; i++) {
    let isMatch = false;
    for (const header of allHeaders) {
      const colIdx = masterColumnOrder.indexOf(header);
      if (colIdx === -1) continue;
      const key = toA1Key(i, colIdx);
      const val = gridData.get(key);
      if (val !== undefined && String(val).toLowerCase().includes(lowerCaseFilter)) {
        isMatch = true;
        break;
      }
    }
    if (isMatch) results.push(i);
  }
  self.postMessage(results);
};