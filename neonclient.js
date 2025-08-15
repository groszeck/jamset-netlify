const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Database connection URL is not defined in NEON_DATABASE_URL or DATABASE_URL");
}

let pool = null;

function initClient() {
  if (!pool) {
    pool = createPool({ connectionString });
  }
  return pool;
}

async function query(sql, params = []) {
  const client = initClient();
  return client.query(sql, params);
}

async function migrate() {
  const client = initClient();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      run_on TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const migrationsDir = path.resolve(process.cwd(), "migrations");
  let files;
  try {
    files = await fs.readdir(migrationsDir);
  } catch (err) {
    if (err.code === "ENOENT") {
      return;
    }
    throw err;
  }

  files = files.filter(f => f.endsWith(".sql")).sort();
  const { rows } = await client.query("SELECT version FROM schema_migrations;");
  const applied = new Set(rows.map(r => r.version));

  for (const file of files) {
    if (applied.has(file)) continue;

    const filePath = path.join(migrationsDir, file);
    const sql = await fs.readFile(filePath, "utf8");

    await client.query("BEGIN;");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(version) VALUES($1);", [file]);
      await client.query("COMMIT;");
    } catch (err) {
      await client.query("ROLLBACK;");
      throw new Error(`Migration failed for ${file}: ${err.message}`);
    }
  }
}

async function closeClient() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export { initClient, query, migrate, closeClient };