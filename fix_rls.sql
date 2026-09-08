-- ENABLE RLS ON ALL TABLES
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE round1_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE round2_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE hint_usage ENABLE ROW LEVEL SECURITY;

-- CREATE POLICIES TO ALLOW ALL OPERATIONS (Read, Insert, Update, Delete) FOR EVERYONE
-- Since this is an MVP without Supabase Auth, we allow anonymous access.

-- Teams
DROP POLICY IF EXISTS "Allow all on teams" ON teams;
CREATE POLICY "Allow all on teams" ON teams FOR ALL USING (true) WITH CHECK (true);

-- Profiles
DROP POLICY IF EXISTS "Allow all on profiles" ON profiles;
CREATE POLICY "Allow all on profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);

-- System State
DROP POLICY IF EXISTS "Allow all on system_state" ON system_state;
CREATE POLICY "Allow all on system_state" ON system_state FOR ALL USING (true) WITH CHECK (true);

-- Round 1 Stages
DROP POLICY IF EXISTS "Allow all on round1_stages" ON round1_stages;
CREATE POLICY "Allow all on round1_stages" ON round1_stages FOR ALL USING (true) WITH CHECK (true);

-- Round 2 Challenges
DROP POLICY IF EXISTS "Allow all on round2_challenges" ON round2_challenges;
CREATE POLICY "Allow all on round2_challenges" ON round2_challenges FOR ALL USING (true) WITH CHECK (true);

-- Stage Progress
DROP POLICY IF EXISTS "Allow all on stage_progress" ON stage_progress;
CREATE POLICY "Allow all on stage_progress" ON stage_progress FOR ALL USING (true) WITH CHECK (true);

-- Hint Usage
DROP POLICY IF EXISTS "Allow all on hint_usage" ON hint_usage;
CREATE POLICY "Allow all on hint_usage" ON hint_usage FOR ALL USING (true) WITH CHECK (true);
