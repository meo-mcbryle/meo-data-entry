import { fromA1Key, toA1Key, formatDateDisplay } from './excel-utils';

export function evaluateFormula(
  value: any, 
  rowData: any, 
  gridData: Map<string, any>, 
  masterColumnOrder: string[], 
  columnOrder: string[], 
  formatId?: string
): any {
  if (typeof value !== 'string' || !value.startsWith('=')) return value;
  try {
    const headers = columnOrder.length > 0 ? columnOrder : ["Title / Item", "Amount", "Location", "Allocation", "Notes"];

    const resolveSingleValue = (arg: string) => {
      // 1. Handle A1 Cell References using shared utility
      const coords = fromA1Key(arg.toUpperCase());
      if (coords) {
        const colName = headers[coords.colIndex];
        const mIdx = masterColumnOrder.indexOf(colName);
        if (mIdx !== -1) return gridData.get(toA1Key(coords.row, mIdx));
        return null;
      }
      // 2. Fallback: Handle Named Columns in Current Row or Literals
      const actualKey = Object.keys(rowData).find(key => key.toLowerCase() === arg.toLowerCase());
      return actualKey ? rowData[actualKey] : (isNaN(Number(arg)) ? arg : Number(arg));
    };

    if (value.toUpperCase().startsWith('=SUM(')) {
      const match = value.match(/=SUM\((.*)\)/i);
      if (!match) return '#ERROR!';
      const args = match[1].split(',').map(s => s.trim());
      
      let total = 0;
      args.forEach(arg => {
        if (arg.includes(':')) {
          const [start, end] = arg.split(':');
          const sC = fromA1Key(start.toUpperCase());
          const eC = fromA1Key(end.toUpperCase());
          if (sC && eC) {
            for (let r = Math.min(sC.row, eC.row); r <= Math.max(sC.row, eC.row); r++) {
              for (let c = Math.min(sC.colIndex, eC.colIndex); c <= Math.max(sC.colIndex, eC.colIndex); c++) {
                const colName = headers[c];
                const mIdx = masterColumnOrder.indexOf(colName);
                const val = mIdx !== -1 ? gridData.get(toA1Key(r, mIdx)) : 0;
                total += (Number(val) || 0);
              }
            }
          }
        } else {
          total += (Number(resolveSingleValue(arg)) || 0);
        }
      });
      return total;
    }

    if (value.toUpperCase().startsWith('=ADD_DAYS(')) {
      const match = value.match(/=ADD_DAYS\s*\((.*)\)/i);
      if (!match) return '#ERROR!';
      // Handle literal strings in quotes and strip them
      const args = match[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      if (args.length !== 2) return '#ARGS!';

      let dateVal = resolveSingleValue(args[0]);
      let daysVal = resolveSingleValue(args[1]);

      // Smart Swap: If the order is reversed (e.g., =ADD_DAYS(100, M2)), swap them.
      if (!isNaN(Number(dateVal)) && isNaN(Number(daysVal))) {
        [dateVal, daysVal] = [daysVal, dateVal];
      }

      if (dateVal === null || dateVal === undefined || dateVal === '') return '';

      let date = new Date(dateVal);
      // Robust parsing for YYYY-MM-DD or MM-DD-YYYY strings
      if (isNaN(date.getTime()) && typeof dateVal === 'string' && dateVal.includes('-')) {
        const parts = dateVal.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          } else if (parts[2].length === 4) {
            date = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
          }
        }
      }

      const days = Number(daysVal);
      if (isNaN(date.getTime())) return '#DATE!';
      if (isNaN(days)) return '#NUM!';

      const resultDate = new Date(date);
      resultDate.setDate(resultDate.getDate() + days);
      return formatDateDisplay(resultDate, formatId);
    }
  } catch (e) { return '#ERR!'; }
  return value;
}
