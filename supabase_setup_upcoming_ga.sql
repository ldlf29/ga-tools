-- 1. Eliminar la tabla si ya existía (Opcional, útil si necesitas resetear el schema)
DROP TABLE IF EXISTS public.upcoming_matches_ga;

-- 2. Crear la nueva tabla
CREATE TABLE public.upcoming_matches_ga (
    id TEXT PRIMARY KEY,
    contest_id TEXT NOT NULL,
    match_date TIMESTAMP WITH TIME ZONE,
    team_red JSONB NOT NULL DEFAULT '[]'::jsonb,
    team_blue JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar Seguridad de Nivel de Fila (RLS)
ALTER TABLE public.upcoming_matches_ga ENABLE ROW LEVEL SECURITY;

-- 4. Crear Política de Lectura Pública (Cualquiera puede leer los partidos)
CREATE POLICY "Enable read access for all users" 
ON public.upcoming_matches_ga 
FOR SELECT 
USING (true);

-- 5. Crear Política de Inserción/Borrado solo para Service Role (El Cron)
-- Dependiendo de tu configuración de Supabase, el Service Role bypass-ea el RLS automáticamente,
-- por lo que con el SELECT público ya es suficiente para el frontend.

-- 6. Índices Opcionales para mejorar la persistencia/búsqueda
CREATE INDEX IF NOT EXISTS idx_upcoming_contest_id ON public.upcoming_matches_ga(contest_id);
-- Si en el futuro necesitas filtrar dentro del JSON directamente desde SQL:
-- CREATE INDEX idx_upcoming_red_jsonb ON public.upcoming_matches_ga USING gin (team_red);
-- CREATE INDEX idx_upcoming_blue_jsonb ON public.upcoming_matches_ga USING gin (team_blue);
