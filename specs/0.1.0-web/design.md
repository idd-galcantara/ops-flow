# Design — ops-union MVP

## Visão geral

ops-union é composto por um **backend Node/TypeScript** que agrega recursos Kubernetes de vários
alvos `(cluster, namespace)` e um **frontend React/Vite** que oferece a visão unificada. Tudo roda
local, é read-only e usa o `~/.kube/config` existente.

```
Browser (React + Vite)
   │  REST (contexts, pods, describe, metrics)  +  WebSocket (logs)
   ▼
Backend (Node + Express + ws)
   ├── kubeconfig loader ──► lista de contexts
   ├── client factory (cache por context) ──► @kubernetes/client-node
   └── fan-out service (Promise.allSettled) ──► normalização + anotação {cluster, namespace}
   ▼
Clusters Kubernetes (via kubeconfig)
```

## Arquitetura do backend

Camadas finas, com responsabilidade única:

- **Routes (Express):** validação de entrada, tradução HTTP ↔ serviço.
- **Services:** orquestram o fan-out, a normalização e a agregação.
- **K8s client wrapper:** encapsula `@kubernetes/client-node` (CoreV1Api, Metrics, Log).
- **Kubeconfig loader:** carrega o config uma vez, expõe contexts e cria clients sob demanda.

### Client factory e cache

```ts
// Pseudocódigo
const kc = new KubeConfig();
kc.loadFromDefault(); // ~/.kube/config

const clientCache = new Map<string, CoreV1Api>();

function clientFor(context: string): CoreV1Api {
  if (!clientCache.has(context)) {
    const scoped = new KubeConfig();
    scoped.loadFromDefault();
    scoped.setCurrentContext(context);
    clientCache.set(context, scoped.makeApiClient(CoreV1Api));
  }
  return clientCache.get(context)!;
}
```

### Fan-out com tolerância a falha parcial

```ts
async function getPods(targets: Target[]): Promise<FanOutResult> {
  const settled = await Promise.allSettled(
    targets.map(async (t) => {
      const api = clientFor(t.cluster);
      const res = await api.listNamespacedPod({ namespace: t.namespace });
      return res.items.map((p) => normalizePod(p, t)); // anota {cluster, namespace}
    })
  );

  const pods: NormalizedPod[] = [];
  const errors: TargetError[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") pods.push(...r.value);
    else errors.push({ target: targets[i], message: safeMessage(r.reason) });
  });
  return { pods, errors };
}
```

`safeMessage` remove qualquer conteúdo sensível antes de retornar.

### Normalização de pod

```ts
interface NormalizedPod {
  cluster: string;
  namespace: string;
  name: string;
  status: string;         // phase + razão (ex.: Running, CrashLoopBackOff)
  ready: string;          // "2/3"
  restarts: number;
  node: string;
  ageSeconds: number;     // front formata
  containers: string[];   // nomes, para seleção de logs/métricas
}
```

### Métricas

Usa `metrics.k8s.io` (via `Metrics` do client-node ou custom objects API). Se a chamada falhar
com 404/NotFound do recurso de métricas, o serviço retorna `{ available: false }` em vez de erro,
para o front degradar graciosamente.

### Logs (WebSocket)

- Endpoint `ws` por pod/container.
- Usa `Log.log()` do client-node, encaminhando o stream para o socket.
- `follow=true` mantém aberto; ao fechar o socket, o request de log é abortado (AbortController).

## Arquitetura do frontend

- **Vite + React + TypeScript.**
- Estado principal: lista de `targets`, resposta agregada (`pods` + `errors`), modo de agrupamento,
  filtro, e seleção de drill-down.

### Componentes

- `TargetSelector`: escolhe contexts e adiciona pares (cluster, namespace).
- `PodTable`: tabela unificada; colunas Cluster/Namespace/Pod/Status/Ready/Restarts/Idade.
- `GroupingControl`: alterna entre `by-namespace | by-cluster | flat`.
- `FilterBar`: filtro textual.
- `PodDetailsPanel`: abas Describe e Metrics.
- `LogViewer`: conecta no WebSocket, auto-scroll, pausar, limpar, filtro de texto.
- `TargetErrorBanner`: mostra erros por alvo sem esconder resultados válidos.

### Agrupamento

Como cada linha carrega `cluster` e `namespace`, o agrupamento é derivado no cliente:

- `by-namespace`: agrupa por `namespace`, coluna Cluster visível.
- `by-cluster`: agrupa por `cluster`, coluna Namespace visível.
- `flat`: sem grupos, ambas as colunas visíveis, ordenável.

## Contrato da API

```
GET  /api/contexts
     → { contexts: string[] }

POST /api/pods
     body: { targets: [{ cluster: string, namespace: string }] }
     → { pods: NormalizedPod[], errors: [{ target, message }] }

GET  /api/pods/:cluster/:namespace/:pod/describe
     → { describe: <detalhes> }

GET  /api/pods/:cluster/:namespace/:pod/metrics
     → { available: boolean, cpu?, memory?, containers?: [...] }

WS   /api/pods/:cluster/:namespace/:pod/logs?container=&follow=&tailLines=
     → stream de linhas de log
```

## Decisões de design

- **Promise.allSettled** para fan-out: falha parcial é o caminho natural, não exceção.
- **Cache de client por context**: evita recarregar/reconstruir a cada request.
- **Anotação na origem**: cada item carrega `{cluster, namespace}`, então o front agrupa sem heurística.
- **Read-only por construção**: o wrapper de client expõe apenas métodos de leitura; não há caminho de código para mutação.
- **Sem persistência de segredos**: o loader lê o kubeconfig só para nomes de context; erros são higienizados.

## Tratamento de erros

- Validação de entrada → 400 com mensagem clara.
- Falha de alvo → coletada em `errors[]`, HTTP 200 se algum alvo teve sucesso.
- Todos os alvos falharam → 200 com `pods: []` e `errors[]` preenchido (o front decide como exibir).
- Métricas indisponíveis → `{ available: false }`, nunca 500.

## Estratégia de testes

- **Backend unit:** normalização de pod, coleta de falha parcial no fan-out, higienização de mensagens.
- **Backend integração (QA agent):** contra clusters reais (`cluster-a`, `cluster-b`, ns `namespace-a`), validando fan-out, isolamento de falha e degradação de métricas.
- **Frontend:** render da tabela com dados mistos, troca de agrupamento, exibição de erro por alvo.
- **Read-only:** revisão garantindo que nenhum método de mutação é chamado ou exposto.
