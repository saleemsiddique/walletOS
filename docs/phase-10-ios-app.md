# WalletOS — Fase 10: App iOS Nativa

La app del usuario final: **Swift + SwiftUI, iOS 16+**, bundle id `com.walletOS.app`. Consume los 4 microservicios del backend a través del gateway Nginx (`http://localhost/api/...` en dev). Offline-first con cola de sincronización local. Se construye en ramas cortas de feature, cada una con su PR a `develop`. Al terminar la fase, `develop` → `main`.

## Contexto

Las Fases 5–9 están completas y mergeadas en `main` (2026-06-30). El backend expone **34 endpoints públicos** detrás del gateway Nginx (`infra/nginx/nginx.conf`), con el flujo E2E verificado (8/8 escenarios Bruno). Los endpoints internos (`/api/internal/*`) están bloqueados por Nginx con `403` y no son accesibles desde la app.

**Gateway:** `http://localhost/api/...` (puerto 80, CORS `*` en dev). En dispositivo físico se accede vía ngrok o IP de la LAN del Mac.
**Auth:** JWT Bearer HS256 (access 15 min) + refresh token opaco (30 días, rotado en cada uso, sin blacklist).
**Contratos de referencia:** `docs/api-contracts.md` (todos los servicios).
**Pantallas y BDD:** `docs/user-flow-and-bdd.md` (pantallas 1–15 y escenarios Gherkin).
**Colección de referencia:** `docs/api-collection/` (Bruno) para ver requests/responses reales.

### Cuentas y credenciales ya disponibles (Fase 2)

| Recurso                    | Valor / archivo                                                           |
| -------------------------- | ------------------------------------------------------------------------- |
| App ID                     | `com.walletOS.app` (capabilities: Sign in with Apple, Push Notifications) |
| Apple Sign In key          | `AuthKey_AH5KSJB2U2.p8` (keyId, teamId, clientId anotados)                |
| APNs auth key              | `AuthKey_38KDR9XZDG.p8` (keyId, teamId, bundleId anotados)                |
| Google OAuth iOS Client ID | `GOOGLE_IOS_CLIENT_ID` anotado (bundle `com.walletOS.app`)                |

### Principio rector — cliente delgado, backend fuente de verdad

Toda la lógica de negocio (balances, stats, categorización, insights, materialización de recurrentes) vive en el backend. La app **no recalcula**: renderiza lo que devuelven `/dashboard`, `/stats`, `/insights`, `/portfolio`. La única lógica local es la de presentación, la **cola de sincronización offline** y el **refresh silencioso de token**. Esto mantiene la app fina, testeable y desacoplada del modelo financiero.

Consecuencias:

- Sin duplicación de reglas financieras entre Swift y el backend.
- Los gráficos nativos (Swift Charts) se dibujan desde el JSON `charts` de `/insights` y desde `/stats`, no desde cálculos propios.
- El offline-first se limita a **crear/editar transacciones** con UUID de cliente; el resto de pantallas requiere red y degrada con datos cacheados en GRDB.

### Decisiones cerradas (recordatorio)

| Decisión              | Elección                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plataforma            | iOS nativo, Swift + SwiftUI, target **iOS 16+**. Sin Flutter, sin Android en v1.                                                                  |
| Arquitectura          | Clean Architecture **feature-first**: `Features/<Feature>/{Domain,Data,Presentation}` + `Core/` (infra) + `Shared/` (dominio y UI cross-feature). |
| Networking            | `URLSession` async/await + interceptor Bearer + refresh silencioso ante 401.                                                                      |
| Almacenamiento seguro | **Keychain** para access + refresh token.                                                                                                         |
| DB local              | **GRDB** (SQLite) para cache y cola de sincronización.                                                                                            |
| Sync offline          | UUID v4 generado en cliente, cola FIFO, 5 reintentos con backoff exponencial, last-write-wins.                                                    |
| Apple Sign In         | `AuthenticationServices` nativo → `POST /api/apple`.                                                                                              |
| Google Sign In        | SDK `GoogleSignIn` para iOS (`GOOGLE_IOS_CLIENT_ID`) → `POST /api/google`.                                                                        |
| Gráficos              | **Swift Charts** (nativo) desde `charts` de insights y desde `/stats`.                                                                            |
| Widget                | **WidgetKit** (S/M): balance total + gasto del día. Deep link `walletos://add`.                                                                   |
| Push                  | **APNs nativo** (`UserNotifications`), sin FCM/Firebase. Registro `POST /api/devices`.                                                            |
| Deep links            | `walletos://reset?token=...`, `walletos://add`.                                                                                                   |
| i18n                  | **String Catalog** (`.xcstrings`), solo `es` en v1 (preparado para `en` en v2).                                                                   |
| Divisa                | EUR fija en toda la UI (v1).                                                                                                                      |
| Linters               | **SwiftLint** + **swift-format**, integrados en el pre-commit del monorepo.                                                                       |

---

## Flujo de ramas

```
develop
 ├── feature/docs-phase-10-plan          (Bloque 0 — este documento)
 ├── feature/ios-scaffold
 ├── feature/ios-design-system
 ├── feature/ios-mascot
 ├── feature/ios-networking
 ├── feature/ios-keychain
 ├── feature/ios-local-db
 ├── feature/ios-sync-engine
 ├── feature/ios-feature-flags
 ├── feature/ios-auth-screen
 ├── feature/ios-apple-signin
 ├── feature/ios-google-signin
 ├── feature/ios-forgot-password
 ├── feature/ios-reset-password
 ├── feature/ios-setup-flow
 ├── feature/ios-home
 ├── feature/ios-add-transaction
 ├── feature/ios-edit-transaction
 ├── feature/ios-accounts
 ├── feature/ios-bank-modal
 ├── feature/ios-wallet-modal
 ├── feature/ios-wallet-transactions
 ├── feature/ios-stats
 ├── feature/ios-insights-list
 ├── feature/ios-insight-detail
 ├── feature/ios-settings
 ├── feature/ios-widget
 ├── feature/ios-push
 └── feature/ios-i18n
main ← develop  (al cerrar la fase)
```

---

## Estado de ejecución

🚧 **Fase 10 en marcha.** Implementación iniciada en Mac (Xcode 26.6, Swift 6.3) el 2026-07-02. **Ramas 1–13 completas y mergeadas en `develop` — Bloques A, B y C (autenticación) cerrados.** Cadencia rama por rama con PR y verificación en simulador iPhone 17 (iOS 26.5) como criterio de "hecho" (o tests para las capas sin UI). Siguiente: Bloque D — Rama 14 (setup inicial) y Rama 15 (Home).

> **Ajuste de arquitectura (2026-07-03):** se pasó de capas globales a **feature-first** (`Features/<Feature>/{Domain,Data,Presentation}` + `Core/` + `Shared/`) — PR #151.

> **⚠️ Pivote estético (2026-07-04):** se **eliminó la mascota** (motor `MascotView`, assets, catálogo de animaciones) y se descartó la identidad mostaza/cuero (PR #160). La nueva dirección quedó **estipulada el mismo día: "Ledger" — terminal premium nativa** (`design-system.md`): monocromo de 6 tokens, acento fósforo, negro OLED, SF Pro + SF Mono en números, hairlines sin tarjetas y una acción primaria por pantalla. Consecuencias sobre este plan: la Rama 3 queda solo como histórico (su entrega se retiró del código); **toda mención a mascota/personaje o a la estética antigua en las ramas pendientes queda anulada** — los checklists describen alcance funcional y la UI se deriva del design system (reglas de simpleza §7) y de `user-flow-and-bdd.md` — **sin specs por pantalla** (`docs/screens/` se eliminó al cerrar Ledger); las decisiones de UI no obvias se anotan en la sección de la rama al implementarla. La dirección se documentó en el PR #161 y **ya está aplicada en código**: `Core/Theme` re-tokenizado y auth re-skineada (PR #162).

| Bloque                                    | Ramas | Contenido                                                          | Estado      |
| ----------------------------------------- | ----- | ------------------------------------------------------------------ | ----------- |
| 0 — Documentación                         | doc   | Este documento                                                     | ✅          |
| A — Setup, identidad y personaje          | 1–3   | Proyecto Xcode/capas/linters, tokens del design system, MascotView | ✅          |
| B — Core / infraestructura                | 4–8   | Networking, Keychain, GRDB, sync engine, feature flags             | ✅ completo |
| C — Autenticación                         | 9–13  | Auth screen, Apple, Google, forgot, reset                          | ✅ completo |
| D — Setup inicial y Home                  | 14–17 | Setup flow, Home, add/edit transacción                             | ⬜          |
| E — Cuentas, transacciones y stats        | 18–22 | Cuentas, banco/wallet modals, txns de wallet, stats                | ⬜          |
| F — Insights, ajustes, widget, push, i18n | 23–29 | Insights, ajustes, widget, push, i18n                              | ⬜          |

### Ramas completadas

| Rama  | Nombre                                | PR   | Entregado                                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | ------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `feature/ios-scaffold`                | #146 | Proyecto Xcode vía **XcodeGen** (`project.yml`), árbol por capas, Info.plist/entitlements, SwiftLint+swift-format en pre-commit, tests.                                                                                                                                                                                                                                                             |
| 2     | `feature/ios-design-system`           | #148 | Tokens color light/dark (asset catalog + `AppColor`), tipografía, spacing/radius/shadow/motion, haptics, `IconCatalog`, `PrimaryButton`, formato EUR. Corrección a11y: 3 pares de color a WCAG AA.                                                                                                                                                                                                  |
| 3     | `feature/ios-mascot`                  | #149 | Motor `MascotView` (estados/gestos, cascada clip→idle→PNG, AVPlayerLooper, Reduce Motion, VoiceOver), `MascotPanel`, 4 PNG base reales.                                                                                                                                                                                                                                                             |
| 4     | `feature/ios-networking`              | #150 | `Endpoint`, `APIError`, `APIClient` (URLSession async/await), `AuthInterceptor` (Bearer + refresh coalesced ante 401 + logout), `TokenStoring`/`RequestAuthorizing`.                                                                                                                                                                                                                                |
| 5     | `feature/ios-keychain`                | #152 | `KeychainStore` (Security), `TokenStore` (actor, implementa `TokenStoring`), `AuthState` observable, `SecureStoring`.                                                                                                                                                                                                                                                                               |
| 6     | `feature/ios-local-db`                | #154 | GRDB vía SPM, `AppDatabase` (DatabaseQueue + migrator en Application Support), tablas espejo `bank/wallet/category/transaction/recurring_rule/sync_operation`, DAOs con upsert, índices (`wallet.bank_id`, `transaction(wallet_id, date)`).                                                                                                                                                         |
| 7     | `feature/ios-sync-engine`             | #155 | `SyncOperation`/`SyncOperationRecord`, `SyncQueue` (actor, FIFO por rowid, backoff exponencial inyectable, `failedOperations` stream), `SyncOperationHandling` (perform+reconcile LWW, agnóstico al negocio), `NetworkMonitor`/`NetworkMonitoring` (NWPathMonitor) con drenado automático al reconectar.                                                                                            |
| 8     | `feature/ios-feature-flags`           | #156 | `AppEnvironment` (local/staging/prod, `baseURL` por caso, override de debug), `FeatureFlags.useSandboxAPNs`; `APIClient` toma la base URL del entorno activo por defecto.                                                                                                                                                                                                                           |
| 9     | `feature/ios-auth-screen`             | #158 | `AuthRepository` + use cases (`LoginUser`/`RegisterUser`), DTOs, `AuthRemoteDataSource`, `AuthRepositoryImpl` (tokens al `TokenStore`), `AuthView`+`AuthViewModel` (toggle login/registro, validación, mascota M-05 wave, placeholders Apple/Google, gancho forgot), `AppDependencies`+`RootView` (la raíz observa `AuthState`; placeholder autenticado como gancho Setup vs Home).                 |
| 10    | `feature/ios-apple-signin`            | #164 | `SignInWithApple` (use case) + `signInWithApple(identityToken:name:)` en repo/datasource → `POST /apple`; `SignInWithAppleButton` nativo en `AuthView` (estilo por tema, `.id(colorScheme)`), extracción de credencial y nombre, cancelación sin error. E2E real pendiente de dispositivo físico.                                                                                                   |
| 11–13 | `feature/ios-google-forgot-reset`     | #165 | Google Sign In (SDK SPM, `GIDClientID` + URL scheme en Info.plist, canje en `/google`), forgot password (mensaje neutro, `/auth/forgot-password`), reset password (`/auth/reset-password`, cierre de sesiones + limpieza local, token inválido → pedir enlace nuevo) y `DeepLinkRouter` (`walletos://reset` testeado, `NavigationStack` raíz). E2E de forgot/reset verificado contra backend local. |
| —     | `feature/ios-remove-mascot`           | #160 | Pivote estético: retirada de la mascota (motor, assets, colorset, catálogo y specs antiguas) del código y del planning.                                                                                                                                                                                                                                                                             |
| —     | `docs/design-system-ledger`           | #161 | Dirección estética **"Ledger"** estipulada y documentada (`design-system.md` reescrito; consistencia en ROADMAP y plan de fase).                                                                                                                                                                                                                                                                    |
| —     | `feature/ios-theme-ledger`            | #162 | Re-tokenización de `Core/Theme` a Ledger (paleta, SF Mono en números, radio único, sin sombras) y re-skin de `AuthView` y `PrimaryButton`. La eliminación de `docs/screens/` (registro de componentes → `design-system.md` §11) llegó en el PR de estado posterior.                                                                                                                                 |
| —     | `feature/ios-feature-first-structure` | #151 | Reorganización a feature-first del código y del plan.                                                                                                                                                                                                                                                                                                                                               |

### Estructura de carpetas objetivo

Organización **feature-first**: cada feature es un slice vertical con su propio mini-stack clean (`Domain/`, `Data/`, `Presentation/`). Lo que usan varias features vive en `Shared/` (entidades y componentes cross-feature) y la infraestructura pura en `Core/`. Regla: lo que usa **una sola feature** vive dentro de la feature; lo que cruzan **dos o más**, en `Shared/`; la fontanería sin negocio ni UI (red, DB, keychain, tokens de diseño), en `Core/`.

```
ios/
  WalletOS.xcodeproj
  WalletOS/
    App/                     WalletOSApp.swift, AppDelegate, DI container, deep-link router
      Navigation/            AppRouter, RootTabView (cableado global de la app)
    Core/                    infraestructura transversal (sin negocio ni UI de feature)
      Theme/                 Colors, Typography, Spacing, Radius, Shadow, Motion, Haptics (design system)
      Network/               APIClient, AuthInterceptor, Endpoint, APIError
      Storage/               KeychainStore, TokenStore
      Database/              GRDB setup, migrations
      Sync/                  SyncQueue, SyncOperation, retry/backoff
      Config/                Environment (staging/prod), feature flags
    Features/                un slice vertical por feature
      Auth/                  login/registro, Apple, Google, forgot, reset
        Domain/              AuthRepository (protocolo), use cases (LoginUser, RegisterUser, ...)
        Data/                DTOs, AuthRemoteDataSource, AuthRepositoryImpl
        Presentation/        AuthView, ForgotPasswordView, ResetPasswordView + ViewModels
      Setup/                 Domain/ Data/ Presentation/ (onboarding post-registro)
      Home/                  Domain/ Data/ Presentation/ (dashboard)
      Transactions/          Domain/ Data/ Presentation/ (modal añadir/editar, txns del wallet)
      Accounts/              Domain/ Data/ Presentation/ (bancos, wallets y sus modals)
      Stats/                 Domain/ Data/ Presentation/
      Insights/              Domain/ Data/ Presentation/ (lista + detalle)
      Settings/              Domain/ Data/ Presentation/
    Shared/                  lo que cruzan dos o más features
      Domain/                entidades cross-feature (Bank, Wallet, Transaction, Category, ...)
                             y sus repositorios (BankRepository, WalletRepository, ...)
      Data/                  DTOs/mappers/datasources/impl de esas entidades + cache GRDB (Local/)
      Components/            UI compartida (PrimaryButton, CategoryGrid, AmountKeypad, IconPicker,
                             EmptyState, Toast, ...)
    Resources/
      Localizable.xcstrings  (es)
      Assets.xcassets
    Widget/                  WalletOSWidget (WidgetKit)
  WalletOSTests/
  WalletOSUITests/
```

---

## Rama 1 — `feature/ios-scaffold`

### Objetivo

Proyecto Xcode base con estructura por capas, linters e integración en el pre-commit del monorepo. Compila y arranca en simulador mostrando una pantalla placeholder.

### Checklist de desarrollo

- [x] Crear proyecto Xcode `WalletOS` en `ios/` (Swift, SwiftUI lifecycle, target iOS 16.0), bundle id `com.walletOS.app`.
- [x] Capabilities en el target: **Sign in with Apple**, **Push Notifications**, **Background Modes** (Remote notifications).
- [x] Crear el árbol de carpetas de la sección anterior (`App/`, `Core/`, `Features/`, `Shared/`, `Resources/`, `Widget/`).
- [x] `Info.plist`: `CFBundleURLTypes` con esquema `walletos` (deep links); `NSAppTransportSecurity` con excepción para `localhost` (HTTP en dev).
- [x] Gestión de dependencias con **Swift Package Manager** (declarar paquetes en las ramas que los usan: GRDB, GoogleSignIn).
- [x] `SwiftLint` (`.swiftlint.yml`) y `swift-format` (`.swift-format`) en la raíz de `ios/`.
- [x] Añadir regla en `lint-staged.config.mjs` raíz: `ios/**/*.swift` → `swiftlint --fix` + `swift-format format -i`.
- [x] `WalletOSApp.swift` con un `WindowGroup` que muestra un placeholder (`Text("WalletOS")`).
- [x] `README.md` en `ios/` con instrucciones de build (Xcode version, cómo abrir, cómo apuntar al backend local).

### Checklist de tests

- [x] Target `WalletOSTests` creado con un test trivial que pasa (smoke de configuración de Xcode).
- [x] `swiftlint` y `swift-format --lint` corren limpios sobre el scaffold.

### Commits del PR

```
chore(ios): scaffold proyecto xcode swiftui ios 16 con estructura por capas
chore(ios): swiftlint y swift-format integrados en lint-staged del monorepo
```

### Criterio Done

El proyecto compila y arranca en simulador iOS 16+ mostrando el placeholder; SwiftLint + swift-format limpios; el pre-commit del monorepo lint-formatea archivos `.swift`.

---

## Rama 2 — `feature/ios-design-system`

### Objetivo

Traducir `docs/design-system.md` (§4–§10: color, tipografía, layout/forma, movimiento, haptics) a tokens de código reutilizables, para que toda pantalla posterior consuma el mismo sistema en vez de valores sueltos. Incluye el catálogo de iconos (§7): la app **nunca** renderiza emoji, todo es SF Symbols.

### Checklist de desarrollo

- [x] `Assets.xcassets`: Color Sets para los tokens semánticos de §4 (`bg`, `surface`, `surface-alt`, `text-primary`, `text-secondary`, `text-on-brand`, `accent`, `income`, `expense`, `separator`, `mascot-stage`) con variante Any/Dark resuelta automáticamente.
- [x] `Core/Theme/Typography.swift`: roles tipográficos de §5 (`balance`, `title`, `headline`, `body`, `amount`, `caption`) sobre SF Pro Rounded, anclados a text styles del sistema (Dynamic Type); `amount`/`balance` con `.monospacedDigit()`.
- [x] `Core/Theme/Spacing.swift` y `Radius.swift`: constantes de §6 (`4,8,12,16,20,24,32` / `sm 8`, `md 12`, `lg 20`, `pill 999`).
- [x] `Core/Theme/Shadow.swift`: modifier de sombra cálida (`brand/ink` a baja opacidad, blur amplio, offset pequeño).
- [x] `Core/Theme/Motion.swift`: duraciones de §9 (`fast 150ms`, `base 250ms`, `slow 400ms`) y curvas (spring suave / ease-in-out) como constantes reutilizables.
- [x] `Core/Theme/Haptics.swift`: wrapper sobre `UINotificationFeedbackGenerator` / `UIImpactFeedbackGenerator` con los casos de §10 (`.success`, `.light`, `.warning`).
- [x] `Core/IconCatalog.swift`: catálogo bidireccional emoji↔SF Symbol de §7 (`[emoji: String: symbolName: String]` + inverso); `symbol(forEmoji:)` con fallback (`ellipsis.circle` categoría / `questionmark.circle` banco-wallet) y `emoji(forSymbol:)` para guardar en el backend lo que este espera. El backend (`api-contracts.md`) no cambia: sigue enviando/recibiendo emoji en `icon`.
- [x] `Shared/Components/PrimaryButton.swift`: botón base, altura 56–64 pt, usa los tokens anteriores (primer componente del registro de componentes, hoy en `design-system.md` §11).
- [x] Formato de moneda EUR (`FormatStyle`/`Locale es_ES`) como utilidad compartida en `Core/Theme` o `Core/Formatting`.

### Checklist de tests

- [x] Cada Color token resuelve un valor distinto en light y en dark (test de asset catalog o snapshot).
- [x] Verificación de contraste AA (test o checklist documentado) para los pares texto/fondo de §4.
- [x] `PrimaryButton` cumple la altura mínima de toque (56 pt) en preview/test de layout.
- [x] Formato EUR (`1.234,56 €`) correcto para valores positivos, negativos y cero.
- [x] `IconCatalog.symbol(forEmoji:)` devuelve el symbol correcto para cada entrada del catálogo y el fallback para un emoji desconocido.
- [x] `IconCatalog.emoji(forSymbol:)` es el inverso exacto de `symbol(forEmoji:)` para cada par del catálogo (round-trip sin pérdida).

### Commits del PR

```
feat(ios): tokens de color light/dark del design system en asset catalog
feat(ios): tipografia sf pro rounded con dynamic type y digitos monoespaciados
feat(ios): spacing, radios, sombras y motion tokens reutilizables
feat(ios): catalogo bidireccional emoji-sf symbol para iconos de categoria/banco/wallet
feat(ios): primarybutton, haptics y formato eur del design system
```

### Criterio Done

Todos los tokens de color, tipografía, espaciado, radios, sombra, movimiento y haptics de `design-system.md` existen como código Swift/Assets reutilizable; cambiar de tema (claro/oscuro) actualiza toda la UI sin tocar las pantallas; `IconCatalog` traduce en ambas direcciones entre el emoji del backend y el SF Symbol de la UI, de forma que ningún emoji llega nunca a renderizarse; `PrimaryButton` y el formato EUR quedan listos para las ramas de auth/setup/home.

---

## Rama 3 — `feature/ios-mascot`

> **Retirada en el pivote estético (2026-07-04):** esta rama se completó y mergeó (#149), pero su entrega (motor, assets y catálogo de la mascota) se eliminó del código al descartar la identidad con personaje. Se conserva como histórico.

### Objetivo

Motor `MascotView` descrito en `design-system.md` §3: componente que resuelve y reproduce el clip de la mascota por estado/gesto, con fallback a idle y a PNG estático, hábitat mostaza y soporte de Reduce Motion. Las pantallas solo declaran el slot; los vídeos se añaden después sin tocar código.

### Checklist de desarrollo

- [x] `Shared/Components/Mascot/MascotView.swift`: `enum MascotState { case empty, serene, happy, overflow }`, `enum MascotGesture { case idle, wave, count, celebrate, cry, loseMoney, narrate, thinking }`.
- [x] Resolución de asset: busca `mascot_<state>_<gesture>.mp4` en `Resources/Mascot/`; si no existe, cae a `mascot_<state>_idle.mp4`; si tampoco existe, muestra el PNG del estado.
- [x] Reproducción con `AVPlayer`: loop cuando el catálogo marca "Sí" (`mascot-animation-catalog.md`), una sola vez → vuelve a idle del estado cuando marca "1 vez".
- [x] `MascotPanel`: compone `MascotView` + fondo `mascot-stage` (mostaza en ambos temas), tamaño de slot configurable.
- [x] Crossfade ~300 ms al cambiar de estado (§9 Movimiento).
- [x] Reduce Motion (`UIAccessibility.isReduceMotionEnabled`) → renderiza el PNG del estado, sin `AVPlayer`.
- [x] Etiqueta VoiceOver por estado (§12), p. ej. "Tu cartera: balance saludable" / "Tu cartera: vacía".
- [x] Placeholders de los 4 PNG base en `Assets.xcassets` (si aún no existen los definitivos, dejar placeholders neutros documentados como pendientes de arte final).

### Checklist de tests

- [x] Gesto sin clip propio → cae al idle del estado; estado sin ningún clip → cae al PNG.
- [x] Reduce Motion activo → renderiza PNG, no `AVPlayer`.
- [x] Clip marcado "1 vez" transiciona a idle tras finalizar (sin loop).
- [x] Etiqueta VoiceOver correcta por cada uno de los 4 estados.

### Commits del PR

```
feat(ios): motor mascotview con estados, gestos y fallback video-a-png
feat(ios): mascotpanel con habitat mostaza y soporte reduce motion
feat(ios): accesibilidad voiceover del personaje por estado
```

### Criterio Done

`MascotView(state:gesture:)` reproduce el clip correspondiente con fallback a idle y a PNG; respeta Reduce Motion; expone etiqueta VoiceOver; el hábitat mostaza es consistente en claro/oscuro. Listo para que Home, Setup e Insights (Ramas 14+) lo consuman.

---

## Rama 4 — `feature/ios-networking`

### Objetivo

Capa de red con `URLSession` async/await, tipado de endpoints y errores, e interceptor que añade `Authorization: Bearer` y ejecuta refresh silencioso ante `401`.

### Checklist de desarrollo

- [x] `Core/Network/Endpoint.swift`: struct con `path`, `method`, `query`, `body`, `requiresAuth`.
- [x] `Core/Network/APIError.swift`: enum (`unauthorized`, `notFound`, `validation(details)`, `rateLimited`, `server`, `offline`, `decoding`). Mapea códigos HTTP del backend.
- [x] `Core/Network/APIClient.swift`: `func send<T: Decodable>(_ endpoint: Endpoint) async throws -> T` con `URLSession`; decodifica JSON con `JSONDecoder` (fechas ISO-8601).
- [x] `Core/Network/AuthInterceptor.swift`: inyecta el access token; ante `401`, ejecuta `POST /api/refresh` **una sola vez** (coalescing de refresh concurrente con un `actor`), actualiza el `TokenStore` y reintenta la request original. Si el refresh falla → emite evento de logout.
- [x] Base URL **inyectable** en `APIClient`; el default (`AppEnvironment.current.baseURL`) se cableó en la Rama 8.
- [x] Rutas de auth (`/register`, `/login`, `/apple`, `/google`, `/refresh`, `/logout`) sin barra final (coinciden con el routing de Nginx).

### Checklist de tests

- [x] `URLProtocol` mock: 200 decodifica el DTO esperado.
- [x] 401 → dispara refresh → reintenta con el nuevo token → devuelve la respuesta.
- [x] Refresh fallido (401 en `/refresh`) → propaga `unauthorized` y emite logout.
- [x] Dos requests concurrentes con 401 → un único `POST /refresh` (coalescing).
- [x] Mapeo de 404/409/429/5xx a los casos de `APIError`.

### Commits del PR

```
feat(ios): capa de red con urlsession async/await y tipado de endpoints
feat(ios): interceptor bearer con refresh silencioso ante 401
```

### Criterio Done

Las requests autenticadas incluyen el Bearer; un 401 refresca el token de forma transparente y reintenta; refresh concurrente se coalesce en una sola llamada; el fallo de refresh degrada a logout.

---

## Rama 5 — `feature/ios-keychain`

### Objetivo

Almacenamiento seguro de tokens en Keychain, consumido por el `AuthInterceptor` y el flujo de auth.

### Checklist de desarrollo

- [x] `Core/Storage/KeychainStore.swift`: wrapper sobre `Security` (`SecItemAdd/Copy/Update/Delete`) con `kSecAttrAccessibleAfterFirstUnlock`.
- [x] `Core/Storage/TokenStore.swift`: `actor` con `saveTokens(access,refresh)`, `accessToken`, `refreshToken`, `clear()`. Fuente de verdad de sesión.
- [x] Publicar un `AuthState` observable (`signedIn` / `signedOut`) que la UI raíz observa.

### Checklist de tests

- [x] Guardar y leer tokens (round-trip) con un servicio de Keychain de test.
- [x] `clear()` elimina ambos tokens y pone `AuthState = signedOut`.
- [x] Sobrescribir tokens existentes (update, no duplicado).

### Commits del PR

```
feat(ios): keychain store para access y refresh token
feat(ios): token store como actor y auth state observable
```

### Criterio Done

Los tokens persisten en Keychain entre lanzamientos; `clear()` cierra sesión; el `AuthInterceptor` lee/escribe a través del `TokenStore`.

---

## Rama 6 — `feature/ios-local-db`

### Objetivo

Base de datos local con GRDB para cachear datos de solo lectura y sostener la cola de sincronización. Entidades y migraciones.

### Checklist de desarrollo

- [x] Añadir paquete **GRDB** vía SPM.
- [x] `Core/Database/AppDatabase.swift`: `DatabaseQueue`, `DatabaseMigrator`, apertura en `Application Support`.
- [x] Migración inicial con tablas espejo de las entidades de dominio: `bank`, `wallet`, `category`, `transaction`, `recurring_rule` (cache de lectura) y `sync_operation` (cola).
- [x] DAOs (`Shared/Data/Local/*LocalDataSource.swift`) con upsert e `id` de cliente (UUID) como PK en `transaction`.
- [x] Índices análogos a los del backend donde ayuden a la UI (`transaction(wallet_id, date DESC)`).

### Checklist de tests

- [x] La migración crea todas las tablas e índices.
- [x] Upsert de wallet/transaction (insert luego update por id).
- [x] Lectura ordenada por `date DESC` para el historial.

### Commits del PR

```
feat(ios): setup grdb con databasequeue y migrator
feat(ios): entidades locales y daos para cache y cola de sync
```

### Criterio Done

La DB local se crea con la migración inicial; los DAOs hacen upsert y lectura ordenada; la tabla `sync_operation` está lista para la Rama 7.

---

## Rama 7 — `feature/ios-sync-engine`

### Objetivo

Motor de sincronización offline-first: cola FIFO de operaciones de escritura con UUID de cliente, reintentos con backoff y resolución last-write-wins.

### Checklist de desarrollo

- [x] `Core/Sync/SyncOperation.swift`: `id` (UUID), `type` (`createTransaction`, `updateTransaction`, `deleteTransaction`), `payload`, `attempts`, `status` (`pending`/`completed`/`failed`), `createdAt`.
- [x] `Core/Sync/SyncQueue.swift`: `actor` que persiste operaciones en GRDB y las drena **en orden FIFO** (por `rowid`, orden de inserción) cuando hay conectividad.
- [x] Reintentos: 5 intentos, backoff exponencial (1, 2, 4, 8, 16 s) — inyectable (`Sleeper`) para tests deterministas sin esperas reales. Tras 5 fallos → `status = failed` + evento en `failedOperations` (`AsyncStream`) para el banner "Operación pendiente".
- [x] Idempotencia: la operación conserva su `id` de cliente entre reintentos (misma fila, sin duplicar) — el handler que la envíe (Rama 16) usará ese mismo `id` en `POST /wallets/:id/transactions`.
- [x] Detección de conectividad con `NWPathMonitor` (`NetworkMonitor` + `NetworkMonitoring` abstracto); al recuperar red, `SyncQueue.observeConnectivity` drena la cola.
- [x] Last-write-wins: `SyncOperationHandling.reconcile(operation:remoteResponse:)` — inyectado por la feature dueña de la entidad (Core/Sync no depende de Shared, se mantiene agnóstico al negocio).

### Checklist de tests

- [x] Operación creada offline queda `pending`; al haber red se envía y pasa a completada.
- [x] Orden FIFO respetado con varias operaciones encoladas.
- [x] Reintento con mismo `id` no crea duplicado (mock del endpoint idempotente).
- [x] Backoff: 5 fallos → `failed` + señal de banner (evento de `failedOperations`).
- [x] Reconciliación LWW: `reconcile` se invoca con la respuesta remota tras cada éxito (verificado vía el handler mock).

### Commits del PR

```
feat(ios): modelo de operacion de sync y cola fifo persistida en grdb
feat(ios): deteccion de red con nwpathmonitor y drenado automatico al reconectar
```

### Criterio Done

Crear/editar/borrar transacciones sin red las encola; al reconectar se sincronizan en orden sin duplicar; tras 5 fallos la operación queda marcada y se avisa al usuario.

---

## Rama 8 — `feature/ios-feature-flags`

### Objetivo

Configuración de entorno para apuntar a backend local / staging / prod sin recompilar lógica, más flags simples.

### Checklist de desarrollo

- [x] `Core/Config/AppEnvironment.swift`: enum (`local`, `staging`, `prod`) con `baseURL` por caso (`http://localhost/api`, `https://staging-api.walletos.app/api`, `https://api.walletos.app/api`).
- [x] Selección por build configuration (Debug/Release) o override en un ajuste de debug oculto (`overrideForDebug`/`clearDebugOverride`, solo con efecto en Debug).
- [x] `Core/Config/FeatureFlags.swift`: flags booleanos simples (`useSandboxAPNs`, derivado del entorno activo).

### Checklist de tests

- [x] `baseURL` correcto por cada entorno.
- [x] El `APIClient` toma la base URL del `AppEnvironment` activo (por defecto en su `init`).

### Commits del PR

```
feat(ios): configuracion de entorno local/staging/prod y feature flags
```

### Criterio Done

Cambiar de entorno reapunta todas las requests; en Debug la app apunta a `http://localhost/api` por defecto.

---

## Rama 9 — `feature/ios-auth-screen`

### Objetivo

Pantalla de autenticación con toggle Login/Registro (email + contraseña), botones Apple/Google (placeholders hasta Ramas 10–11) y link "¿Olvidaste tu contraseña?".

### Checklist de desarrollo

- [x] `Features/Auth/Domain`: `AuthRepository` (protocolo) con `register`, `login`, `refresh`, `logout`; use cases `RegisterUser`, `LoginUser`.
- [x] `Features/Auth/Data`: DTOs `AuthResponse` (`user`, `access_token`, `refresh_token`), `AuthRemoteDataSource`, `AuthRepositoryImpl` (guarda tokens en `TokenStore`).
- [x] `Features/Auth/Presentation/AuthView.swift` + `AuthViewModel`: toggle Login/Registro, validación de email/contraseña, estados `idle/loading/error`.
- [x] Link "¿Olvidaste tu contraseña?" visible solo en modo Login (navega a Rama 12).
- [x] Tras login/registro correcto → decidir Setup vs Home (lógica en Rama 14; aquí dejar el gancho).

### Checklist de tests

- [x] `LoginUser` con credenciales válidas guarda tokens y emite `signedIn`.
- [x] Registro con email inválido bloquea el envío (validación).
- [x] Error 401 en login muestra mensaje sin guardar tokens.
- [x] Toggle Login↔Registro resetea el estado de error.

### Commits del PR

```
feat(ios): auth repository, dtos y use cases de login/registro
feat(ios): pantalla de auth con toggle login/registro y validacion
```

### Criterio Done

Un usuario puede registrarse e iniciar sesión con email+contraseña contra el backend; los tokens se guardan; los errores se muestran; el link de forgot solo aparece en Login.

---

## Rama 10 — `feature/ios-apple-signin`

### Objetivo

Sign in with Apple nativo con `AuthenticationServices`, canjeando el `identity_token` en `POST /api/apple`.

### Checklist de desarrollo

- [x] `SignInWithAppleButton` (SwiftUI) en `AuthView` (estilo por tema con `.id(colorScheme)`: el botón nativo no re-lee su estilo al cambiar de tema en caliente).
- [x] Manejar `ASAuthorizationAppleIDCredential`; extraer `identityToken` (JWT) y enviarlo a `POST /api/apple`.
- [x] `AuthRepository.signInWithApple(identityToken:name:)` (`name?` del contrato: solo llega en la primera autorización); misma respuesta `AuthResponse` → guardar tokens.
- [x] Gestionar cancelación del usuario sin tratarla como error.

### Checklist de tests

- [x] Credencial válida → `POST /api/apple` con el token → tokens guardados.
- [x] Cancelación no produce estado de error.
- [x] Error del backend (token inválido) se propaga como `APIError`.

### Commits del PR

```
feat(ios): sign in with apple con authenticationservices y canje en /api/apple
```

### Criterio Done

El botón de Apple autentica y crea/recupera la cuenta vía backend; cancelar no rompe la UI.

> Verificado con unit tests y en simulador (UI y cambio de tema). El flujo real contra Apple (JWKs) requiere **dispositivo físico** con firma de equipo — pendiente de probar en device al tener uno configurado.

---

## Rama 11 — `feature/ios-google-signin`

### Objetivo

Google Sign In con el SDK oficial de iOS, canjeando el `id_token` en `POST /api/google`.

### Checklist de desarrollo

- [x] Añadir paquete **GoogleSignIn** vía SPM; configurar `GIDClientID` = `GOOGLE_IOS_CLIENT_ID` y el URL scheme inverso en `Info.plist`.
- [x] Botón Google en `AuthView`; flujo `GIDSignIn.sharedInstance.signIn(...)` (async, con presenter del root VC); extraer `idToken`.
- [x] `AuthRepository.signInWithGoogle(idToken:name:)` → `POST /api/google` → guardar tokens.

### Checklist de tests

- [x] `id_token` obtenido → `POST /api/google` → tokens guardados (SDK fuera del VM; repo mockeado).
- [x] Cancelación del flujo no produce error.

### Commits del PR

```
feat(ios): google sign in con sdk oficial y canje en /api/google
```

### Criterio Done

El botón de Google autentica contra el backend y guarda la sesión; el URL scheme de callback está configurado.

---

## Rama 12 — `feature/ios-forgot-password`

### Objetivo

Pantalla de "olvidé mi contraseña" (`POST /api/auth/forgot-password`) y registro del handler de deep link `walletos://reset?token=...`.

### Checklist de desarrollo

- [x] `Features/Auth/Presentation/ForgotPasswordView.swift` + ViewModel: input email → `POST /api/auth/forgot-password`.
- [x] Mostrar siempre el mensaje neutro "Si el email existe, recibirás un enlace" (el backend responde `204` siempre, sin filtrar existencia).
- [x] `App/DeepLinkRouter.swift`: parsear `walletos://reset?token=...` y navegar a la pantalla de reset (Rama 13) con el token precargado.
- [x] Registrar el handler en `onOpenURL` del `WindowGroup` (tras el callback OAuth de Google).

### Checklist de tests

- [x] Envío de email dispara `POST /api/auth/forgot-password` y muestra el mensaje neutro.
- [x] Parseo de `walletos://reset?token=abc` extrae `abc` y enruta a reset.
- [x] URL malformada (sin token) se ignora sin crashear.

### Commits del PR

```
feat(ios): pantalla forgot password con mensaje neutro
feat(ios): router de deep link walletos://reset con extraccion de token
```

### Criterio Done

Solicitar reset envía el email; abrir el deep link de reset navega a la pantalla correspondiente con el token cargado.

---

## Rama 13 — `feature/ios-reset-password`

### Objetivo

Pantalla de restablecer contraseña que consume `POST /api/auth/reset-password` y devuelve al usuario al Login.

### Checklist de desarrollo

- [x] `Features/Auth/Presentation/ResetPasswordView.swift` + ViewModel: recibe `token`, pide nueva contraseña + confirmación, valida fortaleza.
- [x] `POST /api/auth/reset-password { token, new_password }`; al éxito, mensaje y navegación a Login.
- [x] Comunicar que **se cerraron todas las sesiones** (el backend invalida todos los refresh tokens) y limpiar `TokenStore` si hubiera sesión local.
- [x] Manejar token inválido/expirado con mensaje claro + acción "Solicitar un enlace nuevo" → forgot.

### Checklist de tests

- [x] Reset correcto → `POST /reset-password` → navega a Login y limpia tokens locales.
- [x] Confirmación distinta bloquea el envío.
- [x] Token expirado muestra error y ofrece volver a forgot.

### Commits del PR

```
feat(ios): pantalla reset password con invalidacion de sesion y retorno a login
```

### Criterio Done

Con un token válido el usuario fija una nueva contraseña, se le informa del cierre de sesiones y vuelve a Login; tokens inválidos se manejan con mensaje.

---

## Rama 14 — `feature/ios-setup-flow`

### Objetivo

Onboarding post-registro: bienvenida, selección de divisa/timezone y creación del primer banco + wallet. Lógica de decisión post-login (Setup vs Home).

### Checklist de desarrollo

- [ ] Lógica post-login: tras autenticar, llamar `GET /api/banks`; si vacío → Setup; si no → Home.
- [ ] `Features/Setup/Presentation/SetupView.swift` + ViewModel: pasos bienvenida → divisa/tz (`PATCH /api/me`) → primer banco (`POST /api/banks`) → primer wallet (`POST /api/banks/:id/wallets`, con `initial_balance`).
- [ ] Al completar → navegar a Home.
- [ ] Repos/use cases: `BankRepository`, `WalletRepository` en `Shared/Domain` + `Shared/Data` (los consumen Setup, Home, Accounts y Transactions); `UpdateProfile`, `CreateBank`, `CreateWallet` como use cases de la feature.

### Checklist de tests

- [ ] `GET /banks` vacío enruta a Setup; no vacío enruta a Home.
- [ ] El flujo ejecuta PATCH /me + POST /banks + POST /banks/:id/wallets en orden y navega a Home.
- [ ] Fallo en creación del banco no avanza al paso de wallet.

### Commits del PR

```
feat(ios): repos y use cases de banks y wallets
feat(ios): setup inicial con divisa/tz y primer banco+wallet
feat(ios): decision post-login setup vs home segun /banks
```

### Criterio Done

Un usuario nuevo pasa por Setup y llega a Home con un banco y un wallet creados; un usuario existente va directo a Home.

---

## Rama 15 — `feature/ios-home`

### Objetivo

Dashboard principal con balance total, gasto del mes + variación, una lista plana de las wallets más relevantes y últimas transacciones, más el `TabView` raíz (Home, Cuentas, Stats, Insights) y el botón "+" flotante. La UI concreta se especificará bajo la nueva estética (pivote 2026-07-04); el checklist funcional de abajo no cambia.

### Checklist de desarrollo

- [ ] `App/Navigation/AppRouter.swift` + `RootTabView` con las 4 tabs y el botón "+" flotante (abre el modal de Rama 16).
- [ ] `Features/Home/Presentation/HomeView.swift` + ViewModel: `GET /api/dashboard` (`total_balance`, `month_expense`, `month_expense_change_pct`, `recent_transactions`).
- [ ] `Shared/Components/ExpenseIncomeButtons.swift`: los dos botones grandes `− Gasto` / `+ Ingreso` (zona del pulgar) que abren el modal de Rama 16 con el modo preseleccionado.
- [ ] Lista **plana** de wallets (`GET /api/banks`, aplanando wallets con su banco de origen como badge/icono pequeño; **sin** secciones por banco — esa agrupación visual es exclusiva de Cuentas), recortada a **3 filas fijas** con "ver todas" → tab Cuentas. Orden por defecto "banco"; alternativas "favoritas" (manual) / "recientes" (actividad local) configurables en Ajustes (Rama 25) y persistidas local (no backend).
- [ ] Cache en GRDB del último dashboard y de la lista de bancos/wallets para arranque offline; guardar el timestamp de la última sincronización correcta.
- [ ] Banner offline (sin red, mostrando datos cacheados): _"Sin conexión — datos de las {hora}"_ (o _"datos del {día} a las {hora}"_ si es de otro día), usando el timestamp cacheado.
- [ ] Icono ⏱ en `TransactionRow` para transacciones con `SyncOperation.status = pending` (Rama 7); desaparece al confirmarse contra el backend.
- [ ] Tap en transacción → editar (Rama 17); swipe → borrar con toast "Deshacer" (3 s) antes de encolar `DELETE`.
- [ ] Botón ⚙️ → Ajustes (Rama 25).

### Checklist de tests

- [ ] `GET /dashboard` puebla balance, gasto y recientes.
- [ ] `− Gasto` / `+ Ingreso` abren el modal con el modo correcto preseleccionado.
- [ ] La lista de wallets es plana (sin secciones por banco), muestra siempre 3 filas máximo y respeta el orden elegido (banco/favoritas/recientes) tras reiniciar la app.
- [ ] Sin red, muestra el dashboard y las wallets cacheadas con el banner de la hora de los datos.
- [ ] Una transacción `pending` muestra el icono ⏱; al sincronizar, el icono desaparece sin recargar la pantalla.
- [ ] Swipe→borrar muestra toast; confirmar encola `DELETE`, "Deshacer" cancela.

### Commits del PR

```
feat(ios): tabview raiz con 4 tabs y boton flotante de añadir
feat(ios): home dashboard con balance y gasto del mes
feat(ios): botones gasto/ingreso y lista plana de 3 wallets relevantes
feat(ios): cache offline con banner de hora de datos e icono de pending
```

### Criterio Done

Home muestra el dashboard del backend con el balance, los dos botones de acceso directo, una lista plana de las wallets más relevantes (con preferencia de orden local) y "ver todas" hacia Cuentas, cachea para offline, permite editar/borrar (con undo) y navega a las otras tabs y a Ajustes.

---

## Rama 16 — `feature/ios-add-transaction`

### Objetivo

Modal rápido de añadir transacción (3 toques: cantidad → categoría → guardar) con toggle Gasto/Ingreso/Transferencia y auto-categorización.

### Checklist de desarrollo

- [ ] `Features/Transactions/Presentation/TransactionModalView.swift` + ViewModel; componentes `AmountKeypad` y `CategoryGrid` (4 columnas) en `Shared/Components/`. `CategoryGrid` resuelve el `icon` (emoji) de cada categoría a SF Symbol vía `IconCatalog` (Rama 2) — nunca pinta el emoji.
- [ ] Toggle Gasto/Ingreso/Transferencia. En Transferencia: selectores Desde/Hacia wallet, sin categoría → `POST /api/transfers`.
- [ ] Gasto/Ingreso → `POST /api/wallets/:id/transactions` generando **UUID v4 de cliente** y encolando en `SyncQueue` (offline-first).
- [ ] Auto-categorización: al escribir la nota, debounce 500 ms → `POST /api/categorize?note=&type=`; si `confidence ≥ 0.5`, preseleccionar la categoría.
- [ ] `GET /api/wallets` y `GET /api/categories` para poblar selectores (cacheados en GRDB).

### Checklist de tests

- [ ] Guardar gasto genera UUID, encola la operación y cierra el modal optimísticamente.
- [ ] Modo Transferencia llama a `/transfers` con origen/destino y sin categoría.
- [ ] Debounce de categorize: una sola llamada tras dejar de escribir; `confidence < 0.5` no preselecciona.
- [ ] Sin red, la transacción queda `pending` y aparece en Home optimísticamente.

### Commits del PR

```
feat(ios): componentes amount keypad y category grid
feat(ios): modal de añadir transaccion con toggle gasto/ingreso/transferencia
feat(ios): auto-categorizacion con debounce y creacion offline-first
```

### Criterio Done

Añadir un gasto/ingreso en 3 toques lo crea (online u offline) con UUID de cliente; las transferencias usan `/transfers`; la nota sugiere categoría vía `/categorize`.

---

## Rama 17 — `feature/ios-edit-transaction`

### Objetivo

Edición de transacción reutilizando el modal de Rama 16, con las restricciones del backend.

### Checklist de desarrollo

- [ ] Abrir el modal precargado desde `GET /api/transactions/:id`.
- [ ] Guardar → `PATCH /api/transactions/:id` (encolable en `SyncQueue`).
- [ ] Bloquear edición si `transfer_id != null` (las patas de transferencia no se editan; mostrar aviso).
- [ ] Borrar desde el modal → `DELETE /api/transactions/:id` con undo; si es parte de transferencia, el backend borra ambas patas.

### Checklist de tests

- [ ] Editar campos → `PATCH` con el diff; reconciliación LWW actualiza la copia local.
- [ ] Transacción con `transfer_id` no editable (UI bloqueada).
- [ ] Borrar transferencia elimina ambas patas (verificado contra mock).

### Commits del PR

```
feat(ios): edicion de transaccion reutilizando el modal con restricciones de transferencia
```

### Criterio Done

Se edita una transacción normal vía PATCH; las patas de transferencia están protegidas; borrar respeta el borrado atómico del par.

---

## Rama 18 — `feature/ios-accounts`

### Objetivo

Tab "Cuentas": lista de bancos con sus wallets y balances, agrupada por secciones.

### Checklist de desarrollo

- [ ] `Features/Accounts/Presentation/AccountsView.swift` + ViewModel: `GET /api/banks` (bancos no archivados con wallets y balances calculados).
- [ ] Secciones por banco; cada wallet muestra nombre + balance; total por banco.
- [ ] Tap en wallet → transacciones del wallet (Rama 21); botón "+" → crear banco (Rama 19).
- [ ] Swipe en banco/wallet → editar (Ramas 19/20) o archivar (`DELETE` soft).
- [ ] Cache en GRDB para vista offline.

### Checklist de tests

- [ ] `GET /banks` agrupa por banco con balances y total por sección.
- [ ] Archivar wallet lo oculta (soft delete) y refresca la lista.
- [ ] Sin red, muestra la última lista cacheada.

### Commits del PR

```
feat(ios): tab cuentas con bancos, wallets y balances agrupados
feat(ios): archivar banco/wallet con soft delete y cache offline
```

### Criterio Done

Cuentas muestra bancos y wallets con balances del backend, permite archivar y navegar al detalle del wallet.

---

## Rama 19 — `feature/ios-bank-modal`

### Objetivo

Modal de crear/editar banco (nombre, icono, color).

### Checklist de desarrollo

- [ ] `Features/Accounts/Presentation/BankModalView.swift` + ViewModel; `IconPicker` y `ColorPicker` reutilizables en `Shared/Components/`. `IconPicker` muestra una grid de SF Symbols (`IconCatalog`, Rama 2), no emoji; al seleccionar uno, se envía al backend el `IconCatalog.emoji(forSymbol:)` correspondiente.
- [ ] Crear → `POST /api/banks`; editar → `PATCH /api/banks/:id`.
- [ ] Validación de nombre no vacío.

### Checklist de tests

- [ ] Crear banco → `POST /banks` y aparece en la lista.
- [ ] Editar nombre/color → `PATCH /banks/:id`.
- [ ] Nombre vacío bloquea el guardado.

### Commits del PR

```
feat(ios): modal crear/editar banco con icon y color picker
```

### Criterio Done

Se crean y editan bancos con icono y color; la lista de Cuentas refleja los cambios.

---

## Rama 20 — `feature/ios-wallet-modal`

### Objetivo

Modal de crear/editar wallet (banco, nombre, balance inicial, tipo, icono, color).

### Checklist de desarrollo

- [ ] `Features/Accounts/Presentation/WalletModalView.swift` + ViewModel.
- [ ] Crear → `POST /api/banks/:id/wallets` con `type` (CASH|INVESTMENT) e `initial_balance`; selector de banco si se crea desde el "+".
- [ ] Editar → `PATCH /api/wallets/:id` con `initial_balance` y `bank_id` **deshabilitados** (el backend no permite cambiarlos).
- [ ] Icono/color reutilizando los pickers de Rama 19.

### Checklist de tests

- [ ] Crear wallet CASH con balance inicial → `POST /banks/:id/wallets`.
- [ ] Editar wallet no envía `initial_balance` ni `bank_id`.
- [ ] Crear wallet INVESTMENT marca el tipo correcto (Portfolio se cubre en Stats/otra vista).

### Commits del PR

```
feat(ios): modal crear/editar wallet con tipo cash/investment y balance inicial
```

### Criterio Done

Se crean wallets CASH e INVESTMENT y se editan sus campos permitidos; balance inicial y banco no son editables al modificar.

---

## Rama 21 — `feature/ios-wallet-transactions`

### Objetivo

Detalle de un wallet: header con banco/wallet/balance e historial de transacciones con paginación cursor-based.

### Checklist de desarrollo

- [ ] `Features/Transactions/Presentation/WalletTransactionsView.swift` + ViewModel: `GET /api/wallets/:id/transactions?cursor=&limit=20` (max 50) con filtros `from`, `to`, `category_id`.
- [ ] Scroll infinito usando `next_cursor` (null = última página).
- [ ] Reutilizar las acciones de Home (editar en modal, swipe→borrar con undo).
- [ ] Cache en GRDB de la primera página para offline.

### Checklist de tests

- [ ] Primera página + carga de la siguiente vía `next_cursor`.
- [ ] `next_cursor = null` detiene la paginación.
- [ ] Filtro por rango de fechas y categoría ajusta la query.

### Commits del PR

```
feat(ios): historial de transacciones por wallet con paginacion cursor-based
```

### Criterio Done

El detalle del wallet lista transacciones paginadas, aplica filtros y permite editar/borrar; la primera página está disponible offline.

---

## Rama 22 — `feature/ios-stats`

### Objetivo

Tab "Estadísticas": selector mes/año, gasto total + variación, donut por categoría y barras de gasto diario, con **Swift Charts**.

### Checklist de desarrollo

- [ ] `Features/Stats/Presentation/StatsView.swift` + ViewModel: `GET /api/stats?month=&year=` (totales + `previous_period` + `by_category`) y `GET /api/stats/daily?from=&to=` (max 31 días).
- [ ] Donut por categoría y barras diarias con Swift Charts; lista de desglose por categoría (orden DESC).
- [ ] Filtros opcionales `bank_id` / `wallet_id`.
- [ ] Las transferencias quedan excluidas (garantizado por el backend; no recalcular).

### Checklist de tests

- [ ] `GET /stats` puebla totales, variación y `by_category`.
- [ ] `GET /stats/daily` con >31 días se limita/valida.
- [ ] Cambiar mes/año recarga ambos endpoints.

### Commits del PR

```
feat(ios): tab estadisticas con donut y barras diarias usando swift charts
```

### Criterio Done

Stats muestra gasto del periodo con variación, donut por categoría y barras diarias desde el backend, con filtros por mes/año y opcionalmente banco/wallet.

---

## Rama 23 — `feature/ios-insights-list`

### Objetivo

Tab "Insights": lista paginada de resúmenes semanales de IA.

### Checklist de desarrollo

- [ ] `Features/Insights/Presentation/InsightsListView.swift` + ViewModel: `GET /api/insights?cursor=&limit=20` (orden `week_start` DESC; `headline`, `summary_text`, `has_pdf`).
- [ ] Tarjetas con `headline` + `summary_text`; tap → detalle (Rama 24); acción PDF si `has_pdf`.
- [ ] Scroll infinito con `next_cursor`.

### Checklist de tests

- [ ] `GET /insights` puebla las tarjetas y pagina con `next_cursor`.
- [ ] `has_pdf=false` oculta la acción de PDF.

### Commits del PR

```
feat(ios): tab insights con lista paginada de resumenes semanales
```

### Criterio Done

Insights lista los resúmenes semanales con headline y summary, pagina y enlaza al detalle.

---

## Rama 24 — `feature/ios-insight-detail`

### Objetivo

Detalle de un insight con hechos, recomendaciones, gráficos nativos (Swift Charts desde `charts`) y exportación a PDF.

### Checklist de desarrollo

- [ ] `Features/Insights/Presentation/InsightDetailView.swift` + ViewModel: `GET /api/insights/{week_start}` (`headline`, `facts[]`, `recommendations[]`, `charts`, `summary_text`, `has_pdf`).
- [ ] Renderizar `facts` (bloque "ℹ️ Hechos") y `recommendations` (bloque "💡 Sugerencias"; **si `[]`, no renderizar el bloque**).
- [ ] Gráficos con Swift Charts desde `charts` (`category_breakdown`, `weekly_total_last_8w`, `actual_vs_avg_by_category`, `top_transactions`).
- [ ] Botón "Exportar PDF" → `GET /api/insights/{week_start}/export` (URL firmada S3, TTL 1h) → abrir en `SFSafariViewController`/`QuickLook`.
- [ ] `POST /api/insights/generate` opcional (regenerar la última semana) respetando el rate limit 5/min; `204` = sin transacciones.

### Checklist de tests

- [ ] Detalle renderiza facts y charts; `recommendations = []` oculta el bloque.
- [ ] Exportar PDF obtiene la URL firmada y la abre.
- [ ] `generate` con `204` muestra "sin datos esta semana" sin crear vista de insight.

### Commits del PR

```
feat(ios): detalle de insight con facts, recomendaciones y graficos swift charts
feat(ios): exportar pdf del insight vía url firmada s3
```

### Criterio Done

El detalle muestra hechos, recomendaciones (si las hay) y gráficos nativos; el PDF se descarga vía URL firmada; regenerar respeta el `204` sin datos.

---

## Rama 25 — `feature/ios-settings`

### Objetivo

Pantalla de Ajustes: perfil, preferencias de notificación, logout y eliminación de cuenta.

### Checklist de desarrollo

- [ ] `Features/Settings/Presentation/SettingsView.swift` + ViewModel: `GET /api/me` (perfil + flags `has_password`, `apple_linked`, `google_linked`).
- [ ] Editar perfil (nombre, timezone, divisa) → `PATCH /api/me`.
- [ ] Preferencias: `reminder_enabled`, `high_spend_enabled`, `high_spend_threshold` → `PATCH /api/me`.
- [ ] Cerrar sesión → `POST /api/logout` + `TokenStore.clear()` + `DELETE /api/devices/:token` (Rama 27) → Auth.
- [ ] Eliminar cuenta → confirmación por escritura → `DELETE /api/me` → limpiar Keychain + DB local → Auth.

### Checklist de tests

- [ ] `GET /me` puebla perfil y flags; `PATCH /me` guarda cambios.
- [ ] Toggle de umbral de gasto alto envía `high_spend_threshold`.
- [ ] Logout limpia tokens y vuelve a Auth.
- [ ] Eliminar cuenta exige confirmación y limpia estado local.

### Commits del PR

```
feat(ios): ajustes con perfil, preferencias de notificacion, logout y eliminar cuenta
```

### Criterio Done

Ajustes edita perfil y preferencias, cierra sesión limpiando estado y elimina la cuenta con confirmación.

---

## Rama 26 — `feature/ios-widget`

### Objetivo

Widget de pantalla de inicio (WidgetKit) con balance total y gasto del día; tap abre el modal de añadir transacción.

### Checklist de desarrollo

- [ ] Target `WalletOSWidget` (WidgetKit) con familias `.systemSmall` y `.systemMedium`.
- [ ] `TimelineProvider` que lee datos compartidos vía **App Group** (balance + gasto del día del último `GET /api/dashboard`, escrito por la app).
- [ ] Deep link `walletos://add` en el widget → abre el modal de transacción.
- [ ] Refresco periódico razonable (p.ej. cada pocas horas) sin depender de red en el widget.

### Checklist de tests

- [ ] El `TimelineProvider` renderiza con datos del App Group.
- [ ] Placeholder/estado sin datos no crashea.
- [ ] El deep link `walletos://add` está registrado.

### Commits del PR

```
feat(ios): widget de inicio con balance y gasto del dia y deep link a añadir
```

### Criterio Done

El widget muestra balance y gasto del día desde datos compartidos y abre el modal de añadir al tocarlo.

---

## Rama 27 — `feature/ios-push`

### Objetivo

Push notifications con APNs nativo: registro del device token tras login y baja tras logout.

### Checklist de desarrollo

- [ ] `App/AppDelegate.swift`: `UNUserNotificationCenter` — solicitar permisos tras login; `registerForRemoteNotifications`.
- [ ] En `didRegisterForRemoteNotificationsWithDeviceToken` → `POST /api/devices { token }`.
- [ ] En logout → `DELETE /api/devices/:token`.
- [ ] Manejo de notificación en foreground/background; tap → deep link a la sección relevante (p.ej. insight listo → tab Insights).
- [ ] Entorno APNs **sandbox** en dev (flag de `FeatureFlags`).

### Checklist de tests

- [ ] Concesión de permisos → registro → `POST /devices` con el token.
- [ ] Logout → `DELETE /devices/:token`.
- [ ] Payload de notificación mapea al deep link correcto.

### Commits del PR

```
feat(ios): push notifications apns con registro y baja de device token
```

### Criterio Done

Tras login se registra el token en el backend y tras logout se da de baja; las notificaciones se manejan y enrutan. _La verificación de push real a un iPhone en sandbox APNs es manual (dispositivo + `.p8` reales)._

---

## Rama 28 — `feature/ios-i18n`

### Objetivo

Internacionalización con String Catalog en español (única locale de v1).

### Checklist de desarrollo

- [ ] `Resources/Localizable.xcstrings` (String Catalog) con todas las cadenas de UI en `es`.
- [ ] Sustituir literales hardcodeados por claves localizadas en todas las vistas.
- [ ] Formateo de moneda (EUR) y fechas con `Locale`/`FormatStyle` en `es_ES`.
- [ ] Estructura preparada para añadir `en` en v2 sin refactor.

### Checklist de tests

- [ ] Todas las claves usadas existen en el catálogo (sin cadenas ausentes).
- [ ] Formateo de importes en EUR y fechas en `es_ES`.

### Commits del PR

```
feat(ios): i18n con string catalog en español y formateo eur/es_es
```

### Criterio Done

La UI toma sus textos del String Catalog en español; importes y fechas se formatean en `es_ES`; no quedan literales hardcodeados.

---

## Criterio "Done" de la Fase 10

- La app compila y corre en **simulador y dispositivo iOS 16+** contra `http://localhost/api/...` (ngrok/IP LAN para dispositivo físico).
- Los tokens del design system (color, tipografía, spacing, sombra, movimiento, haptics) están implementados y son los únicos que consumen las pantallas (sin valores sueltos ni animaciones ad-hoc).
- El flujo completo funciona: **Auth (email/Apple/Google) → Setup (si `/banks` vacío) → Home → añadir/editar transacción → Cuentas → Stats → Insights → Ajustes**.
- **Offline-first** verificado: crear/editar/borrar transacciones sin red se encola con UUID de cliente y reconcilia al reconectar sin duplicar (idempotencia por `id`), con backoff y last-write-wins.
- **Refresh silencioso** de token ante 401 sin sacar al usuario; el fallo de refresh degrada a logout limpio.
- Gráficos nativos (Swift Charts) en Stats e Insights; **PDF de insight** descargable vía URL firmada S3.
- **Widget** muestra balance + gasto del día y abre el modal vía `walletos://add`; **deep link** de reset password funciona.
- **Push APNs** registra/da de baja el device token; recepción real en iPhone sandbox verificada de forma manual.
- SwiftLint + swift-format limpios; tests de ViewModels, repos, networking y sync engine verdes.

---

## Archivos y áreas críticas

| Área                    | Path                                           | Acción                                                  |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------------- |
| Proyecto                | `ios/WalletOS.xcodeproj`                       | Crear                                                   |
| App / DI / deep links   | `ios/WalletOS/App/`                            | Crear                                                   |
| Design system (tokens)  | `ios/WalletOS/Core/Theme/`                     | Crear                                                   |
| Networking              | `ios/WalletOS/Core/Network/`                   | Crear                                                   |
| Keychain / tokens       | `ios/WalletOS/Core/Storage/`                   | Crear                                                   |
| DB local (GRDB)         | `ios/WalletOS/Core/Database/`                  | Crear                                                   |
| Sync engine             | `ios/WalletOS/Core/Sync/`                      | Crear                                                   |
| Config / flags          | `ios/WalletOS/Core/Config/`                    | Crear                                                   |
| Features (slices)       | `ios/WalletOS/Features/<Feature>/`             | Crear                                                   |
| Compartido (dominio/UI) | `ios/WalletOS/Shared/`                         | Crear                                                   |
| Widget                  | `ios/WalletOS/Widget/`                         | Crear                                                   |
| i18n                    | `ios/WalletOS/Resources/Localizable.xcstrings` | Crear                                                   |
| Linters                 | `ios/.swiftlint.yml`, `ios/.swift-format`      | Crear                                                   |
| Pre-commit              | `lint-staged.config.mjs` (raíz)                | Modificar (regla `ios/**/*.swift`)                      |
| CI                      | `.github/workflows/ci.yml`                     | Modificar (job iOS opcional: swiftlint + build + tests) |

---

## Patrones reutilizados de fases anteriores

| Patrón                                    | Origen    | Aplicación en iOS                                                            |
| ----------------------------------------- | --------- | ---------------------------------------------------------------------------- |
| Ramas cortas por feature + PR a `develop` | Fases 5–8 | Una rama por pantalla/módulo; `develop → main` al cerrar                     |
| Conventional Commits + commitlint         | Fase 1    | Scope `ios`; subject en minúsculas; español                                  |
| JWT Bearer + refresh rotado               | Fase 5    | Interceptor con refresh silencioso; sin blacklist                            |
| Paginación cursor-based                   | Fases 6–8 | Scroll infinito con `next_cursor` en transacciones, insights, notificaciones |
| Idempotencia por `id` de cliente          | Fase 6    | UUID v4 en `POST /wallets/:id/transactions` para offline-first               |
| Rutas sin barra final tras el gateway     | Fase 9    | Endpoints alineados con `infra/nginx/nginx.conf`                             |
| Linters en pre-commit del monorepo        | Fases 1–8 | SwiftLint + swift-format en `lint-staged.config.mjs`                         |
