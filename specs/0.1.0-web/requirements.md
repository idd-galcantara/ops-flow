# Requirements — ops-flow MVP

## Introdução

O ops-flow é uma aplicação web **local** e **read-only** que oferece uma visão unificada de
recursos Kubernetes (pods, describe, métricas e logs) agregados de **múltiplos clusters** e
**múltiplos namespaces** simultaneamente. Substitui a repetição manual de `kubectl` por context,
permitindo inspecionar, por exemplo, os pods de `bank-overdraft` em `kubernetes-qa-tb` e
`kubernetes-qa-gt` numa única tela.

A unidade de consulta é o par `(cluster, namespace)`. O frontend envia uma lista flexível de
alvos e o backend faz fan-out em paralelo usando o `~/.kube/config` do usuário.

## Glossário

- **Alvo (target):** um par `(cluster, namespace)`.
- **Fan-out:** disparo paralelo de uma consulta contra vários alvos.
- **Falha parcial:** situação em que um ou mais alvos falham enquanto outros retornam com sucesso.

## Requisitos

### Requisito 1 — Descoberta de contexts

**User story:** Como usuário, quero listar os contexts do meu kubeconfig, para escolher de quais
clusters vou consultar recursos.

#### Acceptance Criteria
1. WHEN o cliente requisita `GET /api/contexts` THEN o sistema SHALL retornar a lista de nomes de contexts presentes no `~/.kube/config`.
2. WHEN o kubeconfig não existir ou não puder ser lido THEN o sistema SHALL retornar um erro claro sem expor caminhos de credenciais.
3. The system SHALL NOT incluir tokens, certificados ou quaisquer segredos na resposta de contexts.

### Requisito 2 — Consulta unificada de pods (fan-out)

**User story:** Como usuário, quero enviar uma lista de pares (cluster, namespace) e receber os
pods de todos eles numa resposta única, para visualizar recursos de vários clusters/namespaces junto.

#### Acceptance Criteria
1. WHEN o cliente envia `POST /api/pods` com `{ targets: [{cluster, namespace}, ...] }` THEN o sistema SHALL consultar todos os alvos em paralelo.
2. WHEN um pod é retornado THEN o sistema SHALL anotá-lo com `cluster` e `namespace` de origem.
3. WHEN um pod é retornado THEN o sistema SHALL normalizar os campos: nome, status, ready, restarts, node, idade e containers.
4. IF um alvo falha (cluster inacessível, auth inválida, namespace inexistente) THEN o sistema SHALL isolar a falha e retornar um erro por alvo, mantendo os resultados dos alvos bem-sucedidos.
5. WHEN a lista de `targets` está vazia ou malformada THEN o sistema SHALL retornar erro de validação 4xx.

### Requisito 3 — Seleção de alvos e visão unificada

**User story:** Como usuário, quero montar minha lista de alvos e ver os pods numa tabela
organizada, para inspecionar tudo sem trocar de context manualmente.

#### Acceptance Criteria
1. WHEN a interface carrega THEN o sistema SHALL exibir os contexts disponíveis para seleção.
2. WHEN o usuário adiciona pares (cluster, namespace) THEN o sistema SHALL permitir montar uma lista com múltiplos alvos, incluindo múltiplos namespaces no mesmo cluster.
3. WHEN os pods retornam THEN o sistema SHALL exibi-los numa tabela com colunas Cluster, Namespace, Pod, Status, Ready, Restarts e Idade.
4. WHEN o usuário escolhe um agrupamento THEN o sistema SHALL suportar agrupar por namespace, por cluster, ou visão flat.
5. WHEN o usuário digita um filtro THEN o sistema SHALL filtrar as linhas exibidas por texto.
6. IF um alvo retornou erro THEN o sistema SHALL sinalizar esse erro na interface sem esconder os resultados válidos.

### Requisito 4 — Detalhes e métricas do pod

**User story:** Como usuário, quero abrir um pod e ver seu describe e métricas, para entender seu
estado sem sair da ferramenta.

#### Acceptance Criteria
1. WHEN o cliente requisita `GET /api/pods/:cluster/:namespace/:pod/describe` THEN o sistema SHALL retornar os detalhes do pod equivalentes ao describe.
2. WHEN o cliente requisita `GET /api/pods/:cluster/:namespace/:pod/metrics` THEN o sistema SHALL retornar CPU e memória via `metrics.k8s.io`.
3. IF o cluster não possui metrics-server THEN o sistema SHALL degradar graciosamente, indicando que métricas estão indisponíveis, sem quebrar a tela de detalhes.

### Requisito 5 — Logs em streaming

**User story:** Como usuário, quero ver os logs de um container ao vivo, para acompanhar o
comportamento da aplicação em tempo real.

#### Acceptance Criteria
1. WHEN o cliente conecta em `WS /api/pods/:cluster/:namespace/:pod/logs` com `container`, `follow` e `tailLines` THEN o sistema SHALL transmitir as linhas de log do container.
2. WHEN `follow=true` THEN o sistema SHALL continuar enviando novas linhas até o cliente desconectar.
3. WHEN o cliente desconecta THEN o sistema SHALL encerrar o stream e liberar os recursos.
4. WHEN o pod tem múltiplos containers THEN o sistema SHALL permitir escolher qual container acompanhar.

### Requisito 6 — Read-only e segurança (transversal)

**User story:** Como usuário, quero garantia de que a ferramenta nunca altera meus clusters, para
usá-la com segurança em qualquer ambiente.

#### Acceptance Criteria
1. The system SHALL expor exclusivamente operações de leitura (list/get/watch/log). Nenhum endpoint SHALL executar restart, scale, exec, delete, apply ou patch.
2. The system SHALL NOT registrar, retornar ou persistir segredos do kubeconfig.
3. The system SHALL rodar apenas em `localhost` no MVP, sem autenticação própria, confiando no kubeconfig do usuário.

### Requisito 7 — Fundação e experiência de desenvolvimento

**User story:** Como desenvolvedor, quero um monorepo com scripts claros, para subir backend e
frontend com facilidade.

#### Acceptance Criteria
1. The system SHALL organizar o código em `/backend` e `/frontend` na raiz do projeto.
2. WHEN o desenvolvedor roda o script de dev THEN o sistema SHALL subir backend e frontend localmente.
3. The system SHALL usar TypeScript no backend e no frontend, com lint e build configurados.
