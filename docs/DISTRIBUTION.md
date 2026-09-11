# Distribuicao desktop

O empacotamento usa `electron-builder` e sempre executa o build dos tres workspaces antes de
gerar um instalador. O backend compilado, o frontend compilado e apenas as dependencias de
producao do backend sao copiados para recursos explicitos do aplicativo.

## Linux

```bash
npm run package:linux
```

Os arquivos sao gerados em `release/`:

- `AppImage`, para distribuicoes Linux compativeis;
- `.deb`, como artefato avaliado para distribuicoes baseadas em Debian.

## Windows

```bash
npm run package:win
```

O alvo e um instalador NSIS `.exe`. A geracao deve ser validada em Windows ou em CI Windows,
especialmente quando houver dependencias nativas, assinatura ou autenticacao de instalador.

## Conteudo e seguranca

O empacotamento nao inclui `~/.kube`, `KUBECONFIG`, certificados, chaves ou qualquer arquivo do
workspace fora das listas de `files` e `extraResources` em `electron-builder.yml`. O kubeconfig
continua sendo lido somente em runtime pelo caminho padrao, pela variavel `KUBECONFIG` ou pelo
dialogo de selecao manual.

O runtime do backend fica fora do ASAR em `resources/backend`, permitindo que o processo Node
filho resolva suas dependencias. O renderer continua sem acesso a Node ou ao filesystem.

## Assinatura

Os artefatos devem ser assinados antes da distribuicao. No Windows, configure o certificado e as
variaveis do `electron-builder` em CI; no Linux, assine o AppImage e publique checksums. Segredos
de assinatura nunca devem ser commitados no repositorio.

Kubeconfigs com autenticacao `exec` continuam dependendo do executavel externo instalado no
computador do usuario e disponivel no `PATH`.