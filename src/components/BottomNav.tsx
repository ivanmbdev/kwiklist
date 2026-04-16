import { Home, Search, User } from 'lucide-react';

type Tab = 'lists' | 'search';

interface BottomNavProps {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onAccountClick: () => void;
}

export default function BottomNav({ tab, onTabChange, onAccountClick }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 w-full max-w-md bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex justify-around items-center h-20 px-6 z-40 transition-colors duration-300 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-none"
      aria-label="Navegación principal"
    >
      <button
        onClick={() => onTabChange('lists')}
        className={`flex flex-col items-center gap-1 transition-colors duration-300 ${
          tab === 'lists'
            ? 'text-indigo-500'
            : 'text-zinc-400 hover:text-indigo-400'
        }`}
        aria-label="Mis listas"
        aria-current={tab === 'lists' ? 'page' : undefined}
      >
        <Home className="w-6 h-6" />
        <span className="text-[10px] font-medium">Listas</span>
      </button>

      <div className="relative -top-6">
        <button
          onClick={() => onTabChange('search')}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl border-[6px] border-zinc-50 dark:border-zinc-900 transition-all duration-300 transform hover:scale-105 ${
            tab === 'search'
              ? 'bg-indigo-500 text-white'
              : 'bg-zinc-800 dark:bg-zinc-800 text-indigo-400 hover:bg-zinc-700'
          }`}
          aria-label="Buscar"
          aria-current={tab === 'search' ? 'page' : undefined}
        >
          <Search className="w-6 h-6" />
        </button>
      </div>

      <button
        onClick={onAccountClick}
        className="flex flex-col items-center gap-1 transition-colors duration-300 text-zinc-400 hover:text-indigo-400"
        aria-label="Mi cuenta"
      >
        <User className="w-6 h-6" />
        <span className="text-[10px] font-medium">Cuenta</span>
      </button>
    </nav>
  );
}
