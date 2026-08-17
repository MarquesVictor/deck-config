# Protocolo

WebSocket, mensagens JSON, cada uma com um campo `type`. Definido em `shared/src/protocol.ts` (schemas Zod — a fonte da verdade; este documento descreve o mesmo contrato em prosa).

## Versão

`protocolVersion: 1` (constante `CURRENT_PROTOCOL_VERSION` em `shared/src/protocol.ts`). O Agent mantém uma lista de versões aceitas (`SUPPORTED_PROTOCOL_VERSIONS` em `agent/src/transport/websocket/server.ts`) e rejeita qualquer outra com `PROTOCOL_VERSION_MISMATCH` — hoje essa lista só tem `[1]`, mas o mecanismo já existe para aceitar múltiplas versões simultaneamente quando houver um v2.

Convenção pretendida (ainda não exercida na prática, porque só existe a v1):
- Breaking changes → incrementam a versão major.
- Ações novas → versão minor, com fallback pra versão anterior.
- Mobile em v1 falando com Agent em v2 continua em v1 até atualizar.

## Porta

O Agent tenta `38421`; se ocupada, tenta sequencialmente até `38430`. A porta real escolhida é publicada no registro mDNS e mostrada no Dashboard do Agent — o celular nunca precisa adivinhar.

## Conexão e handshake

```
Mobile                                    Agent
  │──── abre WebSocket ──────────────────▶│
  │                                        │
  │◀─── event: agent_ready ────────────────│  (machineId, nome, versão, protocolVersion)
  │                                        │
  │──── request: get_apps (com machineId) ▶│
  │◀─── response: apps ─────────────────────│
```

O Agent nunca pede autenticação explícita — ele simplesmente inclui seu `machineId` no evento `agent_ready` assim que a conexão abre. O celular guarda esse `machineId` e passa a incluí-lo em toda `request` seguinte. Isso não é um segredo (qualquer um na rede vê o `agent_ready`), mas evita que um dispositivo aleatório na rede envie ações sem primeiro ter conversado com o Agent — suficiente para o cenário de rede doméstica/local que este produto assume, não para uma rede hostil.

### `agent_ready` (event)

```json
{
  "type": "event",
  "event": "agent_ready",
  "agent": {
    "id": "machine_8f72c91a",
    "name": "Victor-PC",
    "version": "1.0.0",
    "protocolVersion": 1
  }
}
```

## Envelope de request

```json
{
  "protocolVersion": 1,
  "type": "request",
  "requestId": "req_abc123",
  "machineId": "machine_8f72c91a",
  "action": "get_apps" | "execute",
  "payload": { ... }
}
```

`requestId` é gerado pelo cliente e ecoado na resposta — é assim que o `AgentClient` do mobile correlaciona request/response sobre uma única conexão WebSocket (múltiplas requests podem estar em voo ao mesmo tempo).

## Ações

### `get_apps`

Sem payload. Resposta:

```json
{
  "type": "response",
  "requestId": "req_abc123",
  "success": true,
  "data": {
    "apps": [
      { "id": "app_cs2", "name": "Counter-Strike 2", "icon": "gamepad", "iconImage": "data:image/png;base64,...", "position": 0, "actionType": "open_app" }
    ]
  }
}
```

Note o que **não** está aqui: o caminho do executável. O celular só conhece o `id` — o mapeamento `id → caminho real` mora exclusivamente no Agent (`shared/src/app.ts:toAppSummary`). `iconImage` é opcional (data URL PNG extraída do executável); quando ausente, o celular usa o emoji de `icon` via `shared/src/icons.ts`.

### `execute`

```json
{ "action": "execute", "payload": { "appId": "app_cs2" } }
```

O Agent localiza o app pelo id, valida que o caminho ainda existe em disco, e executa. Resposta de sucesso não tem `data`, só `success: true`. Erros ver abaixo.

## Eventos assíncronos (Agent → Mobile)

### `apps_updated`

Enviado a todos os celulares **autenticados** (que já mandaram pelo menos um request válido) sempre que a lista de apps muda pela UI do Agent — adicionar, editar, remover ou reordenar. Mesmo formato de `apps` que `get_apps` devolve. É o que permite editar apps pela UI do desktop sem o celular precisar desconectar/reconectar para ver a mudança.

### `ping` / `pong`

O Agent manda `{ "type": "ping", "timestamp": <ms> }` a cada 30s. O cliente deve responder `{ "type": "pong", "timestamp": <mesmo valor> }`. Se o Agent não vir um `pong` em até 40s (30s de intervalo + 10s de tolerância) desde o último, derruba a conexão daquele cliente. O mobile usa isso, junto com `onclose`/`onerror` do WebSocket, para detectar quando precisa reconectar.

## Erros

Toda resposta de erro:

```json
{
  "type": "response",
  "requestId": "req_abc123",
  "success": false,
  "error": { "code": "APPLICATION_NOT_FOUND", "message": "...", "timestamp": "...", "details": "..." }
}
```

`code` é estável e feito pra código tratar (`ProtocolError.code` em `shared/src/errors.ts`); `message` é a frase amigável que o mobile mostra direto; `details` é só para log/debug.

Códigos definidos hoje (`ActionErrorCode`):

| Código | Quando |
|---|---|
| `APPLICATION_NOT_FOUND` | appId desconhecido, ou o caminho configurado não existe mais em disco |
| `APPLICATION_LAUNCH_FAILED` | `spawn()`/`open` falhou ao iniciar o processo |
| `APPLICATION_ALREADY_RUNNING` | reservado — nenhum handler emite isso ainda |
| `UNAUTHORIZED` | `machineId` da request não bate com o do Agent |
| `INVALID_MACHINE_ID` | reservado — hoje um machineId errado cai em `UNAUTHORIZED`, não neste código |
| `PROTOCOL_VERSION_MISMATCH` | `protocolVersion` da request fora da lista suportada |
| `INVALID_ACTION` | `action` desconhecida para o `ActionRegistry` |
| `MISSING_PAYLOAD` | reservado — validação de payload hoje é feita pelo Zod schema de cada action, que gera outro tipo de erro, não este código especificamente |
| `VALIDATION_ERROR` | payload não passa no schema Zod da action |
| `INTERNAL_ERROR` | qualquer exceção não mapeada — fallback genérico |
| `TIMEOUT` | reservado — hoje o timeout é só client-side (mobile desiste depois de 10s), o Agent não emite isto |

Os códigos marcados "reservado" existem no enum porque fazem parte do vocabulário do protocolo, mas nenhum handler os produz ainda — não é um bug, é espaço já reservado para quando os casos que os disparam existirem (ex.: `TIMEOUT` quando houver ações de longa duração no Agent).

## Reconexão (mobile)

Backoff fixo: `1s, 2s, 4s, 8s, 15s` (a partir daí sempre 15s), desiste depois de 5 minutos tentando sem sucesso e expõe um botão "Tentar novamente" na UI (`mobile/src/services/websocketClient.ts`). Timeout de conexão inicial: 8s. Timeout de resposta a uma request: 10s.

## Segurança de execução

O Agent nunca executa uma string arbitrária vinda do celular. `execute` só aceita um `appId`; o `ActionRegistry` só roda handlers pré-registrados (`open_app` hoje) contra dados já validados e persistidos no `config.json` do próprio Agent. Não existe (e não deve existir) um caminho onde o payload de uma request vira um comando de shell.
