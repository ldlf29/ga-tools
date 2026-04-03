# Grand Arena Tools - Project Context

## Project Overview
Grand Arena Tools is a specialized application for analyzing and optimizing performance in the "Grand Arena" game (associated with Moki characters). The project consists of a modern Next.js frontend and a Python-based Machine Learning pipeline for predictive analysis.

### Main Technologies
- **Frontend:** Next.js (App Router), React 19, TypeScript, Framer Motion (animations), Recharts (data visualization), SWR (data fetching).
- **Backend:** Supabase (PostgreSQL, Authentication, Realtime features).
- **ML Pipeline:** Python, CatBoost (Classification & Regression), FastAPI (Inference API), Pandas, Scikit-learn.
- **Infrastructure:** Vercel (Frontend Hosting), GitHub Actions (Automation for data sync cron jobs).

## Architecture

### 1. Web Application (`src/`)
- **App Router:** Located in `src/app`, handles page routing and API endpoints.
- **Components:** Modular React components in `src/components`. Notable components include `LineupBuilder`, `PredictionsTab`, and `CardGrid`.
- **Services:** External integrations like `AlchemyService.ts` for blockchain/NFT data and `DiscordService.ts`.
- **Scripts:** Node.js/TypeScript scripts in `src/scripts` for database synchronization and maintenance tasks.

### 2. Machine Learning Pipeline (`ml/`)
A multi-step pipeline for processing game data and training predictive models:
- **Data Collection:** `1_collect_data.py` fetches match performances from the Grand Arena API.
- **Preprocessing:** `2_preprocess.py` performs feature engineering.
- **Model Training:** `6_train_models.py` trains CatBoost models for WinRate and Expected Points.
- **Inference:** `7_api_server.py` provides a FastAPI server for real-time predictions.
- **Ranking:** `8_generate_rank.py` produces the performance rankings used by the frontend.

## Building and Running

### Frontend Development
1. Install dependencies: `npm install`
2. Configure environment: Create `.env.local` with necessary Supabase and API keys.
3. Run development server: `npm run dev`
4. Build for production: `npm run build`

### Data Synchronization
Sync scripts are used to keep the database up-to-date with game API data:
- Sync matches: `npx tsx src/scripts/cron_sync_matches.ts`
- Sync upcoming matches: `npx tsx src/scripts/cron_sync_upcoming.ts`

### ML Pipeline Execution
1. Install Python dependencies: `pip install -r ml/requirements.txt`
2. Run the pipeline steps sequentially (e.g., `python ml/1_collect_data.py --token <token>`, then step 2, etc.).
3. Start the inference API: `python ml/7_api_server.py`

## Development Conventions

### Frontend
- **Type Safety:** Strict TypeScript usage for all new code.
- **Styling:** CSS Modules (`*.module.css`) for component-specific styles.
- **Data Fetching:** Prefer `swr` for client-side fetching and Next.js Server Components/API routes for server-side logic.
- **Database Access:** Use `lib/supabase.ts` for client-side and `lib/supabase-admin.ts` for server-side operations requiring elevated permissions.

### Backend/ML
- **Data Integrity:** Ensure that ML-generated rankings are properly upserted to the `moki_predictions_ranking` table in Supabase.
- **Model Storage:** CatBoost models (`.cbm`) are stored in `ml/models/`.
- **API Standards:** FastAPI for Python-based services, following RESTful principles.

## Key Files
- `package.json`: Frontend dependencies and scripts.
- `ml/README.md`: Detailed documentation for the ML pipeline.
- `src/utils/lineupGenerator.ts`: Core logic for generating optimized game lineups.
- `src/scripts/cron_sync_matches.ts`: Primary script for fetching historical match data.
- `src/app/api/predictions/ranking/route.ts`: Endpoint serving prediction data to the frontend.
