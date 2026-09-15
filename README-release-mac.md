# ops-flow - release macOS

Este guia explica como gerar e executar uma versão empacotada do ops-flow no macOS.

## Gerar os artefatos

Execute em um computador macOS ou em um runner macOS de CI:

```bash
npm install
npm run package:mac
```

Os arquivos são gerados em `release/`:

- `ops-flow-<versão>-mac-x64.dmg` e `.zip` para Macs Intel;
- `ops-flow-<versão>-mac-arm64.dmg` e `.zip` para Apple Silicon.

## Assinatura e notarização

Artefatos sem assinatura podem ser usados em testes internos, mas o Gatekeeper pode bloquear a
abertura ou exibir um alerta.

Para distribuição pública, configure no ambiente de build:

- certificado Apple Developer ID Application;
- identidade da equipe Apple;
- credenciais de notarização;
- configurações de assinatura do `electron-builder`.

Segredos de assinatura não devem ser commitados no repositório.

## Kubeconfig

O aplicativo não inclui kubeconfigs, tokens, certificados ou chaves no instalador. Na inicialização,
ele procura o kubeconfig nesta ordem:

1. caminho selecionado anteriormente no aplicativo;
2. variável de ambiente `KUBECONFIG`;
3. caminho padrão `~/.kube/config`.

Também é possível usar **Selecionar kubeconfig** dentro do aplicativo. Essa escolha fica persistida
no diretório de dados do Electron, normalmente:

```text
~/Library/Application Support/ops-flow/
```

## Autenticação `exec`

Se o kubeconfig usa autenticação `exec`, o executável indicado precisa estar instalado no Mac e
disponível no `PATH` do processo que abre o ops-flow.

## Certificados do cluster

O aplicativo usa a autoridade certificadora presente no kubeconfig e mantém a validação TLS
ativada. Clusters cuja cadeia depende exclusivamente do Keychain do macOS precisam ser validados
com o ambiente real antes da distribuição.

## Limitações de build

O build macOS não é validado neste ambiente Linux. A validação final deve cobrir inicialização,
janela, backend, seleção de kubeconfig, chamadas REST, logs por WebSocket, métricas e encerramento
em Macs Intel e Apple Silicon.