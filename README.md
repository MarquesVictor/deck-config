# Stream Deck

Transforma um celular (iOS/Android) em um Stream Deck para abrir aplicativos num computador Windows pela rede local — sem internet, sem servidor externo, sem configurar roteador.

```
📱 Mobile (Expo/React Native)  ⇄  WebSocket (LAN)  ⇄  💻 Agent (Electron)  →  abre o app
```

## Status atual

O fluxo principal já funciona de ponta a ponta, validado com dispositivos reais:

- ✅ Agent (Electron): adicionar/editar/remover/reordenar aplicativos pela UI, testar direto, ver celulares conectados
- ✅ Ícone de cada app extraído automaticamente do próprio executável
- ✅ App mobile: conectar por IP, listar botões, executar, reconectar sozinho se a rede cair
- ✅ Múltiplos celulares conectados ao mesmo tempo
- ⚠️ Descoberta automática por mDNS **ainda não implementada** — a conexão hoje é por IP manual (o Dashboard do Agent mostra o IP e a porta)
- ⚠️ Validado até agora só em **macOS** como Agent — o alvo real é Windows, ainda não testado numa máquina Windows de verdade
- ❌ Sem instalador ainda (NSIS) — hoje só roda a partir do código-fonte

Veja [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) para a estrutura técnica e [`docs/PROTOCOL.md`](docs/PROTOCOL.md) para a especificação do protocolo.

## Como rodar (desenvolvimento)

Pré-requisitos: Node.js 18+, npm.

```bash
npm install
```

### Agent (desktop)

```bash
cd agent
npm run electron:dev
```

Abre a janela do Agent. Na aba **Aplicativos**, adicione um programa (nome + executável, obrigatório) e o ícone é buscado automaticamente. Na aba **Dashboard** aparece o IP e a porta que o celular vai usar para conectar.

### Mobile

```bash
cd mobile
npx expo start
```

Escaneie o QR code com o app **Expo Go** (mesma rede Wi-Fi do computador). Na tela de conexão, digite o IP e a porta mostrados no Dashboard do Agent.

> Detalhes de compatibilidade de versão do Expo Go, particularidades do macOS e outras pegadinhas de ambiente de desenvolvimento estão em [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

### Testes

```bash
npm run typecheck   # em todos os workspaces
cd agent && npm test # suíte de testes do Agent (unitários + integração real)
```

## Estrutura do monorepo

```
shared/   tipos e protocolo compartilhados (Zod)
agent/    Agent desktop (Electron + WebSocket + mDNS + persistência)
mobile/   app mobile (Expo + React Native)
```

Veja [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) para detalhes de cada módulo.

## Licença

Projeto pessoal, sem licença definida ainda.
