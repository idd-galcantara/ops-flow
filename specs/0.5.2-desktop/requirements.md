# Requirements — ops-union v2 desktop

## Introdução

O ops-union v2 deve distribuir a aplicação local da V1 como um aplicativo desktop para Windows e
Linux. O usuário abre o programa pelo menu do sistema, consulta os clusters por meio do seu
kubeconfig e fecha a janela sem executar comandos manualmente.

A aplicação continua estritamente local e read-only. O desktop shell simplifica a inicialização,
mas não amplia as permissões da ferramenta sobre os clusters.

## Glossário

- **Kubeconfig disponível:** configuração encontrada via `KUBECONFIG`, caminho padrão ou seleção
  manual.
- **Fonte:** origem usada para encontrar a configuração: `environment`, `default` ou `selected`.
- **Desktop shell:** processo Electron que hospeda a interface e controla o backend.
- **Backend filho:** processo Node local iniciado pelo Electron.

## Requisitos

### Requisito 1 — Resolução multiplataforma do kubeconfig

**User story:** Como usuário, quero que o aplicativo encontre meu kubeconfig automaticamente, sem
precisar configurar caminhos manualmente.

#### Acceptance Criteria

1. WHEN `KUBECONFIG` estiver definida THEN o sistema SHALL respeitar essa configuração.
2. WHEN `KUBECONFIG` não estiver definida THEN o sistema SHALL procurar o caminho padrão do
   sistema operacional.
3. WHEN o kubeconfig não existir ou não puder ser lido THEN o sistema SHALL retornar um estado
   claro de configuração ausente, sem expor credenciais ou detalhes sensíveis.
4. O sistema SHALL funcionar com caminhos válidos do Linux e do Windows.
5. O sistema SHALL manter suporte a configurações com múltiplos arquivos quando suportadas pelo
   loader do Kubernetes.

### Requisito 2 — Estado e recarga da configuração

**User story:** Como usuário, quero saber por que não vejo meus contexts e poder corrigir a
configuração sem reiniciar a aplicação.

#### Acceptance Criteria

1. WHEN o cliente requisitar o status do kubeconfig THEN o sistema SHALL informar apenas
   disponibilidade, fonte e dados não sensíveis.
2. WHEN o usuário selecionar um arquivo válido THEN o sistema SHALL recarregar a configuração e
   disponibilizar os contexts sem reiniciar a janela.
3. WHEN o arquivo selecionado for inválido THEN o sistema SHALL exibir uma mensagem clara e
   preservar a configuração anterior válida, quando existir.
4. O sistema SHALL limpar caches de clients associados à configuração anterior após uma troca
   válida.
5. O sistema SHALL NOT retornar, registrar ou persistir tokens, certificados, chaves ou o
   conteúdo completo do kubeconfig.

### Requisito 3 — Experiência desktop

**User story:** Como usuário, quero abrir o ops-union pelo sistema operacional e usá-lo sem
terminal, navegador externo ou comandos de inicialização.

#### Acceptance Criteria

1. WHEN o usuário abrir o aplicativo THEN o Electron SHALL iniciar o backend local
   automaticamente.
2. WHEN o backend estiver saudável THEN o Electron SHALL carregar a interface React na janela.
3. WHEN o usuário fechar a janela THEN o Electron SHALL encerrar o backend filho e seus recursos.
4. O renderer SHALL acessar apenas as APIs expostas pelo preload e as rotas locais da aplicação.
5. O aplicativo SHALL impedir inicializações duplicadas ou informar claramente quando já houver
   uma instância em execução.

### Requisito 4 — Seleção manual e persistência segura

**User story:** Como usuário sem conhecimento de configuração de ambiente, quero escolher meu
kubeconfig por uma janela de arquivos.

#### Acceptance Criteria

1. WHEN nenhum kubeconfig estiver disponível THEN a interface SHALL oferecer a ação de selecionar
   um arquivo.
2. WHEN o usuário solicitar a seleção THEN o Electron SHALL abrir o seletor nativo do sistema.
3. WHEN a seleção for concluída THEN o sistema SHALL validar e carregar o arquivo antes de
   atualizar a interface.
4. O sistema SHALL poder lembrar o caminho selecionado para a próxima execução.
5. A preferência salva SHALL conter apenas o caminho e metadados mínimos, nunca os segredos do
   kubeconfig.

### Requisito 5 — Distribuição Windows e Linux

**User story:** Como usuário, quero instalar o ops-union como um aplicativo comum no meu sistema.

#### Acceptance Criteria

1. O projeto SHALL gerar um instalador executável para Windows.
2. O projeto SHALL gerar pelo menos um artefato instalável ou portátil para Linux.
3. Os pacotes SHALL incluir o runtime necessário para executar o backend sem Node.js instalado.
4. A aplicação empacotada SHALL preservar o acesso ao kubeconfig do usuário.
5. A aplicação SHALL exibir uma mensagem útil quando o kubeconfig depender de um autenticador
   externo ausente.

### Requisito 6 — Compatibilidade e segurança read-only

**User story:** Como usuário, quero a mesma visão da V1 com a garantia de que o aplicativo desktop
não altera meus clusters.

#### Acceptance Criteria

1. O desktop SHALL preservar as rotas e recursos funcionais da V1: contexts, namespaces, pods,
   describe, métricas e logs.
2. O sistema SHALL continuar aceitando apenas operações de leitura, como list, get, watch e log.
3. Nenhuma ponte Electron, rota HTTP ou serviço SHALL expor restart, scale, exec, attach, delete,
   apply, patch, update ou create.
4. O backend SHALL escutar apenas em localhost.
5. O sistema SHALL manter a higienização de erros e a ausência de segredos nas respostas e logs.