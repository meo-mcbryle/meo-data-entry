/**
 * Primitive types allowed for raw cell values within a row object.
 */
export type GridCellValue = string | number | boolean | null | undefined;

/**
 * Represents a spreadsheet row where keys are dynamic column headers.
 */
export type GridRowData = Record<string, GridCellValue>;

/**
 * Structure for file attachments stored within cell metadata.
 */
export interface CellAttachment {
  type: 'image' | 'file';
  name: string;
  url: string;
  path?: string;
  size?: number;
  contentType?: string;
}

/**
 * Represents formatting, formulas, and media information for a specific cell.
 */
export interface CellMetadata {
  type?: string; // 'date', 'number', 'formula', 'media', etc.
  format?: string; // Display format ID
  fontFamily?: string;
  fontSize?: string | number;
  rowSpan?: number;
  colSpan?: number;
  mergedIn?: string; // A1 key of the merge host
  attachments?: CellAttachment[];
  [key: string]: any; // Allows for dynamic extension while keeping known keys typed
}

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parent_id: string | null;
  size_bytes: number;
  created_at: string;
  content?: GridRowData[]; // Represents an array of row objects
  display_settings?: {
    columnAlignments?: Record<string, 'left' | 'center' | 'right' | 'justify'>;
    cellAlignments?: Record<string, 'left' | 'center' | 'right' | 'justify'>;
    hiddenColumns?: string[];
    columnOrder?: string[];
    selectedYear?: string;
    columnWidths?: Record<string, number>; // Add column widths
    cellMetadata?: Record<string, CellMetadata>; // Stores cell types, formulas, and media info
    rowHeights?: Record<string, number>; // Stores custom row heights (keys serialized as strings)
    masterColumnOrder?: string[]; // Stores the stable internal column sequence
  };
  children?: FileNode[];
}

export const buildTree = (nodes: FileNode[]): FileNode[] => {
  const map: Record<string, FileNode> = {};
  const tree: FileNode[] = [];

  nodes.forEach(node => {
    map[node.id] = { ...node, children: [] };
  });

  nodes.forEach(node => {
    if (node.parent_id && map[node.parent_id]) {
      map[node.parent_id].children?.push(map[node.id]);
    } else {
      tree.push(map[node.id]);
    }
  });

  return tree;
};

export const findNodeById = (nodes: FileNode[], id: string): FileNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};
