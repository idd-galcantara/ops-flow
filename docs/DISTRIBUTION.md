# Distribuicao desktop

O empacotamento usa `electron-builder` e sempre executa o build dos tres workspaces antes de
gerar um instalador. O backend compilado, o frontend compilado e apenas as dependencias de
producao do backend sao copiados para recursos explicitos do aplicativo.

Para instalar e executar artefatos ja gerados, consulte:

- [Release Linux](README-release-linux.md)
- [Release macOS](README-release-mac.md)
- [Release Windows](README-release-windows.md)
- [Versionamento e release](VERSIONING-AND-RELEASE.md)

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

## macOS

```bash
npm run package:mac
```

O comando gera artefatos `.dmg` e `.zip` para `x64` (Mac Intel) e `arm64` (Apple Silicon) em
`release/`. A geracao dos artefatos macOS deve ser executada em macOS ou em um runner macOS de
CI, porque o DMG e a assinatura dependem das ferramentas da Apple.

O empacotamento usa `desktop/build/icon.icns`. O aplicativo ainda pode ser gerado sem assinatura
para testes internos, mas a distribuicao publica deve usar assinatura Developer ID e notarizacao
da Apple para evitar bloqueios do Gatekeeper.

## GitHub Actions

O workflow `.github/workflows/package-desktop.yml` executa automaticamente em cada push na
`main` e também pode ser iniciado manualmente pela interface do GitHub. Ele usa runners padrão
para Linux, Windows e macOS e publica os arquivos gerados como artifacts separados, retidos por
14 dias:

- Linux: `.AppImage` e `.deb`;
- Windows: `.exe`;
- macOS: `.dmg` e `.zip` para `x64` e `arm64`.

Quando uma tag no formato `v<versao>` é enviada, o workflow também baixa e extrai os artifacts,
seleciona os instaladores finais (`.deb`, `.AppImage`, `.exe`, `.dmg` e `.zip`), gera release notes
com os commits desde a tag anterior e cria a GitHub Release automaticamente. A tag precisa apontar
para um commit da `main`, e a versão da tag precisa ser igual à versão em `package.json`.

O workflow usa `GITHUB_TOKEN` com permissão de escrita apenas para criar a release. Os scripts de
empacotamento continuam usando `--publish never`, portanto o `electron-builder` não publica nada
diretamente. Para criar uma release, atualize a versão, faça push da `main` e envie a tag:

```bash
git tag -a v0.5.0 -m "Release v0.5.0"
git push origin v0.5.0
```

A publicação oficial ainda deve configurar assinatura e notarização quando necessário. A release
automática não assina os artefatos.

## Conteudo e seguranca

O empacotamento nao inclui `~/.kube`, `KUBECONFIG`, certificados, chaves ou qualquer arquivo do
workspace fora das listas de `files` e `extraResources` em `electron-builder.yml`. O kubeconfig
continua sendo lido somente em runtime pelo caminho padrao, pela variavel `KUBECONFIG` ou pelo
dialogo de selecao manual.

O runtime do backend fica fora do ASAR em `resources/backend`, permitindo que o processo Node
filho resolva suas dependencias. O renderer continua sem acesso a Node ou ao filesystem.

## Assinatura

Os artefatos devem ser assinados antes da distribuicao. No Windows, configure o certificado e as
variaveis do `electron-builder` em CI; no macOS, configure a assinatura Developer ID e a
notarizacao da Apple; no Linux, assine o AppImage e publique checksums. Segredos de assinatura
nunca devem ser commitados no repositorio.

Kubeconfigs com autenticacao `exec` continuam dependendo do executavel externo instalado no
computador do usuario e disponivel no `PATH`.