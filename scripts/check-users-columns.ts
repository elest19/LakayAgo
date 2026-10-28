import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envFiles = ['.env.local', '.env']
for (const file of envFiles) {
  const fullPath = path.resolve(process.cwd(), file)
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const [key, ...rest] = trimmed.split('=')
      const value = rest.join('=').trim()
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local and add the Supabase connection string.')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const client = await pool.connect()

  try {
    const meta = await client.query(`
      SELECT current_database() AS current_database, current_schema() AS current_schema;
    `)

    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'users'
      ORDER BY ordinal_position;
    `)

    console.log('Database metadata:')
    console.log(JSON.stringify(meta.rows[0], null, 2))
    console.log('\nUsers table columns:')
    console.log(JSON.stringify(columns.rows, null, 2))
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Failed to inspect users table', error)
  process.exit(1)
})
