# DocNotes — Frontend

Interface web do **DocNotes**: envie um PDF e converse com uma IA sobre o conteúdo dele. Cada resposta mostra as páginas de origem e grifa os trechos do documento que foram usados. Tudo roda localmente.

Este repositório é só a interface. Ela precisa do **backend** do DocNotes (API FastAPI + Ollama) rodando, que fica em outro repositório do projeto.

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS 4
- oxlint

## Início rápido com Docker (recomendado)

Precisa do **Docker** com o **Docker Compose v2**. Não é preciso instalar Node.

**1. Suba o backend primeiro**, no repositório do backend:

```bash
docker compose up --build
```

Na primeira vez, ele baixa os modelos de IA (~2,5 GB) e demora alguns minutos. Espere até a API responder em http://localhost:8000/health.

**2. Suba o frontend**, neste repositório:

```bash
docker compose up --build
```

**3. Acesse http://localhost:5173.**

### Como o frontend acha o backend

O navegador chama sempre `/api/*` e o Vite repassa a chamada para o backend, removendo o `/api`. Como tudo sai da mesma origem, o backend não precisa de CORS.

```
navegador → localhost:5173/api/chat → (proxy do Vite) → backend:8000/chat
```

No Docker, o destino padrão é `http://host.docker.internal:8000`, a porta 8000 publicada na sua máquina. Funciona com o backend rodando em Docker ou direto na máquina. No segundo caso, o uvicorn precisa estar com `--host 0.0.0.0`. Para apontar para outro endereço:

```bash
BACKEND_URL=http://192.168.0.10:8000 docker compose up
```

O código fica montado no container, então editar os arquivos atualiza a página na hora (hot reload).

## Rodando sem Docker

**Pré-requisitos:** Node.js ≥ 20.19 e npm, e o backend rodando em http://localhost:8000.

```bash
npm install
npm run dev
```

Acesse http://localhost:5173. Se o backend estiver em outro endereço, crie um `.env` a partir do [.env.example](.env.example) e ajuste `BACKEND_URL`.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com hot reload e proxy para o backend |
| `npm run build` | Checa os tipos e gera o build de produção em `dist/` |
| `npm run preview` | Serve o build de `dist/` localmente |
| `npm run lint` | Roda o oxlint |

> O proxy `/api` é do Vite. Para publicar o `dist/` em produção, o servidor web (Nginx, Caddy etc.) precisa repassar `/api/*` para o backend da mesma forma.

## Usando

1. Arraste um PDF para a área de upload ou clique em **Escolher arquivo** (até 20 MB).
2. Aguarde o processamento. PDFs grandes podem levar alguns minutos.
3. Faça perguntas. Cada resposta traz as páginas de origem (`p. N`) e os trechos usados, grifados.
4. Para trocar de documento, clique em **Remover documento** e envie outro.

O documento fica salvo no backend: recarregar a página não o apaga. Só a conversa recomeça.

Se o Ollama estiver fora do ar ou faltar algum modelo, aparece um aviso no topo da tela explicando o que fazer. Se o backend não responder, a tela mostra o erro e um botão para tentar de novo.

## Estrutura

```
src/
  main.tsx                  ponto de entrada
  App.tsx                   telas: carregando, upload, processamento e chat
  index.css                 tema (cores, fontes) e estilos globais do Tailwind
  services/
    api.ts                  cliente tipado da API e tratamento de erros
  components/
    FileUpload.tsx          área de arrastar/escolher o PDF
    ChatMessage.tsx         mensagem do usuário, da IA ou de erro
    SourceReference.tsx     trecho do documento citado como fonte
vite.config.ts              plugins e proxy /api → backend
Dockerfile                  imagem de desenvolvimento (Vite)
docker-compose.yml          sobe o frontend apontando para o backend
```
