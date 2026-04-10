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
        'h-8 flex-1 rounded-full text-[12px] font-medium transition-all duration-200 focus:outline-none',
        active ? 'bg-blue-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
      )}
    >
      {label}
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
        <p className="text-[13px] font-semibold tracking-wide text-slate-800">{title}</p>
        <p className="mt-1 text-[11px] text-slate-500">{description}</p>
      </div>
      <button
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
          checked ? 'bg-blue-500' : 'bg-slate-200'
        )}
        onClick={onToggle}
        title={`切换${title}`}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}
