# ops-union - release Linux

Este guia explica como instalar e executar uma versao empacotada do ops-union em Linux.

## Artefatos

Os arquivos sao gerados em `release/`:

- `ops-union-0.4.0-linux-x86_64.AppImage`
- `ops-union-0.4.0-linux-amd64.deb`

O AppImage e portatil: nao instala o aplicativo no sistema. O `.deb` instala o aplicativo e cria os atalhos registrados pelo pacote.

## Requisito do AppImage

Em Ubuntu 24.04, o AppImage precisa da biblioteca de compatibilidade FUSE 2. Instale-a uma vez:

```bash
sudo apt update
sudo apt install libfuse2t64
```

Em outras distribuicoes, instale o pacote equivalente a `libfuse2` ou `libfuse2t64` conforme a versao do sistema.

## Executar o AppImage

A partir da pasta que contem o arquivo:

```bash
VERSION=0.4.0
chmod +x "ops-union-${VERSION}-linux-x86_64.AppImage"
"./ops-union-${VERSION}-linux-x86_64.AppImage"
```

Para remover o AppImage, basta apagar o arquivo. Nenhuma desinstalacao e necessaria.

Se o sistema bloquear a execucao por permissao, confirme que o arquivo tem permissao de execucao:

```bash
ls -l "ops-union-${VERSION}-linux-x86_64.AppImage"
```

## Instalar o pacote Debian

Em Ubuntu, Debian e distribuicoes compativeis:

```bash
sudo apt install "./ops-union-${VERSION}-linux-amd64.deb"
```

O `./` e importante: ele informa ao `apt` que o arquivo esta na pasta atual.

Depois, abra **ops-union** pelo menu de aplicativos ou execute:

```bash
ops-union
```

Para remover a instalacao:

```bash
sudo apt remove ops-union
```

## Kubeconfig

O aplicativo nao inclui kubeconfigs, tokens, certificados ou chaves no instalador. Na inicializacao, ele procura o kubeconfig local nesta ordem:

1. caminho selecionado anteriormente no aplicativo;
2. variavel de ambiente `KUBECONFIG`;
3. caminho padrao `~/.kube/config`.

Para iniciar usando outro arquivo:

```bash
KUBECONFIG=/caminho/para/config "./ops-union-${VERSION}-linux-x86_64.AppImage"
```

Tambem e possivel usar **Selecionar kubeconfig** dentro do aplicativo.

Ao abrir o AppImage pelo terminal, ele pode herdar `KUBECONFIG` definido nesse terminal. Ao
abrir a versao instalada pelo menu de aplicativos, essa variavel pode nao existir e o programa
pode mostrar menos contexts usando `~/.kube/config`. Compare a origem exibida no painel:

- `KUBECONFIG`: arquivo encontrado no ambiente do processo;
- `Selected file`: arquivo escolhido manualmente;
- `Default location`: `~/.kube/config`.

Se os contexts ou namespaces forem diferentes, use o icone de pasta no painel de kubeconfig e
selecione o mesmo arquivo usado no terminal. Essa escolha fica persistida para as proximas
execucoes.

## Autenticacao `exec`

Se o kubeconfig usa autenticacao `exec`, o executavel indicado nele precisa estar instalado no computador e disponivel no `PATH`. O ops-union nao instala nem substitui esse executavel.

Exemplos comuns incluem plugins de login de provedores de nuvem e ferramentas de identidade corporativa.

## Problemas comuns

### Erro relacionado a FUSE

Instale `libfuse2t64` no Ubuntu 24.04 ou o pacote equivalente da sua distribuicao.

### O aplicativo abre, mas nao encontra o kubeconfig

Confira o caminho selecionado no aplicativo ou defina `KUBECONFIG` antes de iniciar. O arquivo precisa ser valido e acessivel pelo seu usuario.

### Metricas nao aparecem

O cluster precisa ter `metrics-server` disponivel. A consulta de pods continua funcionando sem ele.

### O AppImage parece nao fazer nada no terminal

Isso normalmente significa que a janela foi aberta em segundo plano. Procure por **ops-union** entre as janelas abertas ou no menu de aplicativos.

## Observacoes de seguranca

O backend local escuta somente em `127.0.0.1` e a aplicacao e read-only. Operacoes como create, update, patch, delete, exec, attach e port-forward nao fazem parte do produto.
