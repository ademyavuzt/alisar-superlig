import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://olkrthuvhrxxlqscybfe.supabase.co/rest/v1/";
const supabaseKey = "sb_publishable_56BG_SOHFYGYtwHFYOEGlA_c09bEUQZ";

export const supabase = createClient(supabaseUrl, supabaseKey);