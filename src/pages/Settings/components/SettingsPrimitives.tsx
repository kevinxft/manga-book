import { cn } from '@renderer/lib/utils';

interface SegmentButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

export function SegmentButton({ active, label, onClick }: SegmentButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-9 flex-1 rounded-lg text-[13px] font-semibold transition',
        active ? 'bg-white text-[#2f6cf6] shadow-[0_2px_6px_rgba(47,108,246,0.12)]' : 'text-[#5d6d85] hover:bg-white/60'
      )}
    >
      {label}
    </button>
  );
}

interface OptionCardProps {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}

export function OptionCard({ active, title, desc, onClick }: OptionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-xl border p-3 text-left transition',
        active ? 'border-[#2f6cf6] bg-[#eef5ff]' : 'border-[#dbe2ee] bg-white hover:bg-[#f7f9fc]'
      )}
    >
      <p className={cn('text-[13px] font-semibold', active ? 'text-[#2f6cf6]' : 'text-[#1f2b3d]')}>{title}</p>
      <p className="mt-0.5 text-[12px] text-[#667892]">{desc}</p>
    </button>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  title: string;
  description: string;
  onToggle: () => void;
}

export function ToggleSwitch({ checked, title, description, onToggle }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[13px] font-bold text-[#1f2b3d]">{title}</p>
        <p className="mt-0.5 text-[12px] text-[#6f819b]">{description}</p>
      </div>
      <button
        className={cn(
          'relative h-7 w-[52px] rounded-full border border-[#bcc9dd] transition',
          checked ? 'border-[#2f6cf6] bg-[#2f6cf6]' : 'bg-[#c8d2e0]'
        )}
        onClick={onToggle}
        title={`切换${title}`}
      >
        <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition', checked ? 'left-[26px]' : 'left-[2px]')} />
      </button>
    </div>
  );
}
