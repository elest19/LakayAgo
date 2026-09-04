import pkg from 'pg'
const { Pool } = pkg

let pool: any = null
function getPool() {
  if (pool) return pool
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('Missing DATABASE_URL environment variable')
  pool = new Pool({ connectionString })
  return pool
}

export async function query(text: string, params?: any[]) {
  const p = getPool()
  return p.query(text, params)
}

export async function getClient() {
  const p = getPool()
  const client = await p.connect()
  return client
}

export default { query, getClient }
