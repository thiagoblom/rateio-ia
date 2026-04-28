# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Docker

1. Execute `docker-compose build` para construir os contêineres (`web` vai gerar o `dist/` e `json-server` fica responsável pela API).
2. Suba tudo com `docker-compose up -d` e abra `http://localhost` (ou ajuste a porta) para ver a interface. O `json-server` roda em `http://localhost:3000` e o frontend já aponta para ele via `VITE_API_URL`.
3. Para atualizar os dados do `db.json`, edite o arquivo local e reinicie o serviço `json-server` (`docker-compose restart json-server`) ou monte um volume com persistência no seu servidor.
