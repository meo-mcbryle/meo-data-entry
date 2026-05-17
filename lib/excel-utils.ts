/**
 * Cache for column labels to ensure O(1) retrieval after initial calculation.
 */
const labelCache = new Map<number, string>();

/**
 * Converts a 0-based column index to an Excel letter (0 -> 'A', 26 -> 'AA').
 * Optimized with memoization for high-frequency grid rendering.
 */
export const getExcelColumnLabel = (index: number): string => {
  if (labelCache.has(index)) return labelCache.get(index)!;

  let label = '';
  let i = index;
  while (i >= 0) {
    label = String.fromCharCode((i % 26) + 65) + label;
    i = Math.floor(i / 26) - 1;
  }

  labelCache.set(index, label);
  return label;
};

/**
 * Converts 0-based row and column indices to Excel A1 notation.
 * Example: toA1Key(0, 1) -> 'B1'
 */
export const toA1Key = (rowIndex: number, colIndex: number): string => {
  return getExcelColumnLabel(colIndex) + (rowIndex + 1);
};

/**
 * Converts an Excel A1 notation key back to 0-based row and column indices.
 */
export const fromA1Key = (key: string): { row: number, colIndex: number } | null => {
  const match = key.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  
  const letters = match[1];
  const row = parseInt(match[2], 10) - 1;
  
  let colIndex = 0;
  for (let i = 0; i < letters.length; i++) {
    colIndex = colIndex * 26 + (letters.charCodeAt(i) - 64);
  }
  
  return { row, colIndex: colIndex - 1 };
};

/**
 * Hydrates a Sparse Map (using A1 keys) into an array of objects for Supabase.
 * 
 * @param map - The frontend Sparse Map data structure.
 * @param rowCount - Total number of rows to process.
 * @param headers - Ordered array of column names (e.g., ["Item Name", "Amount"]).
 * @param masterHeaders - The stable master array of column names that defines the A1 coordinates.
 * @returns Array of objects ready for Supabase JSONB storage.
 */
export const hydrateMapToArray = (
  map: Map<string, any>,
  rowCount: number,
  headers: string[],
  masterHeaders: string[] = headers
): any[] => {
  const result = [];
  // Optimization: O(1) index lookup for headers
  const headerToIndex = new Map(masterHeaders.map((h, i) => [h, i]));

  for (let r = 0; r < rowCount; r++) {
    const rowObject: Record<string, any> = {};
    
    headers.forEach((header) => {
      const originalColIndex = headerToIndex.get(header);
      if (originalColIndex !== undefined) {
        const a1Key = toA1Key(r, originalColIndex);
        const value = map.get(a1Key);
        if (value !== undefined) {
          rowObject[header] = value;
        }
      }
    });

    // Preserve 'section' metadata which uses a stable template literal key
    const sectionValue = map.get(`${r}:section`);
    if (sectionValue !== undefined) rowObject.section = sectionValue;

    result.push(rowObject);
  }

  return result;
};

/**
 * Dehydrates (parses) an array of objects from Supabase into a Sparse Map using A1 keys.
 * 
 * @param data - The array of row objects from the database.
 * @param headers - The visual order of headers.
 * @param masterHeaders - The stable master array of column names that defines the A1 coordinates.
 * @returns A Map where keys are Excel-style A1 notation.
 */
export const dehydrateArrayToMap = (
  data: any[],
  headers: string[],
  masterHeaders: string[] = headers
): Map<string, any> => {
  const map = new Map<string, any>();
  const headerToIndex = new Map(masterHeaders.map((h, i) => [h, i]));

  data.forEach((row, rowIndex) => {
    headers.forEach((header) => {
      const colIndex = headerToIndex.get(header);
      const value = row[header];
      if (value !== undefined && value !== null && colIndex !== undefined) {
        const a1Key = toA1Key(rowIndex, colIndex);
        map.set(a1Key, value);
      }
    });

    // Preserve 'section' metadata using a specific key format as it's not a grid cell
    if (row.section !== undefined) {
      map.set(`${rowIndex}:section`, row.section);
    }
  });

  return map;
};

/**
 * Re-keys a Sparse Map (using A1 notation) when a new column order is finalized.
 * 
 * @param map - The original Sparse Map.
 * @param oldOrder - The current masterColumnOrder.
 * @param newOrder - The new column order to be committed as master.
 * @returns A new Map with keys re-indexed to the new order.
 */
export const rekeySparseMap = (
  map: Map<string, any>,
  oldOrder: string[],
  newOrder: string[]
): Map<string, any> => {
  const newMap = new Map<string, any>();
  const newIdxMap = new Map(newOrder.map((h, i) => [h, i]));

  map.forEach((val, key) => {
    // Preserve row-based keys like section markers (they aren't A1 coords)
    if (key.includes(':section')) {
      newMap.set(key, val);
      return;
    }

    const coords = fromA1Key(key);
    if (coords) {
      const header = oldOrder[coords.colIndex];
      const newColIdx = newIdxMap.get(header);
      if (newColIdx !== undefined) {
        newMap.set(toA1Key(coords.row, newColIdx), val);
      }
    }
  });

  return newMap;
};

/**
 * Re-keys a metadata Record (Record<string, any>) using A1 notation.
 * Also handles shifting internal references like 'mergedIn' pointers.
 */
export const rekeyMetadataRecord = (
  obj: Record<string, any>,
  oldOrder: string[],
  newOrder: string[]
): Record<string, any> => {
  const newObj: Record<string, any> = {};
  const newIdxMap = new Map(newOrder.map((h, i) => [h, i]));

  const transformKey = (a1Key: string) => {
    const c = fromA1Key(a1Key);
    if (!c) return null;
    const h = oldOrder[c.colIndex];
    const ni = newIdxMap.get(h);
    return ni !== undefined ? toA1Key(c.row, ni) : null;
  };

  Object.keys(obj).forEach((key) => {
    if (key.startsWith('header:')) {
      const h = key.replace('header:', '');
      if (newIdxMap.has(h)) newObj[key] = obj[key];
      return;
    }
    if (key.includes(':section')) { newObj[key] = obj[key]; return; }

    const nk = transformKey(key);
    if (nk) {
      const val = typeof obj[key] === 'object' ? { ...obj[key] } : obj[key];
      if (val && typeof val === 'object' && val.mergedIn) {
        const sh = transformKey(val.mergedIn);
        if (sh) val.mergedIn = sh;
        else delete val.mergedIn;
      }
      newObj[nk] = val;
    }
  });

  return newObj;
};