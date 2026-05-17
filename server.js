const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'gume.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('DB Error:', err);
  else console.log('✅ Baza podataka povezana');
});

// Promisified db methods
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows || []);
  });
});

// Create tables
db.serialize(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS magacini (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naziv TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS prolazi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      magacin_id INTEGER NOT NULL,
      naziv TEXT NOT NULL,
      FOREIGN KEY (magacin_id) REFERENCES magacini(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS regali (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prolaz_id INTEGER NOT NULL,
      naziv TEXT NOT NULL,
      FOREIGN KEY (prolaz_id) REFERENCES prolazi(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS police (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      regal_id INTEGER NOT NULL,
      naziv TEXT NOT NULL UNIQUE,
      FOREIGN KEY (regal_id) REFERENCES regali(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS gume (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sifra TEXT NOT NULL UNIQUE,
      sezona TEXT NOT NULL,
      sirina TEXT NOT NULL,
      visina TEXT NOT NULL,
      promjer TEXT NOT NULL,
      napomena TEXT DEFAULT '',
      polica_id INTEGER,
      polica_kod TEXT,
      slike TEXT DEFAULT '[]',
      prodato INTEGER DEFAULT 0,
      cijena_prodaje TEXT,
      datum_prodaje TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (polica_id) REFERENCES police(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS counters (
      key TEXT PRIMARY KEY,
      value INTEGER DEFAULT 0
    );

    INSERT OR IGNORE INTO counters (key, value) VALUES ('gu', 9);
    INSERT OR IGNORE INTO counters (key, value) VALUES ('po', 9);
  `);
});

// Helper: next counter
async function nextCounter(key) {
  const row = await dbGet('SELECT value FROM counters WHERE key = ?', [key]);
  const next = (row?.value || 0) + 1;
  await dbRun('UPDATE counters SET value = ? WHERE key = ?', [next, key]);
  return next;
}

// Helper: get full magacin tree
async function getMagaciniTree() {
  const magacini = await dbAll('SELECT * FROM magacini ORDER BY id');
  const result = [];
  for (const m of magacini) {
    const prolazi = await dbAll('SELECT * FROM prolazi WHERE magacin_id = ? ORDER BY id', [m.id]);
    const prolazi_full = [];
    for (const pr of prolazi) {
      const regali = await dbAll('SELECT * FROM regali WHERE prolaz_id = ? ORDER BY id', [pr.id]);
      const regali_full = [];
      for (const r of regali) {
        const police = await dbAll('SELECT * FROM police WHERE regal_id = ? ORDER BY id', [r.id]);
        regali_full.push({ ...r, police });
      }
      prolazi_full.push({ ...pr, regali: regali_full });
    }
    result.push({ ...m, prolazi: prolazi_full });
  }
  return result;
}

// Helper: format guma
function formatGuma(g) {
  return {
    ...g,
    slike: JSON.parse(g.slike || '[]'),
    prodato: g.prodato === 1
  };
}

// ============ MAGACIN ROUTES ============

app.get('/api/magacini', async (req, res, next) => {
  try {
    const result = await getMagaciniTree();
    res.json(result);
  } catch(e) { next(e); }
});

app.post('/api/magacini', async (req, res, next) => {
  try {
    const { naziv } = req.body;
    if (!naziv?.trim()) return res.status(400).json({ error: 'Naziv je obavezan' });
    const result = await dbRun('INSERT INTO magacini (naziv) VALUES (?)', [naziv.trim()]);
    res.json({ id: result.lastID, naziv: naziv.trim(), prolazi: [] });
  } catch(e) { next(e); }
});

app.delete('/api/magacini/:id', async (req, res, next) => {
  try {
    await dbRun('DELETE FROM magacini WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { next(e); }
});

// ============ PROLAZ ROUTES ============

app.post('/api/prolazi', async (req, res, next) => {
  try {
    const { magacin_id } = req.body;
    const existing = await dbAll('SELECT naziv FROM prolazi WHERE magacin_id = ? ORDER BY id', [magacin_id]);
    const lastLetter = existing.length ? existing[existing.length - 1].naziv.slice(-1) : null;
    const nextLetter = lastLetter ? String.fromCharCode(lastLetter.charCodeAt(0) + 1) : 'A';
    const naziv = `Prolaz ${nextLetter}`;
    const result = await dbRun('INSERT INTO prolazi (magacin_id, naziv) VALUES (?, ?)', [magacin_id, naziv]);
    res.json({ id: result.lastID, magacin_id, naziv, regali: [] });
  } catch(e) { next(e); }
});

app.delete('/api/prolazi/:id', async (req, res, next) => {
  try {
    await dbRun('DELETE FROM prolazi WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { next(e); }
});

// ============ REGAL ROUTES ============

app.post('/api/regali', async (req, res, next) => {
  try {
    const { prolaz_id } = req.body;
    const existing = await dbAll('SELECT naziv FROM regali WHERE prolaz_id = ? ORDER BY id', [prolaz_id]);
    const nums = existing.map(r => parseInt(r.naziv.replace('R', '')) || 0);
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    const naziv = `R${next}`;
    const result = await dbRun('INSERT INTO regali (prolaz_id, naziv) VALUES (?, ?)', [prolaz_id, naziv]);
    res.json({ id: result.lastID, prolaz_id, naziv, police: [] });
  } catch(e) { next(e); }
});

app.delete('/api/regali/:id', async (req, res, next) => {
  try {
    await dbRun('DELETE FROM regali WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { next(e); }
});

// ============ POLICA ROUTES ============

app.get('/api/police', async (req, res, next) => {
  try {
    const police = await dbAll(`
      SELECT p.*, r.naziv as regal_naziv, pr.naziv as prolaz_naziv, m.naziv as magacin_naziv
      FROM police p
      JOIN regali r ON p.regal_id = r.id
      JOIN prolazi pr ON r.prolaz_id = pr.id
      JOIN magacini m ON pr.magacin_id = m.id
      ORDER BY p.naziv
    `);
    res.json(police);
  } catch(e) { next(e); }
});

app.post('/api/police/auto', async (req, res, next) => {
  try {
    const { regal_id } = req.body;
    const num = await nextCounter('po');
    const naziv = `P${num}`;
    const result = await dbRun('INSERT INTO police (regal_id, naziv) VALUES (?, ?)', [regal_id, naziv]);
    res.json({ id: result.lastID, regal_id, naziv });
  } catch(e) {
    res.status(400).json({ error: 'Polica već postoji' });
  }
});

app.post('/api/police/custom', async (req, res, next) => {
  try {
    const { regal_id, naziv: rawNaziv } = req.body;
    const naziv = rawNaziv.toUpperCase().startsWith('P') ? rawNaziv.toUpperCase() : `P${rawNaziv.toUpperCase()}`;
    const result = await dbRun('INSERT INTO police (regal_id, naziv) VALUES (?, ?)', [regal_id, naziv]);
    res.json({ id: result.lastID, regal_id, naziv });
  } catch(e) {
    res.status(400).json({ error: `Polica "${naziv}" već postoji` });
  }
});

app.delete('/api/police/:id', async (req, res, next) => {
  try {
    await dbRun('DELETE FROM police WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { next(e); }
});

// ============ GUMA ROUTES ============

app.get('/api/gume', async (req, res, next) => {
  try {
    const { status, sezona, sirina, visina, promjer, sifra } = req.query;
    let sql = 'SELECT * FROM gume WHERE 1=1';
    const params = [];
    if (status === 'stanje') { sql += ' AND prodato = 0'; }
    if (status === 'prodato') { sql += ' AND prodato = 1'; }
    if (sezona) { sql += ' AND sezona = ?'; params.push(sezona); }
    if (sirina) { sql += ' AND sirina LIKE ?'; params.push(`%${sirina}%`); }
    if (visina) { sql += ' AND visina LIKE ?'; params.push(`%${visina}%`); }
    if (promjer) { sql += ' AND promjer LIKE ?'; params.push(`%${promjer}%`); }
    if (sifra) { sql += ' AND sifra LIKE ?'; params.push(`%${sifra}%`); }
    sql += ' ORDER BY id DESC';
    const gume = await dbAll(sql, params);
    res.json(gume.map(formatGuma));
  } catch(e) { next(e); }
});

app.post('/api/gume', async (req, res, next) => {
  try {
    const { sezona, sirina, visina, promjer, napomena, policaKod, slike } = req.body;
    if (!sezona || !sirina || !visina || !promjer || !policaKod) {
      return res.status(400).json({ error: 'Sva polja su obavezna' });
    }
    const polica = await dbGet('SELECT * FROM police WHERE naziv = ?', [policaKod]);
    if (!polica) return res.status(400).json({ error: `Polica "${policaKod}" ne postoji` });
    const num = await nextCounter('gu');
    const sifra = `GU${num}`;
    await dbRun(`
      INSERT INTO gume (sifra, sezona, sirina, visina, promjer, napomena, polica_id, polica_kod, slike)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [sifra, sezona, sirina, visina, promjer, napomena || '', polica.id, policaKod, JSON.stringify(slike || [])]);
    const guma = await dbGet('SELECT * FROM gume WHERE sifra = ?', [sifra]);
    res.json(formatGuma(guma));
  } catch(e) { next(e); }
});

app.put('/api/gume/:id', async (req, res, next) => {
  try {
    const { sezona, sirina, visina, promjer, napomena, policaKod, slike } = req.body;
    const polica = await dbGet('SELECT * FROM police WHERE naziv = ?', [policaKod]);
    if (!polica) return res.status(400).json({ error: `Polica "${policaKod}" ne postoji` });
    await dbRun(`
      UPDATE gume SET sezona=?, sirina=?, visina=?, promjer=?, napomena=?, polica_id=?, polica_kod=?, slike=?
      WHERE id=?
    `, [sezona, sirina, visina, promjer, napomena || '', polica.id, policaKod, JSON.stringify(slike || []), req.params.id]);
    const guma = await dbGet('SELECT * FROM gume WHERE id = ?', [req.params.id]);
    res.json(formatGuma(guma));
  } catch(e) { next(e); }
});

app.post('/api/gume/:id/prodaj', async (req, res, next) => {
  try {
    const { cijena } = req.body;
    const datum = new Date().toLocaleDateString('bs-BA');
    const cijenaTxt = cijena ? `${parseFloat(cijena).toLocaleString('bs-BA')} KM` : null;
    await dbRun('UPDATE gume SET prodato=1, cijena_prodaje=?, datum_prodaje=? WHERE id=?',
      [cijenaTxt, datum, req.params.id]);
    const guma = await dbGet('SELECT * FROM gume WHERE id = ?', [req.params.id]);
    res.json(formatGuma(guma));
  } catch(e) { next(e); }
});

app.delete('/api/gume/:id', async (req, res, next) => {
  try {
    await dbRun('DELETE FROM gume WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { next(e); }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`✅ Auto Delić Gume server pokrenut na portu ${PORT}`);
});
