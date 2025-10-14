import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://frfqjhgemjcprndkoaei.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZnFqaGdlbWpjcHJuZGtvYWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTg3ODYsImV4cCI6MjA3NTQ5NDc4Nn0.GuvrJk8AsJJI4EibuHPtsxqGV0EUl4zsq3Vk4ASCB0c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);