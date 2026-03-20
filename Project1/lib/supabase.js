import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  "https://enupmlxmajjwskvzgcdq.supabase.co",
  "sb_publishable_BPrl6ILbtEkewitdA5LVWQ_LqqRsWaw"
)

export default supabase