# KwikList

**Trabajo de Fin de Grado — Desarrollo de Aplicaciones Multiplataforma**

KwikList es una aplicación web de listas de la compra colaborativas en tiempo real. Permite crear listas, añadir productos, compartirlas con otras personas mediante un código corto y ver los cambios de todos los miembros al instante, sin necesidad de recargar la página.

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React, TypeScript, Vite | React 19, Vite 6 |
| Estilos | Tailwind CSS | 4 |
| Iconos | Lucide React | — |
| HTTP Client | Axios | — |
| WebSocket Client | STOMP.js + SockJS | — |
| Backend | Kotlin, Spring Boot | Kotlin 1.9, Spring Boot 3.2 |
| ORM | Spring Data JPA (Hibernate) | — |
| Base de datos | PostgreSQL | 16 |
| Contenedores | Docker Compose | — |
| Proxy reverso | Nginx | — |

---

## Arquitectura general

```
┌──────────────┐       HTTP (REST)        ┌──────────────────┐       JPA        ┌────────────┐
│              │ ◄──────────────────────► │                  │ ◄──────────────► │            │
│   Frontend   │                          │  Spring Boot API │                  │ PostgreSQL │
│   (React)    │ ◄──────────────────────► │  (Kotlin)        │ ◄──────────────► │            │
│              │    WebSocket (STOMP)      │                  │                  │            │
└──────────────┘                          └──────────────────┘                  └────────────┘
       │                                           │
       └───── Nginx (proxy reverso en producción) ─┘
```

El frontend se comunica con el backend por dos canales simultáneos:

1. **REST (HTTP):** Para operaciones CRUD — crear listas, añadir productos, eliminar, unirse, etc.
2. **WebSocket (STOMP sobre SockJS):** Para recibir actualizaciones en tiempo real sin hacer polling.

Cuando un usuario realiza una acción (por ejemplo, añadir un producto), el backend procesa la petición REST, persiste el cambio en PostgreSQL y después publica un mensaje por WebSocket a todos los clientes conectados que estén viendo esa lista.

---

## Decisiones de diseño

### 1. WebSocket con STOMP para sincronización en tiempo real

La funcionalidad principal de KwikList es que varias personas puedan editar la misma lista simultáneamente. Para conseguirlo había varias opciones:

- **Polling (peticiones periódicas):** Sencillo de implementar, pero genera tráfico innecesario y los cambios tardan en aparecer dependiendo del intervalo.
- **Server-Sent Events (SSE):** Unidireccional (solo servidor → cliente). Válido, pero menos flexible para un sistema donde el cliente también envía datos constantemente.
- **WebSocket:** Conexión bidireccional y persistente. El servidor puede enviar datos al cliente en el momento exacto en que ocurren, sin que el cliente pregunte.

Elegí WebSocket con el protocolo **STOMP** por encima porque:

- STOMP añade un sistema de **topics** (canales) por encima del WebSocket puro, lo que permite suscribirse a `/topic/lists/{id}` para recibir solo las actualizaciones de una lista concreta.
- Spring Boot tiene soporte nativo para STOMP con `@EnableWebSocketMessageBroker`, lo que simplifica mucho la configuración.
- En el cliente uso **SockJS** como fallback: si el navegador no soporta WebSocket nativo (raro hoy en día, pero posible detrás de ciertos proxies corporativos), SockJS degrada automáticamente a long-polling HTTP.

#### Topics utilizados

| Topic | Contenido | Cuándo se emite |
|-------|-----------|-----------------|
| `/topic/lists` | Lista completa (`ShoppingList`) | Al crear una lista o cuando un miembro se une |
| `/topic/lists/{id}` | Producto actualizado (`ShoppingItem`) | Al añadir o marcar/desmarcar un producto |
| `/topic/lists/{id}/delete` | ID del producto eliminado | Al eliminar un producto |
| `/topic/lists/{id}/update` | Lista completa actualizada | Al unirse o salir un miembro |

El frontend se suscribe al topic global `/topic/lists` siempre, y se suscribe/desuscribe dinámicamente a los topics específicos de una lista cuando el usuario abre o cierra una lista.

### 2. Usuario fantasma (Ghost User) con UUID para cero fricción

Uno de los objetivos de UX era que cualquier persona pudiera usar la app **sin necesidad de registrarse**. Muchas aplicaciones de listas obligan a crear una cuenta antes de poder hacer nada, lo que genera fricción y abandonos.

La solución es el **usuario fantasma**: al abrir la app por primera vez, se genera automáticamente un identificador único con el prefijo `ghost_` seguido de caracteres alfanuméricos aleatorios y se guarda en `localStorage`:

```typescript
let id = localStorage.getItem('userId');
if (!id) {
  id = 'ghost_' + Math.random().toString(36).substring(2, 9);
  localStorage.setItem('userId', id);
}
```

Este ID se usa como identificador del usuario en todas las operaciones: crear listas, unirse a listas, añadir productos. El backend no distingue entre un usuario "real" y uno fantasma — simplemente trabaja con el `userId` que recibe.

**Ventajas:**
- El usuario puede empezar a usar la app al instante.
- Si cierra y vuelve a abrir el navegador, su `userId` se mantiene y sus listas siguen ahí.
- En la interfaz, los miembros fantasma se muestran como "Invitado (xxxx)" usando los últimos caracteres de su ID para diferenciarlos.

**Limitaciones conocidas:**
- Si el usuario borra los datos del navegador, pierde su identidad y sus listas.
- No hay autenticación real: cualquier persona que conozca un `userId` podría suplantar a otro usuario técnicamente. Es una limitación aceptable para un prototipo.

### 3. Compartir listas con código corto

Para invitar a otros miembros, la app genera un código de 8 caracteres a partir del UUID de la lista:

```typescript
const getShortCode = (id: string) => id.substring(0, 8).toUpperCase();
```

El usuario puede compartir este código o enviar directamente un enlace tipo `https://app.ejemplo.com?join=X7B9WC01`. Al abrir ese enlace, la app detecta el parámetro `join` en la URL, busca la lista correspondiente, une automáticamente al usuario y limpia la URL con `history.replaceState` para que no se repita el join si se recarga la página.

### 4. Modo oscuro con clase CSS

El modo oscuro se implementa con la estrategia de **clase en el `<html>`**: al activarlo, se añade la clase `dark` al `documentElement` y Tailwind CSS aplica las variantes `dark:` de todos los componentes. La preferencia se guarda en `localStorage` para que persista entre sesiones.

Esta estrategia permite que el tema cambie al instante sin necesidad de recargar los estilos, y es compatible con la configuración de Tailwind v4.

### 5. Arquitectura de componentes del frontend

El frontend está organizado siguiendo el principio de **separación de responsabilidades**:

```
src/
├── App.tsx                  → Orquestador principal (estado global, WebSocket, routing)
├── api.ts                   → Capa de comunicación con el backend (axios)
├── types.ts                 → Interfaces TypeScript compartidas
├── index.css                → Estilos globales y keyframes de animación
├── main.tsx                 → Punto de entrada de React
└── components/
    ├── BottomNav.tsx         → Barra de navegación inferior
    ├── ListDetail.tsx        → Vista de detalle de una lista (productos)
    ├── ListsHome.tsx         → Vista principal (crear, unirse, mis listas)
    ├── SearchTab.tsx         → Buscador de listas y productos
    ├── AccountModal.tsx      → Modal de cuenta / sesión
    ├── SettingsModal.tsx     → Ajustes de la lista (miembros, eliminar, tema)
    └── Toast.tsx             → Sistema de notificaciones temporales
```

`App.tsx` actúa como **orquestador**: mantiene el estado global (listas, lista actual, sesión, tema), gestiona la conexión WebSocket y decide qué vista renderizar. Los componentes hijos reciben datos y callbacks por props, y cada uno gestiona su propio estado local (formularios, búsqueda, etc.).

La capa `api.ts` centraliza todas las llamadas HTTP para que los componentes no dependan directamente de axios ni de las URLs del backend.

### 6. Notificaciones toast en vez de alertas nativas

En vez de usar `alert()` y `confirm()` del navegador (que bloquean el hilo principal, rompen la estética de la app y no se pueden personalizar), la aplicación usa un **sistema de toasts**: notificaciones pequeñas que aparecen en la parte superior de la pantalla, se auto-eliminan a los 3 segundos y tienen tres variantes visuales (éxito, error, información).

### 7. Accesibilidad (a11y)

Se han aplicado mejoras básicas de accesibilidad:

- **`lang="es"`** en el HTML para que los lectores de pantalla usen la pronunciación correcta.
- **`aria-label`** en todos los botones de solo icono (volver, compartir, ajustes, eliminar, tema, navegación).
- **`role="dialog"` y `aria-modal="true"`** en modales para que los lectores de pantalla los anuncien correctamente.
- **`<label>` oculto (`sr-only`)** asociado a cada input de formulario.
- **Cierre con Escape** y **click en overlay** para cerrar modales, facilitando la navegación por teclado.
- **Contraste mejorado:** Los elementos completados usan `opacity-70` (en vez de 60) y los textos secundarios usan `11px` como mínimo.
- **Botones de eliminar visibles en móvil:** En desktop aparecen al pasar el ratón; en móvil se muestran siempre con opacidad reducida, ya que las pantallas táctiles no tienen hover.

---

## Modelo de datos

### ShoppingList

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `UUID` (generado) | Identificador único, generado por JPA |
| `name` | `String` | Nombre de la lista |
| `creatorId` | `String` | `userId` del creador |
| `members` | `Set<String>` | Conjunto de `userId` de los miembros |
| `createdAt` | `LocalDateTime` | Fecha de creación |
| `items` | `List<ShoppingItem>` | Productos de la lista (relación `OneToMany`) |

### ShoppingItem

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `UUID` (generado) | Identificador único |
| `name` | `String` | Nombre del producto |
| `addedBy` | `String` | `userId` de quien lo añadió |
| `isCompleted` | `Boolean` | Si está marcado como comprado |
| `shoppingList` | `ShoppingList` | Relación `ManyToOne` (no se serializa a JSON) |

La relación `ShoppingItem → ShoppingList` usa `@JsonIgnore` para evitar referencias circulares al serializar a JSON. Los items se devuelven siempre dentro de su lista padre.

---

## API REST

Base URL: `/api/lists`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/?userId={userId}` | Obtener listas donde el usuario es miembro |
| `GET` | `/code/{code}` | Buscar lista por código corto (8 primeros caracteres del UUID) |
| `GET` | `/{id}` | Obtener una lista por su ID completo |
| `POST` | `/` | Crear una lista nueva |
| `DELETE` | `/{id}` | Eliminar una lista |
| `POST` | `/{id}/join` | Unirse a una lista (`{ "userId": "..." }`) |
| `POST` | `/{id}/leave` | Abandonar una lista (`{ "userId": "..." }`) |
| `POST` | `/{id}/items` | Añadir un producto a la lista |
| `PUT` | `/items/{itemId}` | Actualizar un producto (marcar/desmarcar) |
| `DELETE` | `/items/{itemId}` | Eliminar un producto |

Todos los errores devuelven códigos HTTP estándar (404 si no se encuentra el recurso, 400 si faltan datos obligatorios) usando `ResponseStatusException` de Spring.

---

## Cómo ejecutar el proyecto

### Requisitos

- Docker y Docker Compose instalados.

### Pasos

1. Clona o descarga el repositorio.
2. Abre una terminal en la carpeta raíz del proyecto.
3. Ejecuta:

```bash
docker-compose up --build
```

4. Accede a la aplicación:
   - **Frontend:** http://localhost:3000
   - **API REST:** http://localhost:8080/api/lists

### Desarrollo local (sin Docker)

Si quieres trabajar en el frontend sin Docker:

1. Levanta la base de datos y el backend con Docker:

```bash
docker-compose up db backend
```

2. Instala las dependencias del frontend:

```bash
npm install
```

3. Arranca el servidor de desarrollo de Vite:

```bash
npm run dev
```

Vite redirige automáticamente las peticiones `/api` y `/ws` al backend en `localhost:8080` gracias a la configuración de proxy en `vite.config.ts`.

---

## Infraestructura (Docker Compose)

El archivo `docker-compose.yml` define tres servicios:

| Servicio | Imagen / Build | Puerto | Función |
|----------|---------------|--------|---------|
| `db` | `postgres:16-alpine` | 5432 | Base de datos PostgreSQL |
| `backend` | Build desde `./backend` | 8080 | API REST + WebSocket (Spring Boot) |
| `frontend` | Build desde `.` con Nginx | 3000 → 80 | Sirve la SPA y hace proxy reverso al backend |

En producción, Nginx sirve los archivos estáticos del build de Vite y redirige las rutas `/api/` y `/ws/` al contenedor del backend. Esto permite tener frontend y backend en el mismo dominio sin problemas de CORS.

---

## Posibles mejoras futuras

- **Autenticación real** con Spring Security y JWT para sustituir al usuario fantasma.
- **Notificaciones push** con Service Workers para avisar de cambios cuando la app está en segundo plano.
- **Edición de nombre de lista** y de productos existentes.
- **Ordenar productos** por categoría o manualmente con drag-and-drop.
- **Historial de compras** para reutilizar listas anteriores.
- **Tests unitarios y de integración** tanto en frontend (React Testing Library) como en backend (JUnit + MockMvc).
