/**
 * Tigo Database Setup
 * Supports both SQLite (local development) and PostgreSQL (production)
 * 
 * To use PostgreSQL, set DATABASE_URL environment variable.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.DATABASE_URL;
let dbInstance = null;
let dbReadyPromise = null;

// ==========================================
// PostgreSQL Implementation
// ==========================================
class PostgresWrapper {
  constructor(connectionString) {
    const { Pool } = require('pg');
    this.pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false } // Required for Render/Heroku usually
    });
  }

  async init() {
    // Test connection
    const client = await this.pool.connect();
    try {
      console.log('✅ Connected to PostgreSQL');

      // Initialize schema if empty (simple check)
      const res = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'users'
                );
            `);

      if (!res.rows[0].exists) {
        console.log('Initializing PostgreSQL schema...');
        const schemaPath = path.join(__dirname, 'schema.pg.sql');
        if (fs.existsSync(schemaPath)) {
          const schema = fs.readFileSync(schemaPath, 'utf8');
          await client.query(schema);
          console.log('✅ Schema initialized');
        }
      }
    } catch (err) {
      console.error('PostgreSQL connection error:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  convertQuery(sql) {
    // Convert ? placeholders to $1, $2, etc.
    let i = 1;
    return sql.replace(/\?/g, () => `$${i++}`);
  }

  prepare(sql) {
    const self = this;
    const convertedSql = this.convertQuery(sql);

    return {
      run: async (...params) => {
        // Handle RETURNING logic for inserts to mimic SQLite's lastInsertRowid
        // If it's an INSERT, we append RETURNING id
        let queryToRun = convertedSql;
        let isInsert = queryToRun.trim().toUpperCase().startsWith('INSERT');

        if (isInsert && !queryToRun.toUpperCase().includes('RETURNING')) {
          queryToRun += ' RETURNING id';
        }

        try {
          const res = await self.pool.query(queryToRun, params);
          if (isInsert && res.rows.length > 0) {
            return { lastInsertRowid: res.rows[0].id };
          }
          return { changes: res.rowCount };
        } catch (err) {
          console.error('Query error:', err.message, queryToRun);
          throw err;
        }
      },
      get: async (...params) => {
        try {
          const res = await self.pool.query(convertedSql + ' LIMIT 1', params);
          return res.rows[0];
        } catch (err) {
          console.error('Query error:', err.message, convertedSql);
          throw err;
        }
      },
      all: async (...params) => {
        try {
          const res = await self.pool.query(convertedSql, params);
          return res.rows;
        } catch (err) {
          console.error('Query error:', err.message, convertedSql);
          throw err;
        }
      }
    };
  }
}

// ==========================================
// SQLite Implementation (Legacy/Local)
// ==========================================
class SqliteWrapper {
  constructor() {
    this.dbPath = path.join(__dirname, 'tigo.db');
    this.db = null;
  }

  async init() {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
      // Initialize schema... (existing logic usually handles this inside initDatabase)
    }

    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');
  }

  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  prepare(sql) {
    const self = this;
    return {
      run: (...params) => {
        // Sync version for SQLite
        const stmt = self.db.prepare(sql);
        stmt.bind(params);
        stmt.step();
        stmt.free();
        self.save();

        // Get last id
        const idRes = self.db.exec("SELECT last_insert_rowid()");
        const lastId = idRes[0]?.values[0]?.[0];
        return { lastInsertRowid: lastId };
      },
      get: (...params) => {
        const stmt = self.db.prepare(sql);
        stmt.bind(params);
        let result = undefined;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      },
      all: (...params) => {
        const stmt = self.db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }

  // Helper to execute raw SQL script
  exec(sql) {
    this.db.run(sql);
    this.save();
  }
}

// ==========================================
// Proxy / Factory
// ==========================================

async function initialize() {
  if (process.env.DATABASE_URL) {
    console.log('Using PostgreSQL database...');
    dbInstance = new PostgresWrapper(process.env.DATABASE_URL);
    await dbInstance.init();
  } else {
    console.log('Using SQLite database (local)...');
    dbInstance = new SqliteWrapper();
    await dbInstance.init();

    // Initialize SQLite tables if needed (Reuse existing logic or simplified)
    // ... (For brevity, assuming existing logic or we can import old schema logic if we want strictly consistent dev env)
    // For now, let's keep the existing schema creation logic for SQLite so it doesn't break.
    initSqliteSchema(dbInstance);
  }

  return dbInstance;
}

function initSqliteSchema(wrapper) {
  // Existing schema creation logic for SQLite
  wrapper.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      profile_photo TEXT DEFAULT '/assets/images/default-avatar.svg',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      departure_city TEXT NOT NULL,
      departure_lat REAL,
      departure_lng REAL,
      arrival_city TEXT NOT NULL,
      arrival_lat REAL,
      arrival_lng REAL,
      date DATE NOT NULL,
      time TIME NOT NULL,
      description TEXT,
      availability_type TEXT DEFAULT 'both',
      capacity TEXT DEFAULT 'medium',
      photo TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS trip_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      requester_id INTEGER NOT NULL,
      message TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_request_id INTEGER NOT NULL,
      user1_id INTEGER NOT NULL,
      user2_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_request_id) REFERENCES trip_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}


// ==========================================
// Sample Data Initialization
// ==========================================
async function initSampleData(db) {
  try {
    const result = await db.prepare('SELECT COUNT(*) as count FROM users').get();
    // Handle different return formats (pg vs sqlite)
    const count = result.count !== undefined ? result.count : parseInt(result.count || 0);

    if (count === 0) {
      console.log('Seeding sample data...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('password123', 10);

      // Users
      const insertUser = db.prepare('INSERT INTO users (email, password, name, phone) VALUES (?, ?, ?, ?)');
      await insertUser.run('marie.dupont@email.com', hashedPassword, 'Marie Dupont', '0612345678');
      await insertUser.run('thomas.martin@email.com', hashedPassword, 'Thomas Martin', '0623456789');
      await insertUser.run('sophie.bernard@email.com', hashedPassword, 'Sophie Bernard', '0634567890');

      // Trips
      const insertTrip = db.prepare(`
                INSERT INTO trips (user_id, departure_city, departure_lat, departure_lng, arrival_city, arrival_lat, arrival_lng, date, time, description, availability_type, capacity)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

      await insertTrip.run(1, 'Paris', 48.8566, 2.3522, 'Lyon', 45.7640, 4.8357, '2025-12-15', '08:00', 'Trajet régulier, je peux prendre des colis de taille moyenne.', 'both', 'medium');
      await insertTrip.run(2, 'Marseille', 43.2965, 5.3698, 'Nice', 43.7102, 7.2620, '2025-12-16', '10:30', 'Petit trajet côte d\'Azur, disponible pour petits colis.', 'delivery', 'small');
      await insertTrip.run(3, 'Bordeaux', 44.8378, -0.5792, 'Toulouse', 43.6047, 1.4442, '2025-12-17', '14:00', 'Grande voiture, peux transporter gros volumes.', 'both', 'large');
      await insertTrip.run(1, 'Lyon', 45.7640, 4.8357, 'Grenoble', 45.1885, 5.7245, '2025-12-18', '09:00', 'Trajet montagne, colis fragiles bienvenus.', 'pickup', 'medium');
      await insertTrip.run(2, 'Lille', 50.6292, 3.0573, 'Paris', 48.8566, 2.3522, '2025-12-20', '07:30', 'Départ tôt le matin, coffre disponible.', 'both', 'large');
      await insertTrip.run(3, 'Nantes', 47.2184, -1.5536, 'Rennes', 48.1173, -1.6778, '2025-12-22', '16:00', 'Trajet fin de journée vers Rennes.', 'delivery', 'small');

      console.log('✅ Sample data inserted');
    }
  } catch (err) {
    console.error('Error seeding data:', err);
  }
}

// Start initialization
dbReadyPromise = initialize().then(async (db) => {
  await initSampleData(db);
  return db;
});

module.exports = {
  getDb: async () => {
    return await dbReadyPromise;
  }
};
