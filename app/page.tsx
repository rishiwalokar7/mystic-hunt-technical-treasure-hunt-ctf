'use client'

import { useState, useEffect } from 'react'
import { DemoDB } from '@/lib/demo-db'

export default function AgentDashboard() {
  const [agentCallsign, setAgentCallsign] = useState('')
  const [loginInput, setLoginInput] = useState('')
  const [profile, setProfile] = useState<any>(null)
  const [totalScore, setTotalScore] = useState(0)
  const [round1Stages, setRound1Stages] = useState<any[]>([])
  const [round2Challenges, setRound2Challenges] = useState<any[]>([])
  const [systemState, setSystemState] = useState<{ phase: 'PHASE_1' | 'PHASE_2', resetStrategy: 'CUMULATIVE' | 'HARD_RESET' }>({ phase: 'PHASE_1', resetStrategy: 'CUMULATIVE' })
  const [loading, setLoading] = useState(true)

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
    DemoDB.useHint(isChallenge ? { profile_id: profile.id, challenge_id: id } : { profile_id: profile.id, stage_id: id })
    DemoDB.addStageProgress({ profile_id: profile.id, ...(isChallenge ? { challenge_id: id } : { stage_id: id }), points_awarded: -penalty })
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
    const prof = profiles.find(p => p.callsign === agentCallsign)
    const state = DemoDB.getSystemState()
    setSystemState(state)

    if (prof) {
      setProfile(prof)
      const progress = DemoDB.getStageProgress().filter(p => p.profile_id === prof.id)
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
    const currentProgress = DemoDB.getStageProgress().find(p => p.profile_id === profile.id && p.stage_id === stageId)
    if (currentProgress) {
      setFeedback('Checkpoint Already Secured.')
      return
    }

    if (answers[stageId]?.trim().toLowerCase() === correctFinalAnswer.trim().toLowerCase()) {
      DemoDB.addStageProgress({ profile_id: profile.id, stage_id: stageId, points_awarded: points })
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
    const currentProgress = DemoDB.getStageProgress().find(p => p.profile_id === profile.id && p.challenge_id === challengeId)
    if (currentProgress) {
      setFeedback('System Already Breached.')
      return
    }

    if (flags[challengeId]?.trim() === correctFlag.trim()) {
      DemoDB.addStageProgress({ profile_id: profile.id, challenge_id: challengeId, points_awarded: points })
      setFeedback('Breach Successful. Points Awarded.')
      fetchArenaData()
    } else {
      setFeedback('Invalid Flag.')
    }
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginInput.trim()) return
    const callsign = loginInput.trim().toUpperCase().replace(/ /g, '_')
    
    const profiles = DemoDB.getProfiles()
    let prof = profiles.find(p => p.callsign === callsign)
    
    if (!prof) {
      prof = DemoDB.addProfile(callsign)
    }
    
    setAgentCallsign(callsign)
    setLoading(true)
  }

  if (loading) return <div className="min-h-screen bg-black text-green-400 font-mono p-10 uppercase tracking-widest">{'>'} Initializing Mainframe...</div>

  if (!agentCallsign) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono p-6 flex items-center justify-center">
        <div className="max-w-md w-full border border-green-500/30 bg-[#0a0a0a] p-8 rounded-lg shadow-[0_0_20px_rgba(34,197,94,0.1)]">
          <h1 className="text-2xl font-bold tracking-widest text-center mb-2 uppercase">Agent Login</h1>
          <p className="text-xs text-center text-zinc-500 mb-8 uppercase tracking-widest">Connect to Event Mainframe</p>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-[10px] text-green-500 uppercase tracking-widest block mb-2">Agent Callsign</label>
              <input 
                type="text" 
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="e.g. CYBER_NINJA"
                className="w-full bg-[#111111] border border-green-900 rounded p-3 text-white outline-none focus:border-green-500 uppercase transition-colors"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">Access Password (Demo)</label>
              <input 
                type="password" 
                placeholder="••••••••"
                className="w-full bg-[#111111] border border-zinc-900 rounded p-3 text-zinc-500 outline-none cursor-not-allowed"
                disabled
              />
              <p className="text-[10px] text-zinc-600 mt-2">Password validation disabled for offline demo.</p>
            </div>
            
            <button 
              type="submit"
              className="w-full bg-green-950/40 border border-green-600/50 hover:bg-green-900/60 text-green-400 py-4 rounded text-sm font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:shadow-[0_0_25px_rgba(34,197,94,0.3)]"
            >
              Initialize Uplink
            </button>
          </form>
          <div className="mt-6 text-center">
            <a href="/scoreboard" className="text-[10px] text-zinc-600 hover:text-zinc-400 tracking-widest uppercase transition-colors">View Scoreboard</a>
            <span className="text-zinc-800 mx-3">|</span>
            <a href="/admin" className="text-[10px] text-zinc-800 hover:text-zinc-700 tracking-widest uppercase transition-colors">Admin</a>
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
            <h1 className="text-2xl font-bold tracking-widest text-white uppercase">{agentCallsign} (OFFLINE DEMO)</h1>
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
            <div className="space-y-4">
              {round1Stages.map(stage => {
                const isClueUnlocked = clueUnlocked[stage.id]
                const isCodeUnlocked = unlockedCodes[stage.id]
                const isSecured = DemoDB.getStageProgress().some(p => p.profile_id === profile?.id && p.stage_id === stage.id)

                return (
                  <div key={stage.id} className="border border-zinc-900 bg-[#0a0a0a] p-5 rounded-lg relative overflow-hidden">
                    {isSecured && <div className="absolute inset-0 bg-green-950/20 pointer-events-none border border-green-500/30"></div>}
                    
                    <div className="flex justify-between items-start mb-3 relative z-10">
                      <h3 className="font-bold text-white uppercase text-sm">
                        {stage.title} {isSecured && <span className="text-green-500 text-xs ml-2">[SECURED]</span>}
                      </h3>
                      <span className="text-xs font-bold text-green-500">{stage.points} PTS</span>
                    </div>

                    {/* STEP 1: Location Clue */}
                    <div className="mb-4 relative z-10">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Location Clue</p>
                      <p className="text-xs text-zinc-300 bg-zinc-900/50 border border-zinc-800 rounded p-3">{stage.location_clue}</p>
                    </div>

                    {/* Hint Button for Phase 1 */}
                    {stage.hint && !isSecured && (() => {
                      const hintUsed = DemoDB.hasUsedHint(profile?.id || '', stage.id)
                      return (
                        <div className="mb-3 relative z-10">
                          {hintUsed ? (
                            <div className="bg-orange-950/20 border border-orange-900/40 rounded p-3">
                              <p className="text-[10px] text-orange-500 uppercase tracking-widest mb-1">Hint Used</p>
                              <p className="text-xs text-zinc-300">{stage.hint}</p>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleUseHint(stage.id, stage.hint_penalty || 25)}
                              className="text-[10px] border border-orange-700/40 text-orange-500 hover:bg-orange-950/30 px-3 py-1.5 rounded uppercase tracking-widest transition-colors"
                            >
                              💡 Get Hint (-{stage.hint_penalty || 25} pts)
                            </button>
                          )}
                        </div>
                      )
                    })()}

                    {/* STEP 1 INPUT: Submit clue answer to unlock */}
                    {!isClueUnlocked && !isSecured && (
                      <div className="relative z-10">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Step 1: Enter your answer to the clue above</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Your clue answer..."
                            value={clueAnswers[stage.id] || ''}
                            onChange={(e) => setClueAnswers({ ...clueAnswers, [stage.id]: e.target.value })}
                            className="flex-1 bg-[#111111] border border-zinc-800 rounded p-2 text-xs text-white outline-none focus:border-yellow-500 transition-colors"
                          />
                          <button
                            onClick={() => handleUnlockClue(stage.id, stage.clue_answer)}
                            className="border border-yellow-600/50 text-yellow-400 hover:bg-yellow-900/20 px-4 text-xs uppercase tracking-widest rounded transition-colors"
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: Access Code reveal + Description + Final Answer */}
                    {(isClueUnlocked || isSecured) && (
                      <div className="space-y-3 relative z-10">

                        {/* Access Code Display */}
                        {stage.access_code && (
                          <div className="border border-yellow-500/40 bg-yellow-950/20 rounded p-4 text-center">
                            <p className="text-[10px] text-yellow-500 uppercase tracking-widest mb-2">Your Access Code</p>
                            <p className="text-2xl font-bold text-yellow-400 tracking-[0.3em]">{stage.access_code}</p>
                          </div>
                        )}

                        {/* Challenge Description */}
                        {stage.description && (
                          <div className="bg-green-950/10 border border-green-900/30 rounded p-3">
                            <p className="text-[10px] text-green-500 uppercase tracking-widest mb-1">Challenge Brief</p>
                            <p className="text-xs text-zinc-300">{stage.description}</p>
                          </div>
                        )}

                        {/* Final Answer */}
                        <div className="bg-green-950/10 border border-green-900/30 p-3 rounded">
                          <p className="text-[10px] text-green-400 uppercase tracking-widest mb-2">Submit Final Answer</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Final Answer..."
                              value={answers[stage.id] || ''}
                              onChange={(e) => setAnswers({ ...answers, [stage.id]: e.target.value })}
                              disabled={isSecured}
                              className="flex-1 bg-[#111111] border border-zinc-800 rounded p-2 text-xs text-white outline-none focus:border-green-500 disabled:opacity-50 transition-colors"
                            />
                            <button
                              onClick={() => handleSubmitPhase1(stage.id, stage.final_answer, stage.points)}
                              disabled={isSecured}
                              className="bg-green-900/30 border border-green-500 text-green-400 px-4 text-xs uppercase tracking-widest rounded hover:bg-green-900/50 disabled:opacity-50 transition-colors"
                            >
                              Submit
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {round1Stages.length === 0 && <p className="text-xs text-zinc-600 uppercase">{systemState.phase === 'PHASE_2' ? 'Phase 1 Archived.' : 'No field stages deployed yet.'}</p>}
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
              <div className="space-y-4">
                {round2Challenges.map(chal => {
                  const isSecured = DemoDB.getStageProgress().some(p => p.profile_id === profile?.id && p.challenge_id === chal.id)
                  
                  return (
                    <div key={chal.id} className="border border-zinc-900 bg-[#0a0a0a] p-5 rounded-lg relative overflow-hidden">
                      {isSecured && <div className="absolute inset-0 bg-green-950/20 pointer-events-none border border-green-500/30"></div>}
                      
                      <div className="flex justify-between items-start mb-2 relative z-10">
                        <div>
                          <span className="text-[10px] font-bold text-green-500 mr-2">[{chal.category || 'GENERAL'}]</span>
                          <h3 className="font-bold text-white uppercase text-sm inline">{chal.title} {isSecured && <span className="text-green-500 text-xs ml-2">[SECURED]</span>}</h3>
                        </div>
                        <span className="text-xs font-bold text-green-500">{chal.points} PTS</span>
                      </div>
                      <p className="text-xs text-zinc-400 mb-4 relative z-10">{chal.description}</p>

                      {/* Hint Button for Phase 2 */}
                      {chal.hint && !isSecured && (() => {
                        const hintUsed = DemoDB.hasUsedHint(profile?.id || '', undefined, chal.id)
                        return (
                          <div className="mb-4 relative z-10">
                            {hintUsed ? (
                              <div className="bg-orange-950/20 border border-orange-900/40 rounded p-3">
                                <p className="text-[10px] text-orange-500 uppercase tracking-widest mb-1">Hint Used</p>
                                <p className="text-xs text-zinc-300">{chal.hint}</p>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleUseHint(chal.id, chal.hint_penalty || 25, true)}
                                className="text-[10px] border border-orange-700/40 text-orange-500 hover:bg-orange-950/30 px-3 py-1.5 rounded uppercase tracking-widest transition-colors"
                              >
                                💡 Get Hint (-{chal.hint_penalty || 25} pts)
                              </button>
                            )}
                          </div>
                        )
                      })()}
                      
                      {chal.file_url && (
                        <div className="mb-4 relative z-10">
                          <a 
                            href={chal.file_url} 
                            download={chal.file_name || 'intel_file'} 
                            className="inline-block text-[10px] border border-green-500/50 hover:bg-green-900/30 text-green-400 px-3 py-1.5 rounded uppercase tracking-widest transition-colors"
                          >
                            ↓ Download Attached Intel
                          </a>
                        </div>
                      )}

                      <div className="flex gap-2 relative z-10">
                        <input 
                          type="text" 
                          placeholder="mystic{...}" 
                          value={flags[chal.id] || ''} 
                          onChange={(e) => setFlags({ ...flags, [chal.id]: e.target.value })} 
                          disabled={isSecured}
                          className="flex-1 bg-[#111111] border border-zinc-800 rounded p-2 text-xs text-white outline-none focus:border-green-500 disabled:opacity-50" 
                        />
                        <button 
                          onClick={() => handleSubmitPhase2(chal.id, chal.flag, chal.points)}
                          disabled={isSecured}
                          className="border border-green-600/50 bg-green-900/20 text-green-400 px-4 text-xs uppercase tracking-widest rounded hover:bg-green-900/50 disabled:opacity-50"
                        >
                          Submit Flag
                        </button>
                      </div>
                    </div>
                  )
                })}
                {round2Challenges.length === 0 && <p className="text-xs text-zinc-600 uppercase">No digital breaches deployed yet.</p>}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
