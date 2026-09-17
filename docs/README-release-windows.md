# ops-union - release Windows

Este guia explica como instalar e executar uma versao empacotada do ops-union no Windows.

## Artefato

O instalador NSIS e gerado em `release/`:

- `ops-union-<versao>-win-x64.exe`

A instalacao cria atalhos no menu Iniciar e, quando selecionado, na area de trabalho. O instalador permite escolher o diretorio de instalacao.

## Instalar

1. Baixe o arquivo `.exe` correspondente a versao.
2. Execute o instalador.
3. Se o Windows SmartScreen exibir um aviso, confirme a origem do arquivo antes de continuar. Builds sem assinatura digital podem gerar esse aviso.
4. Escolha o diretorio de instalacao, se necessario.
5. Abra **ops-union** pelo menu Iniciar ou pelo atalho criado.

O Node.js nao e necessario para executar a versao instalada. O runtime do backend ja vem incluido no pacote.

## Desinstalar

Use **Configuracoes > Aplicativos > Aplicativos instalados > ops-union > Desinstalar**, ou execute o desinstalador no diretorio de instalacao.

## Kubeconfig

O aplicativo nao inclui kubeconfigs, tokens, certificados ou chaves no instalador. Na inicializacao, ele procura o kubeconfig local nesta ordem:

1. caminho selecionado anteriormente no aplicativo;
2. variavel de ambiente `KUBECONFIG`;
3. caminho padrao `%USERPROFILE%\\.kube\\config`.

Para usar outro arquivo no PowerShell antes de abrir o aplicativo:

```powershell
$env:KUBECONFIG = "C:\caminho\para\config"
Start-Process "C:\Program Files\ops-union\ops-union.exe"
```

Tambem e possivel usar **Selecionar kubeconfig** dentro do aplicativo.

## Autenticacao `exec`

Se o kubeconfig usa autenticacao `exec`, o executavel indicado nele precisa estar instalado no computador e disponivel no `PATH`. O ops-union nao instala nem substitui esse executavel.

Depois de instalar ou atualizar um plugin de autenticacao, reinicie o ops-union para que o processo herde o `PATH` atualizado.

## Problemas comuns

### O Windows exibe um aviso do SmartScreen

O instalador precisa ser assinado para evitar avisos de editor desconhecido. Em builds internas ou de desenvolvimento, confirme a origem do arquivo antes de executar.

### O aplicativo nao encontra o kubeconfig

Confira o caminho selecionado no aplicativo ou defina `KUBECONFIG` no mesmo ambiente em que o aplicativo sera iniciado. O arquivo precisa ser valido e acessivel pelo seu usuario.

### Metricas nao aparecem

O cluster precisa ter `metrics-server` disponivel. A consulta de pods continua funcionando sem ele.

### A autenticacao `exec` falha

Verifique se o executavel do plugin esta instalado e se o diretorio dele esta no `PATH` do Windows. Teste tambem a autenticacao fora do ops-union para confirmar que o kubeconfig e o plugin funcionam.

## Observacoes de seguranca

O backend local escuta somente em `127.0.0.1` e a aplicacao e read-only. Operacoes como create, update, patch, delete, exec, attach e port-forward nao fazem parte do produto.
