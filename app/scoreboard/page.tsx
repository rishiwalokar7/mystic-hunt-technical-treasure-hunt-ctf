'use client'

import { useState, useEffect } from 'react'
import { DemoDB } from '@/lib/demo-db'

type LeaderboardEntry = {
  id: string
  team_name: string
  is_finalist: boolean
  total_points: number
  rank: number
  members: number
}

export default function LiveScoreboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeaderboard = () => {
      const teams = DemoDB.getTeams()
      const profiles = DemoDB.getProfiles()
      const progress = DemoDB.getStageProgress()
      const state = DemoDB.getSystemState()

      const rankedTeams = teams.map((team) => {
        const teamProgress = progress.filter(p => p.team_id === team.id)
        const teamMembers = profiles.filter(p => p.team_id === team.id).length
        
        let totalPoints = 0
        if (state.phase === 'PHASE_2' && state.resetStrategy === 'HARD_RESET') {
          totalPoints = teamProgress.filter(p => p.challenge_id).reduce((sum, p) => sum + p.points_awarded, 0)
        } else {
          totalPoints = teamProgress.reduce((sum, p) => sum + p.points_awarded, 0)
        }
        
        return { ...team, team_name: team.name, members: teamMembers, total_points: totalPoints, rank: 0 }
      })
      .sort((a, b) => b.total_points - a.total_points) // Sort highest to lowest
      .map((team, index) => ({ ...team, rank: index + 1 })) // Assign rankings

      setLeaderboard(rankedTeams)
      setLoading(false)
    }

    fetchLeaderboard()
    
    // Auto-refresh the board every 30 seconds
    const interval = setInterval(fetchLeaderboard, 30000) 
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen p-6 relative z-0">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-cyan-900/50 pb-6 mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center justify-center w-12 h-12 rounded-full border border-amber-600/30 bg-[#030B12] text-amber-500/80 shadow-[0_0_15px_rgba(217,119,6,0.1)]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <div>
              <p className="text-[10px] text-amber-500/70 uppercase tracking-widest font-mono flex items-center gap-2">
                MYSTIC HUNT <span className="text-slate-600">|</span> <span>LIVE ANALYTICS</span>
              </p>
              <h1 className="text-3xl font-bold tracking-wide text-white mb-1 uppercase">
                GLOBAL LEADERBOARD
              </h1>
            </div>
          </div>
          <div className="flex gap-4">
            <a href="/" className="border border-slate-700/50 hover:border-cyan-500 hover:bg-cyan-500/10 px-5 py-2.5 text-[10px] font-bold tracking-widest uppercase rounded-lg transition-all text-slate-300 hover:text-cyan-400 font-mono flex items-center gap-2">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back to Arena
            </a>
          </div>
        </div>

        {loading ? (
          <div className="text-cyan-500 tracking-widest uppercase text-center py-20 font-mono flex flex-col items-center gap-4">
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            SYNCING WITH MAINFRAME...
          </div>
        ) : (
          <div className="space-y-3">
            {/* Table Headers */}
            <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-800/60 text-[10px] tracking-widest text-slate-500 uppercase font-bold font-mono">
              <div className="col-span-2 text-center">Rank</div>
              <div className="col-span-5">Team Name</div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-3 text-right">Total Score</div>
            </div>

            {/* Leaderboard Rows */}
            {leaderboard.length === 0 ? (
              <div className="text-center py-12 text-slate-500 uppercase tracking-widest border border-slate-800/60 rounded-xl bg-[#030B12] font-mono text-xs">
                No active teams found in registry.
              </div>
            ) : (
              leaderboard.map((team) => (
                <div 
                  key={team.id} 
                  className={`grid grid-cols-12 gap-4 px-6 py-5 rounded-xl items-center transition-all ${
                    team.rank === 1 ? 'bg-gradient-to-r from-amber-500/10 to-[#030B12] border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.05)]' : 
                    team.rank === 2 ? 'bg-[#030B12] border border-slate-300/20' : 
                    team.rank === 3 ? 'bg-[#030B12] border border-orange-700/30' : 
                    'bg-[#061019] border border-slate-800/60'
                  }`}
                >
                  <div className={`col-span-2 text-center font-bold text-xl font-mono ${
                    team.rank === 1 ? 'text-amber-400' : 
                    team.rank === 2 ? 'text-slate-300' : 
                    team.rank === 3 ? 'text-orange-400' : 
                    'text-slate-500'
                  }`}>
                    #{team.rank}
                  </div>
                  <div className="col-span-5 font-bold text-white tracking-wide text-lg flex items-center gap-3">
                    {team.team_name} 
                    <span className="text-[10px] text-slate-500 font-mono tracking-widest border border-slate-700/50 bg-[#030B12] px-2 py-0.5 rounded">{team.members} AGENTS</span>
                  </div>
                  <div className="col-span-2 text-center">
                    {team.is_finalist ? (
                      <span className="text-[10px] px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded uppercase tracking-wider font-mono font-bold">
                        Phase 2
                      </span>
                    ) : (
                      <span className="text-[10px] px-2.5 py-1 bg-[#030B12] text-slate-400 border border-slate-700/50 rounded uppercase tracking-wider font-mono">
                        Phase 1
                      </span>
                    )}
                  </div>
                  <div className={`col-span-3 text-right font-bold text-xl tracking-widest font-mono ${team.rank === 1 ? 'text-amber-400' : 'text-cyan-400'}`}>
                    {team.total_points}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
