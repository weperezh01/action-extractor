import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const ENV_FILE = path.join(ROOT_DIR, '.env.local')
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'db', 'migrations')

function loadEnvFile(filePath) {
  return readFile(filePath, 'utf8')
    .then((contents) => {
      for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue

        const eqIndex = line.indexOf('=')
        if (eqIndex === -1) continue

        const key = line.slice(0, eqIndex).trim()
        if (!key || process.env[key] !== undefined) continue

        let value = line.slice(eqIndex + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        process.env[key] = value
      }
    })
    .catch((error) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return
      throw error
    })
}

function getDbConfig() {
  if (process.env.ACTION_EXTRACTOR_DATABASE_URL) {
    return {
      connectionString: process.env.ACTION_EXTRACTOR_DATABASE_URL,
      statement_timeout: 60_000,
    }
  }

  return {
    host: process.env.ACTION_EXTRACTOR_DB_HOST ?? 'postgres-db',
    port: Number(process.env.ACTION_EXTRACTOR_DB_PORT ?? 5432),
    database: process.env.ACTION_EXTRACTOR_DB_NAME ?? 'action_extractor_db',
    user: process.env.ACTION_EXTRACTOR_DB_USER ?? 'action_extractor_user',
    password: process.env.ACTION_EXTRACTOR_DB_PASSWORD ?? '',
    statement_timeout: 60_000,
  }
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function getAppliedVersions(client) {
  const { rows } = await client.query('SELECT version FROM schema_migrations')
  return new Set(rows.map((row) => String(row.version)))
}

async function listMigrationFiles() {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

async function applyMigration(client, version) {
  const sqlPath = path.join(MIGRATIONS_DIR, version)
  const sql = await readFile(sqlPath, 'utf8')
  if (!sql.trim()) {
    throw new Error(`Migration ${version} is empty`)
  }

  await client.query('BEGIN')
  try {
    await client.query(sql)
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
      [version]
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

async function main() {
  await loadEnvFile(ENV_FILE)

  const migrationFiles = await listMigrationFiles()
  if (migrationFiles.length === 0) {
    throw new Error(`No SQL migrations found in ${MIGRATIONS_DIR}`)
  }

  const client = new Client(getDbConfig())
  await client.connect()

  try {
    await ensureMigrationsTable(client)
    const appliedVersions = await getAppliedVersions(client)

    let appliedCount = 0
    for (const version of migrationFiles) {
      if (appliedVersions.has(version)) {
        console.log(`skip ${version}`)
        continue
      }

      console.log(`apply ${version}`)
      await applyMigration(client, version)
      appliedCount += 1
    }

    if (appliedCount === 0) {
      console.log('Database schema is up to date.')
    } else {
      console.log(`Applied ${appliedCount} migration(s).`)
    }
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[db:migrate] ${message}`)
  process.exitCode = 1
})
