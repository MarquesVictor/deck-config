# Stream Deck Mobile

Quero desenvolver um aplicativo real, funcional e extensível que transforme um **celular iPhone ou Android em um Stream Deck para controlar um computador Windows através da rede local**.

O projeto deve ser desenvolvido como um produto real desde o início, e não como um protótipo descartável.

O escopo inicial será deliberadamente pequeno:

> O usuário configura aplicativos no Agent instalado no Windows e, pelo celular, toca em um botão para abrir esses aplicativos no computador.

A arquitetura, entretanto, deve ser preparada para futuramente suportar outras ações, como controle de volume, OBS, Discord, Spotify, atalhos de teclado, macros, scripts etc.

---

# 1. Conceito do produto

O produto terá dois componentes principais:

```text
┌─────────────────────┐
│ 📱 MOBILE APP       │
│                     │
│ Interface Stream    │
│ Deck                │
└──────────┬──────────┘
           │
           │ Wi-Fi / LAN
           │ WebSocket
           ▼
┌─────────────────────┐
│ 💻 STREAM DECK      │
│    AGENT            │
│                     │
│ Windows             │
│ Configuração        │
│ Execução de ações   │
└──────────┬──────────┘
           │
           ▼
     Windows / Apps
```

Não haverá necessidade de servidor externo ou conexão com a internet para a operação normal.

O celular e o computador devem conseguir se comunicar diretamente pela rede local.

---

# 2. Experiência que quero para o usuário

A experiência deve exigir o mínimo possível de configuração.

## No computador

O usuário instala o:

**Stream Deck Agent**

Ao abrir pela primeira vez, ele configura seus aplicativos.

Exemplo:

```text
Stream Deck Agent

Computador
Victor-PC

Aplicativos

┌────────────────────────────────────┐
│ 🎮  Counter-Strike 2               │
│     C:\Games\CS2\cs2.exe           │
│                                    │
│                        [ Editar ]  │
│                        [ Remover ] │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ 🎵  Spotify                         │
│     C:\Users\Victor\AppData\...    │
│                                    │
│                        [ Editar ]  │
│                        [ Remover ] │
└────────────────────────────────────┘

          [ + Adicionar aplicativo ]
```

O usuário deve conseguir:

* adicionar aplicativo;
* informar nome;
* selecionar o executável através de um seletor de arquivos;
* escolher um ícone;
* editar;
* remover;
* ordenar os aplicativos;
* testar o aplicativo diretamente pelo Agent.

---

# 3. Aplicativos configurados

Cada aplicativo deve possuir um identificador interno.

Exemplo:

```json
{
  "id": "app_cs2",
  "name": "Counter-Strike 2",
  "icon": "gamepad",
  "type": "application",
  "action": {
    "type": "open_app",
    "path": "C:\\Games\\CS2\\cs2.exe"
  },
  "position": 0
}
```

Outro:

```json
{
  "id": "app_spotify",
  "name": "Spotify",
  "icon": "music",
  "type": "application",
  "action": {
    "type": "open_app",
    "path": "C:\\Users\\Victor\\AppData\\Roaming\\Spotify\\Spotify.exe"
  },
  "position": 1
}
```

O caminho real do executável deve ficar somente no Agent.

O celular **não deve precisar conhecer o caminho do executável**.

O celular trabalha apenas com:

```text
app_cs2
app_spotify
```

---

# 4. Aplicativo mobile

O aplicativo mobile será desenvolvido para:

* iOS;
* Android.

Preferência tecnológica:

* React Native;
* Expo;
* TypeScript.

### Compatibilidade de versões

- **iOS**: versão 13+
- **Android**: API level 21+ (Android 5.0)

O aplicativo deve mostrar os computadores disponíveis na rede local.

Exemplo:

```text
Stream Deck

Computadores encontrados

┌─────────────────────────┐
│ 🖥️ Victor-PC            │
│ 🟢 Disponível           │
│                         │
│       [ CONECTAR ]      │
└─────────────────────────┘
```

O usuário toca em conectar.

Não quero que o usuário tenha que:

* descobrir IP;
* digitar IP;
* digitar porta;
* configurar roteador;
* abrir porta no roteador;
* configurar port forwarding;
* criar conta;
* utilizar servidor externo.

---

# 5. Descoberta automática

O Agent deve anunciar sua presença na rede local usando:

**mDNS / Bonjour / DNS-SD**

Utilizar um serviço semelhante a:

```text
_streamdeck._tcp
```

O serviço deve divulgar informações suficientes para o aplicativo encontrar o Agent.

Por exemplo:

```text
service: _streamdeck._tcp
name: Victor-PC
host: victor-pc.local
port: 38421
txt: {
  "version": "1.0.0",
  "machineId": "machine_8f72c91a",
  "protocolVersion": "1"
}
```

O aplicativo mobile deve procurar esses serviços.

Fluxo:

```text
Abrir aplicativo
       ↓
Procurar Stream Deck Agents
       ↓
Encontrar Victor-PC
       ↓
Usuário toca em Victor-PC
       ↓
Conectar
       ↓
Receber configuração
```

Se nenhum Agent for encontrado, mostrar uma mensagem clara:

```text
Nenhum computador encontrado.

Verifique se:
• o Stream Deck Agent está aberto;
• o celular e o computador estão na mesma rede Wi-Fi;
• a rede permite comunicação entre dispositivos.
```

---

# 6. Comunicação

A comunicação entre mobile e Agent deve utilizar:

**WebSocket**

A conexão deve permanecer aberta enquanto o aplicativo estiver conectado.

Arquitetura:

```text
Mobile
   │
   │ WebSocket (TCP)
   │ Porta: 38421 ou alternativa
   │
   ▼
Agent
```

O protocolo deve utilizar JSON.

Todos os pacotes devem possuir um campo `type`.

Exemplo:

```json
{
  "type": "request",
  "requestId": "abc123",
  "action": "get_apps"
}
```

Resposta:

```json
{
  "type": "response",
  "requestId": "abc123",
  "success": true,
  "data": {
    "apps": []
  }
}
```

---

# 7. Protocolo

O protocolo deve ser versionado.

Exemplo:

```json
{
  "protocolVersion": 1,
  "type": "request",
  "requestId": "abc123",
  "action": "get_apps"
}
```

O Agent deve rejeitar versões de protocolo incompatíveis de maneira controlada.

Criar tipos TypeScript compartilhados ou uma definição de protocolo bem documentada.

### Estratégia de evolução de protocolo

- **Versão Atual**: 1
- **Compatibilidade**: Agent aceita múltiplas versões de protocolo simultâneamente (backward compatibility)
- **Breaking changes**: Incrementam a versão major (1 → 2)
- **Novas ações**: Adicionadas com versão minor (1.0 → 1.1), com fallback para versão anterior
- **Decisão clara**: Se Mobile suporta v1 e Agent oferece v2, Mobile continua usando v1 até atualizar

Exemplo de evolução:

```text
Agent v1.2 (protocol v1)
│
├── Suporta ações: open_app
└── Versão v1 do protocolo

↓

Agent v1.5 (protocol v1)
│
├── Suporta ações: open_app, volume, keyboard
└── Versão v1 do protocolo (backward compatible)

↓

Agent v2.0 (protocol v2)
│
├── Pode quebrar formato JSON
└── Versão v2 (Mobile v1 não consegue conectar, apresenta erro claro)
```

---

# 8. Segurança de rede local

### Autenticação

Implementar um simples **handshake com token** para evitar que dispositivos não autorizados na rede executem ações.

**Fluxo de autenticação:**

1. Agent inicializa com um **machineId** persistente (UUID gerado na primeira execução)
2. Mobile descobre Agent via mDNS, recebe `machineId`
3. Mobile conecta no WebSocket
4. Agent envia evento `agent_ready` com `machineId`
5. Mobile armazena este `machineId` localmente
6. Cada request enviado pelo Mobile inclui o `machineId` no header:

```json
{
  "protocolVersion": 1,
  "type": "request",
  "requestId": "req_123",
  "machineId": "machine_8f72c91a",
  "action": "get_apps"
}
```

7. Agent valida `machineId` antes de processar qualquer ação
8. Se inválido: rejeita com erro `UNAUTHORIZED`

**Benefícios:**
- Impede vizinhos na mesma rede de executar ações
- Sem overhead de PKI/HTTPS (apropriado para rede local)
- Permite múltiplos Mobile conectados simultaneamente (todos memorizam o machineId)

### TLS (Transport Layer Security)

Não é necessário em primeira versão, pois:
- Comunicação é apenas em rede local (não atravessa internet)
- Autenticação por machineId previne spoofing
- Se implementar no futuro: apenas use para rede externa (VPN, remote access)

### Informações sensíveis

Nunca transmitir:
- Caminhos completos de arquivos em logs
- Conteúdo de scripts
- Dados do sistema desnecessariamente

---

# 9. Fluxo de conexão

Ao conectar:

```text
Mobile
  ↓
connect (WebSocket)
  ↓
Agent
  ↓
handshake
  ↓
Agent informa versão + machineId
  ↓
Mobile valida machineId
  ↓
Mobile solicita configuração
  ↓
Agent envia aplicativos
```

Exemplo:

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

Depois:

```json
{
  "type": "request",
  "requestId": "req_123",
  "machineId": "machine_8f72c91a",
  "action": "get_apps"
}
```

Resposta:

```json
{
  "type": "response",
  "requestId": "req_123",
  "success": true,
  "data": {
    "apps": [
      {
        "id": "app_cs2",
        "name": "Counter-Strike 2",
        "icon": "gamepad",
        "position": 0,
        "actionType": "open_app"
      }
    ]
  }
}
```

---

# 10. Abrindo aplicativo

Quando o usuário toca no botão CS2:

```text
📱
[ 🎮 CS2 ]
     ↓
WebSocket
     ↓
Agent
     ↓
app_cs2
     ↓
C:\Games\CS2\cs2.exe
```

O celular deve enviar:

```json
{
  "type": "request",
  "requestId": "req_456",
  "machineId": "machine_8f72c91a",
  "action": "execute",
  "payload": {
    "appId": "app_cs2"
  }
}
```

O Agent localiza o aplicativo pelo ID e executa a ação.

Resposta:

```json
{
  "type": "response",
  "requestId": "req_456",
  "success": true
}
```

Se o executável não existir:

```json
{
  "type": "response",
  "requestId": "req_456",
  "success": false,
  "error": {
    "code": "APPLICATION_NOT_FOUND",
    "message": "O aplicativo configurado não foi encontrado."
  }
}
```

Se machineId for inválido:

```json
{
  "type": "response",
  "requestId": "req_456",
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Dispositivo não autorizado."
  }
}
```

O celular deve apresentar uma mensagem amigável ao usuário.

---

# 11. Tratamento de erros específicos

O Agent deve retornar códigos de erro bem definidos:

```typescript
enum ActionErrorCode {
  // Aplicação
  APPLICATION_NOT_FOUND = "APPLICATION_NOT_FOUND",
  APPLICATION_LAUNCH_FAILED = "APPLICATION_LAUNCH_FAILED",
  APPLICATION_ALREADY_RUNNING = "APPLICATION_ALREADY_RUNNING",
  
  // Autenticação
  UNAUTHORIZED = "UNAUTHORIZED",
  INVALID_MACHINE_ID = "INVALID_MACHINE_ID",
  
  // Protocolo
  PROTOCOL_VERSION_MISMATCH = "PROTOCOL_VERSION_MISMATCH",
  INVALID_ACTION = "INVALID_ACTION",
  MISSING_PAYLOAD = "MISSING_PAYLOAD",
  
  // Servidor
  INTERNAL_ERROR = "INTERNAL_ERROR",
  TIMEOUT = "TIMEOUT"
}
```

Cada erro deve incluir:
- `code`: código máquina
- `message`: mensagem amigável ao usuário
- `details`: contexto técnico (apenas em logs)

Exemplo:

```json
{
  "success": false,
  "error": {
    "code": "APPLICATION_LAUNCH_FAILED",
    "message": "Não foi possível abrir o aplicativo. Verifique se o caminho ainda é válido.",
    "timestamp": "2025-01-15T10:30:45Z"
  }
}
```

---

# 12. Manejo de porta

O Agent tenta usar uma porta padrão, mas deve ser flexível:

**Estratégia de port management:**

1. Tentar usar porta **38421** (padrão)
2. Se ocupada: tentar **38422**, **38423**... até **38430**
3. Se todas ocupadas: erro claro informando que não há portas disponíveis
4. A porta real é registrada no mDNS TXT record
5. Interface do Agent mostra qual porta está sendo usada

Exemplo de log:

```text
[INFO] WebSocket port 38421 already in use
[INFO] Trying port 38422...
[INFO] WebSocket listening on port 38422
[INFO] mDNS updated with port 38422
```

Mobile descobre porta automaticamente via mDNS.

---

# 13. Segurança de execução

Não permitir execução arbitrária de comandos recebidos pelo celular.

Nunca implementar algo como:

```text
exec(message.command)
```

ou:

```text
powershell(message.command)
```

O Agent deve possuir ações conhecidas e controladas.

No primeiro momento:

```text
open_app
```

Posteriormente:

```text
volume_up
volume_down
volume_mute
keyboard_shortcut
open_url
obs_scene
obs_start
obs_stop
script
```

Cada tipo de ação deverá possuir seu próprio handler.

Arquitetura conceitual:

```text
Action Registry

├── open_app
│   └── Handler: executa apenas aplicativos pré-configurados
│
├── volume
│   └── Handler: ajusta volume do sistema via WinAPI
│
├── keyboard
│   └── Handler: simula pressionamento de teclas (whitelist de atalhos)
│
├── url
│   └── Handler: abre browser com URL pré-configurada
│
├── obs
│   └── Handler: se OBS estiver rodando, executa via WebSocket da OBS
│
└── script
    └── Handler: executa scripts pré-autorizados (path + hash verificado)
```

O Agent só executa ações registradas.

**Validação rigorosa:**

- `open_app`: verificar que o caminho existe e pertence à lista configurada
- `keyboard_shortcut`: apenas atalhos pré-definidos (ex: `Ctrl+V`, não aceita comandos arbitrários)
- `script`: calcular hash do script ao salvar, validar hash antes de executar (impede modificação)

---

# 14. Persistência

A configuração dos aplicativos deve sobreviver ao fechamento e reinicialização do Agent.

Não utilizar banco de dados neste momento.

Usar armazenamento local em JSON.

Local padrão:

```text
%APPDATA%\StreamDeck\config.json
```

Estrutura do arquivo:

```json
{
  "version": 1,
  "machine": {
    "id": "machine_8f72c91a",
    "name": "Victor-PC",
    "createdAt": "2025-01-15T10:00:00Z"
  },
  "apps": [
    {
      "id": "app_cs2",
      "name": "Counter-Strike 2",
      "icon": "gamepad",
      "type": "application",
      "action": {
        "type": "open_app",
        "path": "C:\\Games\\CS2\\cs2.exe"
      },
      "position": 0,
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "settings": {
    "autoStartWindows": true,
    "startMinimized": true,
    "logLevel": "info"
  }
}
```

**Backup automático:**

- Ao iniciar o Agent, verificar integridade do JSON
- Se corrompido: restaurar da última versão válida (`.backup`)
- Ao salvar configuração: criar backup do anterior (`.backup`)

**Camada de persistência:**

```typescript
interface IConfigStore {
  loadConfig(): Promise<AgentConfig>
  saveConfig(config: AgentConfig): Promise<void>
  loadApp(appId: string): Promise<App | null>
  saveApp(app: App): Promise<void>
  deleteApp(appId: string): Promise<void>
}
```

Implementação: `JsonConfigStore` inicialmente. Futuramente trocar por SQLite sem reescrever o sistema.

Não salvar configurações em pasta temporária.

---

# 15. Interface do Agent (Desktop)

O Agent deve possuir uma interface gráfica real.

Preferência:

**Electron + React + TypeScript**

Estrutura da interface:

### Dashboard (tela inicial)

```text
Stream Deck Agent v1.0.0

Status
🟢 Online

Computador
Victor-PC
Porta: 38421

Celulares conectados
2

  📱 iPhone Victor
  🟢 conectado • última atividade: 2 min
  
  📱 Android Victor
  🟢 conectado • última atividade: 5 min

Aplicativos configurados
6

[ Ver aplicativos ] [ Configurações ]
```

### Aplicativos

Lista dos aplicativos configurados.

Cada item:

```text
🎮 Counter-Strike 2
C:\Games\CS2\cs2.exe
Adicionado: 15 jan, 10:30

[ Testar ] [ Editar ] [ Remover ]
```

**Ação "Testar":**
- Executa o aplicativo imediatamente
- Mostra feedback visual: "Iniciando..." → "Aberto com sucesso" ou erro
- Log registra a execução

### Adicionar / Editar aplicativo

Formulário:

```text
Novo aplicativo

Nome *
[ Counter-Strike 2 ]

Executável *
[ C:\Games\CS2\cs2.exe ] [ Procurar ]

Ícone
[ 🎮 ▼ ]

Posição
[ Auto ]

[ Cancelar ] [ Salvar ]
```

**Comportamentos:**

- Ao clicar em "Procurar": abrir diálogo nativo do Windows (`OpenFileDialog`)
- Apenas permitir extensões `.exe`
- Validar que o caminho existe ao salvar
- Se inválido: mostrar erro e permitir corrigir

### Configurações

```text
Configurações

Geral
☑ Iniciar automaticamente com o Windows
☑ Iniciar minimizado
☑ Mostrar no system tray

Rede
Porta: 38421
mDNS: ativado
Nome do computador: Victor-PC

Logs
Nível: Info ▼
Local: C:\Users\Victor\AppData\Local\StreamDeck\logs
[ Abrir pasta ]

[ Redefinir para padrão ] [ Fechar ]
```

---

# 16. Ícones

O sistema deve permitir que o usuário escolha um ícone para cada aplicativo.

**Biblioteca inicial de ícones:**

```text
🎮 gamepad
🎵 music
💬 chat
🌐 globe
📁 folder
🛠️ tools
⚙️ settings
🎥 camera
📷 photo
🎬 film
📝 document
📊 chart
🎨 palette
🔧 wrench
📦 box
🔑 key
👤 user
🏠 home
```

**Arquitetura para evolução:**

```typescript
interface IconProvider {
  getIcon(id: string): Promise<IconData>
  listIcons(): Promise<Icon[]>
}

class BuiltinIconProvider implements IconProvider {
  // Icons embutidos
}

class CustomIconProvider implements IconProvider {
  // Futuramente: uploads de PNG/SVG
}
```

Futuramente permitir:
* Upload de imagem (PNG, JPG, SVG)
* Packs de ícones
* Ícones personalizados por usuário

---

# 17. Interface mobile

A interface mobile deve ser visualmente semelhante a um Stream Deck.

### Tela de descoberta

```text
Stream Deck

Procurando computadores...

⏳ Aguarde...
```

Resultados:

```text
Stream Deck

Computadores encontrados

┌─────────────────────────┐
│ 🖥️ Victor-PC            │
│ 🟢 Disponível           │
│ Porta: 38421            │
│                         │
│       [ CONECTAR ]      │
└─────────────────────────┘

[ Conectar manualmente ] [ Atualizar ]
```

### Tela principal (conectado)

```text
┌──────────────────────────────┐
│        VICTOR-PC             │
│        🟢 Conectado          │
├──────────────────────────────┤
│                              │
│  ┌───────┐     ┌───────┐    │
│  │  🎮   │     │  🎵   │    │
│  │  CS2  │     │Spotify│    │
│  └───────┘     └───────┘    │
│                              │
│  ┌───────┐     ┌───────┐    │
│  │  💬   │     │  🌐   │    │
│  │Discord│     │Chrome │    │
│  └───────┘     └───────┘    │
│                              │
│  ┌───────┐     ┌───────┐    │
│  │  🔧   │     │  ⚙️   │    │
│  │VS Code│     │Config │    │
│  └───────┘     └───────┘    │
│                              │
└──────────────────────────────┘
```

### Comportamentos dos botões

**Estado normal:**
- Ícone + nome
- Feedback visual ao toque (highlight)

**Ao pressionar:**
- Feedback visual imediato (animação)
- Spinner "Abrindo..."

**Sucesso:**
- Checkmark verde por 1 segundo
- Voltar ao estado normal

**Erro:**
- X vermelho
- Toast com mensagem de erro
- Botão ativa novamente para retry

### Responsividade

- Adaptar quantidade de colunas ao tamanho da tela
- Portrait: 2 colunas
- Landscape: 3-4 colunas
- Tablets: 4-6 colunas
- Tamanho de botões: sempre quadrado, com padding confortável

---

# 18. Reconexão

A conexão deve ser resiliente.

Se o Wi-Fi cair:

```text
🟡 Reconectando...
```

Quando voltar:

```text
🟢 Conectado
```

Não quero que o usuário precise fechar e abrir o aplicativo.

**Implementar:**

### Heartbeat / Ping-Pong

Agent envia `ping` a cada 30 segundos:

```json
{
  "type": "ping",
  "timestamp": 1673856645000
}
```

Mobile responde com `pong`:

```json
{
  "type": "pong",
  "timestamp": 1673856645000
}
```

Se não receber `pong` em 10 segundos: reconectar

### Reconexão automática

1. **Tentativa 1**: 1 segundo
2. **Tentativa 2**: 2 segundos
3. **Tentativa 3**: 4 segundos
4. **Tentativa 4**: 8 segundos
5. **Tentativa 5+**: 15 segundos (máximo)
6. Desistir após 5 minutos de tentativas contínuas
7. Mostrar mensagem: "Não foi possível reconectar"
8. Oferecer botão: "Tentar novamente" ou "Voltar"

### Detecção de conexão perdida

- WebSocket `onclose` ou `onerror`
- Timeout após 10 segundos sem resposta
- Ambos acionam reconexão automática

---

# 19. Múltiplos celulares

O Agent deve suportar múltiplos celulares conectados simultaneamente.

### Conexões simultâneas

```text
Agent

Dispositivos conectados

📱 iPhone Victor
🟢 conectado (15 min)

📱 Android Victor
🟢 conectado (5 min)
```

Todos podem consultar e executar ações sem conflito.

**Implementação:**

```typescript
class ConnectionManager {
  private connections: Map<string, ClientConnection> = new Map()
  
  async handleNewConnection(socket: WebSocket): Promise<void> {
    const clientId = generateClientId()
    const connection = new ClientConnection(socket, clientId)
    this.connections.set(clientId, connection)
    
    // Event: novo cliente conectado
    this.emit('client:connected', { clientId })
  }
  
  async broadcastEvent(event: AgentEvent): Promise<void> {
    // Enviar evento para todos os clientes conectados
    for (const connection of this.connections.values()) {
      await connection.send(event)
    }
  }
}
```

**Isolamento:**

Cada conexão possui seu próprio estado de sessão.

Ações de um celular não afetam outro.

Todos recebem atualizações de configuração (se um celular adicionar aplicativo, outro recebe update).

---

# 20. Inicialização do Agent

O Agent deve poder iniciar automaticamente com o Windows.

### Configuração

Nas configurações da interface:

```text
Inicialização
☑ Iniciar automaticamente com o Windows
☑ Iniciar minimizado
```

### Implementação

Usar a abordagem nativa do Windows:

1. **Electron**: usar `app.setLoginItemSettings()` para adicionar ao startup
2. **Node.js (standalone)**: adicionar entrada no registro do Windows
   ```powershell
   reg add HKCU\Software\Microsoft\Windows\CurrentVersion\Run /v StreamDeckAgent /d "C:\Program Files\StreamDeckAgent\StreamDeckAgent.exe"
   ```

### Inicialização automática

```text
Windows
   ↓
Stream Deck Agent.exe (ou minimizado)
   ↓
Carregar configuração
   ↓
Inicializar WebSocket (porta 38421+)
   ↓
Registrar mDNS
   ↓
Celular consegue descobrir
```

Log na inicialização:

```text
[INFO] Stream Deck Agent started
[INFO] Machine: Victor-PC (machine_8f72c91a)
[INFO] Version: 1.0.0
[INFO] Protocol version: 1
[INFO] WebSocket: 38421
[INFO] mDNS registered: _streamdeck._tcp
[INFO] Loaded 6 applications
[INFO] Ready
```

---

# 21. Instalação do Agent

O projeto deve possuir um processo real de build e instalação para Windows.

### Geração do instalador

Gerar um executável como:

```text
StreamDeckAgent-1.0.0-Setup.exe
```

### Ferramentas

Usar **NSIS (Nullsoft Scriptable Install System)** ou **WiX Toolset**:

- NSIS: simples, resulta em .exe compacto, perfeito para este caso
- WiX: mais robusto, resulta em .msi

**Escolha: NSIS** (mais rápido, tamanho menor)

### Funcionalidades do instalador

- ✅ Instalar o Agent em `C:\Program Files\StreamDeckAgent\`
- ✅ Criar atalhos no menu iniciar e desktop
- ✅ Ofertar inicialização com Windows (checkbox)
- ✅ Pedir confirmação se houver versão anterior instalada
- ✅ Importar configuração anterior (config.json) se disponível
- ✅ Permitir desinstalação completa
- ✅ Lançar aplicativo ao final da instalação

### Estrutura de arquivos instalados

```text
C:\Program Files\StreamDeckAgent\
├── StreamDeckAgent.exe (Electron app)
├── resources/
│   ├── app/
│   │   ├── main.js (process principal)
│   │   ├── preload.js
│   │   ├── renderer/ (UI React)
│   │   ├── core/ (lógica)
│   │   └── package.json
├── LICENSE
└── README.md
```

### Configuração portável (futuro)

Permitir execução portável (sem instalação):

```text
StreamDeckAgent-portable.zip
```

Descompactar e executar diretamente.

Config.json criado ao lado do executável (não em %APPDATA%).

---

# 22. Firewall do Windows

O produto não deve exigir configuração manual de port forwarding.

A comunicação é exclusivamente local (não atravessa internet).

### Manejo do firewall

**Opção 1 (recomendada): Permissão automática durante instalação**

```powershell
# Adicionar exceção ao Windows Firewall durante instalação
New-NetFirewallRule -DisplayName "Stream Deck Agent" `
  -Direction Inbound `
  -Program "C:\Program Files\StreamDeckAgent\StreamDeckAgent.exe" `
  -Action Allow `
  -Profile Private
```

**Opção 2: Solicitar permissão ao executar**

Windows mostrará diálogo:

```text
Windows Defender Firewall

Stream Deck Agent quer se comunicar em redes
privadas.

Descrição:
Aplicação local para controlar PC via celular
na rede local.

[✓] Rede privada
[ ] Rede pública

[ Permitir ] [ Cancelar ]
```

**Preferência: Opção 1** (instalador silencioso, melhor UX)

### Mensagem clara para o usuário

No README:

```text
📡 COMUNICAÇÃO

✅ Internet: não necessária
✅ Port forwarding: não necessário
✅ Servidor externo: não necessário
✅ Configuração manual: não necessária

A comunicação ocorre exclusivamente em sua rede local
(WiFi doméstica ou corporativa). O Windows Firewall será
configurado automaticamente durante a instalação para
permitir comunicação com dispositivos da rede privada.
```

---

# 23. Identidade do computador

Cada Agent deve possuir um ID persistente.

Não depender somente do hostname.

### Machine ID

```json
{
  "id": "machine_8f72c91a",
  "name": "Victor-PC",
  "createdAt": "2025-01-15T10:00:00Z"
}
```

Geração (primeira execução):

```typescript
const uuid = crypto.randomUUID() // ex: 8f72c91a-...
const machineId = `machine_${uuid.split('-')[0]}` // ex: machine_8f72c91a
```

Armazenado em `config.json` e nunca alterado.

### Por que não usar hostname?

- Usuário pode mudar nome do PC
- Múltiplos PCs podem ter nomes genéricos (DESKTOP-123)
- Machine ID garante identidade permanente

---

# 24. Logs

O Agent deve possuir logs úteis.

Local padrão:

```text
%LOCALAPPDATA%\StreamDeck\logs\
```

Estrutura:

```text
logs/
├── agent.log (todas as mensagens)
├── error.log (apenas erros)
└── archive/
    ├── agent-2025-01-14.log
    └── agent-2025-01-13.log
```

### Níveis de log

```text
[TRACE] - Detalhes de execução (desabilitado por padrão)
[DEBUG] - Informações de debug
[INFO]  - Informações importantes
[WARN]  - Avisos
[ERROR] - Erros
[FATAL] - Erros críticos que causam encerramento
```

Padrão: `INFO`

Configurável em settings.

### Exemplos de logs

**Inicialização:**

```text
[INFO] Stream Deck Agent started
[INFO] Version: 1.0.0
[INFO] Machine: Victor-PC (machine_8f72c91a)
[INFO] Protocol version: 1
[INFO] WebSocket listening on port 38421
[INFO] mDNS registered: _streamdeck._tcp
[INFO] Loaded 6 applications
[INFO] Ready for connections
```

**Conexão:**

```text
[INFO] New WebSocket connection from 192.168.1.100:54321
[INFO] Client handshake: machineId=machine_8f72c91a
[INFO] Client identified: iPhone Victor
```

**Execução de ação:**

```text
[INFO] Executing action: open_app
[INFO] Application ID: app_cs2
[INFO] Path: C:\Games\CS2\cs2.exe
[INFO] Process started: PID 5432
[INFO] Action completed successfully
```

**Erro:**

```text
[ERROR] Failed to launch application
[ERROR] Code: APPLICATION_LAUNCH_FAILED
[ERROR] AppID: app_missing
[ERROR] Path not found: C:\Games\Missing\game.exe
[ERROR] Stack: (truncado para brevidade)
```

### Rotação de logs

- Arquivo máximo: 10 MB
- Retenção: 7 dias
- Compressão: .gz de logs antigos

### Nunca logar

- Caminhos sensíveis desnecessariamente
- Tokens de autenticação
- Dados pessoais do usuário

---

# 25. Arquitetura geral

Organizar o projeto para separar claramente responsabilidades:

```text
stream-deck-agent/
│
├── src/
│   ├── core/
│   │   ├── protocol/
│   │   │   ├── types.ts (definições do protocolo)
│   │   │   ├── serializer.ts
│   │   │   └── validator.ts
│   │   ├── actions/
│   │   │   ├── index.ts (registry)
│   │   │   ├── openApp.ts
│   │   │   ├── volume.ts (futuro)
│   │   │   └── keyboard.ts (futuro)
│   │   ├── persistence/
│   │   │   ├── configStore.ts (interface)
│   │   │   └── jsonConfigStore.ts (implementação)
│   │   └── models/
│   │       ├── Agent.ts
│   │       ├── Application.ts
│   │       └── ClientConnection.ts
│   ├── transport/
│   │   ├── websocket/
│   │   │   ├── server.ts
│   │   │   └── connectionManager.ts
│   │   └── mdns/
│   │       ├── advertiser.ts
│   │       └── discovery.ts (mobile)
│   ├── ui/
│   │   └── electron/
│   │       ├── main.ts (process principal)
│   │       ├── preload.ts
│   │       └── renderer/
│   │           ├── components/
│   │           ├── pages/
│   │           ├── hooks/
│   │           └── App.tsx
│   └── platform/
│       └── windows/
│           ├── firewall.ts
│           ├── startup.ts
│           └── processManager.ts
│
├── mobile/
│   ├── src/
│   │   ├── screens/
│   │   │   ├── DiscoveryScreen.tsx
│   │   │   ├── ConnectScreen.tsx
│   │   │   └── ControlScreen.tsx
│   │   ├── services/
│   │   │   ├── mdnsDiscovery.ts
│   │   │   ├── websocketClient.ts
│   │   │   └── agentConnection.ts
│   │   ├── hooks/
│   │   ├── types/
│   │   └── App.tsx
│   ├── app.json (Expo)
│   └── package.json
│
├── shared/
│   └── protocol.ts (tipos compartilhados)
│
├── installers/
│   ├── nsis/
│   │   └── StreamDeckAgent.nsi
│   └── build.sh
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PROTOCOL.md
│   ├── DEVELOPMENT.md
│   └── DEPLOYMENT.md
│
└── package.json (monorepo com workspaces)
```

**Princípios:**

- Lógica de negócio não fica presa à interface
- Dependências fluem inward (UI → Core, não o contrário)
- Persistência injetável
- Transport injetável
- Fácil testar cada camada isoladamente

---

# 26. Testes

Implementar testes de ponta a ponta que validam o fluxo real.

### Tipos de testes

**Unitários (70%)**

```typescript
describe('ActionRegistry', () => {
  it('should execute registered action', async () => {
    const registry = new ActionRegistry()
    const handler = vi.fn()
    registry.register('test', handler)
    
    await registry.execute('test', {})
    
    expect(handler).toHaveBeenCalled()
  })
  
  it('should reject unknown actions', async () => {
    const registry = new ActionRegistry()
    
    await expect(
      registry.execute('unknown', {})
    ).rejects.toThrow('INVALID_ACTION')
  })
})
```

**Integração (20%)**

```typescript
describe('WebSocket Protocol', () => {
  it('should handle full request-response cycle', async () => {
    const server = new WebSocketServer({ port: 8080 })
    const client = new WebSocketClient('ws://localhost:8080')
    
    await client.connect()
    
    const response = await client.request({
      type: 'request',
      action: 'get_apps'
    })
    
    expect(response.success).toBe(true)
    expect(response.data.apps).toBeDefined()
  })
})
```

**E2E (10%)**

```typescript
describe('Stream Deck E2E', () => {
  it('should discover, connect, and execute app', async () => {
    // 1. Iniciar Agent real
    const agent = await startAgent()
    
    // 2. Descobrir via mDNS real
    const services = await discoverServices('_streamdeck._tcp')
    expect(services.length).toBeGreaterThan(0)
    
    // 3. Conectar via WebSocket real
    const client = new WebSocketClient(services[0].address)
    await client.connect()
    
    // 4. Obter apps
    const apps = await client.getApps()
    expect(apps.length).toBeGreaterThan(0)
    
    // 5. Executar app (Notepad)
    const result = await client.execute('app_notepad')
    expect(result.success).toBe(true)
    
    // 6. Verificar que Notepad abriu
    await sleep(2000)
    const notepad = findProcess('notepad.exe')
    expect(notepad).toBeDefined()
  })
})
```

**CI/CD:**

- Testes unitários: rodam em cada commit
- Testes de integração: rodam em cada PR
- Testes E2E: rodam em VM Windows antes de release

---

# 27. Versionamento e atualizações

### Versioning Semântico

`MAJOR.MINOR.PATCH` (ex: 1.2.3)

- **MAJOR**: breaking changes (protocolo incompatível)
- **MINOR**: novas features (backward compatible)
- **PATCH**: bug fixes

### Estratégia de atualização

**Agent:**

1. Verificar atualizações 1x por semana (configurável)
2. Notificar usuário: "Versão 1.2.0 disponível"
3. Oferecer: "Atualizar agora" ou "Depois"
4. Download + instalação em background
5. Reiniciar transparentemente (reconectar se houver móveis conectados)

**Mobile:**

1. App Store/Play Store gerenciam atualizações
2. Compatibilidade com Agent v1 e v2 (pelo protocolo)
3. Se incompatível: mensagem clara + link para atualizar

### Compatibilidade entre versões

```text
Agent v1.0 (protocol v1)
├── Mobile v1.0 ✅
└── Mobile v1.1 ✅

Agent v1.2 (protocol v1, novas ações)
├── Mobile v1.0 ✅ (ações antigas funcionam)
└── Mobile v1.1 ✅

Agent v2.0 (protocol v2, mudança major)
├── Mobile v1.0 ❌ (erro: incompatible protocol)
└── Mobile v2.0 ✅
```

### Changelog automático

Gerar changelog de cada release:

```markdown
# v1.2.0 (15 jan 2025)

## ✨ Novidades
- Volume control (ajuste de volume do PC)
- Reconexão melhorada com backoff progressivo

## 🐛 Correções
- Crash ao desconectar múltiplos clientes
- Erro em aplicativos com espaços no caminho

## 🔒 Segurança
- Validação de path aprimorada

## 📈 Performance
- Reduzido uso de memória em conexões longas
```

---

# 28. Distribuição

### Estratégia inicial

**Windows Agent:**
1. GitHub Releases (download manual)
2. Instalador NSIS (.exe)
3. Versão portável (.zip)
4. Futuro: Winget, Microsoft Store

**Mobile:**
1. TestFlight (iOS)
2. Google Play Internal Testing (Android)
3. Futuro: App Store, Play Store

### Segurança do instalador

- Assinar .exe com certificado (futuro)
- Hash SHA256 publicado
- Verificação de integridade no instalador

---

# 29. Documentação

Criar documentação clara:

**User:**

- `README.md`: instalação e início rápido
- `TROUBLESHOOTING.md`: problemas comuns
- `FEATURES.md`: o que o produto faz

**Developer:**

- `ARCHITECTURE.md`: estrutura técnica
- `PROTOCOL.md`: especificação completa do protocolo
- `DEVELOPMENT.md`: como configurar ambiente de dev
- `CONTRIBUTING.md`: como contribuir

**Operator:**

- `DEPLOYMENT.md`: como gerar releases
- `CI_CD.md`: como rodam os testes

---

# 30. Futuras funcionalidades (preparadas, não implementadas)

### Sistema de ações expandido

```text
open_app          ← implementado
volume_control    ← preparado
keyboard_shortcut ← preparado
open_url          ← preparado
obs_control       ← preparado
media_control     ← preparado
script_execution  ← preparado
```

### Páginas

Um painel pode ter múltiplas páginas (Gaming, Streaming, Trabalho).

```typescript
interface Page {
  id: string
  name: string
  apps: App[]
}
```

### Pastas

Agrupar aplicativos em pastas na UI.

### Multi-action

Um botão executar múltiplas ações em sequência.

### Backup & Sync

Sincronizar configuração entre múltiplos PCs.

**Arquitetura preparada para tudo isso** – basta adicionar handlers e UI.

---

# 31. Qualidade do código

Quero código de produção.

Não quero:

* ❌ código descartável
* ❌ arquivos gigantes (> 500 linhas)
* ❌ funções com centenas de linhas
* ❌ lógica de negócio dentro da UI
* ❌ `any` indiscriminado
* ❌ TODOs substituindo funcionalidades
* ❌ mocks fingindo funcionalidades reais
* ❌ dados hardcoded onde deveria existir persistência
* ❌ soluções temporárias apresentadas como definitivas

Utilizar:

* ✅ TypeScript strict mode
* ✅ Validação de entrada (Zod ou similiar)
* ✅ Tratamento de erros robusto
* ✅ Tipos bem definidos
* ✅ Testes para componentes importantes
* ✅ ESLint + Prettier (código formatado)
* ✅ Documentação inline onde necessário
* ✅ Logging estruturado
* ✅ Separação de responsabilidades

---

# 32. Posicionamento do projeto

### Público ou privado?

Este é um projeto **pessoal** com potencial para compartilhar com amigos.

**Decisões baseadas nisso:**

- ✅ Não há telemetria ou analytics
- ✅ Código pode ser aberto futuramente
- ✅ Documentação clara para futuros contribuidores
- ✅ Foco em qualidade, não em escala
- ✅ Sem dependências de serviços cloud
- ✅ Tudo roda offline (rede local)

---

# 33. Primeiro comportamento que deve funcionar

Depois de instalar o Agent:

```text
1. ✅ Abrir Agent
2. ✅ Adicionar "Bloco de Notas"
3. ✅ Selecionar notepad.exe
4. ✅ Salvar
5. ✅ Abrir aplicativo mobile
6. ✅ Encontrar computador automaticamente (mDNS)
7. ✅ Conectar (WebSocket)
8. ✅ Receber "Bloco de Notas" (lista de apps)
9. ✅ Mostrar botão
10. ✅ Tocar no botão
11. ✅ Agent executar notepad.exe
12. ✅ Bloco de Notas abrir
```

**Este fluxo precisa funcionar de ponta a ponta:**
- Em uma máquina Windows real
- Em um celular real (iOS ou Android)
- Sem simular comunicação
- Sem usar mocks para WebSocket ou mDNS
- Com logging adequado para debug

---

# 34. Resultado esperado

Ao final desta implementação quero ter um produto funcional composto por:

```text
                    STREAM DECK
                         │
             ┌───────────┴───────────┐
             │                       │
             ▼                       ▼
       💻 Windows Agent          📱 Mobile
             │                       │
             │                       │
      Configura aplicativos     Descobre PC
             │                       │
             │                       │
             └────── WebSocket ──────┘
                         │
                         ▼
                  Executa aplicativo
```

### O usuário não precisa entender:

* IP
* Porta
* WebSocket
* mDNS
* Firewall
* Rede
* Protocolo
* Autenticação

### A experiência desejada é:

> **Instala o Agent → configura os aplicativos → abre o app no celular → encontra o PC → conecta → toca no aplicativo → ele abre no PC.**

### Esse é o primeiro produto real.

Depois que essa base estiver funcionando, novas capacidades poderão ser adicionadas sem precisar reescrever a arquitetura.

---

# Instruções para o desenvolvimento

Antes de começar a implementar:

1. ✅ Analise os requisitos
2. ✅ Proponha a arquitetura final
3. ✅ Explique as principais decisões técnicas
4. ✅ Mostre a estrutura de diretórios
5. ✅ Explique como o mDNS funcionará no Windows, iOS e Android
6. ✅ Explique como o WebSocket será protegido (autenticação com machineId)
7. ✅ Explique como será a persistência (JSON com backup automático)
8. ✅ Explique como o Agent será instalado (NSIS) e iniciado com o Windows
9. ✅ Explique como o firewall será tratado (exceção automática no instalador)
10. ✅ Explique como o protocolo poderá evoluir (versionamento, backward compatibility)

Depois dessa análise, implemente o projeto completo.

Não pare em exemplos ou pseudocódigo.

Quero os arquivos reais, código funcional e instruções para executar, testar e gerar o instalador do Agent.

---

# Tecnologias finais

## Agent (Windows)

```text
Electron (aplicação desktop)
React (UI)
TypeScript (tipo-seguro)
Node.js 18+ (runtime)
ws (WebSocket)
bonjour-service (mDNS)
Windows API (native bindings)
NSIS (instalador)
```

## Mobile (iOS + Android)

```text
React Native
Expo
TypeScript
react-native-mdns-discovery (mDNS)
react-native-websocket
```

## Compartilhado

```text
TypeScript (tipos compartilhados)
Zod (validação)
```

---

**Status: Pronto para início da implementação** ✅