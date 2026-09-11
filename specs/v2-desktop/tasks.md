# Implementation Plan — ops-flow v2 desktop

As tarefas abaixo evoluem a aplicação web da V1 para uma distribuição desktop multiplataforma.
Cada etapa deve preservar o comportamento existente e manter o projeto executável em modo web
durante o desenvolvimento.

## Step 1 — Resolver e loader de kubeconfig

- [x] Extrair a descoberta do kubeconfig para um módulo backend dedicado.
  - [x] Respeitar `KUBECONFIG` quando definida.
  - [x] Usar o caminho padrão do Linux e do Windows quando a variável não existir.
  - [x] Aceitar um caminho selecionado explicitamente pelo aplicativo.
- [x] Manter o carregamento lazy, o cache por context e a aplicação da cadeia de CA da V1.
- [x] Implementar recarga segura da configuração e limpeza dos caches de clients.
- [x] Adicionar testes unitários para prioridade de fontes, arquivo ausente, arquivo inválido e
  troca de configuração.
- _Copilot agent: @ops-flow-backend_
- _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 2.4_

## Step 2 — Status e contrato de configuração

- [x] Criar `GET /api/kubeconfig/status` com resposta sem segredos.
- [x] Definir a operação interna de selecionar/recarregar kubeconfig sem expor o conteúdo ao
  renderer.
- [x] Preservar `GET /api/contexts` e retornar erro sanitizado quando a configuração estiver
  indisponível.
- [x] Adicionar testes de status, recarga, erro e não exposição de caminhos ou credenciais
  sensíveis.
- _Copilot agent: @ops-flow-backend_
- _Requirements: 2.1, 2.3, 2.5, 6.1, 6.5_

## Step 3 — Shell Electron e ciclo de vida

- [x] Adicionar o workspace ou pacote desktop com Electron, TypeScript e preload seguro.
- [x] Iniciar o backend como processo filho e aguardar `/api/health` antes de abrir a janela.
- [x] Carregar o build do frontend na janela Electron, mantendo o Vite para desenvolvimento.
- [x] Encerrar o backend, WebSocket e recursos associados quando a janela for fechada.
- [x] Impedir duas instâncias conflitantes ou apresentar uma mensagem clara ao usuário.
- [x] Manter o backend vinculado a `127.0.0.1`.
- _Copilot agents: @ops-flow-backend, @ops-flow-frontend_
- _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.4_

## Step 4 — Seleção manual e preferências

- [x] Criar o estado de configuração inicial na interface.
  - Carregando.
  - Kubeconfig encontrado.
  - Kubeconfig ausente.
  - Arquivo inválido ou inacessível.
- [x] Adicionar uma ação **Selecionar kubeconfig** para abrir o diálogo nativo por meio do
  preload.
- [x] Recarregar contexts e namespaces após uma seleção válida sem recarregar a aplicação inteira.
- [x] Persistir apenas o caminho escolhido e preferências mínimas do aplicativo.
- [x] Exibir mensagens úteis sem mostrar tokens, certificados ou conteúdo do arquivo.
- _Copilot agent: @ops-flow-frontend_
- _Requirements: 2.2, 2.3, 4.1, 4.2, 4.3, 4.4, 4.5_

## Step 5 — Build e distribuição multiplataforma

- [ ] Configurar build de produção do frontend, backend e Electron em uma sequência reproduzível.
- [ ] Configurar `electron-builder` para gerar instalador Windows `.exe`.
- [ ] Configurar artefato Linux `.AppImage` e avaliar geração de `.deb`.
- [ ] Incluir o runtime e os arquivos compilados necessários no pacote, sem incluir o kubeconfig
  do desenvolvedor.
- [ ] Criar nome, ícone, versão e atalhos do aplicativo para cada plataforma.
- [ ] Documentar o processo de geração dos artefatos e os requisitos de assinatura quando
  aplicável.
- _Copilot agent: @ops-flow-backend_
- _Requirements: 5.1, 5.2, 5.3, 5.4, 6.3_

## Step 6 — Validação final e garantia read-only

- [ ] Testar a abertura, consulta e encerramento do aplicativo em Linux.
- [ ] Testar a instalação, abertura e encerramento do instalador em Windows.
- [ ] Validar kubeconfig no caminho padrão, via `KUBECONFIG` e por seleção manual.
- [ ] Validar configurações com múltiplos contexts e autenticação `exec`, documentando a
  necessidade de executáveis externos quando aplicável.
- [ ] Reexecutar os testes da V1 e os testes específicos da V2.
- [ ] Auditar rotas HTTP, WebSocket, preload e processos para confirmar que nenhuma operação
  mutável foi adicionada.
- [ ] Confirmar que logs, erros e respostas nunca expõem segredos do kubeconfig.
- _Copilot agent: @ops-flow-integration-qa_
- _Requirements: 1.1-1.5, 2.1-2.5, 3.1-3.5, 4.1-4.5, 5.1-5.5, 6.1-6.5_