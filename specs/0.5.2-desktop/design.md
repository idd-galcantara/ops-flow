# Design — ops-union v2 desktop

## Visão geral

O ops-union v2 transforma a aplicação web local da V1 em um aplicativo desktop para Windows e
Linux. A lógica de consulta Kubernetes continua no backend Node/TypeScript e a interface continua
sendo React. O Electron passa a controlar a janela, o ciclo de vida do backend e os recursos
nativos, como o seletor de arquivos.

O aplicativo continua sendo local e read-only. Não existe servidor externo, banco de dados,
Docker ou dependência de `kubectl` para consultar os clusters.

```text
Aplicativo ops-union
├── Electron main process
│   ├── inicia e encerra o backend local
│   ├── abre a janela da interface
│   ├── exibe o seletor nativo de kubeconfig
│   └── persiste preferências não sensíveis
├── React renderer
│   └── interface existente da V1
└── Backend Node + Express + ws
    ├── resolve e carrega o kubeconfig
    ├── consulta os clusters via client-node
    └── expõe API REST e WebSocket somente localmente
```

## Compatibilidade com a V1

- Os endpoints existentes de contexts, namespaces, pods, describe, metrics e logs permanecem
  compatíveis.
- A lógica de fan-out, normalização, agrupamento e streaming de logs não é reescrita.
- O frontend React existente passa a ser carregado pelo Electron em vez de depender do Vite em
  desenvolvimento.
- O backend continua escutando apenas em `127.0.0.1`.
- O modo web da V1 permanece útil para desenvolvimento e pode continuar sendo executado com
  `npm run dev`.

## Resolução do kubeconfig

O backend centraliza a descoberta em um único loader:

1. Se `KUBECONFIG` estiver definida, usa o comportamento padrão do Kubernetes para carregar sua
   configuração.
2. Caso contrário, procura o caminho padrão do sistema:
   - Linux: `~/.kube/config`;
   - Windows: `%USERPROFILE%\\.kube\\config`.
3. Caso nenhum arquivo esteja disponível, retorna um estado explícito de configuração ausente.
4. Depois que o usuário seleciona um arquivo, o backend pode recarregar a configuração sem
   reiniciar a janela.

O caminho escolhido manualmente pode ser salvo nas preferências do aplicativo, mas o conteúdo do
kubeconfig, tokens, certificados e chaves nunca são persistidos pelo ops-union. A variável
`KUBECONFIG` continua tendo prioridade para manter compatibilidade com usuários avançados.

## Comunicação entre Electron, renderer e backend

- O renderer usa a API HTTP local para contexts, namespaces, pods, detalhes e métricas.
- O renderer usa o WebSocket local para logs.
- O preload expõe apenas operações explícitas e mínimas, como abrir o seletor de arquivo e
  consultar a plataforma.
- O renderer não recebe acesso direto a Node.js, filesystem ou `child_process`.
- O processo principal inicia o backend em uma porta local disponível, injeta a configuração
  selecionada quando necessário e aguarda o health check antes de carregar a janela.
- Ao fechar a janela, o processo principal encerra o backend filho e libera a porta.

## Estado de configuração

O backend oferece uma consulta segura do estado do kubeconfig:

```http
GET /api/kubeconfig/status
```

Exemplo:

```json
{
  "available": true,
  "source": "default",
  "contexts": 3
}
```

O campo `source` pode indicar `environment`, `default` ou `selected`. O caminho completo do
arquivo não precisa ser retornado à interface. Quando não houver configuração, a resposta deve
permitir que a UI mostre uma mensagem clara e ofereça a seleção manual.

## Empacotamento

O `electron-builder` gera artefatos multiplataforma a partir da mesma base:

- Windows: instalador `.exe` e atalho no menu;
- Linux: `.AppImage` para distribuição portátil e, opcionalmente, `.deb`.

O pacote inclui o runtime necessário para o backend. O usuário não precisa instalar Node.js,
executar `npm`, abrir terminal ou gerenciar uma porta manualmente.

Kubeconfigs que usam autenticação `exec` continuam dependendo do executável externo referenciado
por eles. O ops-union deve informar a falha de autenticação de forma segura, sem registrar
credenciais.

## Estratégia de testes

- Unitários: prioridade entre `KUBECONFIG`, caminho padrão e caminho selecionado; estados de
  arquivo ausente e recarga do loader.
- Backend: endpoint de status sem exposição de segredos e preservação das rotas read-only da V1.
- Electron: health check, seleção de arquivo, inicialização e encerramento do backend.
- Frontend: estado sem kubeconfig, seleção concluída, erro de leitura e retorno à lista de
  contexts.
- Empacotamento: instalação e abertura em Windows e Linux, incluindo kubeconfig no caminho padrão.
- Auditoria: nenhum endpoint ou ponte Electron pode executar operações mutáveis ou expor o
  conteúdo do kubeconfig.