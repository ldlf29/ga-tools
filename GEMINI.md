# Grand Arena Tools - Project Context

## Project Overview
Grand Arena Tools is a specialized application for analyzing and optimizing performance in the "Grand Arena" game (associated with Moki characters). The project consists of a modern Next.js frontend and a Python-based Machine Learning pipeline for predictive analysis.

### Main Technologies
- **Frontend:** Next.js (App Router), React 19, TypeScript, Framer Motion (animations), Recharts (data visualization), SWR (data fetching), TanStack Query (v5).
- **Web3/Wallet:** Wagmi, Viem, SIWE (Sign-In with Ethereum), Ethers v6.
- **Backend:** Supabase (PostgreSQL, Authentication, Realtime features).
- **ML Pipeline:** Python, CatBoost (Classification & Regression), Optuna (Bayesian Optimization), Pandas, Scikit-learn.
- **Infrastructure:** Vercel (Frontend Hosting & Analytics), GitHub Actions (Automation for data sync cron jobs).

## Architecture

### 1. Web Application (`src/`)
- **App Router:** Located in `src/app`, handles page routing (including i18n in `[locale]`) and API endpoints.
- **Components:** Modular React components in `src/components`. Notable components include `LineupBuilder`, `PredictionsTab`, `CardGrid`, `FilterSidebar`, and `UpcomingMatches`.
- **Services:** External integrations like `AlchemyService.ts` (Blockchain/NFT data) and `DiscordService.ts`.
- **Scripts:** Node.js/TypeScript scripts in `src/scripts` for database synchronization (`sync-db.ts`) and maintenance tasks.
- **I18n:** Internationalization support implemented using route-based locales (`src/app/[locale]`).

### 2. Machine Learning Pipeline (`ml/`)
A multi-step pipeline for processing game data and training predictive models using a **Cascade Stacking** architecture.
- `1_collect_data.py`: Fetches match performances from the Grand Arena API.
- `2_preprocess.py`: Cleans raw data and performs feature engineering (Team Comps, etc.).
- `3_prepare_features.py`: Generates numerical matrices for CatBoost.
- `4_train_models.py`: Trains primary (Score, WinRate) and auxiliary models (Deaths, Deposits).
- `5_generate_rank.py`: Produces performance rankings for 180+ Moki Champions.
- `6_evaluate_results.py`: Performs validation and backtesting (MAE/Accuracy).
- `7_retrain_from_supabase.py`: Automated feedback loop for incremental learning.
- `8_optimize_hyperparameters.py`: Bayesian Tuning with Optuna.

## Database Schema (`supabase/`)
The database contains several tables and functions for game data:
- `moki_predictions_ranking`: Stores the ML-generated rankings.
- `upcoming_matches`: Stores upcoming GA match schedules.
- `class_changes`: Tracks changes in Moki classes.
- SQL setup scripts are located in the `supabase/` directory (e.g., `schema_predictions.sql`, `create_moki_stats.sql`).

## Core Logic & Algorithms
- **Lineup Generation**: The system uses a greedy algorithm with scoring multipliers for rarity and strategy-specific formulas. Detailed documentation is in `LOGIC_REPORT_LINEUP_GENERATOR.md`.
- **Scoring Formulas**:
  - **Trait/Fur**: `(Base Score * Multiplier) + 1,000`
  - **Touching The Wart**: `(Base Score * Multiplier) + (Wart Closer * 175)`
  - **Gacha/Collective**: `((Gacha Pts + (WinRate/10)*300) * Multiplier) + (Gacha Pts * 0.5)`

## Building and Running

### Frontend Development
1. Install dependencies: `npm install`
2. Configure environment: Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. Run development server: `npm run dev`
4. Build for production: `npm run build`

### Data Synchronization
- Run the general sync script: `npm run sync` (points to `src/scripts/sync-db.ts`)
- Specific sync scripts can be run via `tsx`: `npx tsx src/scripts/cron_sync_matches.ts`

### ML Pipeline Execution
1. Install Python dependencies: `pip install -r ml/requirements.txt`
2. Run steps sequentially (e.g., `python ml/1_collect_data.py`).

## Development Conventions

### Frontend
- **Type Safety**: Strict TypeScript usage.
- **Styling**: CSS Modules (`*.module.css`) for component-specific styles.
- **Data Fetching**: Prefer `SWR` for UI-driven fetching and `supabaseAdmin` in API routes/Server Actions.
- **Web3**: Follow Wagmi/Viem best practices for wallet interactions.

### Backend/ML
- **Data Integrity**: ML rankings must be upserted to `moki_predictions_ranking`.
- **Model Storage**: CatBoost models (`.cbm`) are stored in `ml/models/`.
- **Python Style**: Use Pandas for data manipulation and Scikit-learn for preprocessing.

## Key Files
- `package.json`: Frontend dependencies and scripts.
- `LOGIC_REPORT_LINEUP_GENERATOR.md`: Exhaustive logic for the lineup builder.
- `ml/README.md`: Detailed documentation for the ML pipeline.
- `src/utils/lineupGenerator.ts`: Implementation of the lineup generation logic.
- `src/app/api/predictions/ranking/route.ts`: API serving prediction data.
