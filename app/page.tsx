'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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
  const [stageProgress, setStageProgress] = useState<any[]>([])
  const [hintUsage, setHintUsage] = useState<any[]>([])


  const handleUseHint = async (id: string, penalty: number, isChallenge = false) => {
    if (!profile) return
    if (!window.confirm(`Using this hint will cost you ${penalty} points. Proceed?`)) return
    
    const hintObj = isChallenge ? { profile_id: profile.id, challenge_id: id } : { profile_id: profile.id, stage_id: id }
    await supabase.from('hint_usage').insert(hintObj as any)
    
    const progObj = { profile_id: profile.id, team_id: profile.team_id, ...(isChallenge ? { challenge_id: id } : { stage_id: id }), points_awarded: -penalty }
    await supabase.from('stage_progress').insert(progObj as any)
    
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

  const fetchArenaData = async () => {
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

  const handleSubmitPhase1 = async (stageId: string, correctFinalAnswer: string, points: number) => {
    if (!profile) return
    const currentProgress = stageProgress.find(p => p.team_id === profile.team_id && p.stage_id === stageId)
    if (currentProgress) {
      setFeedback('Checkpoint Already Secured by your team.')
      return
    }

    if (answers[stageId]?.trim().toLowerCase() === correctFinalAnswer.trim().toLowerCase()) {
      await supabase.from('stage_progress').insert({ profile_id: profile.id, team_id: profile.team_id, stage_id: stageId, points_awarded: points })
      setFeedback('Checkpoint Secured. Points Awarded.')
      fetchArenaData()
    } else {
      setFeedback('Invalid Answer.')
    }
  }

  const handleSubmitPhase2 = async (chalId: string, correctFlag: string, points: number) => {
    if (!profile) return
    if (systemState.phase === 'PHASE_1') {
      setFeedback('Phase 2 is currently locked.')
      return
    }
    const currentProgress = stageProgress.find(p => p.team_id === profile.team_id && p.challenge_id === chalId)
    if (currentProgress) {
      setFeedback('System Already Breached by your team.')
      return
    }

    if (flags[chalId]?.trim() === correctFlag.trim()) {
      await supabase.from('stage_progress').insert({ profile_id: profile.id, team_id: profile.team_id, challenge_id: chalId, points_awarded: points })
      setFeedback('System Breached. Points Awarded.')
      fetchArenaData()
    } else {
      setFeedback('Invalid Flag.')
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
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
        
        const { data: newTeamArray, error: teamErr } = await supabase.from('teams').insert({ name: tName, password: tPass }).select()
        
        if (teamErr) {
          setLoginError(`DB Error (Teams): ${teamErr.message}`)
          return
        }

        if (newTeamArray && newTeamArray.length > 0) {
          const { error: profErr } = await supabase.from('profiles').insert({ callsign, team_id: newTeamArray[0].id, is_leader: true })
          if (profErr) {
             setLoginError(`DB Error (Profiles): ${profErr.message}`)
             return
          }
        } else {
          setLoginError('Failed to create team. Unknown error.')
          return
        }
        
        setAuthSuccess('Team registered successfully! Please login.')
        setAuthAction('login')
        return
      } else {
        // Join existing team
        const team = teams.find(t => t.name.toLowerCase() === tName.toLowerCase() && t.password === tPass)
        if (!team) {
          setLoginError(`ACCESS DENIED: Invalid Team Name or Password. (Debug: found ${teams.length} total teams in DB)`)
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
        
        const { error: joinErr } = await supabase.from('profiles').insert({ callsign, team_id: team.id, is_leader: false })
        if (joinErr) {
          setLoginError(`DB Error (Join): ${joinErr.message}`)
          return
        }

        setAuthSuccess('Agent registered successfully! Please login.')
        setAuthAction('login')
        return
      }
    } else {
      // Login
      const team = teams.find(t => t.name.toLowerCase() === tName.toLowerCase() && t.password === tPass)
      if (!team) {
        setLoginError(`ACCESS DENIED: Invalid Team Name or Password. (Debug: found ${teams.length} total teams in DB)`)
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
        <div className="max-w-md w-full border border-cyan-900/40 bg-[#061019]/90 backdrop-blur-md p-8 rounded-xl shadow-[0_8px_32px_rgba(6,182,212,0.1)] relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50 rounded-t-xl"></div>
          
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">
              <svg className="w-8 h-8 text-amber-500/80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2v2m0 16v2m10-10h-2M4 12H2M19.07 4.93l-1.41 1.41M6.34 17.66l-1.41 1.41M19.07 19.07l-1.41-1.41M6.34 6.34L4.93 4.93" /></svg>
            </div>
            <h1 className="text-3xl font-bold tracking-widest uppercase text-white mb-2">MYSTIC HUNT</h1>
            <p className="text-[9px] text-amber-500/80 uppercase tracking-widest font-mono mb-2">EXPLORE • SOLVE • UNCOVER</p>
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
      <div className="max-w-6xl mx-auto">
        
        {/* LEFT SIDE AREA - Decorative Atmosphere */}
        <div className="fixed left-0 top-0 bottom-0 w-[calc(50vw-576px)] min-w-[150px] pointer-events-none z-[-1] hidden xl:block overflow-hidden">
          {/* Subtle grid lines */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\\'100\\' height=\\'100\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cpath d=\\'M99 0h1v100h-1zM0 99h100v1H0z\\' fill=\\'rgba(6,182,212,0.01)\\'/%3E%3C/svg%3E')]"></div>
          
          {/* Topographic arcs */}
          <svg className="absolute top-[15%] left-[-20%] w-[150%] h-[30%] opacity-[0.15]" fill="none" viewBox="0 0 100 100" preserveAspectRatio="none" stroke="#d97706" strokeWidth="0.5" strokeDasharray="1 3">
            <path d="M0 100 Q 50 0 100 100" />
            <path d="M0 110 Q 50 10 100 110" />
            <path d="M0 120 Q 50 20 100 120" />
          </svg>
          
          {/* Small coordinate node */}
          <div className="absolute top-[30%] right-8 text-[8px] text-cyan-700/60 uppercase tracking-[0.2em] font-mono whitespace-pre-line text-right flex items-center gap-2">
            <span className="w-8 h-[1px] bg-cyan-800/50 inline-block"></span>
            [SYS.LAT: 47.6062 N]
            <span className="text-cyan-600">+</span>
          </div>
          
          <div className="absolute top-1/2 right-12 -translate-y-1/2 text-[10px] text-slate-600/60 uppercase tracking-[0.25em] font-mono whitespace-pre-line leading-relaxed border-l border-slate-800/50 pl-4">
            SOME
            CLUES ARE
            NOT ON
            SCREENS.
          </div>
          
          {/* Compass Graphic */}
          <div className="absolute bottom-[15%] left-12 opacity-30">
            <svg width="140" height="140" viewBox="0 0 100 100" fill="none" stroke="#d97706" strokeWidth="0.5">
              <circle cx="50" cy="50" r="40" strokeDasharray="2 4"/>
              <circle cx="50" cy="50" r="30" opacity="0.3"/>
              <circle cx="50" cy="50" r="2" fill="#d97706"/>
              <path d="M50 5 L50 95 M5 50 L95 50" strokeOpacity="0.5" />
              <path d="M22 22 L78 78 M22 78 L78 22" strokeOpacity="0.2" />
              <text x="47" y="14" fontSize="6" fill="#d97706" stroke="none" opacity="0.8">N</text>
              <text x="88" y="52" fontSize="6" fill="#d97706" stroke="none" opacity="0.8">E</text>
              <text x="47" y="93" fontSize="6" fill="#d97706" stroke="none" opacity="0.8">S</text>
              <text x="9" y="52" fontSize="6" fill="#d97706" stroke="none" opacity="0.8">W</text>
            </svg>
          </div>
          
          <div className="absolute bottom-12 left-12 text-[9px] text-slate-600/40 uppercase tracking-[0.2em] font-mono whitespace-pre-line">
            19.0760° N
            72.8777° E
          </div>
        </div>

        {/* RIGHT SIDE AREA - Decorative Atmosphere */}
        <div className="fixed right-0 top-0 bottom-0 w-[calc(50vw-576px)] min-w-[150px] pointer-events-none z-[-1] hidden xl:block overflow-hidden">
          {/* Subtle grid lines */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\\'100\\' height=\\'100\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cpath d=\\'M99 0h1v100h-1zM0 99h100v1H0z\\' fill=\\'rgba(6,182,212,0.01)\\'/%3E%3C/svg%3E')]"></div>
          
          {/* Topographic arcs */}
          <svg className="absolute bottom-[20%] right-[-30%] w-[180%] h-[50%] opacity-[0.1]" fill="none" viewBox="0 0 100 100" preserveAspectRatio="none" stroke="#06b6d4" strokeWidth="0.5" strokeDasharray="2 6">
            <path d="M0 0 Q 50 100 100 0" />
            <path d="M0 -10 Q 50 90 100 -10" />
            <path d="M0 -20 Q 50 80 100 -20" />
            <path d="M0 -30 Q 50 70 100 -30" />
          </svg>

          <div className="absolute top-16 left-12 text-[10px] text-slate-600/60 uppercase tracking-[0.25em] font-mono whitespace-pre-line leading-relaxed">
            CLUES
            CONNECT
            PEOPLE.
          </div>
          
          {/* Abstract Connection Nodes */}
          <div className="absolute top-[25%] right-[20%] opacity-40">
            <svg width="120" height="160" viewBox="0 0 100 100" fill="none" stroke="#d97706" strokeWidth="0.5">
              <path d="M20 20 L80 80 M80 20 L20 80" strokeDasharray="2 4"/>
              <path d="M50 0 L50 100 M0 50 L100 50" strokeOpacity="0.2"/>
              <circle cx="20" cy="20" r="1.5" fill="#d97706"/>
              <circle cx="80" cy="80" r="1.5" fill="#d97706"/>
              <circle cx="80" cy="20" r="1.5" fill="#d97706"/>
              <circle cx="20" cy="80" r="1.5" fill="#d97706"/>
            </svg>
            <div className="absolute top-[85%] right-0 text-[7px] text-amber-700/60 font-mono tracking-widest mt-2">
              <span className="text-amber-500/80">X</span> ALIGNMENT
            </div>
          </div>
          
          <div className="absolute top-[55%] left-8 text-[8px] text-slate-700/60 uppercase tracking-[0.2em] font-mono whitespace-pre-line flex items-center gap-2">
            <span className="text-amber-600/50">+</span>
            [SYS.LON: 72.8777 E]
            <span className="w-8 h-[1px] bg-slate-800/80 inline-block"></span>
          </div>

          <div className="absolute bottom-32 left-12 text-[10px] text-slate-600/60 uppercase tracking-[0.25em] font-mono whitespace-pre-line leading-relaxed border-l border-slate-800/50 pl-4">
            FIND
            WHAT
            OTHERS
            OVERLOOK.
          </div>
        </div>
        
        {/* Top Header / Navigation */}
        <div className="flex flex-col xl:flex-row items-start gap-8 mb-8">
          {/* Logo Section */}
          <div className="flex flex-col items-start min-w-[200px]">
            <div className="w-12 h-12 mb-3 text-amber-500/80">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2v2m0 16v2m10-10h-2M4 12H2M19.07 4.93l-1.41 1.41M6.34 17.66l-1.41 1.41M19.07 19.07l-1.41-1.41M6.34 6.34L4.93 4.93" /><circle cx="12" cy="12" r="3" /></svg>
            </div>
            <h1 className="text-xl font-bold tracking-widest text-white mb-1 uppercase">MYSTIC HUNT</h1>
            <p className="text-[8px] text-amber-500/70 uppercase tracking-[0.25em] font-mono whitespace-nowrap">
              EXPLORE • SOLVE • UNCOVER
            </p>
          </div>

          {/* Team Status Panel */}
          <div className="flex-1 border border-slate-700/50 bg-[#061019]/80 backdrop-blur-md p-6 rounded-xl flex flex-col md:flex-row justify-between items-center gap-6 shadow-[0_4px_30px_rgba(0,0,0,0.5)] relative overflow-hidden group w-full">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-400"></div>
            
            <div className="flex items-start gap-5 ml-2">
              <div className="text-cyan-500 mt-1">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
              <div>
                <p className="text-[9px] text-cyan-500 uppercase tracking-widest font-mono mb-1">TEAM STATUS</p>
                <h2 className="text-2xl font-bold tracking-wide text-white uppercase">{agentTeamName} <span className="text-sm text-slate-500 ml-1 font-mono">[{agentCallsign}]</span></h2>
                <p className="text-[11px] text-slate-400 tracking-widest mt-1 font-mono">Current Phase: <span className={systemState.phase === 'PHASE_2' ? 'text-cyan-400' : 'text-cyan-400'}>{systemState.phase === 'PHASE_2' ? 'DIGITAL BREACH AUTHORIZED' : 'PHASE 1 ACTIVE'}</span></p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-right px-6 py-2 rounded-lg bg-[#030B12]/50 border border-slate-800/40">
                <p className="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-mono mb-1">TOTAL INTEL</p>
                <p className="text-3xl font-bold text-white"><span className="text-cyan-400">{totalScore}</span> <span className="text-[10px] text-slate-500 font-mono">PTS</span></p>
              </div>
              <div className="flex gap-2">
                <a href="/scoreboard" className="border border-cyan-900/50 hover:border-cyan-400 hover:bg-cyan-950/30 hover:text-cyan-300 px-6 py-2.5 text-[10px] font-bold tracking-widest uppercase rounded-lg text-cyan-500 transition-all font-mono flex items-center gap-2">
                  SCOREBOARD →
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Team Intel Section */}
        <div className="mb-8 border border-slate-700/50 bg-[#061019]/80 backdrop-blur-sm p-6 rounded-xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 to-transparent pointer-events-none"></div>
          
          <div className="flex justify-between items-center mb-5 border-b border-slate-700/50 pb-3">
            <h2 className="text-sm font-bold tracking-[0.2em] text-slate-300 uppercase">
              TEAM INTEL
            </h2>
            <span className="text-[9px] text-slate-500 font-mono tracking-widest font-bold">{teamMembers.length}/4 AGENTS</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => {
              const member = teamMembers[index]
              if (member) {
                return (
                  <div key={member.id} className="border border-slate-700/50 bg-[#030B12] p-3 rounded-lg flex justify-between items-center group hover:border-cyan-500/50 transition-colors shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center gap-3 relative z-10 pl-1">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${member.is_leader ? 'bg-cyan-900/60 text-cyan-300 border-2 border-cyan-500/50' : 'bg-[#061019] text-slate-300 border-2 border-slate-700'}`}>
                        {member.callsign.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white uppercase tracking-wide">
                          {member.callsign}
                        </p>
                        {member.is_leader && <p className="text-[8px] text-amber-500 uppercase tracking-[0.1em] mt-1 font-mono font-bold">TEAM LEADER</p>}
                      </div>
                    </div>
                    {profile?.is_leader && member.id !== profile.id && (
                      <button 
                        onClick={async () => {
                          if(window.confirm(`Remove ${member.callsign} from the team?`)) {
                            await supabase.from('profiles').delete().eq('id', member.id);
                            fetchArenaData();
                          }
                        }}
                        className="text-[9px] text-slate-500 hover:text-red-400 border border-transparent hover:border-red-900/50 hover:bg-red-500/10 px-2 py-1 rounded transition-all font-mono opacity-0 group-hover:opacity-100 relative z-10 mr-1"
                      >
                        REMOVE
                      </button>
                    )}
                  </div>
                )
              } else {
                return (
                  <div key={`empty-${index}`} className="border border-slate-800/40 border-dashed bg-[#030B12]/30 p-3 rounded-lg flex items-center justify-center gap-2 h-[62px]">
                    <div className="w-5 h-5 rounded-full border border-slate-700 text-slate-600 flex items-center justify-center text-xs">+</div>
                    <p className="text-[9px] text-slate-600 uppercase tracking-widest font-mono">AWAITING AGENT</p>
                  </div>
                )
              }
            })}
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
          <div className={systemState.phase === 'PHASE_2' ? 'opacity-60 pointer-events-none grayscale' : ''}>
            <div className="flex justify-between items-center mb-1 pb-2">
              <h2 className="text-sm font-bold tracking-widest text-slate-200 uppercase flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                PHASE 1: FIELD OPS
              </h2>
              <span className="text-[9px] text-slate-500 font-mono tracking-widest font-bold">{round1Stages.length} MISSIONS</span>
            </div>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono mb-4 border-b border-slate-700/50 pb-4">
              EXPLORE THE CAMPUS. FIND THE CLUES. UNLOCK THE TRUTH.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {round1Stages.map(stage => {
                const isSecured = stageProgress.some(p => p.team_id === profile?.team_id && p.stage_id === stage.id)
                return (
                  <div key={stage.id} onClick={() => setSelectedStageId(stage.id)} className={`cursor-pointer border ${isSecured ? 'border-cyan-500/40 bg-[#041011]' : 'border-slate-700/50 bg-[#030B12] hover:border-cyan-500/50 hover:bg-[#061019]'} p-5 rounded-xl relative overflow-hidden flex flex-col h-[160px] transition-all group`}>
                    
                    <div className="flex justify-between items-center mb-4 relative z-10 border-b border-slate-800/50 pb-3">
                      <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">MISSION ID: {stage.id.substring(0,4)}</span>
                      {isSecured ? (
                        <span className="text-[8px] font-bold text-cyan-400 font-mono flex items-center gap-1 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-900/50"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> SECURED</span>
                      ) : (
                        <span className="text-[8px] font-bold text-cyan-400 font-mono flex items-center gap-1 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-900/50"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> ACTIVE</span>
                      )}
                    </div>
                    
                    <div className="relative z-10 flex flex-col gap-2 mb-auto">
                      <div className="w-6 h-6 text-amber-500/80">
                        {/* Determine icon playfully based on length of title, just to vary them like the reference */}
                        {stage.title.length % 2 === 0 ? (
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        ) : (
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                      </div>
                      <h3 className="font-bold text-[13px] text-white uppercase tracking-wide">{stage.title}</h3>
                    </div>

                    <div className="flex justify-between items-end relative z-10 border-t border-slate-800/50 pt-3">
                      <span className="text-[11px] text-cyan-400 font-mono font-bold flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                        {stage.points} PTS
                      </span>
                      <span className="text-[12px] font-bold text-cyan-500 font-mono">→</span>
                    </div>
                  </div>
                )
              })}
              {round1Stages.length === 0 && <div className="col-span-1 md:col-span-2 text-center py-10 border border-slate-800/50 border-dashed rounded-xl"><p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">No field ops available</p></div>}
            </div>
          </div>

          {/* PHASE 2: DIGITAL BREACHES */}
          <div>
            <div className="flex justify-between items-center mb-1 pb-2">
              <h2 className="text-sm font-bold tracking-widest text-slate-200 uppercase flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                PHASE 2: DIGITAL BREACHES
              </h2>
              {systemState.phase === 'PHASE_1' ? (
                <span className="text-[9px] text-red-500 font-mono tracking-widest font-bold flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  LOCKED
                </span>
              ) : (
                <span className="text-[9px] text-slate-500 font-mono tracking-widest font-bold">{round2Challenges.length} SYSTEMS</span>
              )}
            </div>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono mb-4 border-b border-slate-700/50 pb-4">
              SYSTEMS LIE. DATA REVEALS.
            </p>
            
            {systemState.phase === 'PHASE_1' ? (
              <div className="border border-red-900/30 bg-[#060A10] p-8 rounded-xl flex flex-col items-center justify-center text-center h-[336px] relative overflow-hidden">
                <svg className="w-10 h-10 text-red-500 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                <h3 className="text-slate-200 font-bold tracking-widest text-lg uppercase mb-2">PHASE LOCKED</h3>
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-6">AWAITING PHASE 1 CONCLUSION</p>
                <div className="w-32 h-[1px] bg-slate-800 mb-6"></div>
                <p className="text-[9px] text-slate-600 font-mono uppercase tracking-[0.15em] leading-relaxed">DEEPER CHALLENGES LIE AHEAD.<br/>THE REAL HUNT BEGINS SOON.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {round2Challenges.map(chal => {
                  const isSecured = stageProgress.some(p => p.team_id === profile?.team_id && p.challenge_id === chal.id)
                  return (
                    <div key={chal.id} onClick={() => setSelectedChallengeId(chal.id)} className={`cursor-pointer border ${isSecured ? 'border-cyan-500/40 bg-[#041011]' : 'border-slate-700/50 bg-[#030B12] hover:border-cyan-500/50 hover:bg-[#061019]'} p-5 rounded-xl relative overflow-hidden flex flex-col h-[160px] transition-all group`}>
                      
                      <div className="flex justify-between items-center mb-4 relative z-10 border-b border-slate-800/50 pb-3">
                        <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">SYS ID: {chal.id.substring(0,4)}</span>
                        {isSecured ? (
                          <span className="text-[8px] font-bold text-cyan-400 font-mono flex items-center gap-1 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-900/50"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> BREACHED</span>
                        ) : (
                          <span className="text-[8px] font-bold text-cyan-400 font-mono flex items-center gap-1 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-900/50"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> ONLINE</span>
                        )}
                      </div>
                      
                      <div className="relative z-10 flex flex-col gap-2 mb-auto">
                        <div className="w-6 h-6 text-cyan-500/80">
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M4 17h16a2 2 0 002-2V9a2 2 0 00-2-2H4a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                        </div>
                        <h3 className="font-bold text-[13px] text-white uppercase tracking-wide">{chal.title}</h3>
                      </div>

                      <div className="flex justify-between items-end relative z-10 border-t border-slate-800/50 pt-3">
                        <span className="text-[11px] text-cyan-400 font-mono font-bold flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                          {chal.points} PTS
                        </span>
                        <span className="text-[12px] font-bold text-cyan-500 font-mono">→</span>
                      </div>
                    </div>
                  )
                })}
                {round2Challenges.length === 0 && <div className="col-span-1 md:col-span-2 text-center py-10 border border-slate-800/50 border-dashed rounded-xl"><p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">No systems online</p></div>}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="mt-16 text-center border-t border-slate-800/50 pt-8 pb-10">
          <p className="text-[9px] text-slate-600 uppercase tracking-[0.3em] font-mono">MYSTIC HUNT // REAL CLUES. REAL PEOPLE. REAL CHALLENGES.</p>
        </div>
      </div>

      {/* MODALS */}
      {selectedStageId && (() => {
        const stage = round1Stages.find(s => s.id === selectedStageId)
        if (!stage) return null
        const isClueUnlocked = clueUnlocked[stage.id]
        const isSecured = stageProgress.some(p => p.team_id === profile?.team_id && p.stage_id === stage.id)
        
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
                {feedback && <div className="mb-6 text-[11px] font-mono text-cyan-400 bg-cyan-950/30 border border-cyan-900/50 p-4 rounded-xl flex items-center gap-3">
                  <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {feedback}
                </div>}
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
                  const hintUsed = hintUsage.some(h => h.profile_id === profile?.id && h.stage_id === stage.id)
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
                        onClick={() => { handleSubmitPhase1(stage.id, stage.final_answer, stage.points); }}
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
        const isSecured = stageProgress.some(p => p.team_id === profile?.team_id && p.challenge_id === chal.id)
        
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
                {feedback && <div className="mb-6 text-[11px] font-mono text-cyan-400 bg-cyan-950/30 border border-cyan-900/50 p-4 rounded-xl flex items-center gap-3">
                  <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {feedback}
                </div>}
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
                  const hintUsed = hintUsage.some(h => h.profile_id === profile?.id && h.challenge_id === chal.id)
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
                      onClick={() => { handleSubmitPhase2(chal.id, chal.flag, chal.points); }}
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
