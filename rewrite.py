import re

with open('app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state variables
state_vars = """  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null)
"""
content = content.replace('const [loading, setLoading] = useState(true)', 'const [loading, setLoading] = useState(true)\n' + state_vars)

# 2. Remove Admin panel link
admin_target = """          <div className="mt-6 text-center">
            <a href="/admin" className="text-[10px] text-zinc-600 hover:text-zinc-400 tracking-widest uppercase transition-colors mr-4">Admin Panel</a>
            <a href="/scoreboard" className="text-[10px] text-zinc-600 hover:text-zinc-400 tracking-widest uppercase transition-colors">View Scoreboard</a>
          </div>"""
admin_replacement = """          <div className="mt-6 text-center">
            <a href="/scoreboard" className="text-[10px] text-zinc-600 hover:text-zinc-400 tracking-widest uppercase transition-colors">View Scoreboard</a>
          </div>"""
content = content.replace(admin_target, admin_replacement)

# 3. Extract Phase 1 loop replacement
phase1_target = """            <div className="space-y-4">
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
            </div>"""

phase1_replacement = """            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {round1Stages.map(stage => {
                const isSecured = DemoDB.getStageProgress().some(p => p.profile_id === profile?.id && p.stage_id === stage.id)
                return (
                  <div key={stage.id} onClick={() => setSelectedStageId(stage.id)} className="cursor-pointer border border-zinc-900 bg-[#0a0a0a] hover:border-zinc-700 hover:bg-[#111] p-5 rounded-lg relative overflow-hidden flex flex-col items-center justify-center text-center h-32 transition-colors">
                    {isSecured && <div className="absolute inset-0 bg-green-950/20 pointer-events-none border border-green-500/30"></div>}
                    <h3 className="font-bold text-white uppercase text-sm mb-2 relative z-10">{stage.title}</h3>
                    <span className="text-xs font-bold text-green-500 relative z-10">{stage.points} PTS {isSecured && '[SECURED]'}</span>
                  </div>
                )
              })}
              {round1Stages.length === 0 && <p className="text-xs text-zinc-600 uppercase col-span-full">{systemState.phase === 'PHASE_2' ? 'Phase 1 Archived.' : 'No field stages deployed yet.'}</p>}
            </div>"""

content = content.replace(phase1_target, phase1_replacement)

# 4. Extract Phase 2 loop replacement
phase2_target = """              <div className="space-y-4">
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
              </div>"""

phase2_replacement = """              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {round2Challenges.map(chal => {
                  const isSecured = DemoDB.getStageProgress().some(p => p.profile_id === profile?.id && p.challenge_id === chal.id)
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
              </div>"""

content = content.replace(phase2_target, phase2_replacement)

# 5. Inject Modals
modal_target = """        </div>
      </div>
    </div>
  )
}
"""

modal_replacement = """        </div>
      </div>

      {/* MODALS */}
      {selectedStageId && (() => {
        const stage = round1Stages.find(s => s.id === selectedStageId)
        if (!stage) return null
        const isClueUnlocked = clueUnlocked[stage.id]
        const isSecured = DemoDB.getStageProgress().some(p => p.profile_id === profile?.id && p.stage_id === stage.id)
        
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-[#1a1525] border border-purple-900/50 w-full max-w-2xl rounded-xl shadow-[0_0_50px_rgba(107,33,168,0.2)] overflow-hidden flex flex-col max-h-[90vh]">
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
                <div className="text-center mb-8">
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
                  <input
                    type="text"
                    placeholder="Final Answer..."
                    value={answers[stage.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [stage.id]: e.target.value })}
                    disabled={isSecured}
                    className="flex-1 bg-[#1a1525] border border-purple-900/50 rounded px-4 py-3 text-white outline-none focus:border-purple-500 disabled:opacity-50 transition-colors"
                  />
                  <button
                    onClick={() => { handleSubmitPhase1(stage.id, stage.final_answer, stage.points); setSelectedStageId(null); }}
                    disabled={isSecured}
                    className="bg-[#3a2f50] hover:bg-[#4a3f60] text-purple-100 px-8 rounded disabled:opacity-50 transition-colors font-medium"
                  >
                    Submit
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {selectedChallengeId && (() => {
        const chal = round2Challenges.find(c => c.id === selectedChallengeId)
        if (!chal) return null
        const isSecured = DemoDB.getStageProgress().some(p => p.profile_id === profile?.id && p.challenge_id === chal.id)
        
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-[#211a2f] border border-[#3e3450] w-full max-w-2xl rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
              {/* Top Bar */}
              <div className="bg-[#211a2f] px-4 py-3 flex justify-between items-center border-b border-[#3e3450]">
                <div className="flex gap-2">
                  <span className="bg-[#3e3450] text-[#dedede] text-xs px-3 py-1.5 rounded">Challenge</span>
                  <span className="bg-transparent text-[#9a8ba8] text-xs px-3 py-1.5 rounded">{chal.category || 'GENERAL'}</span>
                </div>
                <button onClick={() => setSelectedChallengeId(null)} className="text-zinc-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="p-8 overflow-y-auto">
                <div className="text-center mb-6">
                  <h2 className="text-[28px] font-normal text-white mb-1 tracking-wide">{chal.title}</h2>
                  <p className="text-[24px] text-white/90">{chal.points}</p>
                </div>
                
                <div className="mb-8">
                  <p className="text-[#cccccc] whitespace-pre-wrap text-[15px]">{chal.description}</p>
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
              <div className="p-4 flex gap-4 mt-auto mb-2 mx-4">
                <input
                  type="text"
                  placeholder="Flag"
                  value={flags[chal.id] || ''}
                  onChange={(e) => setFlags({ ...flags, [chal.id]: e.target.value })}
                  disabled={isSecured}
                  className="flex-1 bg-[#dcdcdc] rounded px-4 py-2 text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 transition-colors placeholder:text-zinc-500"
                />
                <button
                  onClick={() => { handleSubmitPhase2(chal.id, chal.flag, chal.points); setSelectedChallengeId(null); }}
                  disabled={isSecured}
                  className="bg-transparent border border-[#dcdcdc] hover:bg-white/10 text-white px-8 py-2 rounded disabled:opacity-50 transition-colors text-sm"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
"""

content = content.replace(modal_target, modal_replacement)

with open('app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Replacement Complete")
