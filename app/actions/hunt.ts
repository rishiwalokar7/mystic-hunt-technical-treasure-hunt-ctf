'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function verifyPhysicalCheckpoint(callsign: string, stageId: string, finalAnswer: string) {
  try {
    const { data: profile } = await supabase.from('profiles').select('id').eq('callsign', callsign).single()
    if (!profile) return { success: false, error: 'Agent profile not found.' }

    const { data: existing } = await supabase.from('stage_progress').select('id').eq('profile_id', profile.id).eq('stage_id', stageId).maybeSingle()
    if (existing) return { success: false, error: 'Checkpoint already secured.' }

    const { data: stage } = await supabase.from('round1_stages').select('final_answer, points').eq('id', stageId).single()
    if (!stage || stage.final_answer.toLowerCase() !== finalAnswer.toLowerCase()) return { success: false, error: 'Invalid Answer.' }

    const { error: insertError } = await supabase.from('stage_progress').insert({ profile_id: profile.id, stage_id: stageId, points_awarded: stage.points })
    if (insertError) throw insertError

    return { success: true, message: 'Checkpoint Secured. Points Awarded.' }
  } catch (error: any) { return { success: false, error: error.message } }
}

export async function verifyDigitalFlag(callsign: string, challengeId: string, flag: string) {
  try {
    const { data: profile } = await supabase.from('profiles').select('id, is_finalist').eq('callsign', callsign).single()
    if (!profile) return { success: false, error: 'Agent profile not found.' }
    if (!profile.is_finalist) return { success: false, error: 'Phase 2 clearance required.' }

    const { data: existing } = await supabase.from('stage_progress').select('id').eq('profile_id', profile.id).eq('challenge_id', challengeId).maybeSingle()
    if (existing) return { success: false, error: 'System already breached.' }

    const { data: challenge } = await supabase.from('round2_challenges').select('flag, points').eq('id', challengeId).single()
    if (!challenge || challenge.flag !== flag) return { success: false, error: 'Invalid Flag.' }

    const { error: insertError } = await supabase.from('stage_progress').insert({ profile_id: profile.id, challenge_id: challengeId, points_awarded: challenge.points })
    if (insertError) throw insertError

    return { success: true, message: 'Breach Successful.' }
  } catch (error: any) { return { success: false, error: error.message } }
}
