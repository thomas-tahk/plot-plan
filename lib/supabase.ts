import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type PlotRow = {
  id: string
  session_id: string
  created_at: string
  crop: string
  region: string
  plot_width: number
  plot_length: number
  irrigation: string
  plan: unknown
  nickname: string | null
}
