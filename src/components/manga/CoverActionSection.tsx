import { ExternalLink, FolderInput, FolderOpen, Tag, Trash2 } from 'lucide-react';

interface CoverContextMenuItemLike {
  id: string;
  folderPath: string;
}

interface CoverActionSectionProps<T extends CoverContextMenuItemLike> {
  item: T;
  menuAnchor: { x: number; y: number };
  onAddTag: (item: T, anchor: { x: number; y: number }) => void;
  onRename: (item: T) => void;
  onSearchWeb: (item: T, provider: 'hitomi' | 'exhentai' | 'google') => void;
  onOpenInFolder: (mangaId: string) => void;
  onDelete: (item: T) => void;
  onClose: () => void;
}

export function CoverActionSection<T extends CoverContextMenuItemLike>({
  item,
  menuAnchor,
  onAddTag,
  onRename,
  onSearchWeb,
  onOpenInFolder,
  onDelete,
  onClose
}: CoverActionSectionProps<T>) {
  return (
    <>
      <button
        className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
        onClick={() => {
          onAddTag(item, menuAnchor);
          onClose();
        }}
      >
        <Tag className="h-3.5 w-3.5 text-[#5f708a]" />
        编辑标签
      </button>

      <button
        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
        onClick={() => {
          onRename(item);
          onClose();
        }}
      >
        <FolderInput className="h-3.5 w-3.5 text-[#5f708a]" />
        重命名
      </button>

      <button
        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
        onClick={() => {
          onSearchWeb(item, 'hitomi');
          onClose();
        }}
      >
        <ExternalLink className="h-3.5 w-3.5 text-[#5f708a]" />
        Hitomi 搜索
      </button>

      <button
        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
        onClick={() => {
          onSearchWeb(item, 'exhentai');
          onClose();
        }}
      >
        <ExternalLink className="h-3.5 w-3.5 text-[#5f708a]" />
        ExHentai 搜索
      </button>

      <button
        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
        onClick={() => {
          onSearchWeb(item, 'google');
          onClose();
        }}
      >
        <ExternalLink className="h-3.5 w-3.5 text-[#5f708a]" />
        Google 搜索
      </button>

      <button
        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
        onClick={() => {
          onOpenInFolder(item.id);
          onClose();
        }}
      >
        <FolderOpen className="h-3.5 w-3.5 text-[#5f708a]" />
        在文件夹中打开
      </button>

      <button
        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#ab2f2f] transition hover:bg-[#fff0f0]"
        onClick={() => {
          onDelete(item);
          onClose();
        }}
      >
        <Trash2 className="h-3.5 w-3.5 text-[#c73737]" />
        删除漫画
      </button>
    </>
  );
}
