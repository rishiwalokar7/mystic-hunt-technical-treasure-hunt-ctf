import re

with open('app/admin/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace imports
content = content.replace("import { DemoDB } from '@/lib/demo-db'", "import { supabase } from '@/lib/supabase'")

# Make fetchNodes async
content = content.replace("const fetchNodes = () => {", "const fetchNodes = async () => {")
content = content.replace("setStages(DemoDB.getRound1Stages())", "const { data: s } = await supabase.from('round1_stages').select('*').order('created_at', { ascending: false }); setStages(s || [])")
content = content.replace("setChallenges(DemoDB.getRound2Challenges())", "const { data: c } = await supabase.from('round2_challenges').select('*').order('created_at', { ascending: false }); setChallenges(c || [])")
content = content.replace("setTeamsList(DemoDB.getTeams())", "const { data: t } = await supabase.from('teams').select('*').order('created_at', { ascending: false }); setTeamsList(t || [])")

# Make fetchLeaderboard async
content = content.replace("const fetchLeaderboard = () => {", "const fetchLeaderboard = async () => {")
content = content.replace(
"""    const teams = DemoDB.getTeams()
    const profiles = DemoDB.getProfiles()
    const progress = DemoDB.getStageProgress()
    const state = DemoDB.getSystemState()""", 
"""    const { data: teams } = await supabase.from('teams').select('*')
    const { data: profiles } = await supabase.from('profiles').select('*')
    const { data: progress } = await supabase.from('stage_progress').select('*')
    const { data: stateData } = await supabase.from('system_state').select('*').eq('id', 1).single()

    if (!teams || !profiles || !progress) return

    const state = stateData || { phase: 'PHASE_1', reset_strategy: 'CUMULATIVE' }"""
)

# Fix resetStrategy to reset_strategy
content = content.replace("state.resetStrategy === 'HARD_RESET'", "state.reset_strategy === 'HARD_RESET'")
content = content.replace("resetStrategy: 'CUMULATIVE' | 'HARD_RESET'", "reset_strategy: 'CUMULATIVE' | 'HARD_RESET'")
content = content.replace("resetStrategy: 'CUMULATIVE'", "reset_strategy: 'CUMULATIVE'")
content = content.replace("DemoDB.getSystemState()", "(() => { supabase.from('system_state').select('*').eq('id',1).single().then(({data}) => { if(data) setSystemState({ phase: data.phase, reset_strategy: data.reset_strategy }) }) })()")


# handleDeploy async
content = content.replace("const handleDeploy = (e: React.FormEvent) => {", "const handleDeploy = async (e: React.FormEvent) => {")
content = content.replace("DemoDB.addRound1Stage({", "await supabase.from('round1_stages').insert({")
content = content.replace("DemoDB.addRound2Challenge({", "await supabase.from('round2_challenges').insert({")

# handleToggleLock
content = content.replace("const handleToggleLock = (id: string, type: 'stage' | 'challenge', currentState: boolean) => {", "const handleToggleLock = async (id: string, type: 'stage' | 'challenge', currentState: boolean) => {")
content = content.replace("DemoDB.toggleRound1Stage(id, newState)", "await supabase.from('round1_stages').update({ is_active: newState }).eq('id', id)")
content = content.replace("DemoDB.toggleRound2Challenge(id, newState)", "await supabase.from('round2_challenges').update({ is_active: newState }).eq('id', id)")

# handleDelete
content = content.replace("const handleDelete = (id: string, type: 'stage' | 'challenge') => {", "const handleDelete = async (id: string, type: 'stage' | 'challenge') => {")
content = content.replace("DemoDB.deleteRound1Stage(id)", "await supabase.from('round1_stages').delete().eq('id', id)")
content = content.replace("DemoDB.deleteRound2Challenge(id)", "await supabase.from('round2_challenges').delete().eq('id', id)")

# handleResetLeaderboard
content = content.replace("const handleResetLeaderboard = () => {", "const handleResetLeaderboard = async () => {")
content = content.replace("DemoDB.resetStageProgress()", "await supabase.from('stage_progress').delete().neq('id', '00000000-0000-0000-0000-000000000000')")
content = content.replace(
"""    // Unlock Round 1
    const s = DemoDB.getRound1Stages()
    s.forEach(stage => DemoDB.toggleRound1Stage(stage.id, true))""",
"""    // Unlock Round 1
    await supabase.from('round1_stages').update({ is_active: true }).neq('id', '00000000-0000-0000-0000-000000000000')"""
)
content = content.replace(
"""    // Reset Global State to Phase 1
    const newState = { phase: 'PHASE_1' as const, resetStrategy: 'CUMULATIVE' as const }
    DemoDB.setSystemState(newState)
    setSystemState(newState)""",
"""    // Reset Global State to Phase 1
    const newState = { phase: 'PHASE_1' as const, reset_strategy: 'CUMULATIVE' as const }
    await supabase.from('system_state').update({ phase: 'PHASE_1', reset_strategy: 'CUMULATIVE' }).eq('id', 1)
    setSystemState(newState)"""
)

# handleInitiateRound2
content = content.replace("const handleInitiateRound2 = () => {", "const handleInitiateRound2 = async () => {")
content = content.replace(
"""    // 1. Lock Round 1
    const s = DemoDB.getRound1Stages()
    s.forEach(stage => DemoDB.toggleRound1Stage(stage.id, false))""",
"""    // 1. Lock Round 1
    await supabase.from('round1_stages').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')"""
)
content = content.replace(
"""    // 2. Promote ALL teams and wipe leaderboard
    DemoDB.resetStageProgress()
    const teams = DemoDB.getTeams()
    teams.forEach(team => {
      DemoDB.updateTeamFinalistStatus(team.id, true)
    })""",
"""    // 2. Promote ALL teams and wipe leaderboard
    await supabase.from('stage_progress').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('teams').update({ is_finalist: true }).neq('id', '00000000-0000-0000-0000-000000000000')"""
)
content = content.replace(
"""    // 3. Update Global State
    const newState = { phase: 'PHASE_2' as const, resetStrategy: 'HARD_RESET' as const }
    DemoDB.setSystemState(newState)
    setSystemState(newState)""",
"""    // 3. Update Global State
    const newState = { phase: 'PHASE_2' as const, reset_strategy: 'HARD_RESET' as const }
    await supabase.from('system_state').update({ phase: 'PHASE_2', reset_strategy: 'HARD_RESET' }).eq('id', 1)
    setSystemState(newState)"""
)

# Teams inline actions
content = content.replace("onClick={() => {", "onClick={async () => {")
content = content.replace("DemoDB.addTeam(newTeamName, newTeamPass);", "await supabase.from('teams').insert({ name: newTeamName, password: newTeamPass });")
content = content.replace("DemoDB.updateTeamFinalistStatus(team.id, !team.is_finalist);", "await supabase.from('teams').update({ is_finalist: !team.is_finalist }).eq('id', team.id);")
content = content.replace("DemoDB.deleteTeam(team.id);", "await supabase.from('teams').delete().eq('id', team.id);")

with open('app/admin/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Admin rewritten")
