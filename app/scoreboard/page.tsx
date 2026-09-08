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
    <div className="min-h-screen bg-black text-green-400 font-mono p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-widest text-green-400 mb-1">
              {'>'} {'>'} GLOBAL LEADERBOARD (OFFLINE DEMO)
            </h1>
            <p className="text-xs text-zinc-500 uppercase tracking-widest">
              Live Agent Rankings & Analytics
            </p>
          </div>
          <div className="flex gap-4">
            <a href="/" className="border border-zinc-800 hover:border-zinc-600 px-4 py-2 text-xs tracking-widest uppercase rounded transition-colors text-zinc-400">
              ← Back to Arena
            </a>
          </div>
        </div>

        {loading ? (
          <div className="text-zinc-600 tracking-widest uppercase text-center py-20">
            {'>'} SYNCING WITH MAINFRAME...
          </div>
        ) : (
          <div className="space-y-3">
            {/* Table Headers */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-zinc-800 text-xs tracking-widest text-zinc-500 uppercase font-bold">
              <div className="col-span-2 text-center">Rank</div>
              <div className="col-span-5">Team Name</div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-3 text-right">Total Score</div>
            </div>

            {/* Leaderboard Rows */}
            {leaderboard.length === 0 ? (
              <div className="text-center py-10 text-zinc-600 uppercase tracking-widest border border-zinc-900 rounded bg-zinc-950/40">
                No active teams found in registry.
              </div>
            ) : (
              leaderboard.map((team) => (
                <div 
                  key={team.id} 
                  className={`grid grid-cols-12 gap-4 px-6 py-4 rounded-lg items-center transition-all ${
                    team.rank === 1 ? 'bg-green-950/40 border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 
                    team.rank <= 3 ? 'bg-zinc-900/50 border border-zinc-700' : 
                    'bg-zinc-950 border border-zinc-900'
                  }`}
                >
                  <div className={`col-span-2 text-center font-bold text-xl ${team.rank === 1 ? 'text-green-400' : 'text-zinc-400'}`}>
                    #{team.rank}
                  </div>
                  <div className="col-span-5 font-bold text-white tracking-wide text-lg">
                    {team.team_name} <span className="text-xs text-zinc-500 ml-2 font-normal uppercase tracking-widest">({team.members} agents)</span>
                  </div>
                  <div className="col-span-2 text-center">
                    {team.is_finalist ? (
                      <span className="text-[10px] px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/50 rounded uppercase tracking-wider">
                        Phase 2
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-1 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded uppercase tracking-wider">
                        Phase 1
                      </span>
                    )}
                  </div>
                  <div className="col-span-3 text-right font-bold text-green-400 text-xl tracking-widest">
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
