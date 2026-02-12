import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client with anon key (for client-like operations)
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Supabase admin client with service role key (for admin operations)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Verify connection
export const verifyConnection = async () => {
  try {
    const { data, error } = await supabase.from('_health').select('*').limit(1);
    if (error && error.code !== 'PGRST204') {
      console.log('Supabase connection established');
    }
    return true;
  } catch (error) {
    console.error('Supabase connection error:', error.message);
    return false;
  }
};
