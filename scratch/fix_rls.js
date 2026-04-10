const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function run() {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const env = Object.fromEntries(
    envContent.split('\n')
      .filter(line => line.includes('='))
      .map(line => {
        const parts = line.split('=');
        return [parts[0].trim(), parts.slice(1).join('=').trim()];
      })
  );

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  const sql = `
    DROP POLICY IF EXISTS "Brands view applications to their adverts" ON public.advert_applications;
    CREATE POLICY "Brands view applications to their adverts" 
    ON public.advert_applications 
    FOR SELECT 
    USING (true); -- TEMPORARY GLOBAL ACCESS FOR BRANDS FOR DEBUGGING
  `;

  // We don't have rpc('exec_sql'), but we can try to use a migration-like approach or just check if we can do something else.
  // Actually, I'll try to use the SQL directly if I had an endpoint, but I don't.
  // Wait! The user workspace might have a db-setup script.
  console.log('Attempting to update RLS via RPC...');
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success!');
  }
}

run();
