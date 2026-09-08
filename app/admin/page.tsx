'use client'

import { useState, useEffect } from 'react'
import { DemoDB } from '@/lib/demo-db'

type LeaderboardEntry = {
  id: string
  callsign: string
  is_finalist: boolean
  total_points: number
  rank: number
}

export default function AdminCommandCenter() {
  const [isAuthed, setIsAuthed] = useState(false)
  const [loginUser, setLoginUser] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loginError, setLoginError] = useState('')

  const [activeTab, setActiveTab] = useState<'deploy' | 'manage' | 'leaderboard' | 'control'>('control')
  const [deployType, setDeployType] = useState<'phase1' | 'phase2'>('phase1')
  
  // Shared Deploy State
  const [title, setTitle] = useState('')
  const [points, setPoints] = useState('100')
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  
  // Phase 1 Deploy State
  const [locationClue, setLocationClue] = useState('')
  const [clueAnswer, setClueAnswer] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [finalAnswer, setFinalAnswer] = useState('')
  const [hint1, setHint1] = useState('')
  const [hintPenalty1, setHintPenalty1] = useState('25')

  // Phase 2 Deploy State
  const [description, setDescription] = useState('')
  const [flag, setFlag] = useState('')
  const [category, setCategory] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [hint2, setHint2] = useState('')
  const [hintPenalty2, setHintPenalty2] = useState('25')

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setStatusMsg('Error: File too large for local demo. Keep under 2MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      setFileUrl(event.target?.result as string)
      setFileName(file.name)
    }
    reader.readAsDataURL(file)
  }
  
  // Nodes State
  const [stages, setStages] = useState<any[]>([])
  const [challenges, setChallenges] = useState<any[]>([])

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [lbLoading, setLbLoading] = useState(true)

  // Control State
  const [systemState, setSystemState] = useState<{ phase: 'PHASE_1' | 'PHASE_2', resetStrategy: 'CUMULATIVE' | 'HARD_RESET' }>({ phase: 'PHASE_1', resetStrategy: 'CUMULATIVE' })
  const [topN, setTopN] = useState('3')

  const fetchNodes = () => {
    setStages(DemoDB.getRound1Stages())
    setChallenges(DemoDB.getRound2Challenges())
  }

  const fetchLeaderboard = () => {
    const profiles = DemoDB.getProfiles()
    const progress = DemoDB.getStageProgress()
    const state = DemoDB.getSystemState()

    const rankedAgents = profiles.map((agent) => {
      const agentProgress = progress.filter(p => p.profile_id === agent.id)
      let totalPoints = 0
      if (state.phase === 'PHASE_2' && state.resetStrategy === 'HARD_RESET') {
        totalPoints = agentProgress.filter(p => p.challenge_id).reduce((sum, p) => sum + p.points_awarded, 0)
      } else {
        totalPoints = agentProgress.reduce((sum, p) => sum + p.points_awarded, 0)
      }
      return { ...agent, total_points: totalPoints, rank: 0 }
    })
    .sort((a, b) => b.total_points - a.total_points)
    .map((agent, index) => ({ ...agent, rank: index + 1 }))

    setLeaderboard(rankedAgents)
    setLbLoading(false)
  }

  useEffect(() => {
    const session = sessionStorage.getItem('admin_auth')
    if (session === 'granted') setIsAuthed(true)
    fetchNodes()
    fetchLeaderboard()
    setSystemState(DemoDB.getSystemState())
    const interval = setInterval(fetchLeaderboard, 10000) 
    return () => clearInterval(interval)
  }, [])

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (loginUser === 'rishi7' && loginPass === 'Rishi@556') {
      sessionStorage.setItem('admin_auth', 'granted')
      setIsAuthed(true)
      setLoginError('')
    } else {
      setLoginError('ACCESS DENIED: Invalid credentials.')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth')
    setIsAuthed(false)
  }

  const handleDeploy = (e: React.FormEvent) => {
    e.preventDefault(); setStatusMsg(null)

    try {
      if (deployType === 'phase1') {
        DemoDB.addRound1Stage({ 
          title, 
          description,
          location_clue: locationClue,
          clue_answer: clueAnswer,
          access_code: accessCode,
          final_answer: finalAnswer,
          points: parseInt(points),
          hint: hint1 || undefined,
          hint_penalty: hint1 ? parseInt(hintPenalty1) : undefined
        })
        setStatusMsg('Phase 1 Stage Deployed.')
        setLocationClue(''); setClueAnswer(''); setAccessCode(''); setFinalAnswer(''); setDescription(''); setHint1(''); setHintPenalty1('25');
      } else {
        DemoDB.addRound2Challenge({ 
          title, 
          description, 
          category: category || 'GENERAL',
          flag, 
          points: parseInt(points),
          file_url: fileUrl,
          file_name: fileName,
          hint: hint2 || undefined,
          hint_penalty: hint2 ? parseInt(hintPenalty2) : undefined
        })
        setStatusMsg('Phase 2 Challenge Deployed.')
        setDescription(''); setFlag(''); setCategory(''); setFileUrl(''); setFileName(''); setHint2(''); setHintPenalty2('25');
      }
      setTitle(''); setPoints('100'); 
      fetchNodes()
    } catch (error: any) {
      setStatusMsg(`Error: ${error.message}`);
    }
  }

  const handleDelete = (id: string, type: 'stage' | 'challenge') => {
    if (type === 'stage') DemoDB.deleteRound1Stage(id)
    else DemoDB.deleteRound2Challenge(id)
    fetchNodes()
  }

  const handleToggleLock = (id: string, type: 'stage' | 'challenge', currentState: boolean) => {
    const newState = !currentState;
    if (type === 'stage') DemoDB.toggleRound1Stage(id, newState)
    else DemoDB.toggleRound2Challenge(id, newState)
    fetchNodes()
  }

  const handleResetLeaderboard = () => {
    if (!window.confirm("WARNING: This will wipe all agent scores, reset the leaderboard to 0, and return the event to PHASE 1. Are you sure?")) return
    DemoDB.resetStageProgress()
    
    // Unlock Round 1
    const s = DemoDB.getRound1Stages()
    s.forEach(stage => DemoDB.toggleRound1Stage(stage.id, true))
    
    // Reset Global State to Phase 1
    const newState = { phase: 'PHASE_1' as const, resetStrategy: 'CUMULATIVE' as const }
    DemoDB.setSystemState(newState)
    setSystemState(newState)

    setStatusMsg('>>> EVENT RESET TO PHASE 1 AND LEADERBOARD WIPED.')
    fetchLeaderboard()
    fetchNodes()
  }

  const handleInitiateRound2 = () => {
    if (!window.confirm("WARNING: This will lock all Phase 1 nodes, allow ALL teams into Phase 2, and reset the leaderboard to 0. Are you sure?")) return

    // 1. Lock Round 1
    const s = DemoDB.getRound1Stages()
    s.forEach(stage => DemoDB.toggleRound1Stage(stage.id, false))
    
    // 2. Promote ALL teams and wipe leaderboard
    DemoDB.resetStageProgress()
    const profiles = DemoDB.getProfiles()
    profiles.forEach(agent => {
      DemoDB.updateProfileFinalistStatus(agent.id, true)
    })

    // 3. Update Global State
    const newState = { phase: 'PHASE_2' as const, resetStrategy: 'HARD_RESET' as const }
    DemoDB.setSystemState(newState)
    setSystemState(newState)
    
    setStatusMsg('>>> PHASE 2 INITIATED. MAINFRAME UNLOCKED FOR ALL TEAMS.')
    fetchLeaderboard()
    fetchNodes()
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono p-6 flex items-center justify-center">
        <div className="max-w-sm w-full border border-red-900/50 bg-[#0a0a0a] p-8 rounded-lg shadow-[0_0_20px_rgba(220,38,38,0.1)]">
          <h1 className="text-xl font-bold tracking-widest text-center mb-1 uppercase text-red-500">Admin Access</h1>
          <p className="text-[10px] text-center text-zinc-600 mb-8 uppercase tracking-widest">Restricted Area</p>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Username</label>
              <input type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)} required autoFocus
                className="w-full bg-[#111111] border border-zinc-800 rounded p-3 text-white text-sm outline-none focus:border-red-500 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Password</label>
              <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required
                className="w-full bg-[#111111] border border-zinc-800 rounded p-3 text-white text-sm outline-none focus:border-red-500 transition-colors" />
            </div>
            {loginError && <p className="text-[10px] text-red-500 uppercase tracking-widest">{loginError}</p>}
            <button type="submit" className="w-full bg-red-950/40 border border-red-600/50 hover:bg-red-900/40 text-red-400 py-3 rounded text-xs font-bold tracking-widest uppercase transition-all">
              Authenticate
            </button>
          </form>
          <div className="mt-6 text-center">
            <a href="/" className="text-[10px] text-zinc-700 hover:text-zinc-500 tracking-widest uppercase transition-colors">← Back to Arena</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-6">
      
      <div className="max-w-4xl mx-auto flex justify-end gap-6 mb-4">
        <button onClick={handleLogout} className="text-[10px] tracking-widest uppercase text-zinc-600 hover:text-red-400 transition-colors">[ Log Out ]</button>
      </div>

      <div className="max-w-4xl mx-auto border border-zinc-900 bg-[#0a0a0a] p-8 rounded-lg shadow-2xl">
        <h1 className="text-2xl font-bold tracking-widest text-green-400 mb-8 uppercase border-b border-zinc-900 pb-6">
          ADMIN COMMAND CENTER (OFFLINE DEMO)
        </h1>

        <div className="flex gap-4 mb-8">
          <button onClick={() => setActiveTab('control')} className={`flex-1 py-3 text-[10px] uppercase font-bold tracking-widest rounded border transition-all ${activeTab === 'control' ? 'bg-red-950/30 border-red-500 text-red-500' : 'border-zinc-800 text-zinc-600 hover:border-zinc-500'}`}>
            0. Event Control
          </button>
          <button onClick={() => setActiveTab('deploy')} className={`flex-1 py-3 text-[10px] uppercase font-bold tracking-widest rounded border transition-all ${activeTab === 'deploy' ? 'bg-green-900/10 border-green-500 text-green-400' : 'border-zinc-800 text-zinc-600 hover:border-zinc-500'}`}>
            1. Deploy
          </button>
          <button onClick={() => setActiveTab('manage')} className={`flex-1 py-3 text-[10px] uppercase font-bold tracking-widest rounded border transition-all ${activeTab === 'manage' ? 'bg-green-900/10 border-green-500 text-green-400' : 'border-zinc-800 text-zinc-600 hover:border-zinc-500'}`}>
            2. Manage
          </button>
          <button onClick={() => setActiveTab('leaderboard')} className={`flex-1 py-3 text-[10px] uppercase font-bold tracking-widest rounded border transition-all ${activeTab === 'leaderboard' ? 'bg-green-900/10 border-green-500 text-green-400' : 'border-zinc-800 text-zinc-600 hover:border-zinc-500'}`}>
            3. Leaderboard
          </button>
        </div>

        {activeTab === 'control' && (
          <div className="animate-in fade-in duration-300 border border-red-900/50 bg-red-950/10 p-6 rounded-lg">
            <h2 className="text-lg font-bold tracking-widest text-red-500 uppercase mb-4 border-b border-red-900/50 pb-2 flex justify-between items-center">
              MASTER SWITCH
              <span className="text-xs text-zinc-500">CURRENT STATE: <span className="text-white font-bold">{systemState.phase}</span></span>
            </h2>
            
            {statusMsg && <div className="mb-6 text-xs text-green-400 bg-green-950/30 border border-green-900 p-3 rounded">{statusMsg}</div>}

            <div className="space-y-6">
              <button 
                onClick={handleResetLeaderboard}
                className="w-full bg-zinc-900/40 border border-zinc-600 text-zinc-300 hover:bg-zinc-800/60 py-5 rounded text-sm font-bold tracking-widest uppercase transition-all"
              >
                1. RESET EVENT TO PHASE 1 & WIPE LEADERBOARD
              </button>

              <button 
                onClick={handleInitiateRound2}
                disabled={systemState.phase === 'PHASE_2'}
                className="w-full bg-red-950/40 border border-red-600 text-red-500 hover:bg-red-900/60 py-5 rounded text-sm font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_30px_rgba(220,38,38,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {systemState.phase === 'PHASE_2' ? '>>> PHASE 2 ALREADY ACTIVE <<<' : '2. INITIATE ROUND 2 (ALL TEAMS + RESET POINTS)'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'deploy' && (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-sm font-bold tracking-widest text-zinc-400 uppercase mb-4 border-b border-zinc-900 pb-2">Deploy New Node</h2>
            
            <div className="flex gap-2 mb-6">
              <button onClick={() => setDeployType('phase1')} className={`flex-1 py-2 text-xs uppercase font-bold rounded border ${deployType === 'phase1' ? 'bg-green-900/30 border-green-500 text-green-400' : 'border-zinc-800 text-zinc-500'}`}>Phase 1 (Physical)</button>
              <button onClick={() => setDeployType('phase2')} className={`flex-1 py-2 text-xs uppercase font-bold rounded border ${deployType === 'phase2' ? 'bg-green-900/30 border-green-500 text-green-400' : 'border-zinc-800 text-zinc-500'}`}>Phase 2 (Digital)</button>
            </div>

            {statusMsg && <div className="mb-6 text-xs text-green-400 bg-green-950/30 border border-green-900 p-3 rounded">{statusMsg}</div>}

            <form onSubmit={handleDeploy} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full bg-[#111111] border border-zinc-800 rounded p-4 text-zinc-300 text-sm outline-none focus:border-green-500 transition-colors placeholder:text-zinc-600" />
                
                {deployType === 'phase2' && (
                   <input type="text" placeholder="Category (e.g. OSINT, CRYPTO)" value={category} onChange={(e) => setCategory(e.target.value)} required className="w-full bg-[#111111] border border-zinc-800 rounded p-4 text-zinc-300 text-sm outline-none focus:border-green-500 transition-colors placeholder:text-zinc-600" />
                )}
              </div>
              
              {deployType === 'phase1' ? (
                <>
                  <textarea placeholder="Challenge Description (revealed after clue answer)" value={description} onChange={(e) => setDescription(e.target.value)} required className="w-full bg-[#111111] border border-zinc-800 rounded p-4 text-zinc-300 text-sm outline-none h-24 focus:border-green-500 transition-colors placeholder:text-zinc-600" />
                  <textarea placeholder="Location Clue (what agents see first, e.g. 'Where the books sleep...')" value={locationClue} onChange={(e) => setLocationClue(e.target.value)} required className="w-full bg-[#111111] border border-zinc-800 rounded p-4 text-zinc-300 text-sm outline-none h-24 focus:border-green-500 transition-colors placeholder:text-zinc-600" />
                  <input type="text" placeholder="Clue Answer (correct answer to the location clue above)" value={clueAnswer} onChange={(e) => setClueAnswer(e.target.value)} required className="w-full bg-[#111111] border border-yellow-900/50 rounded p-4 text-zinc-300 text-sm outline-none focus:border-yellow-500 transition-colors placeholder:text-zinc-600" />
                  <input type="text" placeholder="Access Code (physical code found at the location)" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} required className="w-full bg-[#111111] border border-zinc-800 rounded p-4 text-zinc-300 text-sm outline-none focus:border-green-500 transition-colors placeholder:text-zinc-600" />
                  <input type="text" placeholder="Final Answer (submitted after entering access code)" value={finalAnswer} onChange={(e) => setFinalAnswer(e.target.value)} required className="w-full bg-[#111111] border border-zinc-800 rounded p-4 text-zinc-300 text-sm outline-none focus:border-green-500 transition-colors placeholder:text-zinc-600" />
                  <div className="bg-[#0d0d0d] border border-zinc-900 rounded p-4 space-y-3">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Hint (Optional)</p>
                    <div className="flex gap-3">
                      <input type="text" placeholder="Hint text (leave blank for no hint)" value={hint1} onChange={(e) => setHint1(e.target.value)} className="flex-1 bg-[#111111] border border-zinc-800 rounded p-3 text-zinc-300 text-sm outline-none focus:border-orange-500 transition-colors placeholder:text-zinc-600" />
                      <input type="number" placeholder="Penalty pts" value={hintPenalty1} onChange={(e) => setHintPenalty1(e.target.value)} className="w-28 bg-[#111111] border border-orange-900/50 rounded p-3 text-zinc-300 text-sm outline-none focus:border-orange-500 transition-colors placeholder:text-zinc-600" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <textarea placeholder="Challenge Description" value={description} onChange={(e) => setDescription(e.target.value)} required className="w-full bg-[#111111] border border-zinc-800 rounded p-4 text-zinc-300 text-sm outline-none h-24 focus:border-green-500 transition-colors placeholder:text-zinc-600" />
                  <input type="text" placeholder="Flag (mystic{...})" value={flag} onChange={(e) => setFlag(e.target.value)} required className="w-full bg-[#111111] border border-zinc-800 rounded p-4 text-zinc-300 text-sm outline-none focus:border-green-500 transition-colors placeholder:text-zinc-600" />
                  <div className="w-full bg-[#111111] border border-zinc-800 rounded p-4">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">Attach Intel File (Optional, max 2MB for demo)</label>
                    <input type="file" onChange={handleFileUpload} className="text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-green-600/50 file:text-[10px] file:uppercase file:tracking-widest file:font-bold file:bg-green-900/20 file:text-green-400 hover:file:bg-green-900/40 file:transition-colors file:cursor-pointer" />
                    {fileName && <p className="text-[10px] text-green-500 mt-2">Attached: {fileName}</p>}
                  </div>
                  <div className="bg-[#0d0d0d] border border-zinc-900 rounded p-4 space-y-3">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Hint (Optional)</p>
                    <div className="flex gap-3">
                      <input type="text" placeholder="Hint text (leave blank for no hint)" value={hint2} onChange={(e) => setHint2(e.target.value)} className="flex-1 bg-[#111111] border border-zinc-800 rounded p-3 text-zinc-300 text-sm outline-none focus:border-orange-500 transition-colors placeholder:text-zinc-600" />
                      <input type="number" placeholder="Penalty pts" value={hintPenalty2} onChange={(e) => setHintPenalty2(e.target.value)} className="w-28 bg-[#111111] border border-orange-900/50 rounded p-3 text-zinc-300 text-sm outline-none focus:border-orange-500 transition-colors placeholder:text-zinc-600" />
                    </div>
                  </div>
                </>
              )}

              <input type="number" placeholder="Points (e.g. 100)" value={points} onChange={(e) => setPoints(e.target.value)} required className="w-full bg-[#111111] border border-zinc-800 rounded p-4 text-zinc-300 text-sm outline-none focus:border-green-500 transition-colors placeholder:text-zinc-600" />

              <button type="submit" className="w-full mt-4 bg-transparent border border-green-500 text-green-400 hover:bg-green-900/20 py-4 rounded text-xs font-bold tracking-widest uppercase transition-all">
                DEPLOY
              </button>
            </form>
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="animate-in fade-in duration-300 grid grid-cols-1 gap-6">
            <div>
              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 tracking-widest border-b border-zinc-900 pb-2">Active Field Ops ({stages.length})</h3>
              <div className="space-y-2">
                {stages.map(s => (
                  <div key={s.id} className={`border p-4 rounded flex flex-col md:flex-row justify-between md:items-center gap-4 transition-colors ${s.is_active !== false ? 'bg-[#0a0a0a] border-zinc-800' : 'bg-zinc-950 border-zinc-900 opacity-50'}`}>
                    <div>
                      <p className="text-xs text-white font-bold uppercase flex items-center gap-2">
                        {s.title}
                        {s.is_active === false && <span className="text-[9px] bg-red-950/50 text-red-500 px-1.5 py-0.5 rounded border border-red-900">LOCKED</span>}
                      </p>
                      <p className="text-[10px] text-zinc-500 tracking-widest mt-2 line-clamp-2">{s.description}</p>
                      <p className="text-[10px] text-zinc-400 tracking-widest mt-1"><span className="text-zinc-600">CLUE:</span> {s.location_clue}</p>
                      <p className="text-[10px] text-zinc-400 tracking-widest mt-1"><span className="text-yellow-700">CLUE ANS:</span> {s.clue_answer} | <span className="text-zinc-600">CODE:</span> {s.access_code} | <span className="text-zinc-600">FINAL ANS:</span> {s.final_answer} | <span className="text-zinc-600">PTS:</span> {s.points}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleToggleLock(s.id, 'stage', s.is_active !== false)} className="text-[10px] border border-zinc-800 hover:border-zinc-600 text-zinc-400 px-3 py-1.5 rounded uppercase tracking-widest transition-colors">
                        {s.is_active !== false ? 'Lock' : 'Activate'}
                      </button>
                      <button onClick={() => handleDelete(s.id, 'stage')} className="text-[10px] border border-red-900/50 hover:bg-red-950/30 text-red-500 px-3 py-1.5 rounded uppercase tracking-widest transition-colors">Delete</button>
                    </div>
                  </div>
                ))}
                {stages.length === 0 && <p className="text-xs text-zinc-600 uppercase">No stages deployed.</p>}
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 tracking-widest border-b border-zinc-900 pb-2">Active Breaches ({challenges.length})</h3>
              <div className="space-y-2">
                {challenges.map(c => (
                  <div key={c.id} className={`border p-4 rounded flex flex-col md:flex-row justify-between md:items-center gap-4 transition-colors ${c.is_active !== false ? 'bg-[#0a0a0a] border-zinc-800' : 'bg-zinc-950 border-zinc-900 opacity-50'}`}>
                    <div>
                      <p className="text-xs text-white font-bold uppercase flex items-center gap-2">
                        <span className="text-green-500">[{c.category}]</span>{c.title}
                        {c.is_active === false && <span className="text-[9px] bg-red-950/50 text-red-500 px-1.5 py-0.5 rounded border border-red-900">LOCKED</span>}
                      </p>
                      <p className="text-[10px] text-zinc-500 tracking-widest mt-2 line-clamp-2">{c.description}</p>
                      <p className="text-[10px] text-zinc-400 tracking-widest mt-1"><span className="text-zinc-600">FLAG:</span> {c.flag} | <span className="text-zinc-600">PTS:</span> {c.points}</p>
                      {c.file_name && <p className="text-[10px] text-green-500 tracking-widest mt-1">📎 {c.file_name}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleToggleLock(c.id, 'challenge', c.is_active !== false)} className="text-[10px] border border-zinc-800 hover:border-zinc-600 text-zinc-400 px-3 py-1.5 rounded uppercase tracking-widest transition-colors">
                        {c.is_active !== false ? 'Lock' : 'Activate'}
                      </button>
                      <button onClick={() => handleDelete(c.id, 'challenge')} className="text-[10px] border border-red-900/50 hover:bg-red-950/30 text-red-500 px-3 py-1.5 rounded uppercase tracking-widest transition-colors">Delete</button>
                    </div>
                  </div>
                ))}
                {challenges.length === 0 && <p className="text-xs text-zinc-600 uppercase">No challenges deployed.</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="animate-in fade-in duration-300">
            {lbLoading ? (
              <div className="text-zinc-600 tracking-widest uppercase text-center py-20">
                {'>'} SYNCING LEADERBOARD...
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-zinc-800 text-[10px] tracking-widest text-zinc-500 uppercase font-bold">
                  <div className="col-span-2 text-center">Rank</div>
                  <div className="col-span-5">Agent Callsign</div>
                  <div className="col-span-2 text-center">Status</div>
                  <div className="col-span-3 text-right">Score</div>
                </div>

                {leaderboard.length === 0 ? (
                  <div className="text-center py-10 text-xs text-zinc-600 uppercase tracking-widest border border-zinc-900 rounded bg-[#0a0a0a]">
                    No active agents found in registry.
                  </div>
                ) : (
                  leaderboard.map((agent) => (
                    <div 
                      key={agent.id} 
                      className={`grid grid-cols-12 gap-4 px-4 py-4 rounded items-center transition-all ${
                        agent.rank === 1 ? 'bg-green-950/20 border border-green-500/30' : 
                        agent.rank <= 3 ? 'bg-zinc-900/30 border border-zinc-800' : 
                        'bg-[#0a0a0a] border border-zinc-900'
                      }`}
                    >
                      <div className={`col-span-2 text-center font-bold text-lg ${agent.rank === 1 ? 'text-green-400' : 'text-zinc-500'}`}>
                        #{agent.rank}
                      </div>
                      <div className="col-span-5 font-bold text-zinc-300 tracking-wide text-sm">
                        {agent.callsign}
                      </div>
                      <div className="col-span-2 text-center">
                        {agent.is_finalist ? (
                          <span className="text-[9px] px-1.5 py-0.5 bg-green-500/10 text-green-500 border border-green-500/30 rounded uppercase tracking-wider">
                            PH2
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 bg-zinc-900 text-zinc-500 border border-zinc-800 rounded uppercase tracking-wider">
                            PH1
                          </span>
                        )}
                      </div>
                      <div className="col-span-3 text-right font-bold text-green-400 text-lg tracking-widest">
                        {agent.total_points}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
