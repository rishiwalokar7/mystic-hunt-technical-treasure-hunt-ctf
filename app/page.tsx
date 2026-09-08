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

  if (loading) return <div className="min-h-screen flex items-center justify-center p-10 uppercase tracking-widest text-cyan-500 font-mono">{'>'} Initializing Mainframe...</div>

  if (!agentCallsign) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#08131C] to-[#02070D] -z-10"></div>
        
        <div className="max-w-md w-full border border-cyan-900/40 bg-[#061019]/90 backdrop-blur-md p-8 rounded-xl shadow-[0_8px_32px_rgba(6,182,212,0.1)] relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50 rounded-t-xl"></div>
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-widest uppercase text-white mb-2">MYSTIC HUNT</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Event Access Portal</p>
          </div>
          
          <div className="flex bg-[#030B12] p-1 rounded-lg mb-6 border border-[#08131C]">
            <button 
              type="button"
              onClick={() => { 
                setAuthAction('login'); setLoginError(''); setAuthSuccess(''); 
                setLoginTeamName(''); setLoginTeamPass(''); setLoginAgentName('');
              }}
              className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-widest rounded-md transition-all ${authAction === 'login' ? 'bg-cyan-500/10 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Login
            </button>
            <button 
              type="button"
              onClick={() => { 
                setAuthAction('register'); setLoginError(''); setAuthSuccess(''); 
                setLoginTeamName(''); setLoginTeamPass(''); setLoginAgentName('');
              }}
              className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-widest rounded-md transition-all ${authAction === 'register' ? 'bg-cyan-500/10 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]' : 'text-slate-500 hover:text-slate-300'}`}
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
                className={`flex-1 py-1.5 text-[9px] uppercase tracking-widest rounded transition-colors border ${registerMode === 'join' ? 'bg-[#08131C] border-cyan-900/50 text-cyan-300' : 'border-transparent text-slate-500 hover:text-slate-300 bg-[#030B12]'}`}
              >
                Join Existing Team
              </button>
              <button 
                type="button"
                onClick={() => { 
                  setRegisterMode('create'); setLoginError(''); setAuthSuccess(''); 
                  setLoginTeamName(''); setLoginTeamPass(''); setLoginAgentName('');
                }}
                className={`flex-1 py-1.5 text-[9px] uppercase tracking-widest rounded transition-colors border ${registerMode === 'create' ? 'bg-[#08131C] border-cyan-900/50 text-cyan-300' : 'border-transparent text-slate-500 hover:text-slate-300 bg-[#030B12]'}`}
              >
                Create New Team
              </button>
            </div>
          )}
          
          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1.5 font-mono">Team Name</label>
              <input 
                type="text" 
                value={loginTeamName}
                onChange={(e) => setLoginTeamName(e.target.value)}
                placeholder="e.g. CYBER_NINJAS"
                className="w-full bg-[#030B12] border border-[#08131C] rounded-lg p-3 text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono"
                autoFocus
                required
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1.5 font-mono">Team Password</label>
              <input 
                type="password" 
                value={loginTeamPass}
                onChange={(e) => setLoginTeamPass(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#030B12] border border-[#08131C] rounded-lg p-3 text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono"
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1.5 font-mono">{authAction === 'register' && registerMode === 'create' ? 'Leader Agent Name' : 'Your Agent Name'}</label>
              <input 
                type="text" 
                value={loginAgentName}
                onChange={(e) => setLoginAgentName(e.target.value)}
                placeholder="e.g. JASON"
                className="w-full bg-[#030B12] border border-[#08131C] rounded-lg p-3 text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 uppercase transition-all font-mono"
                required
                autoComplete="off"
              />
            </div>
            
            {authSuccess && <p className="text-[10px] text-green-400 uppercase tracking-widest text-center bg-green-500/10 py-2 rounded font-mono">{authSuccess}</p>}
            {loginError && <p className="text-[10px] text-red-400 uppercase tracking-widest text-center bg-red-500/10 py-2 rounded font-mono">{loginError}</p>}
            
            <button 
              type="submit"
              className="w-full mt-2 bg-cyan-600 hover:bg-cyan-500 text-white py-3.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] border border-cyan-400/50"
            >
              {authAction === 'register' ? (registerMode === 'create' ? 'Register New Team' : 'Register Agent') : 'Initialize Uplink'}
            </button>
          </form>
          <div className="mt-8 text-center pt-6 border-t border-slate-800/50">
            <a href="/scoreboard" className="text-[10px] text-slate-500 hover:text-cyan-400 tracking-widest uppercase transition-colors font-mono">View Scoreboard ↗</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 relative z-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#08131C] to-transparent opacity-50 -z-10"></div>
      <div className="max-w-6xl mx-auto">
        
        {/* Top Header / Navigation */}
        <div className="border border-slate-800/60 bg-[#061019]/80 backdrop-blur-sm p-6 rounded-xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500"></div>
          <div>
            <p className="text-[10px] text-cyan-400 uppercase tracking-widest font-mono mb-1">TEAM STATUS</p>
            <h1 className="text-2xl font-bold tracking-wide text-white uppercase">{agentTeamName} <span className="text-sm text-slate-500 ml-2 font-mono">[{agentCallsign}]</span></h1>
            <p className="text-xs text-slate-400 tracking-widest mt-1 font-mono">Current Phase: <span className="text-cyan-400">{systemState.phase === 'PHASE_2' ? 'PHASE 2 UNLOCKED' : 'PHASE 1 ACTIVE'}</span></p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right bg-[#030B12] px-6 py-3 rounded-lg border border-[#08131C]">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono mb-1">Total Intel</p>
              <p className="text-3xl font-bold text-white"><span className="text-cyan-400">{totalScore}</span> <span className="text-sm text-slate-500 font-mono">PTS</span></p>
            </div>
            <div className="flex gap-2">
              <a href="/scoreboard" className="border border-cyan-900/50 hover:border-cyan-500 hover:bg-cyan-500/10 px-4 py-2 text-[10px] tracking-widest uppercase rounded-lg text-cyan-400 transition-all font-mono">Scoreboard ↗</a>
            </div>
          </div>
        </div>

        {/* Team Intel Section */}
        <div className="mb-8 border border-slate-800/60 bg-[#061019]/50 p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center mb-4 border-b border-slate-800/60 pb-3">
            <h2 className="text-sm font-bold tracking-widest text-slate-300 uppercase">Team Intel</h2>
            <span className="text-[10px] text-slate-500 font-mono tracking-widest">{teamMembers.length}/4 AGENTS</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {teamMembers.map(member => (
              <div key={member.id} className="border border-slate-800/60 bg-[#030B12] p-4 rounded-lg flex justify-between items-center group hover:border-cyan-900/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${member.is_leader ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800 text-slate-300'}`}>
                    {member.callsign.substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white uppercase">{member.callsign}</p>
                    {member.is_leader && <p className="text-[9px] text-cyan-400 uppercase tracking-widest mt-0.5 font-mono">Leader</p>}
                  </div>
                </div>
                {profile?.is_leader && member.id !== profile.id && (
                  <button 
                    onClick={() => {
                      if(window.confirm(`Remove ${member.callsign} from the team?`)) {
                        DemoDB.removeProfile(member.id);
                        fetchArenaData();
                      }
                    }}
                    className="text-[10px] text-slate-500 hover:text-red-400 border border-transparent hover:border-red-900/50 hover:bg-red-500/10 px-2.5 py-1.5 rounded transition-all font-mono opacity-0 group-hover:opacity-100"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {systemState.phase === 'PHASE_2' && (
          <div className="mb-8 border border-red-500/30 bg-[#061019] p-4 rounded-xl flex items-center gap-4 shadow-[0_0_20px_rgba(244,63,94,0.1)]">
            <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <div>
              <p className="text-red-400 font-bold uppercase tracking-widest text-sm">SYSTEM ALERT: PHASE 2 UNLOCKED</p>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">Physical field operations concluded. Digital breach operations authorized.</p>
            </div>
          </div>
        )}

        {feedback && <div className="mb-6 text-[11px] font-mono text-cyan-400 bg-cyan-950/30 border border-cyan-900/50 p-4 rounded-xl flex items-center gap-3">
          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {feedback}
        </div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* PHASE 1: FIELD OPS */}
          <div className={systemState.phase === 'PHASE_2' ? 'opacity-50 pointer-events-none grayscale' : ''}>
            <div className="flex justify-between items-center mb-4 border-b border-slate-800/60 pb-2">
              <h2 className="text-sm font-bold tracking-widest text-slate-300 uppercase">Phase 1: Field Ops</h2>
              <span className="text-[10px] text-slate-500 font-mono tracking-widest">{round1Stages.length} MISSIONS</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {round1Stages.map(stage => {
                const isSecured = DemoDB.getStageProgress().some(p => p.team_id === profile?.team_id && p.stage_id === stage.id)
                return (
                  <div key={stage.id} onClick={() => setSelectedStageId(stage.id)} className={`cursor-pointer border ${isSecured ? 'border-green-500/30 bg-[#061019]' : 'border-slate-800/60 bg-[#030B12] hover:border-cyan-500/50 hover:shadow-[0_4px_20px_rgba(6,182,212,0.1)]'} p-5 rounded-xl relative overflow-hidden flex flex-col h-32 transition-all group`}>
                    {isSecured && <div className="absolute inset-0 bg-green-500/5 pointer-events-none"></div>}
                    <div className="flex justify-between items-start mb-auto relative z-10">
                      <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-cyan-400 transition-colors uppercase tracking-widest">MISSION ID: {stage.id.substring(0,4)}</span>
                      {isSecured ? (
                        <span className="text-[10px] font-bold text-green-400 font-mono flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> SECURED</span>
                      ) : (
                        <span className="text-[10px] font-bold text-cyan-500 font-mono flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span> ACTIVE</span>
                      )}
                    </div>
                    <div className="relative z-10 mt-auto flex justify-between items-end">
                      <h3 className="font-bold text-white text-sm line-clamp-1 group-hover:text-cyan-100">{stage.title}</h3>
                      <span className={`text-xs font-bold font-mono ${isSecured ? 'text-green-500' : 'text-slate-400 group-hover:text-cyan-400'}`}>{stage.points} PTS</span>
                    </div>
                  </div>
                )
              })}
              {round1Stages.length === 0 && <p className="text-xs text-slate-500 font-mono uppercase col-span-full bg-[#030B12] p-8 rounded-xl border border-slate-800/60 text-center">{systemState.phase === 'PHASE_2' ? 'Phase 1 Archived.' : 'No field missions deployed yet.'}</p>}
            </div>
          </div>

          {/* PHASE 2: DIGITAL BREACH */}
          <div>
            <div className="flex justify-between items-center mb-4 border-b border-slate-800/60 pb-2">
              <h2 className="text-sm font-bold tracking-widest text-slate-300 uppercase">Phase 2: Digital Breaches</h2>
              <span className="text-[10px] text-slate-500 font-mono tracking-widest">{systemState.phase === 'PHASE_1' ? 'LOCKED' : `${round2Challenges.length} SYSTEMS`}</span>
            </div>

            {systemState.phase === 'PHASE_1' ? (
              /* LOCKED STATE */
              <div className="border border-slate-800/60 bg-[#030B12] rounded-xl p-10 flex flex-col items-center justify-center text-center gap-4 h-full min-h-[200px]">
                <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Phase Locked</p>
                  <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest">Awaiting Phase 1 Conclusion</p>
                </div>
              </div>
            ) : (
              /* UNLOCKED STATE — show challenges */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {round2Challenges.map(chal => {
                  const isSecured = DemoDB.getStageProgress().some(p => p.team_id === profile?.team_id && p.challenge_id === chal.id)
                  return (
                    <div key={chal.id} onClick={() => setSelectedChallengeId(chal.id)} className={`cursor-pointer border ${isSecured ? 'border-green-500/30 bg-[#061019]' : 'border-slate-800/60 bg-[#030B12] hover:border-cyan-500/50 hover:shadow-[0_4px_20px_rgba(6,182,212,0.1)]'} p-5 rounded-xl relative overflow-hidden flex flex-col h-32 transition-all group`}>
                      {isSecured && <div className="absolute inset-0 bg-green-500/5 pointer-events-none"></div>}
                      <div className="flex justify-between items-start mb-auto relative z-10">
                        <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-cyan-400 transition-colors uppercase tracking-widest bg-slate-800/50 px-2 py-0.5 rounded">SYS: {chal.category || 'GENERAL'}</span>
                        {isSecured ? (
                          <span className="text-[10px] font-bold text-green-400 font-mono flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> SECURED</span>
                        ) : (
                          <span className="text-[10px] font-bold text-cyan-500 font-mono flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span> ACTIVE</span>
                        )}
                      </div>
                      <div className="relative z-10 mt-auto flex justify-between items-end">
                        <h3 className="font-bold text-white text-sm line-clamp-1 group-hover:text-cyan-100">{chal.title}</h3>
                        <span className={`text-xs font-bold font-mono ${isSecured ? 'text-green-500' : 'text-slate-400 group-hover:text-cyan-400'}`}>{chal.points} PTS</span>
                      </div>
                    </div>
                  )
                })}
                {round2Challenges.length === 0 && <p className="text-xs text-slate-500 font-mono uppercase col-span-full bg-[#030B12] p-8 rounded-xl border border-slate-800/60 text-center">No digital breaches deployed yet.</p>}
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
          <div className="fixed inset-0 bg-[#02070D]/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setSelectedStageId(null)}>
            <div className="bg-[#061019] border border-slate-700/50 w-full max-w-2xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              {/* Top Bar */}
              <div className="bg-[#030B12] px-4 py-3 flex justify-between items-center border-b border-slate-800/60">
                <div className="flex gap-2">
                  <span className="bg-slate-800/50 text-slate-300 font-mono text-[10px] uppercase tracking-widest px-3 py-1 rounded">MISSION INTEL</span>
                </div>
                <button onClick={() => setSelectedStageId(null)} className="text-slate-500 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="p-8 overflow-y-auto">
                <div className="text-center mb-8 relative">
                  {isSecured && <div className="absolute top-0 right-0 border border-green-500 text-green-400 text-[10px] px-2.5 py-1 rounded bg-green-500/10 uppercase tracking-widest font-bold font-mono">Secured</div>}
                  <h2 className="text-2xl font-bold text-white mb-2">{stage.title}</h2>
                  <p className="text-lg text-cyan-400 font-mono font-bold">{stage.points} PTS</p>
                </div>
                
                {/* STEP 1: Location Clue */}
                <div className="mb-6">
                  <p className="text-slate-400 text-[10px] mb-2 font-mono uppercase tracking-widest">Location Clue</p>
                  <p className="text-slate-200 bg-[#030B12] border border-slate-800/60 rounded-lg p-5 whitespace-pre-wrap">{stage.location_clue}</p>
                </div>

                {stage.hint && !isSecured && (() => {
                  const hintUsed = DemoDB.hasUsedHint(profile?.id || '', stage.id)
                  return (
                    <div className="mb-6 text-center">
                      {hintUsed ? (
                        <div className="inline-block bg-[#08131C] border border-amber-900/30 rounded-lg p-4 text-left w-full">
                          <p className="text-amber-400 text-[10px] font-mono uppercase tracking-widest mb-2 flex items-center gap-2"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Intel Decrypted</p>
                          <p className="text-slate-300">{stage.hint}</p>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleUseHint(stage.id, stage.hint_penalty || 25)}
                          className="bg-[#030B12] hover:bg-[#08131C] text-amber-400 px-6 py-2.5 rounded-lg text-xs transition-colors border border-amber-900/50 font-mono uppercase tracking-widest inline-flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          Request Intel (-{stage.hint_penalty || 25} pts)
                        </button>
                      )}
                    </div>
                  )
                })()}

                {!isClueUnlocked && !isSecured && (
                  <div className="bg-[#030B12] border border-slate-800/60 rounded-lg p-5 mb-6">
                    <p className="text-slate-400 text-[10px] mb-3 font-mono uppercase tracking-widest">Location Verification</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter location answer..."
                        value={clueAnswers[stage.id] || ''}
                        onChange={(e) => setClueAnswers({ ...clueAnswers, [stage.id]: e.target.value })}
                        className="flex-1 bg-[#061019] border border-slate-700/50 rounded-lg p-3 text-white outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono text-sm"
                      />
                      <button
                        onClick={() => handleUnlockClue(stage.id, stage.clue_answer)}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 rounded-lg transition-colors text-xs font-bold uppercase tracking-widest"
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                )}

                {(isClueUnlocked || isSecured) && (
                  <div className="space-y-6">
                    {stage.access_code && (
                      <div className="bg-[#030B12] border border-cyan-900/50 rounded-lg p-6 text-center shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                        <p className="text-cyan-400 text-[10px] font-mono uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Location Verified. Access Code:
                        </p>
                        <p className="text-3xl font-bold text-white tracking-widest font-mono bg-slate-900/50 inline-block px-4 py-2 rounded border border-slate-800">{stage.access_code}</p>
                      </div>
                    )}

                    {stage.description && (
                      <div>
                        <p className="text-slate-400 text-[10px] mb-2 font-mono uppercase tracking-widest flex items-center gap-2"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> Locked Intelligence</p>
                        <p className="text-slate-200 bg-[#030B12] border border-slate-800/60 rounded-lg p-5 whitespace-pre-wrap">{stage.description}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Action Bar */}
              {(isClueUnlocked || isSecured) && (
                <div className="bg-[#030B12] p-5 border-t border-slate-800/60 flex gap-4">
                  {isSecured ? (
                    <div className="flex-1 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3.5 text-green-400 text-center font-bold uppercase tracking-widest text-xs font-mono">
                      Mission Secured
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Final Answer..."
                        value={answers[stage.id] || ''}
                        onChange={(e) => setAnswers({ ...answers, [stage.id]: e.target.value })}
                        className="flex-1 bg-[#061019] border border-slate-700/50 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono text-sm"
                      />
                      <button
                        onClick={() => { handleSubmitPhase1(stage.id, stage.final_answer, stage.points); setSelectedStageId(null); }}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 rounded-lg transition-colors font-bold uppercase tracking-widest text-xs"
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
          <div className="fixed inset-0 bg-[#02070D]/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setSelectedChallengeId(null)}>
            <div className="bg-[#061019] border border-slate-700/50 w-full max-w-2xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              {/* Top Bar */}
              <div className="bg-[#030B12] px-4 py-3 flex justify-between items-center border-b border-slate-800/60">
                <div className="flex gap-2">
                  <span className="bg-slate-800/50 text-slate-300 font-mono text-[10px] uppercase tracking-widest px-3 py-1 rounded">SYSTEM BREACH</span>
                  <span className="bg-cyan-950/30 text-cyan-400 font-mono text-[10px] uppercase tracking-widest px-3 py-1 rounded border border-cyan-900/50">{chal.category || 'GENERAL'}</span>
                </div>
                <button onClick={() => setSelectedChallengeId(null)} className="text-slate-500 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="p-8 overflow-y-auto">
                <div className="text-center mb-8 relative">
                  {isSecured && <div className="absolute top-0 right-0 border border-green-500 text-green-400 text-[10px] px-2.5 py-1 rounded bg-green-500/10 uppercase tracking-widest font-bold font-mono">Secured</div>}
                  <h2 className="text-2xl font-bold text-white mb-2">{chal.title}</h2>
                  <p className="text-lg text-cyan-400 font-mono font-bold">{chal.points} PTS</p>
                </div>
                
                <div className="mb-8">
                  <p className="text-slate-400 text-[10px] mb-2 font-mono uppercase tracking-widest">Challenge Brief</p>
                  <div className="bg-[#030B12] border border-slate-800/60 rounded-lg p-5">
                    <p className="text-slate-200 whitespace-pre-wrap">{chal.description}</p>
                  </div>
                </div>

                {chal.hint && !isSecured && (() => {
                  const hintUsed = DemoDB.hasUsedHint(profile?.id || '', undefined, chal.id)
                  return (
                    <div className="mb-8 text-center">
                      {hintUsed ? (
                        <div className="inline-block bg-[#08131C] border border-amber-900/30 rounded-lg p-4 text-left w-full">
                          <p className="text-amber-400 text-[10px] font-mono uppercase tracking-widest mb-2 flex items-center gap-2"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Intel Decrypted</p>
                          <p className="text-slate-300">{chal.hint}</p>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleUseHint(chal.id, chal.hint_penalty || 25, true)}
                          className="bg-[#030B12] hover:bg-[#08131C] text-amber-400 px-6 py-2.5 rounded-lg text-xs transition-colors border border-amber-900/50 font-mono uppercase tracking-widest inline-flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          Request Intel (-{chal.hint_penalty || 25} pts)
                        </button>
                      )}
                    </div>
                  )
                })()}

                {chal.file_url && (
                  <div className="mb-2">
                    <p className="text-slate-400 text-[10px] mb-2 font-mono uppercase tracking-widest">Intel Files</p>
                    <a 
                      href={chal.file_url} 
                      download={chal.file_name || 'intel_file'} 
                      className="inline-flex items-center gap-3 bg-[#030B12] hover:bg-[#08131C] border border-slate-700 hover:border-cyan-900/50 text-slate-300 hover:text-cyan-400 px-5 py-3 rounded-lg transition-colors text-sm font-mono"
                    >
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      {chal.file_name || 'Download System File'}
                    </a>
                  </div>
                )}
              </div>

              {/* Bottom Action Bar */}
              <div className="p-5 flex gap-4 mt-auto mx-0 border-t border-slate-800/60 bg-[#030B12]">
                {isSecured ? (
                  <div className="flex-1 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3.5 text-green-400 text-center font-bold uppercase tracking-widest text-xs font-mono">
                    System Breached & Secured
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Enter Flag (e.g. mystic{...})"
                      value={flags[chal.id] || ''}
                      onChange={(e) => setFlags({ ...flags, [chal.id]: e.target.value })}
                      className="flex-1 bg-[#061019] border border-slate-700/50 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono text-sm placeholder:text-slate-600"
                    />
                    <button
                      onClick={() => { handleSubmitPhase2(chal.id, chal.flag, chal.points); setSelectedChallengeId(null); }}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded-lg transition-colors font-bold uppercase tracking-widest text-xs"
                    >
                      Submit Flag
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
