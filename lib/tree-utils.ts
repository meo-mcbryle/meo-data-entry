export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parent_id: string | null;
  size_bytes: number;
  created_at: string;
  content?: any;
  display_settings?: {
    columnAlignments?: Record<string, 'left' | 'center' | 'right'>;
    cellAlignments?: Record<string, 'left' | 'center' | 'right'>;
    hiddenColumns?: string[];
    columnOrder?: string[];
    selectedYear?: string;
    columnWidths?: Record<string, number>; // Add column widths
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
