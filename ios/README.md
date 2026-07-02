# WalletOS — App iOS

App nativa iOS (Swift + SwiftUI, iOS 16+) de WalletOS. Consume el backend a través del gateway Nginx. Plan de fase: `docs/phase-10-ios-app.md`.

## Requisitos

- **Xcode 16+** (probado con Xcode 26).
- **XcodeGen** — genera el `.xcodeproj` desde `project.yml` (el `.xcodeproj` **no** se versiona):
  ```bash
  brew install xcodegen
  ```
- **SwiftLint** y **swift-format** para el lint del pre-commit:
  ```bash
  brew install swiftlint          # swift-format viene con la toolchain de Xcode
  ```

## Generar y abrir el proyecto

```bash
cd ios
xcodegen generate
open WalletOS.xcodeproj
```

`project.yml` es la fuente de verdad de la estructura del proyecto. Tras editarlo, volver a ejecutar `xcodegen generate`.

## Compilar y correr en simulador

Desde Xcode: seleccionar el scheme **WalletOS** y un simulador iOS 16+ y pulsar Run.

Desde línea de comandos:

```bash
cd ios
xcodegen generate
xcodebuild \
  -project WalletOS.xcodeproj \
  -scheme WalletOS \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO \
  build
```

> Las capabilities Sign in with Apple y Push requieren un equipo de firma para dispositivo físico. En simulador se compila con `CODE_SIGNING_ALLOWED=NO`.

## Apuntar al backend local

La app usa por defecto el gateway en `http://localhost/api` (definido en `Core/Config` a partir de la Rama 8). Levantar el backend:

```bash
cd ../infra
docker compose up -d
```

Para dispositivo físico, exponer el gateway vía ngrok o la IP LAN del Mac y ajustar el entorno.

## Lint

```bash
cd ios
swiftlint
swift-format lint --recursive WalletOS WalletOSTests WalletOSUITests
```

## Estructura por capas

```
WalletOS/
  App/            Punto de entrada, DI, deep-link router
  Core/           Theme, Network, Storage, Database, Sync, Config
  Domain/         Entities, Repositories (protocolos), UseCases
  Data/           DTOs, Mappers, Remote/Local data sources, Repositories (impl)
  Presentation/   Features (View + ViewModel) y Components (incl. Mascot)
  Resources/      Info.plist, Assets.xcassets, Mascot, i18n
  Widget/         WidgetKit (Rama 26)
WalletOSTests/    Tests unitarios
WalletOSUITests/  Tests de UI
```
