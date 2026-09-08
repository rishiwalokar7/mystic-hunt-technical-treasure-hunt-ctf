import re

with open('app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace imports
content = content.replace("import { DemoDB } from '@/lib/demo-db'", "import { supabase } from '@/lib/supabase'")

# Add new states
state_insertion = """  const [stageProgress, setStageProgress] = useState<any[]>([])
  const [hintUsage, setHintUsage] = useState<any[]>([])
"""
content = content.replace("const [feedback, setFeedback] = useState<string | null>(null)", "const [feedback, setFeedback] = useState<string | null>(null)\n" + state_insertion)

# Replace handleUseHint
old_hint = """  const handleUseHint = (id: string, penalty: number, isChallenge = false) => {
    if (!profile) return
    if (!window.confirm(`Using this hint will cost you ${penalty} points. Proceed?`)) return
    DemoDB.consumeHint(isChallenge ? { profile_id: profile.id, challenge_id: id } : { profile_id: profile.id, stage_id: id })
    DemoDB.addStageProgress({ profile_id: profile.id, team_id: profile.team_id, ...(isChallenge ? { challenge_id: id } : { stage_id: id }), points_awarded: -penalty })
    setFeedback(`Hint revealed! -${penalty} pts deducted.`)
    fetchArenaData()
  }"""
new_hint = """  const handleUseHint = async (id: string, penalty: number, isChallenge = false) => {
    if (!profile) return
    if (!window.confirm(`Using this hint will cost you ${penalty} points. Proceed?`)) return
    
    const hintObj = isChallenge ? { profile_id: profile.id, challenge_id: id } : { profile_id: profile.id, stage_id: id }
    await supabase.from('hint_usage').insert(hintObj)
    
    const progObj = { profile_id: profile.id, team_id: profile.team_id, ...(isChallenge ? { challenge_id: id } : { stage_id: id }), points_awarded: -penalty }
    await supabase.from('stage_progress').insert(progObj)
    
    setFeedback(`Hint revealed! -${penalty} pts deducted.`)
    fetchArenaData()
  }"""
content = content.replace(old_hint, new_hint)

# Replace fetchArenaData
old_fetch = """  const fetchArenaData = () => {
    if (!agentCallsign) {
      setLoading(false)
      return
    }

    const profiles = DemoDB.getProfiles()
    // Find the profile using the stored agent callsign
    const prof = profiles.find(p => p.callsign === agentCallsign)
    
    if (!prof) {
      // Auto-logout if removed
      setAgentCallsign('')
      setLoading(false)
      return
    }

    const state = DemoDB.getSystemState()
    setSystemState(state)

    if (prof) {
      setProfile(prof)
      setTeamMembers(profiles.filter(p => p.team_id === prof.team_id))
      const teams = DemoDB.getTeams()
      const t = teams.find(t => t.id === prof.team_id)
      if (t) setAgentTeamName(t.name)

      const progress = DemoDB.getStageProgress().filter(p => p.team_id === prof.team_id)
      if (state.phase === 'PHASE_2' && state.resetStrategy === 'HARD_RESET') {
        setTotalScore(progress.filter(p => p.challenge_id).reduce((sum, p) => sum + p.points_awarded, 0))
      } else {
        setTotalScore(progress.reduce((sum, p) => sum + p.points_awarded, 0))
      }
    }
    
    const r1 = DemoDB.getRound1Stages().filter(s => s.is_active !== false)
    const r2 = DemoDB.getRound2Challenges().filter(c => c.is_active !== false)
    
    setRound1Stages(r1)
    setRound2Challenges(r2)
    setLoading(false)
  }"""
new_fetch = """  const fetchArenaData = async () => {
    if (!agentCallsign) {
      setLoading(false)
      return
    }

    const { data: profiles } = await supabase.from('profiles').select('*')
    const prof = profiles?.find(p => p.callsign === agentCallsign)
    
    if (!prof) {
      setAgentCallsign('')
      setLoading(false)
      return
    }

    const { data: stateData } = await supabase.from('system_state').select('*').eq('id', 1).single()
    const state = stateData || { phase: 'PHASE_1', reset_strategy: 'CUMULATIVE' }
    setSystemState({ phase: state.phase, resetStrategy: state.reset_strategy as 'CUMULATIVE' | 'HARD_RESET' })

    if (prof) {
      setProfile(prof)
      setTeamMembers(profiles?.filter(p => p.team_id === prof.team_id) || [])
      
      const { data: teams } = await supabase.from('teams').select('*')
      const t = teams?.find(t => t.id === prof.team_id)
      if (t) setAgentTeamName(t.name)

      const { data: allProgress } = await supabase.from('stage_progress').select('*')
      const progress = allProgress?.filter(p => p.team_id === prof.team_id) || []
      
      setStageProgress(progress)
      
      if (state.phase === 'PHASE_2' && state.reset_strategy === 'HARD_RESET') {
        setTotalScore(progress.filter(p => p.challenge_id).reduce((sum, p) => sum + p.points_awarded, 0))
      } else {
        setTotalScore(progress.reduce((sum, p) => sum + p.points_awarded, 0))
      }
      
      const { data: allHints } = await supabase.from('hint_usage').select('*')
      setHintUsage(allHints?.filter(h => h.profile_id === prof.id) || [])
    }
    
    const { data: r1Data } = await supabase.from('round1_stages').select('*').order('created_at', { ascending: true })
    const { data: r2Data } = await supabase.from('round2_challenges').select('*').order('created_at', { ascending: true })
    
    setRound1Stages(r1Data?.filter(s => s.is_active !== false) || [])
    setRound2Challenges(r2Data?.filter(c => c.is_active !== false) || [])
    setLoading(false)
  }"""
content = content.replace(old_fetch, new_fetch)


# Replace handleSubmitPhase1
content = content.replace("const handleSubmitPhase1 = (stageId: string, correctFinalAnswer: string, points: number) => {", "const handleSubmitPhase1 = async (stageId: string, correctFinalAnswer: string, points: number) => {")
content = content.replace(
"""    const currentProgress = DemoDB.getStageProgress().find(p => p.team_id === profile.team_id && p.stage_id === stageId)
    if (currentProgress) {""",
"""    const currentProgress = stageProgress.find(p => p.team_id === profile.team_id && p.stage_id === stageId)
    if (currentProgress) {"""
)
content = content.replace(
"""    if (answers[stageId]?.trim().toLowerCase() === correctFinalAnswer.trim().toLowerCase()) {
      DemoDB.addStageProgress({ profile_id: profile.id, team_id: profile.team_id, stage_id: stageId, points_awarded: points })
      setFeedback('Checkpoint Secured. Points Awarded.')""",
"""    if (answers[stageId]?.trim().toLowerCase() === correctFinalAnswer.trim().toLowerCase()) {
      await supabase.from('stage_progress').insert({ profile_id: profile.id, team_id: profile.team_id, stage_id: stageId, points_awarded: points })
      setFeedback('Checkpoint Secured. Points Awarded.')"""
)

# Replace handleSubmitPhase2
content = content.replace("const handleSubmitPhase2 = (chalId: string, correctFlag: string, points: number) => {", "const handleSubmitPhase2 = async (chalId: string, correctFlag: string, points: number) => {")
content = content.replace(
"""    const currentProgress = DemoDB.getStageProgress().find(p => p.team_id === profile.team_id && p.challenge_id === chalId)
    if (currentProgress) {""",
"""    const currentProgress = stageProgress.find(p => p.team_id === profile.team_id && p.challenge_id === chalId)
    if (currentProgress) {"""
)
content = content.replace(
"""    if (flags[chalId]?.trim() === correctFlag.trim()) {
      DemoDB.addStageProgress({ profile_id: profile.id, team_id: profile.team_id, challenge_id: chalId, points_awarded: points })
      setFeedback('System Breached. Points Awarded.')""",
"""    if (flags[chalId]?.trim() === correctFlag.trim()) {
      await supabase.from('stage_progress').insert({ profile_id: profile.id, team_id: profile.team_id, challenge_id: chalId, points_awarded: points })
      setFeedback('System Breached. Points Awarded.')"""
)

# Replace handleAuth
old_auth = """  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setAuthSuccess('')
    
    if (!loginTeamName.trim() || !loginTeamPass.trim() || !loginAgentName.trim()) {
      setLoginError('All fields are required.')
      return
    }

    const tName = loginTeamName.trim()
    const tPass = loginTeamPass.trim()
    const callsign = loginAgentName.trim().toUpperCase().replace(/ /g, '_')
    
    const teams = DemoDB.getTeams()
    const profiles = DemoDB.getProfiles()

    if (authAction === 'register') {
      if (registerMode === 'create') {
        const existingTeam = teams.find(t => t.name.toLowerCase() === tName.toLowerCase())
        if (existingTeam) {
          setLoginError('Team Name is already taken.')
          return
        }
        
        const newTeam = DemoDB.addTeam(tName, tPass)
        DemoDB.addProfile(callsign, newTeam.id, true)
        
        setAuthSuccess('Team registered successfully! Please login.')
        setAuthAction('login')
        return
      } else {
        // Join existing team
        const team = teams.find(t => t.name.toLowerCase() === tName.toLowerCase() && t.password === tPass)
        if (!team) {
          setLoginError('ACCESS DENIED: Invalid Team Name or Password.')
          return
        }
        
        const teamProfiles = profiles.filter(p => p.team_id === team.id)
        let prof = profiles.find(p => p.callsign === callsign && p.team_id === team.id)
        
        if (prof) {
          setLoginError('Agent already registered in this team. Please login.')
          return
        }
        
        if (teamProfiles.length >= 4) {
          setLoginError('Team is already full (Max 4 Agents).')
          return
        }
        
        DemoDB.addProfile(callsign, team.id, false)
        setAuthSuccess('Agent registered successfully! Please login.')
        setAuthAction('login')
        return
      }
    } else {
      // Login
      const team = teams.find(t => t.name.toLowerCase() === tName.toLowerCase() && t.password === tPass)
      if (!team) {
        setLoginError('ACCESS DENIED: Invalid Team Name or Password.')
        return
      }
      
      let prof = profiles.find(p => p.callsign === callsign && p.team_id === team.id)
      if (!prof) {
        setLoginError('Agent not registered in this team. Please register first.')
        return
      }
      
      setAgentCallsign(callsign)
      setLoading(true)
    }
  }"""
new_auth = """  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setAuthSuccess('')
    
    if (!loginTeamName.trim() || !loginTeamPass.trim() || !loginAgentName.trim()) {
      setLoginError('All fields are required.')
      return
    }

    const tName = loginTeamName.trim()
    const tPass = loginTeamPass.trim()
    const callsign = loginAgentName.trim().toUpperCase().replace(/ /g, '_')
    
    const { data: teams } = await supabase.from('teams').select('*')
    const { data: profiles } = await supabase.from('profiles').select('*')

    if (!teams || !profiles) {
      setLoginError('Database error.')
      return
    }

    if (authAction === 'register') {
      if (registerMode === 'create') {
        const existingTeam = teams.find(t => t.name.toLowerCase() === tName.toLowerCase())
        if (existingTeam) {
          setLoginError('Team Name is already taken.')
          return
        }
        
        const { data: newTeamArray } = await supabase.from('teams').insert({ name: tName, password: tPass }).select()
        if (newTeamArray && newTeamArray.length > 0) {
          await supabase.from('profiles').insert({ callsign, team_id: newTeamArray[0].id, is_leader: true })
        }
        
        setAuthSuccess('Team registered successfully! Please login.')
        setAuthAction('login')
        return
      } else {
        // Join existing team
        const team = teams.find(t => t.name.toLowerCase() === tName.toLowerCase() && t.password === tPass)
        if (!team) {
          setLoginError('ACCESS DENIED: Invalid Team Name or Password.')
          return
        }
        
        const teamProfiles = profiles.filter(p => p.team_id === team.id)
        let prof = profiles.find(p => p.callsign === callsign && p.team_id === team.id)
        
        if (prof) {
          setLoginError('Agent already registered in this team. Please login.')
          return
        }
        
        if (teamProfiles.length >= 4) {
          setLoginError('Team is already full (Max 4 Agents).')
          return
        }
        
        await supabase.from('profiles').insert({ callsign, team_id: team.id, is_leader: false })
        setAuthSuccess('Agent registered successfully! Please login.')
        setAuthAction('login')
        return
      }
    } else {
      // Login
      const team = teams.find(t => t.name.toLowerCase() === tName.toLowerCase() && t.password === tPass)
      if (!team) {
        setLoginError('ACCESS DENIED: Invalid Team Name or Password.')
        return
      }
      
      let prof = profiles.find(p => p.callsign === callsign && p.team_id === team.id)
      if (!prof) {
        setLoginError('Agent not registered in this team. Please register first.')
        return
      }
      
      setAgentCallsign(callsign)
      setLoading(true)
    }
  }"""
content = content.replace(old_auth, new_auth)

# Replace inline getStageProgress usages with state
content = content.replace("DemoDB.getStageProgress().some(p => p.team_id === profile?.team_id && p.stage_id === stage.id)", "stageProgress.some(p => p.team_id === profile?.team_id && p.stage_id === stage.id)")
content = content.replace("DemoDB.getStageProgress().some(p => p.team_id === profile?.team_id && p.challenge_id === chal.id)", "stageProgress.some(p => p.team_id === profile?.team_id && p.challenge_id === chal.id)")
content = content.replace("DemoDB.hasUsedHint(profile?.id || '', stage.id)", "hintUsage.some(h => h.profile_id === profile?.id && h.stage_id === stage.id)")
content = content.replace("DemoDB.hasUsedHint(profile?.id || '', undefined, chal.id)", "hintUsage.some(h => h.profile_id === profile?.id && h.challenge_id === chal.id)")

with open('app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Page rewritten")
