import type { LucideIcon } from 'lucide-react';

export type SortKey = 'addedAtDesc' | 'addedAtAsc' | 'titleAsc' | 'titleDesc' | 'lastReadAtDesc';

export type LibraryMenuItem = {
  key: string;
  label: string;
  icon: LucideIcon;
};

export type TagItem = {
  id: string;
  label: string;
};

export type MangaPathCategory = 'artists' | 'series' | 'other';
