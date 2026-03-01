import type { LucideIcon } from 'lucide-react';

export type SortKey = 'title' | 'addedAt' | 'lastReadAt';

export type LibraryMenuItem = {
  key: string;
  label: string;
  icon: LucideIcon;
};

export type TagItem = {
  id: string;
  label: string;
  color: string;
};

export type MangaPathCategory = 'artists' | 'series' | 'other';
export type MangaCategoryFilter = 'all' | MangaPathCategory;
