import { useState, useEffect } from 'react';
import { hydrateMapToArray, dehydrateArrayToMap } from '@/lib/excel-utils';

interface UseCodeViewProps {
  viewMode: string;
  activeNode: any;
  spreadsheet: any;
}

export function useCodeView({ viewMode, activeNode, spreadsheet }: UseCodeViewProps) {
  const [codeViewContent, setCodeViewContent] = useState<string>('');

  useEffect(() => {
    if (viewMode !== 'code' || !activeNode || activeNode.type !== 'file') return;
    const contentArray = hydrateMapToArray(
      spreadsheet.gridData,
      spreadsheet.rowCount,
      spreadsheet.allHeaders,
      spreadsheet.masterColumnOrder
    );
    const fullData = {
      content: contentArray,
      display_settings: {
        columnAlignments: spreadsheet.columnAlignments,
        cellAlignments: spreadsheet.cellAlignments,
        hiddenColumns: spreadsheet.hiddenColumns,
        selectedYear: spreadsheet.selectedYear,
        columnOrder: spreadsheet.columnOrder,
        columnWidths: spreadsheet.columnWidths,
        cellMetadata: spreadsheet.cellMetadata,
        rowHeights: spreadsheet.rowHeights
      }
    };
    setCodeViewContent(JSON.stringify(fullData, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeNode?.id]);

  const handleCodeChange = (val: string) => {
    setCodeViewContent(val);
    try {
      const parsed = JSON.parse(val);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.content)) {
        if (parsed.display_settings) {
          const ds = parsed.display_settings;
          const master = ds.masterColumnOrder || ds.columnOrder || spreadsheet.allHeaders;
          spreadsheet.setMasterColumnOrder(master);
          spreadsheet.setGridData(dehydrateArrayToMap(parsed.content, ds.columnOrder || spreadsheet.allHeaders, master));
          spreadsheet.setRowCount(parsed.content.length);
          spreadsheet.setColumnAlignments(ds.columnAlignments || {});
          spreadsheet.setCellAlignments(ds.cellAlignments || {});
          spreadsheet.setHiddenColumns(ds.hiddenColumns || []);
          spreadsheet.setSelectedYear(ds.selectedYear || new Date().getFullYear().toString());
          spreadsheet.setColumnOrder(ds.columnOrder || []);
          spreadsheet.setColumnWidths(ds.columnWidths || {});
          spreadsheet.setCellMetadata(ds.cellMetadata || {});
          spreadsheet.setRowHeights(ds.rowHeights || {});
        }
      } else if (Array.isArray(parsed)) {
        spreadsheet.setGridData(dehydrateArrayToMap(parsed, spreadsheet.allHeaders, spreadsheet.masterColumnOrder));
        spreadsheet.setRowCount(parsed.length);
      }
    } catch (e) {
      // Keep codeViewContent as-is on parse error
    }
  };

  return {
    codeViewContent,
    handleCodeChange
  };
}
