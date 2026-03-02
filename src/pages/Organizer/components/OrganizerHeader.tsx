import { ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';

interface OrganizerHeaderProps {
  count: number;
  onBack?: () => void;
}

export function OrganizerHeader({ count, onBack }: OrganizerHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-[#d8dde6] bg-[#f7f9fc] px-7 py-3.5">
      <div className="flex items-center gap-4">
        <Button
          variant="secondary"
          className="h-11 rounded-xl border border-[#d7deea] bg-[#edf1f6] px-5 text-[14px] font-semibold text-[#47556c]"
          onClick={onBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>

        <h1 className="text-[24px] font-extrabold tracking-tight text-[#132038]">待整理漫画 ({count} 本)</h1>
      </div>

      <div className="flex items-start gap-2">
        <BookOpen className="mt-0.5 h-5 w-5 text-[#2563eb]" />
        <div>
          <p className="text-[24px] font-bold leading-none tracking-tight text-[#1e2a3a]">漫画整理</p>
          <p className="mt-1 text-[10px] font-semibold tracking-[0.1em] text-[#7e8a9a]">MANGA ORGANIZER</p>
        </div>
      </div>
    </header>
  );
}
