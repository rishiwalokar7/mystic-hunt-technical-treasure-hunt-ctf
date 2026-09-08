'use client'

import { useState, useEffect } from 'react'
import { DemoDB } from '@/lib/demo-db'

export default function AgentDashboard() {
  const [agentCallsign, setAgentCallsign] = useState('')
  const [agentTeamName, setAgentTeamName] = useState('')
  
  const [loginTeamName, setLoginTeamName] = useState('')
  const [loginTeamPass, setLoginTeamPass] = useState('')
  const [loginAgentName, setLoginAgentName] = useState('')
  const [loginError, setLoginError] = useState('')
  const [authAction, setAuthAction] = useState<'login' | 'register'>('login')
  const [registerMode, setRegisterMode] = useState<'create' | 'join'>('join')
  const [authSuccess, setAuthSuccess] = useState('')
  
  const [profile, setProfile] = useState<any>(null)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [totalScore, setTotalScore] = useState(0)
  const [round1Stages, setRound1Stages] = useState<any[]>([])
  const [round2Challenges, setRound2Challenges] = useState<any[]>([])
  const [systemState, setSystemState] = useState<{ phase: 'PHASE_1' | 'PHASE_2', resetStrategy: 'CUMULATIVE' | 'HARD_RESET' }>({ phase: 'PHASE_1', resetStrategy: 'CUMULATIVE' })
  const [loading, setLoading] = useState(true)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null)


  // Interactive UI states for solving stages
  const [clueAnswers, setClueAnswers] = useState<{ [key: string]: string }>({})
  const [clueUnlocked, setClueUnlocked] = useState<{ [key: string]: boolean }>({})
  const [unlockedCodes, setUnlockedCodes] = useState<{ [key: string]: boolean }>({})
  const [inputCodes, setInputCodes] = useState<{ [key: string]: string }>({})
  const [answers, setAnswers] = useState<{ [key: string]: string }>({})
  const [flags, setFlags] = useState<{ [key: string]: string }>({})
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleUseHint = (id: string, penalty: number, isChallenge = false) => {
    if (!profile) return
    if (!window.confirm(`Using this hint will cost you ${penalty} points. Proceed?`)) return
    DemoDB.consumeHint(isChallenge ? { profile_id: profile.id, challenge_id: id } : { profile_id: profile.id, stage_id: id })
    DemoDB.addStageProgress({ profile_id: profile.id, team_id: profile.team_id, ...(isChallenge ? { challenge_id: id } : { stage_id: id }), points_awarded: -penalty })
    setFeedback(`Hint revealed! -${penalty} pts deducted.`)
    fetchArenaData()
  }

  const handleUnlockClue = (stageId: string, correctCode: string | undefined) => {
    if (!correctCode) {
      setFeedback('Error: This stage has no clue answer set. Please redeploy it.')
      return
    }
    if (clueAnswers[stageId]?.trim() === correctCode.trim()) {
      setClueUnlocked(prev => ({ ...prev, [stageId]: true }))
      setFeedback('Location Confirmed. Challenge Details & Final Answer Unlocked.')
    } else {
      setFeedback('Incorrect. Re-check your location clue answer.')
    }
  }

  const fetchArenaData = () => {
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
  }

  useEffect(() => {
    fetchArenaData()
  }, [agentCallsign])

  const handleUnlockCode = (stageId: string, correctCode: string) => {
    if (inputCodes[stageId]?.trim() === correctCode.trim()) {
      setUnlockedCodes(prev => ({ ...prev, [stageId]: true }))
      setFeedback('Access Code Verified. Final Answer Box Unlocked.')
    } else {
      setFeedback('Access Denied: Incorrect Code.')
    }
  }

  const handleSubmitPhase1 = (stageId: string, correctFinalAnswer: string, points: number) => {
    if (!profile) return
    const currentProgress = DemoDB.getStageProgress().find(p => p.team_id === profile.team_id && p.stage_id === stageId)
    if (currentProgress) {
      setFeedback('Checkpoint Already Secured by your team.')
      return
    }

    if (answers[stageId]?.trim().toLowerCase() === correctFinalAnswer.trim().toLowerCase()) {
      DemoDB.addStageProgress({ profile_id: profile.id, team_id: profile.team_id, stage_id: stageId, points_awarded: points })
      setFeedback('Checkpoint Secured. Points Awarded.')
      fetchArenaData()
    } else {
      setFeedback('Invalid Answer.')
    }
  }

  const handleSubmitPhase2 = (challengeId: string, correctFlag: string, points: number) => {
    if (!profile) return
    if (systemState.phase === 'PHASE_1') {
      setFeedback('Phase 2 is currently locked.')
      return
    }
    const currentProgress = DemoDB.getStageProgress().find(p => p.team_id === profile.team_id && p.challenge_id === challengeId)
    if (currentProgress) {
      setFeedback('System Already Breached by your team.')
      return
    }

    if (flags[challengeId]?.trim() === correctFlag.trim()) {
      DemoDB.addStageProgress({ profile_id: profile.id, team_id: profile.team_id, challenge_id: challengeId, points_awarded: points })
      setFeedback('Breach Successful. Points Awarded.')
      fetchArenaData()
    } else {
      setFeedback('Invalid Flag.')
    }
  }

  const handleAuth = (e: React.FormEvent) => {
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
  }

  if (loading) return <div className="min-h-screen bg-black text-green-400 font-mono p-10 uppercase tracking-widest">{'>'} Initializing Mainframe...</div>

  if (!agentCallsign) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono p-6 flex items-center justify-center">
        <div className="max-w-md w-full border border-green-500/30 bg-[#0a0a0a] p-8 rounded-lg shadow-[0_0_20px_rgba(34,197,94,0.1)]">
          <h1 className="text-2xl font-bold tracking-widest text-center mb-2 uppercase">Agent Login</h1>
          <p className="text-xs text-center text-zinc-500 mb-6 uppercase tracking-widest">Connect to Event Mainframe</p>
          
          <div className="flex gap-2 mb-6">
            <button 
              type="button"
              onClick={() => { 
                setAuthAction('login'); setLoginError(''); setAuthSuccess(''); 
                setLoginTeamName(''); setLoginTeamPass(''); setLoginAgentName('');
              }}
              className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-widest rounded border transition-colors ${authAction === 'login' ? 'bg-green-950/40 border-green-500 text-green-400' : 'border-zinc-800 text-zinc-600 hover:border-zinc-600'}`}
            >
              Login
            </button>
            <button 
              type="button"
              onClick={() => { 
                setAuthAction('register'); setLoginError(''); setAuthSuccess(''); 
                setLoginTeamName(''); setLoginTeamPass(''); setLoginAgentName('');
              }}
              className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-widest rounded border transition-colors ${authAction === 'register' ? 'bg-green-950/40 border-green-500 text-green-400' : 'border-zinc-800 text-zinc-600 hover:border-zinc-600'}`}
            >
              Register
            </button>
          </div>

          {authAction === 'register' && (
            <div className="flex gap-2 mb-6">
              <button 
                type="button"
                onClick={() => { 
                  setRegisterMode('join'); setLoginError(''); setAuthSuccess(''); 
                  setLoginTeamName(''); setLoginTeamPass(''); setLoginAgentName('');
                }}
                className={`flex-1 py-1 text-[9px] uppercase tracking-widest rounded border transition-colors ${registerMode === 'join' ? 'bg-zinc-800 border-zinc-600 text-white' : 'border-zinc-900 text-zinc-600 hover:border-zinc-700'}`}
              >
                Join Existing Team
              </button>
              <button 
                type="button"
                onClick={() => { 
                  setRegisterMode('create'); setLoginError(''); setAuthSuccess(''); 
                  setLoginTeamName(''); setLoginTeamPass(''); setLoginAgentName('');
                }}
                className={`flex-1 py-1 text-[9px] uppercase tracking-widest rounded border transition-colors ${registerMode === 'create' ? 'bg-zinc-800 border-zinc-600 text-white' : 'border-zinc-900 text-zinc-600 hover:border-zinc-700'}`}
              >
                Create New Team
              </button>
            </div>
          )}
          
          <form onSubmit={handleAuth} className="space-y-6">
            <div>
              <label className="text-[10px] text-green-500 uppercase tracking-widest block mb-2">Team Name</label>
              <input 
                type="text" 
                value={loginTeamName}
                onChange={(e) => setLoginTeamName(e.target.value)}
                placeholder="e.g. CYBER_NINJAS"
                className="w-full bg-[#111111] border border-green-900 rounded p-3 text-white outline-none focus:border-green-500 transition-colors"
                autoFocus
                required
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-[10px] text-green-500 uppercase tracking-widest block mb-2">Team Password</label>
              <input 
                type="password" 
                value={loginTeamPass}
                onChange={(e) => setLoginTeamPass(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#111111] border border-green-900 rounded p-3 text-white outline-none focus:border-green-500 transition-colors"
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">{authAction === 'register' && registerMode === 'create' ? 'Leader Agent Name' : 'Your Agent Name'}</label>
              <input 
                type="text" 
                value={loginAgentName}
                onChange={(e) => setLoginAgentName(e.target.value)}
                placeholder="e.g. JASON"
                className="w-full bg-[#111111] border border-zinc-800 rounded p-3 text-white outline-none focus:border-zinc-500 uppercase transition-colors"
                required
                autoComplete="off"
              />
            </div>
            
            {authSuccess && <p className="text-[10px] text-green-500 uppercase tracking-widest text-center">{authSuccess}</p>}
            {loginError && <p className="text-[10px] text-red-500 uppercase tracking-widest text-center">{loginError}</p>}
            
            <button 
              type="submit"
              className="w-full bg-green-950/40 border border-green-600/50 hover:bg-green-900/60 text-green-400 py-4 rounded text-sm font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:shadow-[0_0_25px_rgba(34,197,94,0.3)]"
            >
              {authAction === 'register' ? (registerMode === 'create' ? 'Register New Team' : 'Register Agent') : 'Initialize Uplink'}
            </button>
          </form>
          <div className="mt-6 text-center">
            <a href="/scoreboard" className="text-[10px] text-zinc-600 hover:text-zinc-400 tracking-widest uppercase transition-colors">View Scoreboard</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Top Header / Navigation */}
        <div className="border border-zinc-900 bg-[#0a0a0a] p-6 rounded-lg mb-8 flex flex-col md:flex-row justify-between items-center gap-4 shadow-2xl">
          <div>
            <h1 className="text-2xl font-bold tracking-widest text-white uppercase">{agentTeamName} <span className="text-sm text-zinc-500 ml-2">[{agentCallsign}]</span></h1>
            <p className="text-xs text-green-500 tracking-widest mt-1">STATUS: {systemState.phase === 'PHASE_2' ? 'PHASE 2 UNLOCKED' : 'PHASE 1 FIELD OPS ACTIVE'}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Total Intel</p>
              <p className="text-3xl font-bold text-green-400">{totalScore} PTS</p>
            </div>
            <div className="flex gap-2">
              <a href="/scoreboard" className="border border-green-500/50 hover:border-green-400 px-3 py-2 text-[10px] tracking-widest uppercase rounded text-green-400 transition-colors">Scoreboard</a>
            </div>
          </div>
        </div>

        {/* Team Intel Section */}
        <div className="mb-8 border border-zinc-900 bg-[#0a0a0a] p-6 rounded-lg shadow-xl">
          <h2 className="text-sm font-bold tracking-widest text-zinc-400 uppercase mb-4 border-b border-zinc-900 pb-2">Team Intel ({teamMembers.length}/4)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {teamMembers.map(member => (
              <div key={member.id} className="border border-zinc-800 bg-[#111] p-3 rounded flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-white uppercase">{member.callsign}</p>
                  {member.is_leader && <p className="text-[10px] text-orange-400 uppercase tracking-widest mt-1">Leader</p>}
                </div>
                {profile?.is_leader && member.id !== profile.id && (
                  <button 
                    onClick={() => {
                      if(window.confirm(`Remove ${member.callsign} from the team?`)) {
                        DemoDB.removeProfile(member.id);
                        fetchArenaData();
                      }
                    }}
                    className="text-[10px] text-red-500 hover:text-red-400 border border-red-900 hover:border-red-500 px-2 py-1 rounded transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>


        {systemState.phase === 'PHASE_2' && (
          <div className="mb-8 border border-red-900 bg-red-950/20 p-4 rounded-lg animate-pulse text-center shadow-[0_0_15px_rgba(220,38,38,0.2)]">
            <p className="text-red-500 font-bold uppercase tracking-widest text-sm">
              {'>'}{'>'}{'>'} WARNING: PHASE 1 CONCLUDED. FINALIST STATUS CONFIRMED. PHASE 2 MAINFRAME UNLOCKED.
            </p>
          </div>
        )}

        {feedback && <div className="mb-6 text-xs text-green-400 bg-green-950/30 border border-green-900 p-3 rounded">{feedback}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* PHASE 1: FIELD OPS */}
          <div className={systemState.phase === 'PHASE_2' ? 'opacity-30 pointer-events-none' : ''}>
            <h2 className="text-sm font-bold tracking-widest text-zinc-400 uppercase mb-4 border-b border-zinc-900 pb-2">Phase 1: Field Ops ({round1Stages.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {round1Stages.map(stage => {
                const isSecured = DemoDB.getStageProgress().some(p => p.team_id === profile?.team_id && p.stage_id === stage.id)
                return (
                  <div key={stage.id} onClick={() => setSelectedStageId(stage.id)} className="cursor-pointer border border-zinc-900 bg-[#0a0a0a] hover:border-zinc-700 hover:bg-[#111] p-5 rounded-lg relative overflow-hidden flex flex-col items-center justify-center text-center h-32 transition-colors">
                    {isSecured && <div className="absolute inset-0 bg-green-950/20 pointer-events-none border border-green-500/30"></div>}
                    <h3 className="font-bold text-white uppercase text-sm mb-2 relative z-10">{stage.title}</h3>
                    <span className="text-xs font-bold text-green-500 relative z-10">{stage.points} PTS {isSecured && '[SECURED]'}</span>
                  </div>
                )
              })}
              {round1Stages.length === 0 && <p className="text-xs text-zinc-600 uppercase col-span-full">{systemState.phase === 'PHASE_2' ? 'Phase 1 Archived.' : 'No field stages deployed yet.'}</p>}
            </div>
          </div>

          {/* PHASE 2: DIGITAL BREACH */}
          <div>
            <h2 className="text-sm font-bold tracking-widest text-zinc-400 uppercase mb-4 border-b border-zinc-900 pb-2">Phase 2: Digital Breaches</h2>

            {systemState.phase === 'PHASE_1' ? (
              /* LOCKED STATE */
              <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-10 flex flex-col items-center justify-center text-center gap-4">
                <div className="text-4xl">🔒</div>
                <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Round 2 Locked</p>
                <p className="text-[10px] text-zinc-700 uppercase tracking-widest">Available after Phase 1 concludes</p>
              </div>
            ) : (
              /* UNLOCKED STATE — show challenges */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {round2Challenges.map(chal => {
                  const isSecured = DemoDB.getStageProgress().some(p => p.team_id === profile?.team_id && p.challenge_id === chal.id)
                  return (
                    <div key={chal.id} onClick={() => setSelectedChallengeId(chal.id)} className="cursor-pointer border border-zinc-900 bg-[#0a0a0a] hover:border-zinc-700 hover:bg-[#111] p-5 rounded-lg relative overflow-hidden flex flex-col items-center justify-center text-center h-32 transition-colors">
                      {isSecured && <div className="absolute inset-0 bg-green-950/20 pointer-events-none border border-green-500/30"></div>}
                      <span className="text-[10px] font-bold text-green-500 mb-1 relative z-10">[{chal.category || 'GENERAL'}]</span>
                      <h3 className="font-bold text-white uppercase text-sm mb-2 relative z-10">{chal.title}</h3>
                      <span className="text-xs font-bold text-green-500 relative z-10">{chal.points} PTS {isSecured && '[SECURED]'}</span>
                    </div>
                  )
                })}
                {round2Challenges.length === 0 && <p className="text-xs text-zinc-600 uppercase col-span-full">No digital breaches deployed yet.</p>}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* MODALS */}
      {selectedStageId && (() => {
        const stage = round1Stages.find(s => s.id === selectedStageId)
        if (!stage) return null
        const isClueUnlocked = clueUnlocked[stage.id]
        const isSecured = DemoDB.getStageProgress().some(p => p.team_id === profile?.team_id && p.stage_id === stage.id)
        
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setSelectedStageId(null)}>
            <div className="bg-[#1a1525] border border-purple-900/50 w-full max-w-2xl rounded-xl shadow-[0_0_50px_rgba(107,33,168,0.2)] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              {/* Top Bar */}
              <div className="bg-[#241d35] px-4 py-3 flex justify-between items-center border-b border-purple-900/30">
                <div className="flex gap-2">
                  <span className="bg-[#3a2f50] text-purple-200 text-xs px-3 py-1.5 rounded font-medium">Phase 1</span>
                </div>
                <button onClick={() => setSelectedStageId(null)} className="text-zinc-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="p-8 overflow-y-auto">
                <div className="text-center mb-8 relative">
                  {isSecured && <div className="absolute top-0 right-0 border border-green-500 text-green-500 text-xs px-3 py-1 rounded bg-green-950/30 uppercase tracking-widest font-bold">Secured</div>}
                  <h2 className="text-3xl font-bold text-purple-100 mb-2">{stage.title}</h2>
                  <p className="text-2xl text-purple-400 font-mono">{stage.points}</p>
                </div>
                
                {/* STEP 1: Location Clue */}
                <div className="mb-6">
                  <p className="text-purple-300 text-sm mb-2 font-medium">Location Clue:</p>
                  <p className="text-purple-100/80 bg-[#241d35] rounded-md p-4 whitespace-pre-wrap">{stage.location_clue}</p>
                </div>

                {stage.hint && !isSecured && (() => {
                  const hintUsed = DemoDB.hasUsedHint(profile?.id || '', stage.id)
                  return (
                    <div className="mb-6 text-center">
                      {hintUsed ? (
                        <div className="inline-block bg-[#3a2f50] rounded-md p-4 text-left">
                          <p className="text-orange-300 text-sm font-medium mb-1">Hint Used</p>
                          <p className="text-purple-100/80">{stage.hint}</p>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleUseHint(stage.id, stage.hint_penalty || 25)}
                          className="bg-[#241d35] hover:bg-[#3a2f50] text-orange-300 px-4 py-2 rounded text-sm transition-colors border border-purple-900/30"
                        >
                          💡 Get Hint (-{stage.hint_penalty || 25} pts)
                        </button>
                      )}
                    </div>
                  )
                })()}

                {!isClueUnlocked && !isSecured && (
                  <div className="bg-[#241d35] rounded-md p-4 mb-6">
                    <p className="text-purple-300 text-sm mb-3">Enter your answer to the clue above to unlock the final challenge:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Location answer..."
                        value={clueAnswers[stage.id] || ''}
                        onChange={(e) => setClueAnswers({ ...clueAnswers, [stage.id]: e.target.value })}
                        className="flex-1 bg-[#1a1525] border border-purple-900/50 rounded p-3 text-white outline-none focus:border-purple-500 transition-colors"
                      />
                      <button
                        onClick={() => handleUnlockClue(stage.id, stage.clue_answer)}
                        className="bg-[#3a2f50] hover:bg-[#4a3f60] text-purple-100 px-6 rounded transition-colors"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                )}

                {(isClueUnlocked || isSecured) && (
                  <div className="space-y-6">
                    {stage.access_code && (
                      <div className="bg-[#241d35] border border-green-500/30 rounded p-6 text-center">
                        <p className="text-green-400 text-sm mb-2 font-medium">Location Confirmed! Your Access Code:</p>
                        <p className="text-3xl font-bold text-white tracking-widest font-mono">{stage.access_code}</p>
                      </div>
                    )}

                    {stage.description && (
                      <div>
                        <p className="text-purple-300 text-sm mb-2 font-medium">Challenge Details:</p>
                        <p className="text-purple-100/80 bg-[#241d35] rounded-md p-4 whitespace-pre-wrap">{stage.description}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Action Bar */}
              {(isClueUnlocked || isSecured) && (
                <div className="bg-[#241d35] p-4 border-t border-purple-900/30 flex gap-4">
                  {isSecured ? (
                    <div className="flex-1 bg-green-950/20 border border-green-500/30 rounded px-4 py-3 text-green-400 text-center font-bold uppercase tracking-widest">
                      Challenge Secured
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Final Answer..."
                        value={answers[stage.id] || ''}
                        onChange={(e) => setAnswers({ ...answers, [stage.id]: e.target.value })}
                        className="flex-1 bg-[#1a1525] border border-purple-900/50 rounded px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors"
                      />
                      <button
                        onClick={() => { handleSubmitPhase1(stage.id, stage.final_answer, stage.points); setSelectedStageId(null); }}
                        className="bg-[#3a2f50] hover:bg-[#4a3f60] text-purple-100 px-8 rounded transition-colors font-medium"
                      >
                        Submit
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {selectedChallengeId && (() => {
        const chal = round2Challenges.find(c => c.id === selectedChallengeId)
        if (!chal) return null
        const isSecured = DemoDB.getStageProgress().some(p => p.team_id === profile?.team_id && p.challenge_id === chal.id)
        
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setSelectedChallengeId(null)}>
            <div className="bg-[#211a2f] border border-[#3e3450] w-full max-w-2xl rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              {/* Top Bar */}
              <div className="bg-[#211a2f] px-4 py-3 flex justify-between items-center border-b border-[#3e3450]">
                <div className="flex gap-2">
                  <span className="bg-[#3e3450] text-[#dedede] text-xs px-3 py-1.5 rounded uppercase tracking-widest">Challenge</span>
                  <span className="bg-transparent text-[#9a8ba8] text-xs px-3 py-1.5 rounded uppercase tracking-widest border border-[#3e3450]">{chal.category || 'GENERAL'}</span>
                </div>
                <button onClick={() => setSelectedChallengeId(null)} className="text-zinc-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="p-8 overflow-y-auto">
                <div className="text-center mb-8 relative">
                  {isSecured && <div className="absolute top-0 right-0 border border-green-500 text-green-500 text-xs px-3 py-1 rounded bg-green-950/30 uppercase tracking-widest font-bold">Secured</div>}
                  <h2 className="text-[28px] font-bold text-white mb-2 tracking-widest uppercase">{chal.title}</h2>
                  <p className="text-[24px] text-[#9a8ba8] font-mono">{chal.points} PTS</p>
                </div>
                
                <div className="mb-8">
                  <p className="text-[#9a8ba8] text-sm mb-2 font-medium uppercase tracking-widest">Challenge Description</p>
                  <div className="bg-[#1a1425] border border-[#3e3450] rounded-md p-5">
                    <p className="text-[#cccccc] whitespace-pre-wrap text-[15px]">{chal.description}</p>
                  </div>
                </div>

                {chal.hint && !isSecured && (() => {
                  const hintUsed = DemoDB.hasUsedHint(profile?.id || '', undefined, chal.id)
                  return (
                    <div className="mb-8 text-center">
                      {hintUsed ? (
                        <div className="inline-block bg-[#3e3450] rounded p-4 text-left max-w-full">
                          <p className="text-orange-300 text-sm font-medium mb-1">Hint Used</p>
                          <p className="text-[#cccccc]">{chal.hint}</p>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleUseHint(chal.id, chal.hint_penalty || 25, true)}
                          className="bg-[#2d243e] hover:bg-[#3e3450] text-orange-300 px-6 py-2 rounded text-sm transition-colors border border-[#3e3450] inline-block"
                        >
                          💡 Get Hint (-{chal.hint_penalty || 25} pts)
                        </button>
                      )}
                    </div>
                  )
                })()}

                {chal.file_url && (
                  <div className="mb-2 text-left">
                    <a 
                      href={chal.file_url} 
                      download={chal.file_name || 'intel_file'} 
                      className="inline-flex flex-col items-center justify-center bg-[#a65d9d] hover:bg-[#8f4a87] text-white px-8 py-3 rounded shadow transition-colors min-w-[140px] text-sm"
                    >
                      <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      {chal.file_name || 'Download'}
                    </a>
                  </div>
                )}
              </div>

              {/* Bottom Action Bar */}
              <div className="p-4 flex gap-4 mt-auto mb-2 mx-4 border-t border-[#3e3450] pt-6">
                {isSecured ? (
                  <div className="flex-1 bg-green-950/20 border border-green-500/30 rounded px-4 py-3 text-green-400 text-center font-bold uppercase tracking-widest">
                    Challenge Secured
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Enter Flag (e.g. mystic{...})"
                      value={flags[chal.id] || ''}
                      onChange={(e) => setFlags({ ...flags, [chal.id]: e.target.value })}
                      className="flex-1 bg-[#1a1425] border border-[#3e3450] rounded px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors placeholder:text-[#6a5b78]"
                    />
                    <button
                      onClick={() => { handleSubmitPhase2(chal.id, chal.flag, chal.points); setSelectedChallengeId(null); }}
                      className="bg-[#3e3450] hover:bg-[#4a3f60] text-white px-8 py-3 rounded transition-colors text-sm uppercase tracking-widest font-bold"
                    >
                      Submit
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
