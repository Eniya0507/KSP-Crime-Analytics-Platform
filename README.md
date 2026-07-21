# KSP Crime Intelligence & Analytics Platform

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-xsf42uuv)

AI-powered crime intelligence and analytics platform for Karnataka State Police — built for the KSP Datathon 2026.

---

## Features

| Module | Description |
|---|---|
| Dashboard | Statewide KPIs, charts, alerts, hotspots, repeat offenders |
| Crime Search | Full CRUD — create, edit, delete, archive, filter, sort, paginate |
| Case Detail | AI investigation summary, SHAP risk, similar cases, notes, timeline |
| AI Chatbot | RAG pipeline, English + Kannada, voice input/output, conversation history |
| Analytics | Monthly/yearly trends, district/station breakdown, radar, seasonal |
| Hotspot Map | Leaflet heatmap, zone analysis, nearby crime prediction |
| Forecast | STL decomposition + XGBoost-compatible, district/crime-type modes |
| Network Analysis | Force-directed graph, gang detection, leader detection, hidden link prediction |
| Investigation Timeline | Case event reconstruction |
| Reports | Dashboard, Case, Investigation, Analytics, Conversation, Audit PDFs |
| Alerts | Severity filter, dismiss/restore, real-time signals |
| Accused Profile | SHAP risk waterfall, crime history, gang affiliation |
| Victim Profile | Injury severity, linked case |
| Patrol Recommendation | AI-driven deployment, map waypoints |
| Audit Logs | Login, case access, AI query, report, prediction logs |
| Manage | Full CRUD for Accused, Victims, Officers, Stations, Districts |
| Role-Based Access | Admin, Supervisor, Investigator, Analyst |
| Bilingual | English + Kannada (ಕನ್ನಡ) throughout |
| Catalyst Integration | AppSail, DataStore, Functions, Cron, Cache, Signals, Stratus, QuickML, SmartBrowz |

---

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@ksp.gov.in | admin123 |
| Supervisor | supervisor@ksp.gov.in | super123 |
| Investigator | investigator@ksp.gov.in | invest123 |
| Analyst | analyst@ksp.gov.in | analyst123 |

---

## Quick Start (Local Dev)

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (works in demo mode without Supabase)
npm run dev

# 3. Open http://localhost:5173
```

The app runs fully in **demo mode** with 1,000 synthetic cases, 2,500 accused, 1,500 victims, 500 officers, 150 stations, and 31 Karnataka districts — no Supabase required.

---

## Enable Live Database (Supabase)

```bash
# 1. Create a Supabase project at https://supabase.com
# 2. Run the migration
supabase db push  # or paste supabase/migrations/*.sql in the SQL editor

# 3. Update .env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# 4. Seed the database (from the app: Settings > Seed Database)
# Or run the seed script directly in the browser console
```

---

## Production Build

```bash
npm run build
# Output: dist/
```

---

## Docker

```bash
# Build and run
docker build -t ksp-platform .
docker run -p 3000:3000 \
  -e VITE_SUPABASE_URL=your-url \
  -e VITE_SUPABASE_ANON_KEY=your-key \
  ksp-platform

# Or with Docker Compose
docker-compose up
```

---

## Zoho Catalyst Deployment

### Prerequisites
```bash
npm install -g @zohocloud/catalyst-cli
catalyst login
```

### Deploy
```bash
# Full deployment (frontend + functions + cron)
bash deploy.sh

# Or step by step:
npm run build
catalyst deploy --component appsail --name ksp-frontend
```

### Configuration
1. Update `catalyst.json` with your `project_id`, `project_key`, `org_id`
2. Update `app-config.json` with your Supabase credentials
3. Set environment variables in Catalyst AppSail dashboard

---

## Project Structure

```
src/
├── ai/           # AI modules: chat, forecast, investigation, risk, reports
├── components/   # Reusable UI: Layout, Sidebar, TopBar, MapView, NetworkGraph, charts
├── data/         # Synthetic data: generator, analytics, catalog
├── i18n/         # Bilingual translations (EN + KN)
├── lib/          # Supabase client, DB layer, fallback layer
├── pages/        # All route pages
│   └── manage/   # CRUD management pages
├── store/        # Zustand stores: auth, chat, audit, alerts
└── types.ts      # Core TypeScript types

catalyst-functions/
├── ai-query/     # Catalyst Function: AI chatbot backend
├── forecast/     # Catalyst Function: QuickML forecast serving
└── alerts-cron/  # Catalyst Cron: daily alert generation

supabase/
└── migrations/   # PostgreSQL schema with RLS policies
```

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **State**: Zustand (auth, chat, audit, alerts)
- **Charts**: Recharts
- **Maps**: Leaflet
- **Database**: Supabase (PostgreSQL + RLS)
- **AI/ML**: STL decomposition, SHAP-style explainability, RAG chatbot
- **Deployment**: Zoho Catalyst (AppSail, Functions, DataStore, QuickML)
- **i18n**: English + Kannada

---

## Commands Reference

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run typecheck    # TypeScript type check
npm run lint         # ESLint
docker-compose up    # Run with Docker
bash deploy.sh       # Deploy to Zoho Catalyst
```

---

*KSP Datathon 2026 · For official use only · CONFIDENTIAL*
