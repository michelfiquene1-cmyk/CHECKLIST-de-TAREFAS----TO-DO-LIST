# Checklist de Tarefas

Aplicação em HTML, CSS e JavaScript para organizar tarefas, preservando o visual de cartão com fita amarela e a fonte Space Mono do projeto original.

## Funcionalidades

- Adicionar, editar, concluir, reabrir e excluir tarefas.
- Filtros Todas, Pendentes e Concluídas e contador geral de conclusão.
- Salvamento automático com `localStorage` no modo inicial Neste navegador.
- Modo opcional para a API Java existente, com listas separadas do armazenamento local.
- Validação de nomes (1 a 200 caracteres após remover espaços nas pontas).
- Feedback de sucesso e falhas, prevenção de envios simultâneos e estados vazios.
- Layout responsivo, controles nativos, foco visível e avisos para leitores de tela.
- Edição com Enter para salvar e Escape para cancelar.

## Executar e demonstrar localmente

Não há dependências de aplicação. Com Node.js 22 ou superior:

```sh
node tools/serve.mjs
```

Acesse **http://localhost:4173**. Adicione uma tarefa, edite, marque como concluída, alterne os filtros e atualize a página para verificar o salvamento. Também é possível abrir `index.html` diretamente, mas o armazenamento em URLs `file:` varia entre navegadores; prefira o servidor local.

O Google Fonts é opcional: sem conexão, a interface usa a fonte monospace do sistema. Os arquivos CSS e JavaScript usam caminhos relativos.

## Persistência e API

O modo inicial é local e não faz requisições à API. A chave é `checklist.tarefas.v1`. Os dados pertencem ao navegador, perfil e origem utilizados; limpar os dados do site os remove. Ao mudar de localhost para o domínio Netlify, a lista começa vazia, pois cada origem tem seu armazenamento. Não há conta, backup ou sincronização entre dispositivos. Alterações em outra aba da mesma origem atualizam a lista; em gravações simultâneas prevalece a última gravação.

O seletor **Salvar tarefas → Na API existente** mantém a integração original:

```text
https://vizioon-todoist-java-backend.onrender.com/api/tarefa
GET    /          → lista de { id, nome, concluida, descricao? }
POST   /          ← { nome, descricao } → tarefa criada
PUT    /{id}      ← { nome, descricao, concluida }
DELETE /{id}
```

As listas local e remota não são mescladas nem enviadas automaticamente de um modo para outro. Ao abrir novamente, o aplicativo inicia no modo local. O modo API só confirma mudanças após resposta de sucesso; em falhas de gravação, recarregue antes de tentar novamente, pois o servidor pode ter aplicado a operação sem devolver resposta. Cada requisição tem limite de 15 segundos; um servidor em inicialização pode precisar de nova tentativa.

Na revisão inicial, uma consulta GET de diagnóstico não respondeu em 45 segundos. Portanto, disponibilidade, CORS e gravações reais do backend não foram confirmados. O contrato remoto é testado com respostas simuladas, sem alterar dados externos. Para usar a API em produção, o backend precisa permitir a origem do site Netlify por CORS e manter o contrato acima. O frontend não implementa autenticação: trate a API como potencialmente compartilhada e não insira dados sensíveis.

## Segurança e validação

Nomes são renderizados com `textContent`, sem interpolação em HTML. Dados recebidos da API e do armazenamento são validados. IDs em URLs são codificados. Não há tokens ou chaves de acesso no projeto. Falhas no armazenamento não confirmam alterações na interface. Dados locais inválidos não são apagados durante a leitura; uma nova gravação substitui o conteúdo da chave.

## Testes

```sh
node --check script.js
node tools/build.mjs
node --test tests/browser.test.mjs
```

Os testes usam Node.js e Chrome/Edge instalado, em modo headless, sem bibliotecas adicionais. Defina `CHROME_PATH` se o navegador estiver em outro caminho. Geram `dist` automaticamente e verificam os arquivos que serão publicados, respostas HTTP e caminhos relativos. Cobrem os fluxos da interface, recarga, edição por teclado, filtros, conteúdo malicioso, erros de armazenamento, contrato e falhas da API simulada e ausência de transbordamento em celular, tablet e desktop. A API é bloqueada no teste local, que confirma zero chamadas a ela. O teste não escreve na API real.

## Preparação para Netlify

Repositório: [michelfiquene1-cmyk/Pasta-vs-code-front-end](https://github.com/michelfiquene1-cmyk/Pasta-vs-code-front-end). Branch de publicação: **master**.

O `index.html` de origem permanece na raiz do repositório. O comando abaixo copia somente `index.html`, `style.css` e `script.js` para `dist`, preservando os caminhos relativos e sem compilar ou adicionar frameworks:

```sh
node tools/build.mjs
```

`dist` é gerada e ignorada pelo Git. README, testes, ferramentas, configuração Git e arquivos locais não entram no diretório publicado. O script recusa conteúdo inesperado em `dist` para evitar publicar arquivos por engano. Não são necessárias variáveis secretas, Functions ou banco de dados.

Quando desejar publicar, importe o repositório existente no Netlify e use:

| Configuração | Valor |
| --- | --- |
| Production branch | `master` |
| Framework preset | Nenhum / Other |
| Base directory | Em branco (raiz do repositório) |
| Package directory | Em branco |
| Build command | `node tools/build.mjs` |
| Publish directory | `dist` |
| Node.js | `22` (definido no arquivo) |
| Environment variables / secrets | Nenhum necessário |

O arquivo `netlify.toml` versiona o comando, o diretório de publicação e a versão de Node. Os campos seguem a [documentação oficial de configuração do Netlify](https://docs.netlify.com/build/configure-builds/file-based-configuration/).

Esta preparação não cria nem publica um site no Netlify. Quando você autorizar a publicação no painel, teste o endereço HTTPS gerado. A demonstração pública ainda não foi criada.
