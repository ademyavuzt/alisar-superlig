import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://olkrthuvhrxxlqscybfe.supabase.co/rest/v1/";
const supabaseKey = "olkrthuvhrxxlqscybfe";

export const supabase = createClient(supabaseUrl, supabaseKey);