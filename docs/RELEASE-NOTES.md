# ops-flow v0.3.0

## Destaques

- Suporte oficial para macOS.
- Builds para macOS Intel e Apple Silicon.
- Instaladores automatizados para Linux, Windows e macOS.
- Aplicacao continua estritamente read-only para workloads Kubernetes.
- Compatibilidade com kubeconfigs locais e autenticacao `exec`.

## Downloads

Escolha o arquivo conforme seu sistema:

| Sistema | Arquivo |
|---|---|
| Ubuntu/Debian | `ops-flow-0.3.0-linux-amd64.deb` |
| Linux geral | `ops-flow-0.3.0-linux-x86_64.AppImage` |
| Windows 64-bit | `ops-flow-0.3.0-win-x64.exe` |
| macOS Apple Silicon | `ops-flow-0.3.0-mac-arm64.dmg` |
| macOS Intel | `ops-flow-0.3.0-mac-x64.dmg` |

Tambem estao disponiveis pacotes ZIP para macOS:

- `ops-flow-0.3.0-mac-arm64.zip`
- `ops-flow-0.3.0-mac-x64.zip`

## Instalacao no Linux

### Ubuntu, Debian e derivados

Baixe:

```text
ops-flow-0.3.0-linux-amd64.deb
```

Instale com:

```bash
sudo apt install ./ops-flow-0.3.0-linux-amd64.deb
```

Depois, abra o aplicativo pelo menu do sistema ou execute:

```bash
ops-flow
```

Para remover:

```bash
sudo apt remove ops-flow
```

### AppImage

Baixe:

```text
ops-flow-0.3.0-linux-x86_64.AppImage
```

Torne o arquivo executavel:

```bash
chmod +x ops-flow-0.3.0-linux-x86_64.AppImage
```

Execute:

```bash
./ops-flow-0.3.0-linux-x86_64.AppImage
```

Para remover, basta apagar o arquivo.

No Ubuntu 24.04, pode ser necessario instalar o suporte FUSE:

```bash
sudo apt update
sudo apt install libfuse2t64
```

## Instalacao no Windows

Baixe:

```text
ops-flow-0.3.0-win-x64.exe
```

Execute o instalador e siga as instrucoes exibidas.

O instalador e destinado a Windows 64-bit.

## Instalacao no macOS

### Apple Silicon

Para Macs com processadores Apple Silicon, como M1, M2, M3 ou M4, baixe:

```text
ops-flow-0.3.0-mac-arm64.dmg
```

Abra o DMG e arraste o aplicativo para a pasta `Applications`.

### Intel

Para Macs com processador Intel, baixe:

```text
ops-flow-0.3.0-mac-x64.dmg
```

Abra o DMG e arraste o aplicativo para a pasta `Applications`.

### Pacote ZIP

Como alternativa ao DMG, use o ZIP correspondente a arquitetura do Mac:

```text
ops-flow-0.3.0-mac-arm64.zip
ops-flow-0.3.0-mac-x64.zip
```

Extraia o arquivo e mova `ops-flow.app` para a pasta `Applications`.

## Kubeconfig

O aplicativo nao inclui kubeconfigs, tokens, certificados ou chaves.

Na inicializacao, o ops-flow procura o kubeconfig nesta ordem:

1. arquivo selecionado anteriormente no aplicativo;
2. variavel de ambiente `KUBECONFIG`;
3. local padrao `~/.kube/config`.

Tambem e possivel selecionar manualmente um kubeconfig dentro do aplicativo.

Exemplo no Linux:

```bash
KUBECONFIG=/caminho/para/config ./ops-flow-0.3.0-linux-x86_64.AppImage
```

Se o kubeconfig usar autenticacao `exec`, o executavel indicado precisa estar instalado e disponivel no `PATH`.

## Metricas

A exibicao de metricas depende da disponibilidade do `metrics-server` no cluster Kubernetes.

A consulta de pods continua funcionando mesmo quando o `metrics-server` nao esta disponivel.

## Seguranca

- O backend local escuta somente em `127.0.0.1`.
- O aplicativo nao executa operacoes de criacao, alteracao ou exclusao no Kubernetes.
- Operacoes como `create`, `update`, `patch`, `delete`, `exec`, `attach` e `port-forward` nao fazem parte do produto.
- Os instaladores desta release podem nao possuir assinatura de codigo.

Por isso, Windows e macOS podem exibir avisos de seguranca na primeira execucao.

## Problemas conhecidos

- O macOS pode solicitar confirmacao adicional por o aplicativo nao estar notarizado.
- O Windows pode exibir um aviso do SmartScreen para o instalador nao assinado.
- O AppImage pode exigir a instalacao do pacote FUSE da distribuicao Linux.
- O aplicativo depende dos executaveis externos usados por autenticacoes `exec` do kubeconfig.

## Changelog

### Added

- Suporte para empacotamento e distribuicao no macOS.
- Build macOS para arquiteturas Intel (`x64`) e Apple Silicon (`arm64`).
- Geracao automatizada de instaladores para Linux, Windows e macOS.
- Workflow multiplataforma no GitHub Actions.

### Changed

- Atualizacao do `electron-builder` para uma versao com melhorias na geracao de DMG.
- Publicacao dos artefatos de empacotamento separada da criacao da GitHub Release.

### Fixed

- Falhas de publicacao automatica causadas pela ausencia de `GH_TOKEN` no GitHub Actions.
- Melhorias na confiabilidade da geracao de pacotes DMG no macOS.

## Validacao

Esta release foi empacotada para:

- Linux: AppImage e Debian `.deb`;
- Windows: instalador NSIS `.exe`;
- macOS: DMG e ZIP para Intel e Apple Silicon.
