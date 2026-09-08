'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type LeaderboardEntry = {
  id: string
  team_name: string
  is_finalist: boolean
  total_points: number
  rank: number
  members: number
}

export default function AdminCommandCenter() {
  const [isAuthed, setIsAuthed] = useState(false)
  const [loginUser, setLoginUser] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loginError, setLoginError] = useState('')

  const [activeTab, setActiveTab] = useState<'deploy' | 'manage' | 'leaderboard' | 'control' | 'teams'>('control')
  const [deployType, setDeployType] = useState<'phase1' | 'phase2'>('phase1')
  
  // Teams State
  const [teamsList, setTeamsList] = useState<any[]>([])
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamPass, setNewTeamPass] = useState('')
  
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
  const [systemState, setSystemState] = useState<{ phase: 'PHASE_1' | 'PHASE_2', reset_strategy: 'CUMULATIVE' | 'HARD_RESET' }>({ phase: 'PHASE_1', reset_strategy: 'CUMULATIVE' })
  const [topN, setTopN] = useState('3')

  const fetchNodes = async () => {
    const { data: s } = await supabase.from('round1_stages').select('*').order('created_at', { ascending: false }); setStages(s || [])
    const { data: c } = await supabase.from('round2_challenges').select('*').order('created_at', { ascending: false }); setChallenges(c || [])
    const { data: t } = await supabase.from('teams').select('*').order('created_at', { ascending: false }); setTeamsList(t || [])
  }

  const fetchLeaderboard = async () => {
    const { data: teams } = await supabase.from('teams').select('*')
    const { data: profiles } = await supabase.from('profiles').select('*')
    const { data: progress } = await supabase.from('stage_progress').select('*')
    const { data: stateData } = await supabase.from('system_state').select('*').eq('id', 1).single()

    if (!teams || !profiles || !progress) return

    const state = stateData || { phase: 'PHASE_1', reset_strategy: 'CUMULATIVE' }

    const rankedTeams = teams.map((team) => {
      const teamProgress = progress.filter(p => p.team_id === team.id)
      const teamMembers = profiles.filter(p => p.team_id === team.id).length
      
      let totalPoints = 0
      if (state.phase === 'PHASE_2' && state.reset_strategy === 'HARD_RESET') {
        totalPoints = teamProgress.filter(p => p.challenge_id).reduce((sum, p) => sum + p.points_awarded, 0)
      } else {
        totalPoints = teamProgress.reduce((sum, p) => sum + p.points_awarded, 0)
      }
      return { ...team, team_name: team.name, members: teamMembers, total_points: totalPoints, rank: 0 }
    })
    .sort((a, b) => b.total_points - a.total_points)
    .map((team, index) => ({ ...team, rank: index + 1 }))

    setLeaderboard(rankedTeams)
    setLbLoading(false)
  }

  useEffect(() => {
    const session = sessionStorage.getItem('admin_auth')
    if (session === 'granted') setIsAuthed(true)
    fetchNodes()
    fetchLeaderboard()
    supabase.from('system_state').select('*').eq('id',1).single().then(({data}) => { if(data) setSystemState({ phase: data.phase as any, reset_strategy: data.reset_strategy as any }) })
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

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault(); setStatusMsg(null)

    try {
      if (deployType === 'phase1') {
        await supabase.from('round1_stages').insert({ 
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
        await supabase.from('round2_challenges').insert({ 
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

  const handleDelete = async (id: string, type: 'stage' | 'challenge') => {
    if (type === 'stage') await supabase.from('round1_stages').delete().eq('id', id)
    else await supabase.from('round2_challenges').delete().eq('id', id)
    fetchNodes()
  }

  const handleToggleLock = async (id: string, type: 'stage' | 'challenge', currentState: boolean) => {
    const newState = !currentState;
    if (type === 'stage') await supabase.from('round1_stages').update({ is_active: newState }).eq('id', id)
    else await supabase.from('round2_challenges').update({ is_active: newState }).eq('id', id)
    fetchNodes()
  }

  const handleResetLeaderboard = async () => {
    if (!window.confirm("WARNING: This will wipe all agent scores, reset the leaderboard to 0, and return the event to PHASE 1. Are you sure?")) return
    await supabase.from('stage_progress').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    // Unlock Round 1
    await supabase.from('round1_stages').update({ is_active: true }).neq('id', '00000000-0000-0000-0000-000000000000')
    
    // Reset Global State to Phase 1
    const newState = { phase: 'PHASE_1' as const, reset_strategy: 'CUMULATIVE' as const }
    await supabase.from('system_state').update({ phase: 'PHASE_1', reset_strategy: 'CUMULATIVE' }).eq('id', 1)
    setSystemState(newState as any)

    setStatusMsg('>>> EVENT RESET TO PHASE 1 AND LEADERBOARD WIPED.')
    fetchLeaderboard()
    fetchNodes()
  }

  const handleInitiateRound2 = async () => {
    if (!window.confirm("WARNING: This will lock all Phase 1 nodes, allow ALL teams into Phase 2, and reset the leaderboard to 0. Are you sure?")) return

    // 1. Lock Round 1
    await supabase.from('round1_stages').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
    
    // 2. Promote ALL teams and wipe leaderboard
    await supabase.from('stage_progress').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('teams').update({ is_finalist: true }).neq('id', '00000000-0000-0000-0000-000000000000')

    // 3. Update Global State
    const newState = { phase: 'PHASE_2' as const, reset_strategy: 'HARD_RESET' as const }
    await supabase.from('system_state').update({ phase: 'PHASE_2', reset_strategy: 'HARD_RESET' }).eq('id', 1)
    setSystemState(newState as any)
    
    setStatusMsg('>>> PHASE 2 INITIATED. MAINFRAME UNLOCKED FOR ALL TEAMS.')
    fetchLeaderboard()
    fetchNodes()
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen p-6 relative z-0 flex items-center justify-center">
        <div className="max-w-sm w-full border border-red-900/40 bg-[#0A0508]/90 backdrop-blur-md p-8 rounded-xl shadow-[0_8px_32px_rgba(220,38,38,0.15)] relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50 rounded-t-xl"></div>
          
          <div className="text-center mb-8">
            <h1 className="text-xl font-bold tracking-widest uppercase text-white mb-2">ADMIN ACCESS</h1>
            <p className="text-[10px] text-red-500 uppercase tracking-widest font-mono">Restricted Area</p>
          </div>
          
          <form onSubmit={handleAdminLogin} className="space-y-5">
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1.5 font-mono">Username</label>
              <input type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)} required autoFocus
                className="w-full bg-[#050204] border border-red-900/30 rounded-lg p-3 text-slate-200 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1.5 font-mono">Password</label>
              <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required
                className="w-full bg-[#050204] border border-red-900/30 rounded-lg p-3 text-slate-200 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all font-mono" />
            </div>
            {loginError && <p className="text-[10px] text-red-400 uppercase tracking-widest text-center bg-red-500/10 py-2 rounded font-mono border border-red-500/20">{loginError}</p>}
            <button type="submit" className="w-full mt-2 bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] hover:shadow-[0_0_25px_rgba(220,38,38,0.4)] border border-red-400/50">
              Authenticate
            </button>
          </form>
          <div className="mt-8 text-center pt-6 border-t border-slate-800/50">
            <a href="/" className="text-[10px] text-slate-500 hover:text-red-400 tracking-widest uppercase transition-colors font-mono flex items-center justify-center gap-2">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back to Arena
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 relative z-0">
      
      <div className="max-w-4xl mx-auto flex justify-between gap-6 mb-4">
        <a href="/" className="text-[10px] tracking-widest uppercase text-slate-500 hover:text-cyan-400 transition-colors font-mono flex items-center gap-2">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Back to Arena
        </a>
        <button onClick={handleLogout} className="text-[10px] tracking-widest uppercase text-slate-500 hover:text-red-400 transition-colors font-mono">
          [ Terminate Session ]
        </button>
      </div>

      <div className="max-w-4xl mx-auto border border-slate-800/60 bg-[#061019]/80 backdrop-blur-sm p-8 rounded-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 opacity-50"></div>
        <h1 className="text-2xl font-bold tracking-widest text-white mb-8 uppercase border-b border-slate-800/60 pb-6">
          COMMAND CENTER
        </h1>

        <div className="flex flex-wrap gap-2 mb-8">
          <button onClick={() => setActiveTab('control')} className={`flex-1 py-3 px-2 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all border ${activeTab === 'control' ? 'bg-red-500/10 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(220,38,38,0.1)]' : 'border-transparent text-slate-500 hover:text-slate-300 bg-[#030B12]'}`}>
            0. Event Control
          </button>
          <button onClick={() => setActiveTab('deploy')} className={`flex-1 py-3 px-2 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all border ${activeTab === 'deploy' ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'border-transparent text-slate-500 hover:text-slate-300 bg-[#030B12]'}`}>
            1. Deploy
          </button>
          <button onClick={() => setActiveTab('manage')} className={`flex-1 py-3 px-2 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all border ${activeTab === 'manage' ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'border-transparent text-slate-500 hover:text-slate-300 bg-[#030B12]'}`}>
            2. Manage
          </button>
          <button onClick={() => setActiveTab('teams')} className={`flex-1 py-3 px-2 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all border ${activeTab === 'teams' ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'border-transparent text-slate-500 hover:text-slate-300 bg-[#030B12]'}`}>
            3. Teams
          </button>
          <button onClick={() => setActiveTab('leaderboard')} className={`flex-1 py-3 px-2 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all border ${activeTab === 'leaderboard' ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'border-transparent text-slate-500 hover:text-slate-300 bg-[#030B12]'}`}>
            4. Leaderboard
          </button>
        </div>

        {activeTab === 'control' && (
          <div className="animate-in fade-in duration-300 border border-red-900/50 bg-[#0A0508] p-6 rounded-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-[100px] pointer-events-none"></div>
            <h2 className="text-lg font-bold tracking-widest text-red-500 uppercase mb-6 border-b border-red-900/30 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              MASTER SWITCHES
              <span className="text-xs text-slate-500 font-mono">SYSTEM STATE: <span className="text-white font-bold bg-slate-900 px-3 py-1 rounded-md border border-slate-700">{systemState.phase}</span></span>
            </h2>
            
            {statusMsg && <div className="mb-6 text-[11px] font-mono text-cyan-400 bg-cyan-950/30 border border-cyan-900/50 p-4 rounded-xl">{statusMsg}</div>}

            <div className="space-y-6">
              <button 
                onClick={handleResetLeaderboard}
                className="w-full bg-[#030B12] border border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white py-5 rounded-lg text-sm font-bold tracking-widest uppercase transition-all"
              >
                1. RESET EVENT TO PHASE 1 & WIPE LEADERBOARD
              </button>

              <button 
                onClick={handleInitiateRound2}
                disabled={systemState.phase === 'PHASE_2'}
                className="w-full bg-red-600/10 border border-red-600 text-red-500 hover:bg-red-600/20 py-6 rounded-xl text-sm font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(220,38,38,0.1)] hover:shadow-[0_0_30px_rgba(220,38,38,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {systemState.phase === 'PHASE_2' ? '>>> PHASE 2 ALREADY ACTIVE <<<' : '2. INITIATE PHASE 2 (ALL TEAMS + RESET POINTS)'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'deploy' && (
          <div className="animate-in fade-in duration-300 bg-[#061019] border border-slate-800/60 p-6 rounded-xl">
            <h2 className="text-sm font-bold tracking-widest text-slate-300 uppercase mb-4 border-b border-slate-800/60 pb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Deploy New Mission Node
            </h2>
            
            <div className="flex gap-2 mb-6 p-1 bg-[#030B12] rounded-lg border border-slate-800/60">
              <button onClick={() => setDeployType('phase1')} className={`flex-1 py-2.5 text-[10px] uppercase font-bold tracking-widest rounded-md transition-colors ${deployType === 'phase1' ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>Phase 1 (Physical)</button>
              <button onClick={() => setDeployType('phase2')} className={`flex-1 py-2.5 text-[10px] uppercase font-bold tracking-widest rounded-md transition-colors ${deployType === 'phase2' ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>Phase 2 (Digital)</button>
            </div>

            {statusMsg && <div className="mb-6 text-[11px] font-mono text-cyan-400 bg-cyan-950/30 border border-cyan-900/50 p-4 rounded-xl">{statusMsg}</div>}

            <form onSubmit={handleDeploy} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full bg-[#030B12] border border-slate-700/50 rounded-lg p-4 text-slate-200 text-sm outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono placeholder:text-slate-600" />
                
                {deployType === 'phase2' && (
                   <input type="text" placeholder="Category (e.g. OSINT, CRYPTO)" value={category} onChange={(e) => setCategory(e.target.value)} required className="w-full bg-[#030B12] border border-slate-700/50 rounded-lg p-4 text-slate-200 text-sm outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono placeholder:text-slate-600" />
                )}
              </div>
              
              {deployType === 'phase1' ? (
                <>
                  <textarea placeholder="Challenge Description (revealed after clue answer)" value={description} onChange={(e) => setDescription(e.target.value)} required className="w-full bg-[#030B12] border border-slate-700/50 rounded-lg p-4 text-slate-200 text-sm outline-none h-24 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono placeholder:text-slate-600" />
                  <textarea placeholder="Location Clue (what agents see first, e.g. 'Where the books sleep...')" value={locationClue} onChange={(e) => setLocationClue(e.target.value)} required className="w-full bg-[#030B12] border border-slate-700/50 rounded-lg p-4 text-slate-200 text-sm outline-none h-24 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono placeholder:text-slate-600" />
                  <input type="text" placeholder="Clue Answer (correct answer to the location clue above)" value={clueAnswer} onChange={(e) => setClueAnswer(e.target.value)} required className="w-full bg-[#030B12] border border-amber-900/50 rounded-lg p-4 text-slate-200 text-sm outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono placeholder:text-slate-600" />
                  <input type="text" placeholder="Access Code (physical code found at the location)" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} required className="w-full bg-[#030B12] border border-slate-700/50 rounded-lg p-4 text-slate-200 text-sm outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono placeholder:text-slate-600" />
                  <input type="text" placeholder="Final Answer (submitted after entering access code)" value={finalAnswer} onChange={(e) => setFinalAnswer(e.target.value)} required className="w-full bg-[#030B12] border border-slate-700/50 rounded-lg p-4 text-slate-200 text-sm outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono placeholder:text-slate-600" />
                  <div className="bg-[#030B12] border border-slate-800 rounded-lg p-5 space-y-4">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Hint (Optional)</p>
                    <div className="flex flex-col md:flex-row gap-4">
                      <input type="text" placeholder="Hint text (leave blank for no hint)" value={hint1} onChange={(e) => setHint1(e.target.value)} className="flex-1 bg-[#061019] border border-slate-700/50 rounded-lg p-3 text-slate-200 text-sm outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono placeholder:text-slate-600" />
                      <input type="number" placeholder="Penalty pts" value={hintPenalty1} onChange={(e) => setHintPenalty1(e.target.value)} className="w-full md:w-32 bg-[#061019] border border-amber-900/50 rounded-lg p-3 text-slate-200 text-sm outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono placeholder:text-slate-600" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <textarea placeholder="Challenge Description" value={description} onChange={(e) => setDescription(e.target.value)} required className="w-full bg-[#030B12] border border-slate-700/50 rounded-lg p-4 text-slate-200 text-sm outline-none h-24 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono placeholder:text-slate-600" />
                  <input type="text" placeholder="Flag (mystic{...})" value={flag} onChange={(e) => setFlag(e.target.value)} required className="w-full bg-[#030B12] border border-slate-700/50 rounded-lg p-4 text-slate-200 text-sm outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono placeholder:text-slate-600" />
                  <div className="w-full bg-[#030B12] border border-slate-700/50 rounded-lg p-5">
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-3 font-bold">Attach Intel File (Optional, max 2MB for demo)</label>
                    <input type="file" onChange={handleFileUpload} className="text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-5 file:rounded-lg file:border-0 file:text-[10px] file:uppercase file:tracking-widest file:font-bold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20 file:transition-colors file:cursor-pointer font-mono" />
                    {fileName && <p className="text-[10px] text-cyan-500 mt-3 font-mono border border-cyan-900/50 bg-cyan-950/30 inline-block px-3 py-1 rounded">Attached: {fileName}</p>}
                  </div>
                  <div className="bg-[#030B12] border border-slate-800 rounded-lg p-5 space-y-4">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Hint (Optional)</p>
                    <div className="flex flex-col md:flex-row gap-4">
                      <input type="text" placeholder="Hint text (leave blank for no hint)" value={hint2} onChange={(e) => setHint2(e.target.value)} className="flex-1 bg-[#061019] border border-slate-700/50 rounded-lg p-3 text-slate-200 text-sm outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono placeholder:text-slate-600" />
                      <input type="number" placeholder="Penalty pts" value={hintPenalty2} onChange={(e) => setHintPenalty2(e.target.value)} className="w-full md:w-32 bg-[#061019] border border-amber-900/50 rounded-lg p-3 text-slate-200 text-sm outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono placeholder:text-slate-600" />
                    </div>
                  </div>
                </>
              )}

              <input type="number" placeholder="Points (e.g. 100)" value={points} onChange={(e) => setPoints(e.target.value)} required className="w-full bg-[#030B12] border border-cyan-900/50 rounded-lg p-4 text-cyan-400 text-xl font-bold outline-none focus:border-cyan-500 transition-all font-mono placeholder:text-slate-600" />

              <button type="submit" className="w-full mt-6 bg-cyan-600 hover:bg-cyan-500 text-white py-4 rounded-lg text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                DEPLOY MISSION NODE
              </button>
            </form>
          </div>
        )}

        {activeTab === 'teams' && (
          <div className="animate-in fade-in duration-300 bg-[#061019] border border-slate-800/60 p-6 rounded-xl">
            <h2 className="text-sm font-bold tracking-widest text-slate-300 uppercase mb-6 border-b border-slate-800/60 pb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              Manage Squadrons
            </h2>
            
            <div className="bg-[#030B12] border border-slate-800/60 p-5 rounded-lg mb-8 shadow-inner">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 font-mono flex items-center gap-2"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg> Register New Team</h3>
              <div className="flex flex-col md:flex-row gap-4">
                <input type="text" placeholder="Team Name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="flex-1 bg-[#061019] border border-slate-700/50 rounded-lg p-3.5 text-slate-200 text-sm outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono" />
                <input type="text" placeholder="Team Password" value={newTeamPass} onChange={e => setNewTeamPass(e.target.value)} className="flex-1 bg-[#061019] border border-slate-700/50 rounded-lg p-3.5 text-slate-200 text-sm outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono" />
                <button onClick={async () => {
                  if(!newTeamName || !newTeamPass) return;
                  await supabase.from('teams').insert({ name: newTeamName, password: newTeamPass });
                  setNewTeamName(''); setNewTeamPass('');
                  fetchNodes();
                }} className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 uppercase text-xs font-bold tracking-widest rounded-lg transition-colors shadow-[0_0_10px_rgba(6,182,212,0.2)] py-3 md:py-0">
                  Register
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {teamsList.map(team => (
                <div key={team.id} className="border border-slate-800/60 bg-[#030B12] hover:bg-[#061019] p-5 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors group">
                  <div>
                    <h3 className="font-bold text-white text-lg tracking-wide">{team.name}</h3>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono border border-slate-800 bg-[#030B12] px-2 py-0.5 rounded">Pass: <span className="text-slate-300">{team.password}</span></p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono border border-slate-800 bg-[#030B12] px-2 py-0.5 rounded">Access: {team.is_finalist ? <span className="text-cyan-400 font-bold">PHASE 2</span> : <span className="text-slate-400">PHASE 1</span>}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={async () => { await supabase.from('teams').update({ is_finalist: !team.is_finalist }).eq('id', team.id); fetchNodes() }} className="flex-1 md:flex-none text-[10px] font-bold uppercase border border-cyan-900/50 bg-cyan-950/20 px-4 py-2.5 rounded-lg text-cyan-400 hover:bg-cyan-900/40 transition-colors font-mono">
                      Toggle Access
                    </button>
                    <button onClick={async () => { if(window.confirm('Delete this team?')) { await supabase.from('teams').delete().eq('id', team.id); fetchNodes() } }} className="flex-1 md:flex-none text-[10px] font-bold uppercase border border-red-900/30 bg-red-950/10 px-4 py-2.5 rounded-lg text-red-500 hover:bg-red-900/20 transition-colors font-mono">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {teamsList.length === 0 && <p className="text-xs text-slate-500 uppercase font-mono text-center py-8 border border-slate-800/50 rounded-lg border-dashed">No teams registered yet.</p>}
            </div>
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="animate-in fade-in duration-300 grid grid-cols-1 gap-8">
            <div className="bg-[#061019] border border-slate-800/60 p-6 rounded-xl">
              <h3 className="text-xs font-bold text-slate-300 uppercase mb-4 tracking-widest border-b border-slate-800/60 pb-3 flex items-center justify-between">
                <span className="flex items-center gap-2"><svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> Active Field Ops</span>
                <span className="bg-slate-800/50 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono">{stages.length} Nodes</span>
              </h3>
              <div className="space-y-3">
                {stages.map(s => (
                  <div key={s.id} className={`border p-5 rounded-lg flex flex-col md:flex-row justify-between md:items-center gap-4 transition-colors ${s.is_active !== false ? 'bg-[#030B12] border-slate-700/50 hover:border-cyan-500/30' : 'bg-[#020508] border-red-900/30 opacity-70'}`}>
                    <div className="flex-1">
                      <p className="text-sm text-white font-bold uppercase tracking-widest flex items-center gap-3">
                        {s.title}
                        {s.is_active === false ? <span className="text-[9px] bg-red-950/50 text-red-500 px-2 py-0.5 rounded font-mono border border-red-900/50">LOCKED</span> : <span className="text-[9px] bg-cyan-950/30 text-cyan-400 px-2 py-0.5 rounded font-mono border border-cyan-900/50">ACTIVE</span>}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">{s.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="text-[9px] font-mono border border-slate-800 bg-[#061019] px-2 py-1 rounded text-slate-300"><span className="text-slate-500">CLUE:</span> {s.location_clue}</span>
                        <span className="text-[9px] font-mono border border-amber-900/30 bg-amber-950/10 px-2 py-1 rounded text-amber-200/80"><span className="text-amber-500/50">ANS:</span> {s.clue_answer}</span>
                        <span className="text-[9px] font-mono border border-slate-800 bg-[#061019] px-2 py-1 rounded text-slate-300"><span className="text-slate-500">CODE:</span> {s.access_code}</span>
                        <span className="text-[9px] font-mono border border-slate-800 bg-[#061019] px-2 py-1 rounded text-slate-300"><span className="text-slate-500">FINAL:</span> {s.final_answer}</span>
                        <span className="text-[9px] font-mono border border-cyan-900/30 bg-cyan-950/10 px-2 py-1 rounded text-cyan-400 font-bold">{s.points} PTS</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleToggleLock(s.id, 'stage', s.is_active !== false)} className={`text-[10px] border px-4 py-2 rounded-lg uppercase tracking-widest transition-colors font-bold font-mono ${s.is_active !== false ? 'border-amber-900/50 text-amber-500 hover:bg-amber-950/20' : 'border-cyan-900/50 text-cyan-500 hover:bg-cyan-950/20'}`}>
                        {s.is_active !== false ? 'Lock' : 'Activate'}
                      </button>
                      <button onClick={() => handleDelete(s.id, 'stage')} className="text-[10px] border border-red-900/30 hover:bg-red-950/20 text-red-500 px-4 py-2 rounded-lg uppercase tracking-widest transition-colors font-bold font-mono">Delete</button>
                    </div>
                  </div>
                ))}
                {stages.length === 0 && <p className="text-xs text-slate-500 uppercase font-mono text-center py-6 border border-slate-800/50 rounded-lg border-dashed">No stages deployed.</p>}
              </div>
            </div>

            <div className="bg-[#061019] border border-slate-800/60 p-6 rounded-xl">
              <h3 className="text-xs font-bold text-slate-300 uppercase mb-4 tracking-widest border-b border-slate-800/60 pb-3 flex items-center justify-between">
                <span className="flex items-center gap-2"><svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> Active Breaches</span>
                <span className="bg-slate-800/50 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono">{challenges.length} Nodes</span>
              </h3>
              <div className="space-y-3">
                {challenges.map(c => (
                  <div key={c.id} className={`border p-5 rounded-lg flex flex-col md:flex-row justify-between md:items-center gap-4 transition-colors ${c.is_active !== false ? 'bg-[#030B12] border-slate-700/50 hover:border-cyan-500/30' : 'bg-[#020508] border-red-900/30 opacity-70'}`}>
                    <div className="flex-1">
                      <p className="text-sm text-white font-bold uppercase tracking-widest flex items-center gap-3">
                        <span className="text-cyan-500 text-[10px] font-mono border border-cyan-900/50 bg-cyan-950/20 px-2 py-0.5 rounded">[{c.category}]</span>
                        {c.title}
                        {c.is_active === false ? <span className="text-[9px] bg-red-950/50 text-red-500 px-2 py-0.5 rounded font-mono border border-red-900/50">LOCKED</span> : <span className="text-[9px] bg-cyan-950/30 text-cyan-400 px-2 py-0.5 rounded font-mono border border-cyan-900/50">ACTIVE</span>}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">{c.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2 items-center">
                        <span className="text-[9px] font-mono border border-slate-800 bg-[#061019] px-2 py-1 rounded text-slate-300"><span className="text-slate-500">FLAG:</span> {c.flag}</span>
                        <span className="text-[9px] font-mono border border-cyan-900/30 bg-cyan-950/10 px-2 py-1 rounded text-cyan-400 font-bold">{c.points} PTS</span>
                        {c.file_name && <span className="text-[9px] font-mono border border-indigo-900/50 bg-indigo-950/20 px-2 py-1 rounded text-indigo-300 flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg> {c.file_name}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => handleToggleLock(c.id, 'challenge', c.is_active !== false)} className={`text-[10px] border px-4 py-2 rounded-lg uppercase tracking-widest transition-colors font-bold font-mono ${c.is_active !== false ? 'border-amber-900/50 text-amber-500 hover:bg-amber-950/20' : 'border-cyan-900/50 text-cyan-500 hover:bg-cyan-950/20'}`}>
                        {c.is_active !== false ? 'Lock' : 'Activate'}
                      </button>
                      <button onClick={() => handleDelete(c.id, 'challenge')} className="text-[10px] border border-red-900/30 hover:bg-red-950/20 text-red-500 px-4 py-2 rounded-lg uppercase tracking-widest transition-colors font-bold font-mono">Delete</button>
                    </div>
                  </div>
                ))}
                {challenges.length === 0 && <p className="text-xs text-slate-500 uppercase font-mono text-center py-6 border border-slate-800/50 rounded-lg border-dashed">No challenges deployed.</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="animate-in fade-in duration-300 bg-[#061019] border border-slate-800/60 p-6 rounded-xl">
            {lbLoading ? (
              <div className="text-cyan-500 tracking-widest uppercase text-center py-20 font-mono flex flex-col items-center gap-4">
                <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                SYNCING LEADERBOARD...
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-slate-800/60 text-[10px] tracking-widest text-slate-500 uppercase font-bold font-mono">
                  <div className="col-span-2 text-center">Rank</div>
                  <div className="col-span-5">Team Name</div>
                  <div className="col-span-2 text-center">Status</div>
                  <div className="col-span-3 text-right">Score</div>
                </div>

                {leaderboard.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-500 uppercase tracking-widest border border-slate-800/60 rounded-lg bg-[#030B12] font-mono">
                    No active teams found in registry.
                  </div>
                ) : (
                  leaderboard.map((team) => (
                    <div 
                      key={team.id} 
                      className={`grid grid-cols-12 gap-4 px-4 py-4 rounded-lg items-center transition-all ${
                        team.rank === 1 ? 'bg-gradient-to-r from-amber-500/10 to-[#030B12] border border-amber-500/30' : 
                        team.rank <= 3 ? 'bg-[#030B12] border border-slate-700/50' : 
                        'bg-[#061019] border border-slate-800/60 hover:border-slate-700/50'
                      }`}
                    >
                      <div className={`col-span-2 text-center font-bold text-lg font-mono ${
                        team.rank === 1 ? 'text-amber-400' : 
                        team.rank <= 3 ? 'text-slate-300' : 
                        'text-slate-500'
                      }`}>
                        #{team.rank}
                      </div>
                      <div className="col-span-5 font-bold text-white tracking-wide text-sm flex items-center gap-2">
                        {team.team_name} 
                        <span className="text-[10px] text-slate-500 font-normal uppercase tracking-widest border border-slate-800 bg-[#030B12] px-1.5 py-0.5 rounded font-mono hidden sm:inline-block">{team.members} agents</span>
                      </div>
                      <div className="col-span-2 text-center">
                        {team.is_finalist ? (
                          <span className="text-[9px] px-2 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded font-mono font-bold tracking-widest">
                            PH2
                          </span>
                        ) : (
                          <span className="text-[9px] px-2 py-0.5 bg-[#030B12] text-slate-500 border border-slate-700/50 rounded font-mono tracking-widest">
                            PH1
                          </span>
                        )}
                      </div>
                      <div className={`col-span-3 text-right font-bold text-lg tracking-widest font-mono ${team.rank === 1 ? 'text-amber-400' : 'text-cyan-400'}`}>
                        {team.total_points}
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
