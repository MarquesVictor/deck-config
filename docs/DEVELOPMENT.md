# Ambiente de desenvolvimento

## Pré-requisitos

- Node.js 18+ (recomendado 20+; alguns pacotes do Electron reclamam de engine abaixo de 22, mas funcionam)
- npm (o projeto usa npm workspaces — não misture com yarn/pnpm)
- Para rodar o mobile num celular: app **Expo Go** instalado
- Para build nativo do mobile (fora do escopo deste documento por enquanto): Xcode completo (iOS) e/ou Android Studio (Android) — não necessário para o fluxo de dev normal, que usa Expo Go

## Setup inicial

```bash
git clone <repo>
cd streamDeck
npm install
```

Isso instala as dependências de todos os workspaces (`shared`, `agent`, `mobile`) de uma vez.

## A pegadinha nº 1: `shared` precisa de build manual

`agent` e `mobile` importam `@stream-deck/shared` através do seu `dist/` compilado, não do `src/` diretamente (`shared/package.json`: `"main": "dist/index.js"`). Se você editar qualquer arquivo em `shared/src/` e não ver a mudança refletida em `agent`/`mobile` (ou pior, um erro de tipo dizendo que uma propriedade "não existe"), rode:

```bash
cd shared && npm run build
```

Não há watch automático ligado por padrão — se for mexer bastante em `shared/`, rode `npm run dev` lá (usa `tsc --watch`) numa aba de terminal separada.

## Rodando o Agent

### Modo headless (sem UI, mais rápido para testar o core)

```bash
cd agent
npm run dev
```

Sobe o WebSocket, o mDNS advertiser e carrega/cria o `config.json`. Não tem UI — útil para testar o protocolo diretamente ou rodar em CI. Antes da UI existir, apps eram adicionados via `npm run add-app -- --name "TextEdit" --path "/path/to/app" --icon document` (`agent/src/cli/addApp.ts`); hoje isso é redundante com a UI, mas o script continua funcionando se precisar.

### Modo Electron (UI completa)

```bash
cd agent
npm run electron:dev
```

Sobe três processos em paralelo (Vite servindo o renderer em `localhost:5173`, `tsc --watch` compilando o main process, e o Electron em si assim que os dois primeiros ficam prontos). Hot reload funciona tanto no renderer (Vite) quanto no main (o Electron reinicia quando o `tsc --watch` termina uma recompilação — se você editar `main.ts`/`preload.ts`, pare com Ctrl+C e rode `npm run electron:dev` de novo, já que o processo do Electron em si não se auto-recarrega).

Onde o Agent guarda dados, por plataforma (`agent/src/core/persistence/paths.ts`):
- Config: `%APPDATA%\StreamDeck\config.json` (Windows) ou `~/.streamdeck/config.json` (dev em macOS/Linux)
- Logs: só console por enquanto (ainda não grava em arquivo — ver `docs/ARCHITECTURE.md`)

## Rodando o mobile

```bash
cd mobile
npx expo start
```

Escaneie o QR code com o Expo Go. A tela de conexão pede IP + porta — pegue os dois no Dashboard do Agent (mostra o IP real da máquina na rede e a porta escolhida, já que ela pode variar de 38421 até 38430 se a padrão estiver ocupada).

### Compatibilidade de versão do Expo Go

O app está fixado no **Expo SDK 54**. Isso não é arbitrário: a Apple ficou meses sem aprovar atualizações do Expo Go na App Store, então o Expo Go publicamente disponível ficou preso no SDK 54 por um bom tempo. Se o app não abrir no seu Expo Go ("Project is incompatible with this version of Expo Go"), confirme qual SDK o Expo Go instalado suporta antes de simplesmente atualizar o SDK do projeto — do contrário você reproduz o mesmo problema ao contrário.

### Sem descoberta automática ainda

Hoje a conexão é sempre por IP manual — não existe tela de descoberta por mDNS no app (foi avaliado e adiado; ver `docs/ARCHITECTURE.md` para o porquê). O app lembra o último IP/porta usado (`mobile/src/services/storage.ts`) para não precisar redigitar toda vez.

## Testes

```bash
cd agent
npm test
```

Roda a suíte do `agent` (Vitest): unitários (`ActionRegistry`, `JsonConfigStore`, `AgentService`, `openApp`) e integração real — inclusive um teste que sobe um servidor WebSocket de verdade, conecta um cliente real, e executa um processo real (`tests/websocketProtocol.test.ts`). Não há testes automatizados para a camada de UI do Electron (main/preload/renderer) nem para o mobile ainda.

```bash
npm run typecheck
```

Na raiz, roda `tsc --noEmit` em todos os workspaces (inclui o `tsconfig` separado do renderer do Electron).

## Particularidades específicas de macOS que valem saber ao testar

- **Ícone de apps `.app`**: extraído via um script JXA (`agent/src/platform/macIcon.ts`), não pela API padrão do Electron — ver `docs/ARCHITECTURE.md` para o porquê.
- **Abrir um `.app` diretamente com `spawn()` pode travar com `SIGKILL (Code Signature Invalid)`** dependendo do processo "responsável" pela árvore de processos (ex.: rodar de dentro de certos ambientes de automação/CI). O handler de `open_app` já roteia `.app` por `/usr/bin/open` especificamente por causa disso — se você editar esse handler, não volte a chamar `spawn()` direto num `.app`.
- **`ELECTRON_RUN_AS_NODE`**: se essa variável estiver definida no seu shell (comum em alguns sandboxes/ambientes de automação), o Electron nunca abre uma janela de verdade — `npm run electron:dev` sobe os processos mas o app "roda como Node puro" e quebra ao tentar usar `app.whenReady`. Confira `echo $ELECTRON_RUN_AS_NODE` se a janela simplesmente não aparecer.

## O que ainda não dá para testar neste projeto

- Comportamento real em Windows (instalação, firewall, `.exe`, autostart) — tudo isso foi implementado seguindo a documentação oficial do Electron/Windows, mas nunca rodou numa máquina Windows de verdade.
- Descoberta mDNS no celular (não implementada).
- Instalador NSIS (não existe ainda).
