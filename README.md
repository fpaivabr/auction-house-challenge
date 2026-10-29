# Modern Art Auction

**Peças únicas. Novas histórias.**

Uma plataforma full stack de leilões de arte, com lances em tempo real, carteiras simuladas, liquidação de arremates e verificação pública da integridade do histórico de lances.

![Prévia da identidade visual da Modern Art Auction](docs/images/modern-art-auction-hero.png)

> **Sobre o projeto:** desenvolvido para o desafio técnico **Elite Dev da Verzel**, que propõe a construção de uma casa de leilões online com catálogo proveniente de uma API pública, dois perfis de usuário, regras financeiras e auditoria dos lances.

> **Publicação:** a Modern Art Auction está disponível publicamente no Railway, com frontend React, API Express e banco de dados PostgreSQL.
>
> **Acesse a aplicação:** [Modern Art Auction — Versão Online](https://auction-house-challenge-production.up.railway.app/)
>
> **Observação:** esta é uma plataforma demonstrativa. Os créditos e as transações financeiras são simulados.

## Índice

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Executar localmente](#executar-localmente)
- [Contas e dados demonstrativos](#contas-e-dados-demonstrativos)
- [Testes e qualidade](#testes-e-qualidade)
- [Principais endpoints](#principais-endpoints)
- [Regras de negócio](#regras-de-negócio)
- [Auditoria e integridade](#auditoria-e-integridade)
- [Deploy e considerações de produção](#deploy-e-considerações-de-produção)
- [Limitações conhecidas](#limitações-conhecidas)
- [Uso de IA e créditos](#uso-de-ia-e-créditos)

## Visão geral

A **Modern Art Auction** simula a experiência de uma casa de leilões de arte. O leiloeiro seleciona uma obra de um catálogo externo, define valores e agenda um lote. O licitante acompanha a disputa em tempo real, deposita saldo fictício, registra lances e, caso vença, recebe um comprovante que pode ser compartilhado por link.

O objetivo técnico é demonstrar a integração entre interface, API, banco de dados e regras de domínio, dando atenção especial à consistência financeira, à concorrência entre lances e à rastreabilidade das operações.

**Importante:** todas as operações financeiras são **simuladas**. Não há cobrança, integração bancária, pagamentos reais ou transferência de propriedade das obras exibidas.

## Funcionalidades

### Visitantes

- Vitrine pública com lotes **agendados, em andamento e encerrados**, pesquisa, filtros e ordenação.
- Apresentação visual com obras do acervo do **Cleveland Museum of Art**, alternadas automaticamente.
- Detalhes do lote, valores e histórico da disputa.
- Página pública de auditoria do lote, sem necessidade de autenticação.
- Consulta de comprovantes por link público.
- Interface responsiva com temas claro e escuro.

### Leiloeiro (`AUCTIONEER`)

- Acesso ao painel de administração dos próprios lotes.
- Busca de obras em API externa, com imagem e dados da obra.
- Criação de lotes em rascunho, definição de preço inicial e incremento mínimo.
- Publicação imediata ou agendamento por data de início e encerramento.
- Cancelamento de lotes elegíveis, com regras para preservar a consistência da disputa.
- Visualização de lotes encerrados, vendas concluídas e total recebido em créditos simulados.
- Verificação administrativa da cadeia de auditoria.

### Licitante (`BIDDER`)

- Cadastro, autenticação e gerenciamento da sessão.
- Carteira com **saldo total, saldo reservado e saldo disponível**.
- Depósitos fictícios e histórico de movimentações.
- Lances com validação de valor, saldo, horário e posição na disputa.
- Atualização da sala do lote sem recarregar a página, usando **Server-Sent Events (SSE)**.
- Indicadores de liderança e de superação de lances.
- Página **Meus arremates**, com participações, resultados e comprovantes.

### Segurança e consistência

- Autenticação com tokens JWT e autorização por papel.
- Validação de entradas no backend com **Zod**.
- Senhas armazenadas com hash; cabeçalhos HTTP de proteção com **Helmet**.
- Transações PostgreSQL e bloqueio de registros nas operações críticas de lance e liquidação.
- Restrição de unicidade para impedir que a mesma obra do catálogo seja cadastrada em mais de um lote.
- Registro de auditoria com cadeia criptográfica e checkpoints externos opcionais, conforme a configuração do ambiente.

## Tecnologias

| Camada                     | Tecnologias                                                                    |
| -------------------------- | ------------------------------------------------------------------------------ |
| Interface                  | React 19, TypeScript, Vite 8, Tailwind CSS 4, componentes Radix/shadcn, Lucide |
| API                        | Node.js 24, Express 5, TypeScript, Zod                                         |
| Persistência               | PostgreSQL 17, Prisma ORM 7 e adapter PostgreSQL                               |
| Atualizações em tempo real | Server-Sent Events (SSE)                                                       |
| Autenticação e proteção    | JWT (`jose`), hash de senhas, Helmet, CORS                                     |
| Integridade                | HMAC-SHA256, cadeia de eventos e checkpoints em arquivos externos              |
| Testes                     | Vitest, Supertest, testes unitários e de integração da API                     |
| Desenvolvimento            | Docker Compose, npm workspaces, ESLint, Prettier                               |

## Arquitetura

O projeto utiliza um **monorepo com npm workspaces** e uma API organizada em módulos de domínio.

```text
auction-house-challenge/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── migrations/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── audit/
│   │   │   │   ├── auth/
│   │   │   │   ├── bids/
│   │   │   │   ├── lots/
│   │   │   │   ├── products/
│   │   │   │   ├── receipts/
│   │   │   │   └── wallets/
│   │   │   ├── shared/
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   └── tests/
│   │       ├── integration/
│   │       └── unit/
│   └── web/
│       ├── public/
│       └── src/
│           ├── components/
│           ├── features/
│           ├── hooks/
│           └── pages/
├── docs/
│   └── images/
│       └── modern-art-auction-hero.png
├── compose.yaml
├── package.json
└── README.md
```

**Fluxo principal:** o React se comunica com a API Express por `/api`; a API consulta o PostgreSQL via Prisma e utiliza o catálogo público de arte apenas para descoberta de obras e criação de novos lotes. Os dados relevantes da obra são copiados para o lote, evitando que um leilão já criado dependa da disponibilidade futura da API externa.

O servidor executa rotinas periódicas para iniciar e encerrar lotes e para sincronizar os checkpoints de auditoria, quando configurados.

## Executar localmente

### 1. Pré-requisitos

- **Node.js 24** e npm.
- **Docker Desktop** (ou Docker Engine com Compose).
- **Git**.
- Porta **5432** disponível para o PostgreSQL; portas **3000** e **5173** para API e frontend.

> Os exemplos abaixo usam **PowerShell**, no Windows. No macOS/Linux, use os equivalentes `cp` e `cd` quando necessário. Os comandos npm e Docker são os mesmos.

### 2. Clonar o repositório e instalar dependências

```powershell
git clone https://github.com/fpaivabr/auction-house-challenge.git
cd auction-house-challenge
npm ci
```

A instalação deve ser executada **na raiz do monorepo**, não separadamente em cada aplicação.

### 3. Subir o PostgreSQL

```powershell
docker compose up -d postgres
docker compose ps
```

O arquivo `compose.yaml` configura o PostgreSQL 17 com:

| Configuração local | Valor                  |
| ------------------ | ---------------------- |
| Host               | `localhost`            |
| Porta              | `5432`                 |
| Banco principal    | `auction_house`        |
| Usuário            | `auction`              |
| Senha              | `auction_dev_password` |

Essas credenciais são **apenas para desenvolvimento**. Não devem ser reutilizadas em produção.

Se já houver outro PostgreSQL na porta 5432, interrompa o serviço conflitante ou ajuste a porta no `compose.yaml` e na URL de conexão.

### 4. Configurar as variáveis da API

Crie o arquivo local a partir do exemplo:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

Edite **`apps/api/.env`** com estes nomes e valores de referência:

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://auction:auction_dev_password@localhost:5432/auction_house?schema=public"
JWT_SECRET="SUBSTITUA_POR_UM_SEGREDO_ALEATORIO_DE_32_OU_MAIS_CARACTERES"
AUDIT_SECRET="SUBSTITUA_POR_OUTRO_SEGREDO_ALEATORIO_DE_32_OU_MAIS_CARACTERES"
DEMO_PASSWORD="DEFINA_UMA_SENHA_DEMO_COM_8_OU_MAIS_CARACTERES"

# Opcional: caminho absoluto para um diretório persistente FORA do repositório.
# AUDIT_CHECKPOINT_DIR="C:/Users/SEU_USUARIO/modern-auction-audit"
```

**Use valores diferentes** para `JWT_SECRET` e `AUDIT_SECRET`. Para gerar cada segredo localmente, execute este comando duas vezes e copie os resultados:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

O `.env` contém informações sensíveis e não deve ser versionado. O projeto já ignora arquivos `.env` no Git.

### 5. Aplicar as migrations e gerar o Prisma Client

```powershell
Push-Location apps/api
npx prisma migrate deploy
npx prisma generate
Pop-Location
```

As migrations versionadas criam as tabelas e índices, incluindo a restrição de unicidade das obras. Não é necessário recriar manualmente as tabelas.

### 6. Popular o banco com dados de demonstração

```powershell
npm run db:seed -w apps/api
```

O seed cria os usuários demonstrativos e, em um **banco novo**, um lote aberto com lance inicial já registrado, permitindo testar o fluxo sem cadastrar tudo manualmente.

Ele pode ser repetido sem duplicar as contas, o lote de exemplo ou o lance inicial. Por segurança, a execução é autorizada automaticamente apenas no banco local `auction_house`, com `NODE_ENV=development`.

> **Observação:** o seed tenta obter uma imagem de domínio público da API externa. Se ela estiver indisponível, cria um lote demonstrativo sem imagem. O seed não sobrescreve saldos, senhas e valores de lotes já existentes.

### 7. Iniciar a API e o frontend

Abra **dois terminais**, ambos na raiz do projeto.

**Terminal 1 — API:**

```powershell
npm run dev -w apps/api
```

**Terminal 2 — frontend:**

```powershell
npm run dev -w apps/web
```

Acesse:

| Serviço       | Endereço local                  |
| ------------- | ------------------------------- |
| Aplicação     | http://localhost:5173           |
| API (saúde)   | http://localhost:3000/health    |
| Banco (saúde) | http://localhost:3000/health/db |

O Vite redireciona as chamadas `/api` para `http://localhost:3000` **somente em desenvolvimento**.

### 8. Opcional: habilitar a âncora externa de auditoria

Para verificar também a integridade contra um checkpoint fora do banco:

1. Configure `AUDIT_CHECKPOINT_DIR` no arquivo `apps/api/.env`, usando um **diretório novo, vazio e persistente**, fora do repositório.
2. Execute **primeiro o seed**, para existir ao menos um evento auditável.
3. Com a API parada, inicialize a âncora explicitamente:

```powershell
Push-Location apps/api
npx tsx src/modules/audit/audit-bootstrap.ts --confirm-bootstrap
Pop-Location
```

4. Inicie a API normalmente. O servidor tentará sincronizar novos checkpoints a cada **10 segundos**.

O bootstrap **recusa um diretório que já contenha arquivos**. Não apague checkpoints antigos nem reinicialize a âncora para contornar uma divergência: isso destruiria a referência de integridade anteriormente estabelecida.

Sem `AUDIT_CHECKPOINT_DIR`, a verificação pública pode conferir a consistência do histórico, mas não atesta a presença de uma âncora externa. Em produção, a verificação administrativa sinaliza essa ausência.

## Contas e dados demonstrativos

As contas demonstrativas são criadas pelo seed e compartilham uma senha de acesso.

**Credenciais para avaliação da aplicação publicada:**

**Senha:** `teste_senha`

| Perfil      | E-mail                  | Acesso                                 |
| ----------- | ----------------------- | -------------------------------------- |
| Leiloeiro   | `auctioneer@demo.local` | Criar, publicar e gerenciar lotes      |
| Licitante 1 | `bidder1@demo.local`    | Depositar saldo e registrar lances     |
| Licitante 2 | `bidder2@demo.local`    | Disputar lances com outro participante |

> As credenciais são destinadas exclusivamente ao ambiente demonstrativo. Os créditos e as operações financeiras são fictícios.

Em uma base nova, cada licitante recebe **R$ 1.000.000,00** de saldo fictício. O seed também prepara um lote com preço inicial de **R$ 250.000,00**, incremento mínimo de **R$ 10.000,00**, duração inicial de aproximadamente **72 horas** e um lance de **R$ 275.000,00** feito pelo primeiro licitante.

O cadastro público pela interface cria exclusivamente contas do tipo **licitante**. A conta de leiloeiro demonstrativa é criada pelo seed.

**Sugestão de roteiro de avaliação:** entre com o leiloeiro para verificar o painel e criar ou publicar um lote; depois, entre com uma das contas de licitante para registrar um lance em um leilão aberto, acompanhar a atualização em tempo real, consultar a carteira e verificar a auditoria pública do lote.

## Testes e qualidade

### Verificação estática e build

Na raiz do projeto:

```powershell
npm run format
npx prettier . --check
npm run lint
npm run build
```

O build da API gera o Prisma Client e compila o TypeScript. O frontend é compilado pelo TypeScript e pelo Vite, com divisão do JavaScript em chunks por rota.

### Testes automatizados da API

Os testes de integração usam um **banco exclusivo**, chamado `auction_house_test`. **Eles apagam os registros desse banco antes e depois da execução.** Nunca configure os testes para o banco principal ou um banco com dados que precisam ser preservados.

Crie o banco exclusivo (uma única vez):

```powershell
docker compose exec -T postgres psql -U auction -d postgres -c "CREATE DATABASE auction_house_test;"
```

Crie **`apps/api/.env.test`** com a URL do banco de testes e segredos próprios:

```dotenv
NODE_ENV=test
PORT=3001
DATABASE_URL="postgresql://auction:auction_dev_password@localhost:5432/auction_house_test?schema=public"
JWT_SECRET="SUBSTITUA_POR_UM_SEGREDO_DE_TESTE_COM_PELO_MENOS_32_CARACTERES"
AUDIT_SECRET="SUBSTITUA_POR_OUTRO_SEGREDO_DE_TESTE_COM_PELO_MENOS_32_CARACTERES"
```

Aplique as migrations **especificamente no banco de testes**:

```powershell
Push-Location apps/api
$env:DATABASE_URL = 'postgresql://auction:auction_dev_password@localhost:5432/auction_house_test?schema=public'
npx prisma migrate deploy
Remove-Item Env:DATABASE_URL
Pop-Location
```

Depois execute:

```powershell
npm run test -w apps/api
```

A suíte atual contém **70 testes em 13 arquivos**, entre testes unitários e de integração, cobrindo autenticação, lances, carteira, liquidação, comprovantes e integridade da auditoria. O frontend tem validações de lint e build; não há, neste momento, uma suíte automatizada própria de testes de interface.

## Principais endpoints

| Método | Rota                            | Finalidade                           | Acesso      |
| ------ | ------------------------------- | ------------------------------------ | ----------- |
| `GET`  | `/health`                       | Saúde da API                         | Público     |
| `GET`  | `/health/db`                    | Conectividade com o banco            | Público     |
| `POST` | `/api/auth/register`            | Cadastro de licitante                | Público     |
| `POST` | `/api/auth/login`               | Autenticação                         | Público     |
| `GET`  | `/api/auth/me`                  | Usuário autenticado                  | Autenticado |
| `GET`  | `/api/products`                 | Busca de obras no catálogo externo   | Público     |
| `GET`  | `/api/lots`                     | Vitrine de lotes publicados          | Público     |
| `GET`  | `/api/lots/:id`                 | Detalhes do lote                     | Público     |
| `GET`  | `/api/lots/:id/events`          | Eventos SSE do lote                  | Público     |
| `GET`  | `/api/lots/:id/participation`   | Participação do usuário              | Licitante   |
| `POST` | `/api/lots/:id/bids`            | Registrar lance                      | Licitante   |
| `GET`  | `/api/lots/participations/mine` | Histórico de participações           | Licitante   |
| `POST` | `/api/lots`                     | Criar lote                           | Leiloeiro   |
| `GET`  | `/api/lots/mine`                | Lotes do leiloeiro                   | Leiloeiro   |
| `GET`  | `/api/lots/mine/summary`        | Indicadores financeiros do leiloeiro | Leiloeiro   |
| `POST` | `/api/lots/:id/publish`         | Publicar/agendar lote                | Leiloeiro   |
| `POST` | `/api/lots/:id/cancel`          | Cancelar lote elegível               | Leiloeiro   |
| `GET`  | `/api/wallet/me`                | Saldos                               | Autenticado |
| `GET`  | `/api/wallet/me/transactions`   | Extrato                              | Autenticado |
| `POST` | `/api/wallet/me/deposits`       | Depósito simulado                    | Licitante   |
| `GET`  | `/api/receipts/mine`            | Comprovantes do licitante            | Licitante   |
| `GET`  | `/api/receipts/:token`          | Comprovante por link                 | Público     |
| `GET`  | `/api/audit/lots/:id`           | Auditoria pública do lote            | Público     |
| `GET`  | `/api/audit/verify`             | Auditoria geral e checkpoints        | Leiloeiro   |

Rotas autenticadas recebem o cabeçalho `Authorization: Bearer <token>`. Valores monetários são transmitidos em **centavos**; campos `BigInt` são serializados como strings JSON, evitando perda de precisão.

## Regras de negócio

- **Lance válido:** apenas em lote aberto e dentro do período definido.
- **Valor mínimo:** o primeiro lance deve atingir o preço inicial; os seguintes devem atingir o lance atual mais o incremento mínimo.
- **Liderança:** o usuário que está liderando não pode superar o próprio lance.
- **Saldo:** o novo líder precisa dispor do valor necessário; o saldo correspondente fica reservado. A reserva do líder anterior é liberada quando ele é superado.
- **Concorrência:** lances e reservas são processados em transações com bloqueios para evitar inconsistências por disputas simultâneas.
- **Anti-sniping:** um lance válido nos dois minutos finais prorroga o horário de encerramento do lote em dois minutos, conforme a regra implementada.
- **Encerramento:** lotes sem lances fecham sem vencedor; lotes arrematados são liquidados com débito do vencedor, crédito do leiloeiro e comprovante.
- **Idempotência:** uma liquidação já concluída não deve cobrar o vencedor novamente.
- **Cancelamento:** não é permitido cancelar lote com lances registrados ou já encerrado.
- **Unicidade:** uma obra identificada pelo catálogo externo não pode ser cadastrada novamente em outro lote, inclusive quando o registro anterior não está mais na vitrine.

## Auditoria e integridade

A API grava eventos auditáveis em uma cadeia HMAC-SHA256. Cada entrada possui sequência, dados do evento, referência ao hash anterior e assinatura. A verificação confere tanto a cadeia quanto a correspondência dos eventos de lance com os registros do banco.

Para reforçar a detecção de alterações feitas diretamente no PostgreSQL, a aplicação permite armazenar **checkpoints assinados em um diretório externo ao banco**. A auditoria pública apresenta estados como íntegro, pendente, inválido ou ainda não verificado, conforme os dados e a configuração disponível.

Os dados públicos de licitantes são representados por **identificadores pseudônimos**, em vez de divulgar nomes ou e-mails.

**Limite de segurança:** um arquivo em disco ou volume persistente comum não é imutável. A proteção contra um administrador mal-intencionado capaz de modificar simultaneamente banco, segredos e armazenamento exige retenção independente e controles adicionais. A sincronização dos checkpoints também é assíncrona; eventos recentes podem aparecer como pendentes até o próximo ciclo.

## Deploy e considerações de produção

A aplicação está publicada no **Railway**, em um ambiente de demonstração que reúne frontend, backend e banco de dados.

**Aplicação pública:** [Modern Art Auction](https://auction-house-challenge-production.up.railway.app/)

### Infraestrutura de produção

| Componente       | Implementação                                          |
| ---------------- | ------------------------------------------------------ |
| Hospedagem       | Railway                                                |
| Frontend         | React + Vite, compilado e servido pelo Express         |
| Backend          | Node.js 24 + Express 5                                 |
| Banco de dados   | PostgreSQL 17, com volume persistente                  |
| ORM e migrations | Prisma 7                                               |
| Auditoria        | Checkpoints HMAC-SHA256 em volume persistente separado |
| Comunicação      | HTTPS, API REST e Server-Sent Events (SSE)             |

O frontend e a API são disponibilizados no mesmo domínio. O Express entrega os arquivos estáticos compilados do React e atende às rotas `/api`, sem necessidade de um serviço independente para o frontend.

### Processo de publicação

O Railway está conectado à branch `main` do repositório no GitHub. Novos commits enviados para essa branch podem iniciar automaticamente uma nova publicação.

O processo utiliza:

**Build:**

```bash
npm run build
```

**Pre-deploy (migrations):**

```bash
cd apps/api && npx prisma migrate deploy
```

**Inicialização:**

```bash
npm run start -w apps/api
```

As configurações sensíveis, incluindo `DATABASE_URL`, `JWT_SECRET`, `AUDIT_SECRET` e `DEMO_PASSWORD`, são gerenciadas por variáveis de ambiente no Railway e não são armazenadas no repositório.

### Auditoria em produção

O sistema utiliza um volume persistente independente do PostgreSQL para armazenar checkpoints criptográficos.

A variável `AUDIT_CHECKPOINT_DIR` aponta para o diretório configurado no volume, e o primeiro checkpoint foi inicializado explicitamente após a criação dos dados demonstrativos.

A API sincroniza novos registros periodicamente e permite consultar a integridade do histórico de lances pela interface pública.

Esses checkpoints fornecem evidências de integridade, mas o volume utilizado não oferece garantias de imutabilidade contra administradores com controle sobre toda a infraestrutura.

### Dados demonstrativos

O ambiente publicado contém contas demonstrativas para os perfis de leiloeiro e licitante, além de lotes utilizados na avaliação das funcionalidades.

As credenciais demonstrativas estão disponíveis na seção [Contas e dados demonstrativos](#contas-e-dados-demonstrativos). O cadastro público cria contas exclusivamente do tipo licitante.

### Disponibilidade

A hospedagem é destinada à demonstração e avaliação técnica do projeto. A disponibilidade pública poderá ser encerrada após o processo seletivo, enquanto o código-fonte e as instruções de execução local permanecerão no GitHub.

A implantação foi verificada quanto à disponibilidade da aplicação, conectividade com o banco de dados e consulta pública da integridade dos lances. Os demais fluxos devem ser validados no ambiente publicado antes da entrega final.

## Limitações conhecidas

- **Pagamentos e créditos são fictícios:** o projeto não processa transações bancárias reais.
- **Catálogo externo:** a busca e seleção de novas obras dependem da disponibilidade e dos limites da API do Cleveland Museum of Art. Os lotes já cadastrados continuam acessíveis porque guardam uma cópia dos dados essenciais.
- **Galeria inicial:** exibe obras do acervo público como recurso visual; não significa que todas estejam disponíveis para arremate.
- **SSE:** a implementação atual não possui um broker distribuído para múltiplas instâncias da API.
- **Auditoria:** a verificação externa depende da configuração, persistência e retenção adequada dos checkpoints.
- **Seed demonstrativo:** utiliza um identificador próprio (`demo-seed`) para o lote de exemplo, mesmo quando aproveita a imagem de uma obra do museu. Portanto, esse lote não reserva automaticamente o identificador da obra no catálogo `cleveland`.
- **Testes de interface:** ainda não há suíte automatizada de testes end-to-end do frontend; a validação atual combina lint, build e testes manuais dos fluxos da interface.
- **Hospedagem demonstrativa:** a aplicação está publicada no Railway para avaliação técnica, sem compromisso de disponibilidade permanente após o processo seletivo.

## Uso de IA e créditos

### Inteligência artificial no desenvolvimento

Durante o desenvolvimento da Modern Art Auction, utilizei **IA generativa (ChatGPT)** como ferramenta de apoio técnico, com o objetivo de acelerar a implementação dentro do prazo de sete dias estabelecido para o desafio.

A ferramenta foi utilizada principalmente nas seguintes atividades:

- **Elaboração e revisão de código:** apoio na construção de funcionalidades, análise de trechos de código e sugestões de melhorias.
- **Diagnóstico de problemas:** investigação de erros de execução, compilação, integração e configuração, com análise de mensagens de erro e alternativas de correção.
- **Validação de soluções:** discussão de abordagens, identificação de possíveis inconsistências e apoio na interpretação dos resultados dos testes.
- **Documentação:** auxílio na organização e redação das instruções de instalação, execução e apresentação do projeto.

O desenvolvimento ocorreu de forma iterativa, com integração e ajustes das soluções propostas. O projeto foi submetido a verificações de formatação (Prettier), análise estática (ESLint), compilação (build) e testes automatizados da API.

### Créditos das obras de arte

As obras e imagens do catálogo são consultadas por meio da [Open Access API do Cleveland Museum of Art](https://openaccess-api.clevelandart.org/), com seleção de imagens identificadas como **CC0**.

A aplicação é uma demonstração técnica e não possui vínculo comercial com o museu.

**Desenvolvimento:** [Fernando Paiva Sousa](https://github.com/fpaivabr)
**Repositório:** [fpaivabr/auction-house-challenge](https://github.com/fpaivabr/auction-house-challenge)
**Contexto:** desafio técnico Elite Dev — Verzel.
