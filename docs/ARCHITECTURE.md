# Arquitetura

## Monorepo

npm workspaces, três pacotes:

```
shared/   tipos TypeScript + validação Zod do protocolo — consumido por agent e mobile
agent/    Agent desktop: core (protocolo, persistência, ações) + Electron (UI) + CLI headless
mobile/   app React Native/Expo
```

`shared` compila para `dist/` (`npm run build` dentro de `shared/`); `agent` e `mobile` resolvem `@stream-deck/shared` via esse build, não via `src/` diretamente. **Depois de editar algo em `shared/src`, rode `npm run build` em `shared/` antes de testar `agent`/`mobile`** — é a pegadinha mais comum nesse monorepo.

## Princípios

- Lógica de negócio não fica presa à UI: tudo que faz algo de verdade (validar, persistir, executar ações, falar com o WebSocket) mora em `agent/src/core/` e `agent/src/transport/`, sem depender do Electron.
- Dependências fluem pra dentro: a UI (`agent/src/ui/electron/`) depende do core; o core não sabe que o Electron existe.
- Persistência e transporte são injetáveis: `AgentService`, `RequestRouter` etc. recebem um `IConfigStore` por interface, não uma implementação concreta — facilita testar com um store em diretório temporário.

## Fluxo de dados (Agent)

```
bootstrapAgent()                          agent/src/core/bootstrap.ts
  ├─ JsonConfigStore                       persistência em disco (config.json)
  ├─ ActionRegistry + createOpenAppHandler ações executáveis conhecidas
  ├─ RequestRouter                         roteia get_apps / execute
  ├─ startWebSocketServer                  porta 38421-38430, handshake, heartbeat
  └─ advertiseAgent (mDNS)                 anuncia _streamdeck._tcp na rede
```

Dois consumidores desse bootstrap, ambos chamando a mesma função — nenhuma lógica duplicada entre eles:

- **`agent/src/index.ts`** — entrypoint headless (`npm run dev` em `agent/`), sem UI. Útil para automação/testes manuais rápidos.
- **`agent/src/ui/electron/main.ts`** — processo principal do Electron. Chama `bootstrapAgent()`, cria a janela, registra os handlers de IPC (`AgentService`) que a UI usa para CRUD de apps, configurações, etc.

`AgentService` (`agent/src/core/agentService.ts`) é a camada que a UI do Electron fala por IPC — envolve o mesmo `ConfigStore`/`ActionRegistry` que o WebSocket usa, então o Agent e os celulares conectados sempre veem o mesmo estado. Qualquer mudança na lista de apps feita pela UI dispara um evento `apps_updated` para os celulares autenticados, sem precisar reconectar.

## Estrutura de diretórios

```
agent/src/
├── core/
│   ├── actions/         ActionRegistry + handlers (só open_app implementado)
│   ├── models/           AgentConfig (schema Zod da configuração persistida)
│   ├── persistence/       IConfigStore + JsonConfigStore (JSON com backup automático)
│   ├── agentService.ts    camada usada pela UI via IPC
│   ├── bootstrap.ts       boot compartilhado (config, actions, websocket, mdns)
│   └── requestRouter.ts   roteia requests do protocolo pra actions/config
├── transport/
│   ├── websocket/         server.ts (porta, handshake, heartbeat) + connectionManager.ts
│   └── mdns/              advertiser.ts (bonjour-service)
├── platform/
│   ├── logger.ts          logger estruturado por nível (console; sem arquivo/rotação ainda)
│   ├── network.ts         IPs locais (mostrados no Dashboard e no log de boot)
│   └── macIcon.ts          extração de ícone .app no macOS (workaround, ver abaixo)
├── ui/electron/
│   ├── main.ts             processo principal: janela, tray, IPC handlers
│   ├── preload.ts          contextBridge — expõe window.streamDeck tipado
│   ├── ipc.ts               contrato de canais IPC (main e preload compilam contra o mesmo tipo)
│   └── renderer/           React + Vite: pages/ (Dashboard, Apps, Settings), components/
└── cli/addApp.ts           seed manual de apps via terminal (bypassa a UI, útil em dev)

mobile/src/
├── screens/                ConnectScreen, ControlScreen
├── services/
│   ├── websocketClient.ts  AgentClient: handshake, correlação de request/response, heartbeat, reconexão
│   └── storage.ts          último IP/porta usado (AsyncStorage)
└── theme.ts                paleta compartilhada entre as telas

shared/src/
├── protocol.ts             schemas Zod do envelope do protocolo (request/response/event)
├── app.ts                  schema do App e AppSummary (o que o celular recebe)
├── errors.ts                ActionErrorCode + classe ProtocolError
└── icons.ts                 mapa de ícones emoji (fallback quando não há iconImage)
```

## Particularidades conhecidas de plataforma

Coisas que existem no código por causa de comportamento real observado, não por precaução teórica:

- **Extração de ícone no macOS** (`agent/src/platform/macIcon.ts`): `app.getFileIcon()` do Electron tem uma limitação conhecida no macOS — resolve ícones de bundles `.app` por tipo MIME e devolve um ícone genérico em vez do real. Contornado chamando a mesma API que o Finder usa (`NSWorkspace.iconForFile`, via um script JXA em `assets/extract-mac-icon.jxa.js`) e reduzindo o resultado com `sips`. No Windows, a API do Electron já funciona corretamente para `.exe`, então esse workaround só roda em `darwin`.
- **`sandbox: false` na BrowserWindow** (`main.ts`): o carregador de preload sandboxed do Electron tem instabilidade conhecida quando o preload faz `require()` de outro arquivo local (nosso `./ipc.js`). Desativado porque essa é uma UI local confiável, não conteúdo remoto.
- **`.app` do macOS precisa passar por `open`** (`core/actions/openApp.ts`): um bundle `.app` é um diretório — `spawn()` não executa isso diretamente. No macOS, caminhos terminados em `.app` são roteados por `/usr/bin/open`; caminhos `.exe` (o caso real) continuam com `spawn()` direto.
- **`ELECTRON_RUN_AS_NODE`**: se essa variável de ambiente estiver definida, qualquer binário do Electron roda como Node puro (sem GUI) — `require("electron")` retorna uma string em vez da API, e `app.whenReady` quebra. Isso não é um bug do projeto; é uma restrição de sandbox em alguns ambientes de execução automatizados.

## O que ainda não existe

- Descoberta automática por mDNS no celular (hoje é IP manual — ver `docs/DEVELOPMENT.md`)
- Logs em arquivo com rotação (hoje só console)
- Instalador Windows (NSIS) e regra de firewall automática
- Ações além de `open_app` (volume, atalho de teclado, abrir URL, OBS, script) — a arquitetura (`ActionRegistry`) já foi desenhada para isso, só falta implementar cada handler
