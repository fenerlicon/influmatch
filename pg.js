const { Client } = require('pg');

async function push() {
    const client = new Client({
        connectionString: 'postgres://postgres.aiftdpagcnwqzzemtkwt:vY4eQO5U3h%40j6uG@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'
    });

    try {
        await client.connect();
        const res = await client.query(`SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'advert_projects' AND conname = 'advert_projects_status_check';`);
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
push();
