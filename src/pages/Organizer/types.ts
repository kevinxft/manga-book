import type { MangaBookWithCover } from '@shared/types';

export type OrganizerSortKey = 'addedAt' | 'title' | 'pages';
export type OrganizerStatusFilter = 'all' | 'organized' | 'unorganized';

export interface OrganizerCategory {
  key: string;
  label: string;
  aliases: string[];
  path: string;
  count: number;
  kind: 'artists' | 'series' | 'other';
  latestAddedAt: string;
  lastMovedAt: string | null;
}

export interface OrganizerItem extends MangaBookWithCover {
  displayPath: string;
  ownerBadge: string | null;
  organizeStatus: 'organized' | 'unorganized';
}
