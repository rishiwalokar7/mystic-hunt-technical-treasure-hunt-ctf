export type Team = { id: string, name: string, password: string, is_finalist: boolean, created_at: number }
export type Profile = { id: string, team_id: string, callsign: string, is_leader?: boolean }
export type StageProgress = { id: string, profile_id: string, team_id: string, stage_id?: string, challenge_id?: string, points_awarded: number }
export type Round1Stage = { id: string, title: string, description?: string, location_clue: string, clue_answer: string, access_code: string, final_answer: string, points: number, hint?: string, hint_penalty?: number, is_active: boolean, created_at: number }
export type Round2Challenge = { id: string, title: string, description: string, category: string, flag: string, points: number, hint?: string, hint_penalty?: number, is_active: boolean, created_at: number, file_url?: string, file_name?: string }
export type SystemState = { phase: 'PHASE_1' | 'PHASE_2', resetStrategy: 'CUMULATIVE' | 'HARD_RESET' }
export type HintUsage = { profile_id: string, stage_id?: string, challenge_id?: string }

const isBrowser = typeof window !== 'undefined'

const getLocal = <T>(key: string, fallback: T): T => {
  if (!isBrowser) return fallback
  const val = localStorage.getItem(key)
  return val ? JSON.parse(val) : fallback
}
const setLocal = (key: string, val: any) => {
  if (isBrowser) localStorage.setItem(key, JSON.stringify(val))
}

export const DemoDB = {
  getTeams: () => getLocal<Team[]>('teams', []),
  addTeam: (name: string, password: string) => {
    const teams = DemoDB.getTeams()
    const newTeam = { id: Math.random().toString(36).substring(7), name, password, is_finalist: false, created_at: Date.now() }
    setLocal('teams', [...teams, newTeam])
    return newTeam
  },
  deleteTeam: (id: string) => {
    setLocal('teams', DemoDB.getTeams().filter(t => t.id !== id))
  },
  updateTeamFinalistStatus: (id: string, isFinalist: boolean) => {
    const teams = DemoDB.getTeams()
    setLocal('teams', teams.map(t => t.id === id ? { ...t, is_finalist: isFinalist } : t))
  },

  getProfiles: () => getLocal<Profile[]>('profiles', []),
  addProfile: (callsign: string, teamId: string, isLeader: boolean = false) => {
    const profiles = DemoDB.getProfiles()
    const newProfile = { id: Math.random().toString(36).substring(7), team_id: teamId, callsign, is_leader: isLeader }
    setLocal('profiles', [...profiles, newProfile])
    return newProfile
  },
  removeProfile: (id: string) => {
    const profiles = DemoDB.getProfiles()
    setLocal('profiles', profiles.filter(p => p.id !== id))
  },
  
  getSystemState: () => getLocal<SystemState>('system_state', { phase: 'PHASE_1', resetStrategy: 'CUMULATIVE' }),
  setSystemState: (state: SystemState) => setLocal('system_state', state),

  archiveLeaderboard: (lb: any[]) => setLocal('leaderboard_archive', lb),
  getLeaderboardArchive: () => getLocal<any[]>('leaderboard_archive', []),

  getStageProgress: () => getLocal<StageProgress[]>('stage_progress', []),
  resetStageProgress: () => setLocal('stage_progress', []),

  getHintUsage: () => getLocal<HintUsage[]>('hint_usage', []),
  consumeHint: (usage: HintUsage) => {
    const existing = DemoDB.getHintUsage()
    setLocal('hint_usage', [...existing, usage])
  },
  hasUsedHint: (profileId: string, stageId?: string, challengeId?: string) => {
    return DemoDB.getHintUsage().some(h =>
      h.profile_id === profileId &&
      (stageId ? h.stage_id === stageId : h.challenge_id === challengeId)
    )
  },
  addStageProgress: (progress: Omit<StageProgress, 'id'>) => {
    const existing = DemoDB.getStageProgress()
    const newProgress = { ...progress, id: Math.random().toString(36).substring(7) }
    setLocal('stage_progress', [...existing, newProgress])
    return newProgress
  },
  
  getRound1Stages: () => getLocal<Round1Stage[]>('round1_stages', []),
  addRound1Stage: (stage: Omit<Round1Stage, 'id' | 'is_active' | 'created_at'>) => {
    const stages = DemoDB.getRound1Stages()
    const newStage = { ...stage, id: Math.random().toString(36).substring(7), is_active: true, created_at: Date.now() }
    setLocal('round1_stages', [newStage, ...stages])
  },
  deleteRound1Stage: (id: string) => {
    setLocal('round1_stages', DemoDB.getRound1Stages().filter(s => s.id !== id))
  },
  toggleRound1Stage: (id: string, isActive: boolean) => {
    setLocal('round1_stages', DemoDB.getRound1Stages().map(s => s.id === id ? { ...s, is_active: isActive } : s))
  },

  getRound2Challenges: () => getLocal<Round2Challenge[]>('round2_challenges', []),
  addRound2Challenge: (chal: Omit<Round2Challenge, 'id' | 'is_active' | 'created_at'>) => {
    const chals = DemoDB.getRound2Challenges()
    const newChal = { ...chal, id: Math.random().toString(36).substring(7), is_active: true, created_at: Date.now() }
    setLocal('round2_challenges', [newChal, ...chals])
  },
  deleteRound2Challenge: (id: string) => {
    setLocal('round2_challenges', DemoDB.getRound2Challenges().filter(c => c.id !== id))
  },
  toggleRound2Challenge: (id: string, isActive: boolean) => {
    setLocal('round2_challenges', DemoDB.getRound2Challenges().map(c => c.id === id ? { ...c, is_active: isActive } : c))
  }
}
