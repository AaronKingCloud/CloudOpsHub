# CloudOps Hub — Frontend

React 19 + TypeScript dashboard built with Vite.

## Run it

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

| Command           | What it does                         |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start dev server with hot reload     |
| `npm run build`   | Type-check and build to `dist/`      |
| `npm run lint`    | Run ESLint                           |
| `npm run preview` | Serve the production build locally   |

## Mock data vs real backend

By default the app uses **mock data** so it runs without the backend.

To use the real backend, copy `.env.example` to `.env.local` and set:

```
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:8000/api
```

Restart `npm run dev` after changing env files.

## Folder layout

```
src/
├── components/   UI components (StatCard, CpuChart, AccountList, ...)
├── hooks/        Reusable hooks (useApi: loading / error / data)
├── mock/         Mock data used when VITE_USE_MOCK is not "false"
├── services/     API calls — components fetch data ONLY through here
├── types/        TypeScript types matching docs/api/frontend-contract.md
├── App.tsx       Page layout
└── main.tsx      Entry point
```

## Adding a new data source

1. Add the type in `src/types/`
2. Add mock data in `src/mock/`
3. Add a function in `src/services/dashboardService.ts`
4. Use it in a component: `const { data, loading, error } = useApi(getSomething);`
5. Document the endpoint in `docs/api/frontend-contract.md`
