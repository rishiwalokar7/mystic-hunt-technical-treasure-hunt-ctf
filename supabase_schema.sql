-- WIPE EXISTING TABLES IF THEY EXIST
DROP TABLE IF EXISTS hint_usage CASCADE;
DROP TABLE IF EXISTS stage_progress CASCADE;
DROP TABLE IF EXISTS round2_challenges CASCADE;
DROP TABLE IF EXISTS round1_stages CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS system_state CASCADE;

-- CREATE NEW TABLES

-- 1. Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  is_finalist BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Profiles (Agents)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  callsign TEXT NOT NULL,
  is_leader BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, callsign)
);

-- 3. System State (Singleton)
CREATE TABLE system_state (
  id INT PRIMARY KEY DEFAULT 1,
  phase TEXT NOT NULL DEFAULT 'PHASE_1',
  reset_strategy TEXT NOT NULL DEFAULT 'CUMULATIVE'
);
-- Initialize singleton row
INSERT INTO system_state (id, phase, reset_strategy) VALUES (1, 'PHASE_1', 'CUMULATIVE');

-- 4. Phase 1 Missions
CREATE TABLE round1_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location_clue TEXT NOT NULL,
  clue_answer TEXT NOT NULL,
  access_code TEXT NOT NULL,
  final_answer TEXT NOT NULL,
  points INT NOT NULL DEFAULT 100,
  hint TEXT,
  hint_penalty INT DEFAULT 25,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Phase 2 Digital Breaches
CREATE TABLE round2_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'GENERAL',
  flag TEXT NOT NULL,
  points INT NOT NULL DEFAULT 100,
  hint TEXT,
  hint_penalty INT DEFAULT 25,
  is_active BOOLEAN DEFAULT true,
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Stage Progress (Score tracking)
CREATE TABLE stage_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES round1_stages(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES round2_challenges(id) ON DELETE CASCADE,
  points_awarded INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Prevent a team from securing the same stage/challenge twice
  CONSTRAINT unique_team_stage UNIQUE(team_id, stage_id),
  CONSTRAINT unique_team_challenge UNIQUE(team_id, challenge_id)
);

-- 7. Hint Usage (To track penalty application)
CREATE TABLE hint_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES round1_stages(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES round2_challenges(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- DISABLE ROW LEVEL SECURITY FOR MVP
-- (If you want RLS, you can enable it later, but keeping it off simplifies Next.js client-side queries for the event)
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE round1_stages DISABLE ROW LEVEL SECURITY;
ALTER TABLE round2_challenges DISABLE ROW LEVEL SECURITY;
ALTER TABLE stage_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE hint_usage DISABLE ROW LEVEL SECURITY;
