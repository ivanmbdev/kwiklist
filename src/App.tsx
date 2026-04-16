import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Moon, Sun, WifiOff } from 'lucide-react';
import { ShoppingList, ToastMessage } from './types';
import { listsApi, WS_URL } from './api';
import {
  enqueue,
  flush,
  isNetworkError,
  cacheListsLocally,
  getCachedLists,
  QueuedOperation,
} from './offlineQueue';

import ListsHome from './components/ListsHome';
import ListDetail from './components/ListDetail';
import SearchTab from './components/SearchTab';
import AccountModal from './components/AccountModal';
import SettingsModal from './components/SettingsModal';
import BottomNav from './components/BottomNav';
import Toast from './components/Toast';

export default function App() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [currentList, setCurrentList] = useState<ShoppingList | null>(null);
  const [tab, setTab] = useState<'lists' | 'search'>('lists');
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('isLoggedIn') !== 'false';
  });
  const [userId] = useState(() => {
    let id = localStorage.getItem('userId');
    if (!id) {
      id = 'ghost_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('userId', id);
    }
    return id;
  });

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showAccount, setShowAccount] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const stompClientRef = useRef<Client | null>(null);

  const showToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Ejecutar una operación encolada contra el backend
  const executeQueuedOp = async (op: QueuedOperation) => {
    const p = op.payload;
    switch (op.type) {
      case 'addItem':
        await listsApi.addItem(p.listId as string, p.name as string, p.addedBy as string);
        break;
      case 'toggleItem':
        await listsApi.toggleItem(p.item as Parameters<typeof listsApi.toggleItem>[0]);
        break;
      case 'deleteItem':
        await listsApi.deleteItem(p.itemId as string);
        break;
      case 'deleteList':
        await listsApi.delete(p.listId as string);
        break;
      case 'leaveList':
        await listsApi.leave(p.listId as string, p.userId as string);
        break;
      case 'updateListName':
        await listsApi.updateName(p.listId as string, p.name as string);
        break;
    }
  };

  const flushQueue = async () => {
    const count = await flush(executeQueuedOp);
    if (count > 0) {
      showToast(`${count} cambio${count > 1 ? 's' : ''} sincronizado${count > 1 ? 's' : ''}`, 'success');
      fetchLists();
    }
  };

  // Detectar cambios de conexión
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      showToast('Conexión restaurada', 'success');
      flushQueue();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Aplicar modo oscuro al <html> y guardar preferencia
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const fetchLists = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listsApi.getByUser(userId);
      setLists(res.data);
      cacheListsLocally(res.data);
    } catch {
      const cached = getCachedLists();
      if (cached.length > 0) setLists(cached);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Gestionar enlace de invitación en la URL (?join=CÓDIGO)
  const handleJoinFromUrl = async () => {
    const params = new URLSearchParams(window.location.search);
    const joinCodeParam = params.get('join');
    if (!joinCodeParam) return;

    try {
      const codeRes = await listsApi.getByCode(joinCodeParam);
      const found = codeRes.data;

      if (!(found.members || []).includes(userId)) {
        const joinRes = await listsApi.join(found.id, userId);
        setCurrentList(joinRes.data);
        setLists((prev) => {
          if (!prev.find((l) => l.id === joinRes.data.id))
            return [...prev, joinRes.data];
          return prev.map((l) =>
            l.id === joinRes.data.id ? joinRes.data : l,
          );
        });
        showToast('Te has unido a la lista', 'success');
      } else {
        showToast('Ya eres miembro de esta lista', 'info');
        setCurrentList(found);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      showToast('Código de invitación no válido', 'error');
    }
  };

  // Conectar WebSocket STOMP al montar
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      onConnect: () => {
        flushQueue();
        client.subscribe('/topic/lists', (message) => {
          const newList = JSON.parse(message.body);
          if (newList.members && newList.members.includes(userId)) {
            setLists((prev) => {
              if (!prev.find((l) => l.id === newList.id))
                return [...prev, newList];
              return prev.map((l) => (l.id === newList.id ? newList : l));
            });
          }
        });
      },
    });
    client.activate();
    stompClientRef.current = client;

    return () => {
      client.deactivate();
    };
  }, [userId]);

  // Cargar datos iniciales según el estado de sesión
  useEffect(() => {
    if (isLoggedIn) {
      fetchLists();
      handleJoinFromUrl();
    } else {
      const params = new URLSearchParams(window.location.search);
      if (params.get('join')) {
        fetchLists().then(() => handleJoinFromUrl());
      } else {
        // Intentar cargar cache offline al arrancar
        const cached = getCachedLists();
        if (cached.length > 0) setLists(cached);
        setLoading(false);
      }
    }
  }, [isLoggedIn]);

  // Suscripciones WebSocket para la lista abierta
  useEffect(() => {
    if (!currentList || !stompClientRef.current) return;

    const itemSub = stompClientRef.current.subscribe(
      `/topic/lists/${currentList.id}`,
      (message) => {
        const updatedItem = JSON.parse(message.body);
        setCurrentList((prev) => {
          if (!prev) return prev;
          const exists = prev.items.find((i) => i.id === updatedItem.id);
          const newItems = exists
            ? prev.items.map((i) =>
                i.id === updatedItem.id ? updatedItem : i,
              )
            : [...prev.items, updatedItem];
          return { ...prev, items: newItems };
        });
      },
    );

    const deleteSub = stompClientRef.current.subscribe(
      `/topic/lists/${currentList.id}/delete`,
      (message) => {
        const deletedId = message.body;
        setCurrentList((prev) => {
          if (!prev) return prev;
          return { ...prev, items: prev.items.filter((i) => i.id !== deletedId) };
        });
      },
    );

    const updateSub = stompClientRef.current.subscribe(
      `/topic/lists/${currentList.id}/update`,
      (message) => {
        const updatedList = JSON.parse(message.body);
        setCurrentList(updatedList);
      },
    );

    return () => {
      itemSub.unsubscribe();
      deleteSub.unsubscribe();
      updateSub.unsubscribe();
    };
  }, [currentList?.id]);

  // Sincronizar la lista abierta con el array principal y cache
  useEffect(() => {
    if (currentList) {
      setLists((prev) => {
        const updated = prev.map((l) => (l.id === currentList.id ? currentList : l));
        cacheListsLocally(updated);
        return updated;
      });
    }
  }, [currentList]);

  // --- Handlers principales ---

  const handleOpenList = useCallback(async (list: ShoppingList) => {
    setCurrentList(list);
    try {
      const res = await listsApi.getById(list.id);
      if (res.data) setCurrentList(res.data);
    } catch {
      // Offline: se muestra la versión cacheada que ya está en currentList
    }
  }, []);

  const handleDeleteList = useCallback(async () => {
    if (!currentList) return;
    try {
      await listsApi.delete(currentList.id);
      setLists((prev) => prev.filter((l) => l.id !== currentList.id));
      setCurrentList(null);
      setShowSettings(false);
      showToast('Lista eliminada', 'success');
    } catch (err) {
      if (isNetworkError(err)) {
        enqueue('deleteList', { listId: currentList.id });
        setLists((prev) => prev.filter((l) => l.id !== currentList.id));
        setCurrentList(null);
        setShowSettings(false);
        showToast('Se sincronizará al recuperar conexión', 'info');
      } else {
        showToast('No se pudo eliminar la lista', 'error');
      }
    }
  }, [currentList, showToast]);

  const handleLeaveList = useCallback(async () => {
    if (!currentList) return;
    try {
      await listsApi.leave(currentList.id, userId);
      setLists((prev) => prev.filter((l) => l.id !== currentList.id));
      setCurrentList(null);
      setShowSettings(false);
      showToast('Has salido de la lista', 'success');
    } catch (err) {
      if (isNetworkError(err)) {
        enqueue('leaveList', { listId: currentList.id, userId });
        setLists((prev) => prev.filter((l) => l.id !== currentList.id));
        setCurrentList(null);
        setShowSettings(false);
        showToast('Se sincronizará al recuperar conexión', 'info');
      } else {
        showToast('No se pudo salir de la lista', 'error');
      }
    }
  }, [currentList, userId, showToast]);

  const handleLogin = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    localStorage.setItem('isLoggedIn', 'true');
    setIsLoggedIn(true);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.setItem('isLoggedIn', 'false');
    setIsLoggedIn(false);
    setLists([]);
    setCurrentList(null);
    setShowAccount(false);
  }, []);

  const handleTabChange = useCallback((newTab: 'lists' | 'search') => {
    setCurrentList(null);
    setTab(newTab);
  }, []);

  // --- Renderizado ---

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 pb-24 font-sans transition-colors duration-300">
      <div className="max-w-md mx-auto min-h-screen relative bg-white dark:bg-zinc-900 shadow-2xl transition-colors duration-300">

        {/* Banner sin conexión */}
        {isOffline && (
          <div className="bg-amber-500 text-white text-center py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium">
            <WifiOff className="w-4 h-4" />
            Sin conexión — los cambios se guardarán localmente
          </div>
        )}

        {currentList ? (
          <ListDetail
            list={currentList}
            userId={userId}
            onBack={() => setCurrentList(null)}
            onShowSettings={() => setShowSettings(true)}
            showToast={showToast}
          />
        ) : (
          <>
            {/* Cabecera con toggle de tema */}
            <div className="p-6 flex justify-between items-center">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="text-zinc-400 hover:text-indigo-500 transition-colors duration-300"
                aria-label={
                  darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
                }
              >
                {darkMode ? (
                  <Sun className="w-6 h-6" />
                ) : (
                  <Moon className="w-6 h-6" />
                )}
              </button>
            </div>

            {tab === 'lists' && (
              <ListsHome
                lists={lists}
                loading={loading}
                userId={userId}
                onOpenList={handleOpenList}
                onListCreated={(list) => setCurrentList(list)}
                onListJoined={(list) => {
                  setCurrentList(list);
                  setLists((prev) => {
                    if (!prev.find((l) => l.id === list.id))
                      return [...prev, list];
                    return prev.map((l) => (l.id === list.id ? list : l));
                  });
                }}
                showToast={showToast}
              />
            )}

            {tab === 'search' && (
              <SearchTab lists={lists} onOpenList={handleOpenList} />
            )}
          </>
        )}

        {/* Modal de ajustes de lista */}
        {showSettings && currentList && (
          <SettingsModal
            list={currentList}
            userId={userId}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(!darkMode)}
            onDeleteList={handleDeleteList}
            onLeaveList={handleLeaveList}
            onClose={() => setShowSettings(false)}
          />
        )}

        {/* Modal de cuenta */}
        {showAccount && (
          <AccountModal
            isLoggedIn={isLoggedIn}
            userId={userId}
            onLogin={handleLogin}
            onLogout={handleLogout}
            onClose={() => setShowAccount(false)}
          />
        )}

        {/* Navegación inferior */}
        <BottomNav
          tab={tab}
          onTabChange={handleTabChange}
          onAccountClick={() => setShowAccount(true)}
        />
      </div>

      {/* Notificaciones toast */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
