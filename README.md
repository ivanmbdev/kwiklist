# KwikList

**Trabajo de Fin de Grado — Desarrollo de Aplicaciones Multiplataforma**

KwikList es una aplicación de listas de la compra colaborativas en tiempo real. Permite crear listas, añadir productos, compartirlas con otras personas mediante un código corto y ver los cambios de todos los miembros al instante, sin necesidad de recargar la página. Funciona incluso sin conexión gracias a su sistema de cola offline.

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
| App nativa | Capacitor | 7 |

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
| `/topic/lists/{id}/update` | Lista completa actualizada | Al unirse/salir un miembro o editar el nombre |

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

### 3. Cola offline (Offline Queue)

La aplicación está pensada para usarse en el supermercado, donde la conexión móvil puede ser inestable. Para que esto no sea un problema, se implementó un sistema de **cola offline**:

**Cómo funciona:**

1. Cuando el usuario realiza una acción (añadir producto, marcar como comprado, eliminar...), la app intenta enviarla al servidor.
2. Si la petición falla por falta de conexión (detectado via `navigator.onLine` y errores de red de axios), la operación se **encola** en `localStorage` en vez de perderse.
3. Se muestra un toast informativo: "Guardado offline".
4. Cuando la conexión se recupera (evento `online` del navegador o reconexión del WebSocket), la app **ejecuta automáticamente** todas las operaciones pendientes en orden y sincroniza el estado con el servidor.

**Persistencia local de listas:**

Cada vez que se cargan listas del servidor, se guardan también en `localStorage` como cache. Si el usuario abre la app sin conexión, las listas se hidratan desde este cache para que pueda ver sus datos aunque esté offline.

**Banner de estado:**

Cuando se detecta que no hay conexión, aparece un banner amarillo en la parte superior de la app: "Sin conexión — los cambios se guardarán localmente".

### 4. Compartir listas con código corto

Para invitar a otros miembros, la app genera un código de 8 caracteres a partir del UUID de la lista:

```typescript
const getShortCode = (id: string) => id.substring(0, 8).toUpperCase();
```

El usuario puede compartir este código o enviar directamente un enlace tipo `https://kwiklist.ejemplo.com?join=X7B9WC01`. Al abrir ese enlace, la app detecta el parámetro `join` en la URL, busca la lista correspondiente, une automáticamente al usuario y limpia la URL con `history.replaceState` para que no se repita el join si se recarga la página.

### 5. Edición de nombre de lista

El nombre de la lista se puede editar directamente desde la vista de detalle. Al pulsar sobre el título de la lista, se transforma en un campo de texto editable. Al pulsar Enter o hacer click fuera, se envía el cambio al backend vía `PUT /api/lists/{id}` y se notifica a todos los miembros por WebSocket.

Si no hay conexión en ese momento, el cambio se encola en la cola offline y se sincronizará automáticamente.

### 6. Modo oscuro con clase CSS

El modo oscuro se implementa con la estrategia de **clase en el `<html>`**: al activarlo, se añade la clase `dark` al `documentElement` y Tailwind CSS aplica las variantes `dark:` de todos los componentes. La preferencia se guarda en `localStorage` para que persista entre sesiones.

### 7. Arquitectura de componentes del frontend

El frontend está organizado siguiendo el principio de **separación de responsabilidades**:

```
src/
├── App.tsx                  → Orquestador principal (estado global, WebSocket, routing)
├── api.ts                   → Capa de comunicación con el backend (axios)
├── offlineQueue.ts          → Cola offline y cache local de listas
├── types.ts                 → Interfaces TypeScript compartidas
├── index.css                → Estilos globales y keyframes de animación
├── main.tsx                 → Punto de entrada de React
└── components/
    ├── BottomNav.tsx         → Barra de navegación inferior
    ├── ListDetail.tsx        → Vista de detalle de una lista (productos, edición de nombre)
    ├── ListsHome.tsx         → Vista principal (crear, unirse, mis listas)
    ├── SearchTab.tsx         → Buscador de listas y productos
    ├── AccountModal.tsx      → Modal de cuenta / sesión
    ├── SettingsModal.tsx     → Ajustes de la lista (miembros, eliminar, tema)
    └── Toast.tsx             → Sistema de notificaciones temporales
```

`App.tsx` actúa como **orquestador**: mantiene el estado global (listas, lista actual, sesión, tema, conexión), gestiona la conexión WebSocket, la cola offline y decide qué vista renderizar. Los componentes hijos reciben datos y callbacks por props, y cada uno gestiona su propio estado local (formularios, búsqueda, etc.).

### 8. Notificaciones toast en vez de alertas nativas

En vez de usar `alert()` y `confirm()` del navegador (que bloquean el hilo principal, rompen la estética de la app y no se pueden personalizar), la aplicación usa un **sistema de toasts**: notificaciones pequeñas que aparecen en la parte superior de la pantalla, se auto-eliminan a los 3 segundos y tienen tres variantes visuales (éxito, error, información).

### 9. Accesibilidad (a11y)

Se han aplicado mejoras básicas de accesibilidad:

- **`lang="es"`** en el HTML para que los lectores de pantalla usen la pronunciación correcta.
- **`aria-label`** en todos los botones de solo icono.
- **`role="dialog"` y `aria-modal="true"`** en modales.
- **`<label>` oculto (`sr-only`)** asociado a cada input de formulario.
- **Cierre con Escape** y **click en overlay** para cerrar modales.
- **Botones de eliminar visibles en móvil** con opacidad reducida (en desktop aparecen solo al hover).

---

## Modelo de datos

### ShoppingList

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `UUID` (generado) | Identificador único, generado por JPA |
| `name` | `String` | Nombre de la lista (editable) |
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

---

## API REST

Base URL: `/api/lists`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/?userId={userId}` | Obtener listas donde el usuario es miembro |
| `GET` | `/code/{code}` | Buscar lista por código corto |
| `GET` | `/{id}` | Obtener una lista por su ID completo |
| `POST` | `/` | Crear una lista nueva |
| `PUT` | `/{id}` | Actualizar una lista (nombre) |
| `DELETE` | `/{id}` | Eliminar una lista |
| `POST` | `/{id}/join` | Unirse a una lista (`{ "userId": "..." }`) |
| `POST` | `/{id}/leave` | Abandonar una lista (`{ "userId": "..." }`) |
| `POST` | `/{id}/items` | Añadir un producto a la lista |
| `PUT` | `/items/{itemId}` | Actualizar un producto (marcar/desmarcar) |
| `DELETE` | `/items/{itemId}` | Eliminar un producto |

Todos los errores devuelven códigos HTTP estándar (404 si no se encuentra el recurso, 400 si faltan datos obligatorios) usando `ResponseStatusException` de Spring.

---

## Cómo ejecutar el proyecto

### Opción 1: Solo Docker (sin Node.js)

1. Asegúrate de tener **Docker** y **Docker Compose** instalados.
2. Abre una terminal en la carpeta raíz del proyecto.
3. Ejecuta:

```bash
docker-compose up --build
```

4. Accede a la aplicación:
   - **Frontend:** http://localhost:3000
   - **API REST:** http://localhost:8080/api/lists

### Opción 2: Desarrollo local (frontend fuera de Docker)

1. Instala [Node.js 20+](https://nodejs.org/) si no lo tienes.
2. Levanta la base de datos y el backend con Docker:

```bash
docker-compose up db backend
```

3. Instala las dependencias del frontend:

```bash
npm install
```

4. Arranca el servidor de desarrollo de Vite:

```bash
npm run dev
```

Vite redirige automáticamente las peticiones `/api` y `/ws` al backend en `localhost:8080` gracias a la configuración de proxy en `vite.config.ts`.

---

## Compilar para Android (Capacitor)

### Requisitos previos

1. **Node.js 20+** instalado ([nodejs.org](https://nodejs.org/)).
2. **Android Studio** instalado ([developer.android.com/studio](https://developer.android.com/studio)).
3. En Android Studio, instalar al menos un **Android SDK** (API 33 o superior).
4. Un **dispositivo Android** con depuración USB activada, o un emulador configurado.

### Pasos

1. Instalar dependencias:

```bash
npm install
```

2. Inicializar Capacitor (solo la primera vez):

```bash
npx cap init "KwikList" "com.kwiklist.app" --web-dir dist
```

> Si ya existe `capacitor.config.ts`, este paso se puede saltar.

3. Añadir la plataforma Android (solo la primera vez):

```bash
npx cap add android
```

4. Generar los iconos para Android desde el icono base (`public/icon.png`):

```bash
npx @capacitor/assets generate --iconBackgroundColor '#10b981' --iconBackgroundColorDark '#0d9488'
```

5. Compilar el frontend y sincronizar con Android:

```bash
npm run build
npx cap sync
```

6. Abrir el proyecto en Android Studio:

```bash
npx cap open android
```

7. En Android Studio:
   - Conecta tu dispositivo Android por USB (con depuración USB activada en Ajustes > Opciones de desarrollador).
   - Pulsa el botón **Run** (triángulo verde).
   - La app se instalará en tu dispositivo con el icono de KwikList.

### Apuntar la app a tu servidor

Por defecto, la app compilada busca el backend en la misma URL desde la que se sirve (relativa). Para que funcione en tu móvil, necesitas que el backend sea accesible desde internet. Edita `capacitor.config.ts`:

```typescript
server: {
  url: 'https://TU-DOMINIO-O-IP',
  androidScheme: 'https',
},
```

Después vuelve a ejecutar `npm run build && npx cap sync` y reinstala la app.

---

## Despliegue en producción

Para que la app funcione fuera de `localhost` (accesible desde tu móvil y desde el de otros usuarios), necesitas un servidor accesible desde internet.

### Opción A: VPS (recomendado para el TFG)

**Proveedores económicos:**

| Proveedor | Precio | Notas |
|-----------|--------|-------|
| [Hetzner](https://www.hetzner.com/cloud) | ~3-4 EUR/mes | Buen rendimiento, datacenters en Europa |
| [DigitalOcean](https://www.digitalocean.com/) | ~6 USD/mes | Interfaz muy sencilla |
| [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/) | Gratis | 1 GB RAM, suficiente para el prototipo |

**Pasos para desplegar:**

1. **Crear el VPS** con Ubuntu 22.04 o 24.04 y acceder por SSH.

2. **Instalar Docker y Docker Compose:**

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

3. **Clonar el repositorio:**

```bash
git clone https://TU-REPO.git kwiklist
cd kwiklist
```

4. **Lanzar con Docker Compose (producción):**

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

5. **Configurar HTTPS** (necesario para WebSocket y Capacitor). La opción más sencilla es usar [Caddy](https://caddyserver.com/) como proxy inverso:

```bash
# Instalar Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

```bash
# Configurar Caddy (/etc/caddy/Caddyfile)
kwiklist.tudominio.com {
    reverse_proxy localhost:3000
}
```

Caddy obtiene y renueva certificados HTTPS automáticamente con Let's Encrypt.

6. **Actualizar `capacitor.config.ts`** con la URL del VPS y recompilar la app Android.

### Opción B: ngrok (solo para pruebas rápidas)

Si solo quieres probar la app en tu móvil sin montar un VPS:

1. Instala [ngrok](https://ngrok.com/) y créate una cuenta gratuita.

2. Con Docker Compose corriendo en local:

```bash
ngrok http 3000
```

3. ngrok te dará una URL pública tipo `https://xxxx.ngrok-free.app` que redirige a tu Docker local.

4. Pon esa URL en `capacitor.config.ts`, recompila y ejecuta en tu móvil.

> **Nota:** La URL de ngrok cambia cada vez que lo reinicias (en el plan gratuito). Es útil para demos y pruebas del TFG, no para producción.

---

## Infraestructura (Docker Compose)

El archivo `docker-compose.yml` define tres servicios:

| Servicio | Imagen / Build | Puerto | Función |
|----------|---------------|--------|---------|
| `db` | `postgres:16-alpine` | 5432 | Base de datos PostgreSQL |
| `backend` | Build desde `./backend` | 8080 | API REST + WebSocket (Spring Boot) |
| `frontend` | Build desde `.` con Nginx | 3000 → 80 | Sirve la SPA y hace proxy reverso al backend |

En producción, Nginx sirve los archivos estáticos del build de Vite y redirige las rutas `/api/` y `/ws/` al contenedor del backend.

---

## Posibles mejoras futuras

- **Login con Google (OAuth2):** La filosofía actual del usuario fantasma prioriza cero fricción. Un login con Google sería una capa adicional *opcional* para los usuarios que quieran vincular su cuenta y no perder sus datos al cambiar de dispositivo. Requeriría integrar Spring Security con OAuth2 en el backend y el SDK de Google Identity en el frontend.
- **Notificaciones push** con Service Workers para avisar de cambios cuando la app está en segundo plano.
- **Ordenar productos** por categoría o manualmente con drag-and-drop.
- **Historial de compras** para reutilizar listas anteriores.
- **Tests unitarios y de integración** tanto en frontend (React Testing Library) como en backend (JUnit + MockMvc).
