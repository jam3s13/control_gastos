/**
 * js/supabaseClient.js
 * Responsabilidad: Inicializar y exportar el cliente de Supabase
 */

const SUPABASE_URL = 'https://kjytkmuuyvwrcurzvsjq.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_HCaLtZlqKdWhSsHF1rOgXg_tnkyfDcV'; 

// Exportamos la constante para que otros archivos puedan usarla
export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);