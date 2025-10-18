import Database from 'better-sqlite3';

export class DatabaseManager {
  private dbPath: string;
  private db: Database.Database | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.open();
    this.initSchema();
  }

  private open() {
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  private initSchema() {
    if (!this.db) return;
    const db = this.db;

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        name TEXT,
        role TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS officials (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT,
        phone TEXT,
        license_number TEXT,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS competitions (
        id INTEGER PRIMARY KEY,
        name TEXT,
        date TEXT,
        location TEXT,
        type TEXT,
        status TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS competition_officials (
        id INTEGER PRIMARY KEY,
        competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE,
        official_id INTEGER REFERENCES officials(id) ON DELETE CASCADE,
        role TEXT,
        hours REAL,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY,
        official_id INTEGER REFERENCES officials(id) ON DELETE SET NULL,
        competition_id INTEGER REFERENCES competitions(id) ON DELETE SET NULL,
        amount REAL,
        date TEXT,
        method TEXT,
        status TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // seed default admin if none exists
    const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
    if (userCount.c === 0) {
      db.prepare(
        'INSERT INTO users (username, password, name, role) VALUES (@username, @password, @name, @role)'
      ).run({ username: 'admin', password: 'admin123', name: 'Administrator', role: 'admin' });
    }

    // seed one official for demo
    const offCount = db.prepare('SELECT COUNT(*) as c FROM officials').get() as { c: number };
    if (offCount.c === 0) {
      db.prepare(
        'INSERT INTO officials (name, email, phone, license_number, active) VALUES (@name, @email, @phone, @license, 1)'
      ).run({ name: 'Janez Novak', email: 'janez@example.com', phone: '+38640111222', license: 'LIC-001' });
      db.prepare(
        'INSERT INTO officials (name, email, phone, license_number, active) VALUES (@name, @email, @phone, @license, 1)'
      ).run({ name: 'Marija Kovač', email: 'marija@example.com', phone: '+38640333444', license: 'LIC-002' });
    }

    // seed default roles
    const roles = this.getSetting('official_roles');
    if (!roles) {
      this.setSetting('official_roles', [
        { id: 1, name: 'Glavni sodnik', hourlyRate: 25 },
        { id: 2, name: 'Pomožni sodnik', hourlyRate: 18 },
        { id: 3, name: 'Časomerilec', hourlyRate: 15 }
      ]);
    }

    // seed demo competitions
    const compCount = db.prepare('SELECT COUNT(*) as c FROM competitions').get() as { c: number };
    if (compCount.c === 0) {
      db.prepare(
        'INSERT INTO competitions (name, date, location, type, status, notes) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('Državno prvenstvo 2024', '2024-06-15', 'Ljubljana', 'outdoor', 'completed', 'Poletno državno prvenstvo');
      db.prepare(
        'INSERT INTO competitions (name, date, location, type, status, notes) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('Zimski cross 2025', '2025-01-20', 'Maribor', 'cross_country', 'planned', '');
    }

    // seed demo payments
    const payCount = db.prepare('SELECT COUNT(*) as c FROM payments').get() as { c: number };
    if (payCount.c === 0) {
      db.prepare(
        'INSERT INTO payments (official_id, competition_id, amount, date, method, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(1, 1, 200.00, '2024-06-15', 'bank_transfer', 'paid', 'Plačilo za 8 ur');
      db.prepare(
        'INSERT INTO payments (official_id, competition_id, amount, date, method, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(2, 1, 144.00, '2024-06-15', 'cash', 'owed', 'Plačilo za 8 ur');
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Simple helpers
  getUserByUsername(username: string): { id: number; username: string; password: string; name: string; role: string } | undefined {
    if (!this.db) return undefined;
    const row = this.db
      .prepare('SELECT id, username, password, name, role FROM users WHERE username = ?')
      .get(username) as any;
    return row ?? undefined;
  }

  getUserById(id: number): { id: number; username: string; password: string; name: string; role: string } | undefined {
    if (!this.db) return undefined;
    const row = this.db
      .prepare('SELECT id, username, password, name, role FROM users WHERE id = ?')
      .get(id) as any;
    return row ?? undefined;
  }

  listOfficials(): Array<{ id: number; name: string; email: string; phone: string; license_number: string; active: number }> {
    if (!this.db) return [];
    return this.db.prepare('SELECT id, name, email, phone, license_number, active FROM officials ORDER BY name').all() as any[];
  }

  getSetting<T = unknown>(key: string): T | undefined {
    if (!this.db) return undefined;
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
    if (!row) return undefined;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return undefined;
    }
  }

  setSetting(key: string, value: unknown): void {
    if (!this.db) return;
    const json = JSON.stringify(value);
    this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, json);
  }

  addOfficial(data: { name: string; email: string; phone: string; license_number: string; active?: number }): number {
    if (!this.db) return -1;
    const stmt = this.db.prepare('INSERT INTO officials (name, email, phone, license_number, active) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(data.name, data.email, data.phone, data.license_number, data.active ?? 1);
    return info.lastInsertRowid as number;
  }

  updateOfficial(id: number, data: { name: string; email: string; phone: string; license_number: string; active: number }): boolean {
    if (!this.db) return false;
    const stmt = this.db.prepare('UPDATE officials SET name=?, email=?, phone=?, license_number=?, active=? WHERE id=?');
    const info = stmt.run(data.name, data.email, data.phone, data.license_number, data.active, id);
    return info.changes > 0;
  }

  deleteOfficial(id: number): boolean {
    if (!this.db) return false;
    const stmt = this.db.prepare('DELETE FROM officials WHERE id=?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  setOfficialActive(id: number, active: number): boolean {
    if (!this.db) return false;
    const stmt = this.db.prepare('UPDATE officials SET active=? WHERE id=?');
    const info = stmt.run(active, id);
    return info.changes > 0;
  }

  listCompetitions(): Array<{ id: number; name: string; date: string; location: string; type: string; status: string }> {
    if (!this.db) return [];
    return this.db.prepare('SELECT id, name, date, location, type, status FROM competitions ORDER BY date DESC').all() as any[];
  }

  addCompetition(data: { name: string; date: string; location: string; type: string; status: string; notes?: string }): number {
    if (!this.db) return -1;
    const stmt = this.db.prepare('INSERT INTO competitions (name, date, location, type, status, notes) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(data.name, data.date, data.location, data.type, data.status, data.notes ?? '');
    return info.lastInsertRowid as number;
  }

  updateCompetition(id: number, data: { name: string; date: string; location: string; type: string; status: string; notes: string }): boolean {
    if (!this.db) return false;
    const stmt = this.db.prepare('UPDATE competitions SET name=?, date=?, location=?, type=?, status=?, notes=? WHERE id=?');
    const info = stmt.run(data.name, data.date, data.location, data.type, data.status, data.notes, id);
    return info.changes > 0;
  }

  deleteCompetition(id: number): boolean {
    if (!this.db) return false;
    const stmt = this.db.prepare('DELETE FROM competitions WHERE id=?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  // Payments
  listPayments(filters?: { officialId?: number; competitionId?: number; status?: string; dateFrom?: string; dateTo?: string }): Array<any> {
    if (!this.db) return [];
    let query = 'SELECT p.*, o.name as official_name, c.name as competition_name FROM payments p LEFT JOIN officials o ON p.official_id=o.id LEFT JOIN competitions c ON p.competition_id=c.id WHERE 1=1';
    const params: any[] = [];
    if (filters?.officialId) {
      query += ' AND p.official_id=?';
      params.push(filters.officialId);
    }
    if (filters?.competitionId) {
      query += ' AND p.competition_id=?';
      params.push(filters.competitionId);
    }
    if (filters?.status) {
      query += ' AND p.status=?';
      params.push(filters.status);
    }
    if (filters?.dateFrom) {
      query += ' AND p.date>=?';
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      query += ' AND p.date<=?';
      params.push(filters.dateTo);
    }
    query += ' ORDER BY p.date DESC, p.id DESC';
    return this.db.prepare(query).all(...params) as any[];
  }

  addPayment(data: { official_id: number; competition_id: number; amount: number; date: string; method: string; status: string; notes?: string }): number {
    if (!this.db) return -1;
    const stmt = this.db.prepare('INSERT INTO payments (official_id, competition_id, amount, date, method, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(data.official_id, data.competition_id, data.amount, data.date, data.method, data.status, data.notes ?? '');
    return info.lastInsertRowid as number;
  }

  updatePayment(id: number, data: { official_id: number; competition_id: number; amount: number; date: string; method: string; status: string; notes: string }): boolean {
    if (!this.db) return false;
    const stmt = this.db.prepare('UPDATE payments SET official_id=?, competition_id=?, amount=?, date=?, method=?, status=?, notes=? WHERE id=?');
    const info = stmt.run(data.official_id, data.competition_id, data.amount, data.date, data.method, data.status, data.notes, id);
    return info.changes > 0;
  }

  deletePayment(id: number): boolean {
    if (!this.db) return false;
    const stmt = this.db.prepare('DELETE FROM payments WHERE id=?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  markPaymentAsPaid(id: number): boolean {
    if (!this.db) return false;
    const stmt = this.db.prepare('UPDATE payments SET status=? WHERE id=?');
    const info = stmt.run('paid', id);
    return info.changes > 0;
  }

  // Users CRUD
  listUsers(): Array<{ id: number; username: string; name: string; role: string; created_at: string }> {
    if (!this.db) return [];
    return this.db.prepare('SELECT id, username, name, role, created_at FROM users ORDER BY username').all() as any[];
  }

  addUser(data: { username: string; password: string; name: string; role: string }): number {
    if (!this.db) return -1;
    const stmt = this.db.prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)');
    const info = stmt.run(data.username, data.password, data.name, data.role);
    return info.lastInsertRowid as number;
  }

  updateUser(id: number, data: { username: string; name: string; role: string; password?: string }): boolean {
    if (!this.db) return false;
    if (data.password) {
      const stmt = this.db.prepare('UPDATE users SET username=?, name=?, role=?, password=? WHERE id=?');
      const info = stmt.run(data.username, data.name, data.role, data.password, id);
      return info.changes > 0;
    } else {
      const stmt = this.db.prepare('UPDATE users SET username=?, name=?, role=? WHERE id=?');
      const info = stmt.run(data.username, data.name, data.role, id);
      return info.changes > 0;
    }
  }

  deleteUser(id: number): boolean {
    if (!this.db) return false;
    const stmt = this.db.prepare('DELETE FROM users WHERE id=?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  // Dashboard stats
  getDashboardStats(): any {
    if (!this.db) return {};
    const totalOfficials = this.db.prepare('SELECT COUNT(*) as count FROM officials').get() as any;
    const activeCompetitions = this.db.prepare("SELECT COUNT(*) as count FROM competitions WHERE status='planned' OR status='completed'").get() as any;
    const totalPayments = this.db.prepare('SELECT SUM(amount) as total FROM payments').get() as any;
    const owedPayments = this.db.prepare("SELECT SUM(amount) as total FROM payments WHERE status='owed'").get() as any;
    const paidPayments = this.db.prepare("SELECT SUM(amount) as total FROM payments WHERE status='paid'").get() as any;
    return {
      totalOfficials: totalOfficials?.count ?? 0,
      activeCompetitions: activeCompetitions?.count ?? 0,
      totalPayments: totalPayments?.total ?? 0,
      owedPayments: owedPayments?.total ?? 0,
      paidPayments: paidPayments?.total ?? 0
    };
  }

  // Role management helpers
  checkRoleUsage(roleName: string): Array<{ competition_id: number; competition_name: string; official_id: number; official_name: string }> {
    if (!this.db) return [];
    return this.db.prepare(`
      SELECT 
        co.competition_id, 
        c.name as competition_name,
        co.official_id,
        o.name as official_name
      FROM competition_officials co
      LEFT JOIN competitions c ON co.competition_id = c.id
      LEFT JOIN officials o ON co.official_id = o.id
      WHERE co.role = ?
    `).all(roleName) as any[];
  }

  deleteRoleReferences(roleName: string): number {
    if (!this.db) return 0;
    const stmt = this.db.prepare('DELETE FROM competition_officials WHERE role = ?');
    const info = stmt.run(roleName);
    return info.changes;
  }
}
