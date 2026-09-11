# Implementation Plan — ops-flow MVP

Cada tarefa aponta o **Copilot custom agent responsável**: `@ops-flow-backend`,
`@ops-flow-frontend` ou `@ops-flow-integration-qa`. As tarefas seguem as fases do `docs/PLANO.md` e
são incrementais — cada uma constrói sobre a anterior.

## Fase 0 — Fundação

- [x] 1. Estruturar o monorepo e as configs base
  - Criar `/backend` e `/frontend` com TypeScript, lint e scripts de dev.
  - Backend "hello" respondendo em `localhost`; frontend Vite conectando ao backend.
  - Script de dev único que sobe backend + frontend.
  - _Copilot agents: @ops-flow-backend (backend + raiz), @ops-flow-frontend (frontend)_
  - _Requirements: 7.1, 7.2, 7.3_

## Fase 1 — Kubeconfig e contexts

- [x] 2. Loader de kubeconfig e factory de client
  - Carregar `~/.kube/config`; extrair apenas nomes de contexts (sem segredos).
  - Factory de client por context com cache por cluster.
  - _Copilot agent: @ops-flow-backend_
  - _Requirements: 1.1, 1.3, 6.2_

- [x] 3. Endpoint `GET /api/contexts`
  - Retornar lista de contexts; erro claro e higienizado se o kubeconfig faltar.
  - _Copilot agent: @ops-flow-backend_
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3.1 Validar contexts contra o ambiente real
  - `curl /api/contexts` deve refletir os contexts reais do usuário; confirmar ausência de segredos na resposta.
  - _Copilot agent: @ops-flow-integration-qa_
  - _Requirements: 1.1, 1.3_

## Fase 2 — Fan-out de pods

- [x] 4. Serviço de fan-out com tolerância a falha parcial
  - `Promise.allSettled` sobre os alvos; coletar `pods` e `errors[]` por alvo.
  - Higienizar mensagens de erro (sem segredos/caminhos sensíveis).
  - _Copilot agent: @ops-flow-backend_
  - _Requirements: 2.1, 2.4, 6.2_

- [x] 5. Normalização de pod e anotação de origem
  - Mapear para `NormalizedPod` (nome, status, ready, restarts, node, ageSeconds, containers).
  - Anotar cada pod com `{ cluster, namespace }`.
  - _Copilot agent: @ops-flow-backend_
  - _Requirements: 2.2, 2.3_

- [x] 6. Endpoint `POST /api/pods` + validação de entrada
  - Validar `targets`; 4xx para lista vazia/malformada; 200 com `{pods, errors}`.
  - _Copilot agent: @ops-flow-backend_
  - _Requirements: 2.1, 2.5_

- [x] 6.1 Testes unitários de fan-out e normalização
  - Cobrir falha parcial (um alvo falha, outros ok) e mapeamento de campos.
  - _Copilot agent: @ops-flow-backend_
  - _Requirements: 2.2, 2.3, 2.4_

- [x] 6.2 Validar fan-out contra clusters reais
  - `POST /api/pods` com `kubernetes-qa-tb` e `kubernetes-qa-gt` em `bank-overdraft`; conferir unificação e isolamento de falha.
  - _Copilot agent: @ops-flow-integration-qa_
  - _Requirements: 2.1, 2.2, 2.4_

## Fase 3 — Seleção de alvos e tabela unificada

- [x] 7. `TargetSelector` (frontend)
  - Carregar contexts de `/api/contexts`; montar lista de pares (cluster, namespace), incluindo múltiplos namespaces no mesmo cluster.
  - _Copilot agent: @ops-flow-frontend_
  - _Requirements: 3.1, 3.2_

- [x] 8. `PodTable` unificada + estados de erro por alvo
  - Colunas Cluster/Namespace/Pod/Status/Ready/Restarts/Idade; `TargetErrorBanner` sem esconder resultados válidos.
  - _Copilot agent: @ops-flow-frontend_
  - _Requirements: 3.3, 3.6_

- [x] 9. `GroupingControl` + `FilterBar`
  - Agrupar por namespace | por cluster | flat; filtro textual.
  - _Copilot agent: @ops-flow-frontend_
  - _Requirements: 3.4, 3.5_

- [x] 9.1 Validar visão unificada ponta a ponta
  - Verificar múltiplos clusters + múltiplos namespaces na tela e troca de agrupamento.
  - _Copilot agent: @ops-flow-integration-qa_
  - _Requirements: 3.2, 3.3, 3.4_

## Fase 4 — Describe e métricas

- [x] 10. Endpoints `describe` e `metrics` (backend)
  - `GET .../describe`; `GET .../metrics` via `metrics.k8s.io` com `{available:false}` quando não houver metrics-server.
  - _Copilot agent: @ops-flow-backend_
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 11. `PodDetailsPanel` (frontend)
  - Abas Describe e Metrics; mensagem clara quando métricas indisponíveis.
  - _Copilot agent: @ops-flow-frontend_
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 11.1 Validar degradação sem metrics-server
  - Testar em cluster sem metrics-server e confirmar que a tela não quebra.
  - _Copilot agent: @ops-flow-integration-qa_
  - _Requirements: 4.3_

## Fase 5 — Logs em streaming

- [x] 12. WebSocket de logs (backend)
  - `WS .../logs` com container/follow/tailLines; abortar o stream ao fechar o socket.
  - _Copilot agent: @ops-flow-backend_
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 13. `LogViewer` (frontend)
  - Conectar no WebSocket; seleção de container, auto-scroll, pausar, limpar, filtro.
  - _Copilot agent: @ops-flow-frontend_
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 13.1 Validar logs ao vivo
  - Acompanhar logs de um pod real; confirmar encerramento limpo ao desconectar.
  - _Copilot agent: @ops-flow-integration-qa_
  - _Requirements: 5.1, 5.2, 5.3_

## Fase 6 — Polimento e garantia read-only

- [x] 14. Auto-refresh opcional e presets de alvos
  - Refresh opcional da lista; salvar/carregar presets de alvos localmente.
  - _Copilot agent: @ops-flow-frontend_
  - _Requirements: 3.2_

- [x] 15. Estados de loading/erro consistentes
  - Padronizar loading e mensagens de erro em toda a UI.
  - _Copilot agent: @ops-flow-frontend_
  - _Requirements: 3.6, 4.3_

- [x] 16. Auditoria read-only ponta a ponta
  - Revisar backend e front: nenhum método de mutação exposto/chamado; nenhum segredo logado/retornado; app só em localhost.
  - _Copilot agent: @ops-flow-integration-qa_
  - _Requirements: 6.1, 6.2, 6.3_
