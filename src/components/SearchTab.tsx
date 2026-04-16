import { useState, useMemo, useCallback } from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import { ShoppingList } from '../types';

interface SearchTabProps {
  lists: ShoppingList[];
  onOpenList: (list: ShoppingList) => void;
}

export default function SearchTab({ lists, onOpenList }: SearchTabProps) {
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (normalizedQuery.length < 2) return [];
    return lists.filter((list) => {
      const nameMatch = list.name.toLowerCase().includes(normalizedQuery);
      const itemMatch = list.items?.some((item) =>
        item.name.toLowerCase().includes(normalizedQuery),
      );
      return nameMatch || itemMatch;
    });
  }, [lists, normalizedQuery]);

  const getMatchingItems = useCallback(
    (list: ShoppingList) => {
      if (!normalizedQuery) return [];
      return (list.items || []).filter((item) =>
        item.name.toLowerCase().includes(normalizedQuery),
      );
    },
    [normalizedQuery],
  );

  return (
    <div className="px-6 animate-slide-up">
      <h1 className="text-2xl font-bold text-zinc-800 dark:text-white mb-6">
        Buscador
      </h1>

      {/* Campo de búsqueda */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
        <label htmlFor="search-input" className="sr-only">
          Buscar lista o producto
        </label>
        <input
          id="search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar lista o producto..."
          className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-4 text-zinc-800 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all duration-300"
        />
      </div>

      {/* Sin resultados */}
      {query.trim().length >= 2 && results.length === 0 && (
        <div className="text-center py-10">
          <p className="text-zinc-400">
            No se encontraron resultados para "{query}"
          </p>
        </div>
      )}

      {/* Resultados */}
      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((list) => {
            const matchingItems = getMatchingItems(list);
            return (
              <button
                key={list.id}
                onClick={() => onOpenList(list)}
                className="group w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-700/50 hover:border-indigo-400 dark:hover:border-indigo-400 transition-all duration-300 text-left shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-zinc-800 dark:text-white group-hover:text-indigo-500 transition-colors duration-300">
                    {list.name}
                  </h3>
                  <ArrowLeft className="w-4 h-4 rotate-180 text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                </div>
                {matchingItems.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {matchingItems.slice(0, 5).map((item) => (
                      <span
                        key={item.id}
                        className="text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg"
                      >
                        {item.name}
                      </span>
                    ))}
                    {matchingItems.length > 5 && (
                      <span className="text-xs text-zinc-400 px-2 py-1">
                        +{matchingItems.length - 5} más
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Estado vacío */}
      {!query.trim() && (
        <div className="text-center mt-16">
          <Search className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">Escribe para buscar en tus listas</p>
          <p className="text-zinc-400 text-sm mt-1">
            Puedes buscar por nombre de lista o producto
          </p>
        </div>
      )}
    </div>
  );
}
