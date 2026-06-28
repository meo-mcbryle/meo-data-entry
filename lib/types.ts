import { FileNode } from './tree-utils';

export type TrashNode = FileNode & {
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
};
