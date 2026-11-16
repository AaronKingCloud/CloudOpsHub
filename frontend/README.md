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
├── App.tsx       Routes (which URL shows which page)
├── pages/        One file per page: Overview, Devices, Alerts, Accounts, AWS Cloud, Users
├── components/
│   ├── layout/   App shell: sidebar, top bar, page header, icons, navItems.ts
│   ├── aws/      AWS Cloud page pieces (account card, EC2 table, CPU panel)
│   ├── users/    Admin user management (Add user dialog)
│   └── *.tsx     Dashboard widgets (StatCard, CpuChart, MetricChart, DeviceTable, ...)
├── context/      AuthProvider (signed-in user, roles), RefreshProvider (auto-refresh)
├── hooks/        useApi (loading / error / data / reload), useSort, useAuth, useTheme
├── mock/         Mock data used when VITE_USE_MOCK is not "false"
├── services/     API calls (dashboard, aws, auth, users) — components fetch data ONLY through here
├── styles/       shell.css (layout), widgets.css (states, charts, sorting), cloud.css, users.css;
│                 global colour tokens are in index.css
├── types/        TypeScript types matching docs/api/frontend-contract.md
└── main.tsx      Entry point
```

## Adding a new page

1. Create `src/pages/MyPage.tsx` (start with `<PageHeader />`, then panels)
2. Add a `<Route path="my-page" element={<MyPage />} />` in `src/App.tsx`
3. Add an entry to `src/components/layout/navItems.ts` (label, icon, description;
   set `roles` to hide it from some users)

## Auto-refresh

Pages with live data (Overview, Devices, Alerts, Accounts) refresh every 30 seconds while the tab
is visible. The control at the top right of those pages shows the last update, turns auto-refresh
off, or refreshes now.

A component opts in with `useApi(fetcher, { live: true })`. **Don't** use `live` for calls that cost
money or have tight quotas (AWS, billing / Cost Explorer): give those a manual refresh button that
calls `reload()` instead, like the EC2 panel does.

## Loading and errors

Use the shared pieces in `components/PanelStatus.tsx`:
`<Skeleton rows={3} />` (or `height={240}` for charts) while loading, and
`<ErrorState what="devices" message={error} onRetry={reload} />` on failure.

## Theme

The moon/sun button in the top bar cycles **System → Light → Dark**. The choice is saved
in the browser. Colours are CSS variables in `index.css`, so new components should use
`var(--surface)`, `var(--text-h)`, `var(--ok)`, etc. instead of hard-coded colours.

## Adding a new data source

1. Add the type in `src/types/`
2. Add mock data in `src/mock/`
3. Add a function in `src/services/dashboardService.ts`
4. Use it in a component: `const { data, loading, error } = useApi(getSomething);`
5. Document the endpoint in `docs/api/frontend-contract.md`
