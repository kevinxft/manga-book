import { ArrowDownUp, FolderInput, Search } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import type { OrganizerCategory } from '@renderer/pages/Organizer/types';

type MoveSortKey = 'recentDesc' | 'recentAsc' | 'movedDesc' | 'movedAsc' | 'countDesc' | 'countAsc' | 'nameAsc' | 'nameDesc';

interface CoverMoveSectionProps {
  moveSearch: string;
  moveSortBy: MoveSortKey;
  moveTargets: OrganizerCategory[];
  itemId: string;
  onMoveSearchChange: (value: string) => void;
  onMoveSortChange: (value: MoveSortKey) => void;
  onQuickMove: (mangaId: string, destinationPath: string) => void;
  onClose: () => void;
}

export function CoverMoveSection({
  moveSearch,
  moveSortBy,
  moveTargets,
  itemId,
  onMoveSearchChange,
  onMoveSortChange,
  onQuickMove,
  onClose
}: CoverMoveSectionProps) {
  return (
    <>
      <p className="px-2 pb-1 text-[11px] font-bold tracking-[0.08em] text-[#7b89a1]">快速移动到作者</p>

      <div className="mb-2 grid grid-cols-[1fr_126px] items-center gap-1.5 px-1">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8b98ac]" />
          <Input
            value={moveSearch}
            onChange={(event) => onMoveSearchChange(event.target.value)}
            className="h-7 rounded-md border-[#d7deeb] bg-[#f3f6fb] pl-7 text-[11px]"
            placeholder="搜索作者/别名"
          />
        </div>
        <label className="relative flex items-center">
          <ArrowDownUp className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-[#7f8da1]" />
          <select
            className="h-7 w-full appearance-none rounded-md border border-[#d7deeb] bg-[#f3f6fb] pl-7 pr-2 text-[11px] font-semibold text-[#4f617d] outline-none"
            value={moveSortBy}
            onChange={(event) => onMoveSortChange(event.target.value as MoveSortKey)}
          >
            <option value="recentDesc">最近(新-旧)</option>
            <option value="recentAsc">最近(旧-新)</option>
            <option value="movedDesc">最近移入(新-旧)</option>
            <option value="movedAsc">最近移入(旧-新)</option>
            <option value="countDesc">本数(多-少)</option>
            <option value="countAsc">本数(少-多)</option>
            <option value="nameAsc">名称(A-Z)</option>
            <option value="nameDesc">名称(Z-A)</option>
          </select>
        </label>
      </div>

      <div className="mb-2 max-h-[260px] space-y-1 overflow-auto rounded-md border border-[#e2e8f3] bg-[#f8fafe] p-1">
        {moveTargets.length > 0 ? (
          moveTargets.map((category) => (
            <button
              key={category.key}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#28415f] transition hover:bg-[#e7efff]"
              onClick={() => {
                onQuickMove(itemId, category.path);
                onClose();
              }}
            >
              <FolderInput className="h-3.5 w-3.5 text-[#2f7fe6]" />
              <span className="inline-flex min-w-0 items-baseline gap-1">
                <span className="truncate">{category.label}</span>
                {category.aliases.length > 0 ? (
                  <span className="truncate text-[11px] font-medium text-[#6e7f97]">({category.aliases.join(' / ')})</span>
                ) : null}
              </span>
            </button>
          ))
        ) : (
          <div className="px-2 py-1.5 text-[12px] text-[#8a97ac]">暂无可用目录</div>
        )}
      </div>
    </>
  );
}

export type { MoveSortKey };
