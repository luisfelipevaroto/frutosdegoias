import { createClient } from "@supabase/supabase-js";

// As duas variáveis abaixo vêm do painel do Supabase em
// Project Settings → API, e devem ser cadastradas no .env.local
// (localmente) e em Environment Variables (na Vercel).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
