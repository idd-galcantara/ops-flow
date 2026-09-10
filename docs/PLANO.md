# ops-flow — Plano de Desenvolvimento

Visualização unificada e read-only de recursos Kubernetes (pods, describe, métricas, logs)
agregados de **múltiplos clusters e múltiplos namespaces** ao mesmo tempo, por uma interface web local.

## Problema

O trabalho diário exige inspecionar o mesmo tipo de recurso espalhado por vários clusters e
namespaces, hoje via `kubectl` repetido, um context de cada vez:

```
kubectl get pods --context kubernetes-qa-tb -n bank-overdraft
kubectl get pods --context kubernetes-qa-gt -n bank-overdraft
```

Falta uma visão única, organizada e fácil, sem trocar de context na mão.

## Objetivo

Uma app **local** (uso pessoal, sem multiusuário) que:

- Recebe uma lista flexível de alvos `(cluster, namespace)`.
- Faz fan-out em paralelo em cada alvo usando o `~/.kube/config` existente.
- Exibe os pods numa visão unificada, com agrupamento configurável (por namespace, por cluster ou flat).
- Permite drill-down num pod: `describe`, métricas (CPU/memória) e logs em streaming.
- É **read-only** no MVP (sem restart, scale, exec ou qualquer mutação).

## Modelo de dados central

A unidade de consulta é o **par (cluster, namespace)**. O front envia uma lista de alvos:

```json
{
  "targets": [
    { "cluster": "kubernetes-qa-tb", "namespace": "bank-overdraft" },
    { "cluster": "kubernetes-qa-gt", "namespace": "bank-overdraft" },
    { "cluster": "kubernetes-qa-gt", "namespace": "bank-payments" }
  ]
}
```

Cada item retornado é anotado com `cluster` e `namespace` na origem, então o front pode
agrupar/filtrar por qualquer dimensão sem ambiguidade.

## Stack

- **Backend:** Node + TypeScript, Express, `@kubernetes/client-node`, `ws` (WebSocket para logs).
- **Frontend:** React + Vite + TypeScript.
- **Layout:** monorepo simples (`/backend`, `/frontend`) na raiz do projeto.
- Sem Go (não instalado); Node 25 já disponível localmente.

## API do MVP

```
GET  /api/contexts
     → lista os contexts disponíveis no kubeconfig

POST /api/pods
     body: { targets: [{ cluster, namespace }, ...] }
     → pods de todos os pares, cada um anotado com { cluster, namespace }
       campos: nome, status, ready, restarts, node, idade, containers

GET  /api/pods/:cluster/:namespace/:pod/describe
     → detalhes do pod (equivalente ao describe)

GET  /api/pods/:cluster/:namespace/:pod/metrics
     → CPU/memória via metrics.k8s.io (quando o metrics-server existir no cluster)

WS   /api/pods/:cluster/:namespace/:pod/logs?container=<c>&follow=true&tailLines=500
     → stream de logs do container
```

## Fluxo de dados

```
Browser (React)
   │  POST /api/pods { targets: [{cluster, namespace}...] }
   ▼
Backend (Node)
   ├── task → client(kubernetes-qa-tb, bank-overdraft) → pods
   ├── task → client(kubernetes-qa-gt, bank-overdraft) → pods
   └── task → client(kubernetes-qa-gt, bank-payments)  → pods
   ▼  merge; cada item recebe { cluster, namespace }
Browser: visão unificada com agrupamento (namespace | cluster | flat),
         filtros e drill-down → describe / métricas / logs (WebSocket)
```

## Desenvolvimento por partes (fases)

### Fase 0 — Fundação do projeto
- Estrutura do monorepo (`/backend`, `/frontend`).
- Configs de TypeScript, lint, scripts de dev.
- Backend "hello" respondendo em `localhost` e front conectando.
- **Entregável:** `npm run dev` sobe backend + front vazios.

### Fase 1 — Kubeconfig e contexts (backend)
- Carregar `~/.kube/config`, listar contexts.
- Endpoint `GET /api/contexts`.
- Factory de client por context (cache de clients por cluster).
- **Entregável:** `curl /api/contexts` retorna os contexts reais.

### Fase 2 — Fan-out de pods (backend)
- `POST /api/pods` recebe lista de alvos e faz fan-out paralelo.
- Cada pod anotado com `{ cluster, namespace }`; normalização dos campos.
- Tolerância a falha parcial: um alvo que falha não derruba os outros (retorna erro por alvo).
- **Entregável:** `curl` com 2+ alvos retorna pods unificados.

### Fase 3 — Seleção de alvos e tabela unificada (frontend)
- UI para escolher contexts + digitar namespaces e montar a lista de alvos.
- Tabela unificada com colunas Cluster, Namespace, Pod, Status, Ready, Restarts, Idade.
- Agrupamento configurável (por namespace | por cluster | flat) + filtro de texto.
- **Entregável:** visão unificada dos pods de múltiplos alvos na tela.

### Fase 4 — Drill-down: describe e métricas
- `GET .../describe` e `GET .../metrics` no backend.
- Painel de detalhes do pod no front (aba describe + aba métricas).
- Degradação graciosa quando o cluster não tem metrics-server.
- **Entregável:** clicar num pod mostra detalhes e métricas.

### Fase 5 — Logs em streaming
- WebSocket `.../logs` com seleção de container, follow e tailLines.
- Visualizador de logs no front (auto-scroll, pausar, limpar, filtro).
- **Entregável:** logs ao vivo de um container pela interface.

### Fase 6 — Polimento
- Auto-refresh/watch opcional da lista de pods.
- Presets de alvos salvos localmente (ex.: "QA overdraft = tb+gt").
- Tratamento de erros e estados de loading consistentes.
- **Entregável:** MVP fluido e usável no dia a dia.

## Margem de melhoria (pós-MVP)

- Outros recursos: deployments, services, events, configmaps.
- Watch em tempo real (informers) em vez de polling.
- Busca global por label/selector cross-cluster.
- Comparação lado a lado do mesmo recurso entre clusters (diff).
- Exportar describe/logs.
- Ações (restart, scale, exec) — atrás de um toggle explícito e confirmação, quando fizer sentido.

## Restrições e decisões

- **Uso local**: sem autenticação própria; confia no kubeconfig do usuário.
- **Read-only** no MVP: nenhuma operação de mutação é exposta.
- Falha de um alvo é isolada e reportada, nunca quebra a agregação inteira.
- O backend nunca ecoa segredos do kubeconfig; contexts são referenciados por nome.

## Nota de ambiente: cadeia de CA e TLS

Durante a Fase 2 o fan-out falhava em todos os alvos com `UNABLE_TO_GET_ISSUER_CERT`,
embora o `kubectl` funcionasse com o mesmo kubeconfig. Causa raiz:

- Os clusters apresentam **apenas o certificado folha**.
- O `certificate-authority-data` do kubeconfig contém somente a CA **intermediária**
  (ex.: `CN = kubernetes-qa-tb CA`).
- Os emissores acima dela — `SSL Kubernetes CA v1` → `PagPKI Root CA v1` — vivem no
  **trust store do sistema** (`/etc/ssl/certs/ca-certificates.crt`).
- O `@kubernetes/client-node` monta seu agente HTTPS a partir do `caData` apenas, então
  a cadeia ficava incompleta e o handshake falhava.

**Solução aplicada** (`backend/src/kube/caChain.ts`): compor a cadeia completa concatenando
a CA do kubeconfig com o bundle de CAs do sistema, e injetá-la no cluster carregado antes
de criar o client.

Importante:
- A **verificação TLS permanece totalmente ativa** — não usamos `skipTLSVerify` nem
  `NODE_TLS_REJECT_UNAUTHORIZED`.
- O trust store do sistema é apenas **lido**; nada no ambiente do usuário é alterado.
- Se nenhum bundle do sistema for legível, a CA do kubeconfig é usada como está.

## Nota de ambiente: sidecars nativos (Istio)

O `istio-proxy` é injetado como **init container com `restartPolicy: Always`** (sidecar
nativo, Kubernetes 1.29+). O `kubectl` conta esses sidecars nas colunas `READY` e
`RESTARTS`. A normalização do ops-flow faz o mesmo, garantindo paridade com o terminal,
e expõe o sidecar na lista de containers para seleção de logs.

## Nota de escala: paginação de linhas na tabela

Na validação da Fase 3, incluir `kube-system` entre os alvos trouxe **1339 pods** num
único grupo. Renderizar tudo de uma vez colocaria dezenas de milhares de nós no DOM e
travaria a interface.

A tabela passa a renderizar **100 linhas por grupo**, com ações "Mostrar mais" e
"Mostrar todos" no rodapé de cada grupo. O agrupamento e os contadores continuam
refletindo o total real — nenhum pod é descartado, apenas a renderização é adiada.
