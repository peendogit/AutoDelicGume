const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // large limit for base64 images
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'gume.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Create tables
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

// Helper: next counter
function nextCounter(key) {
  const row = db.prepare('SELECT value FROM counters WHERE key = ?').get(key);
  const next = (row?.value || 0) + 1;
  db.prepare('UPDATE counters SET value = ? WHERE key = ?').run(next, key);
  return next;
}

// Helper: get full magacin tree
function getMagaciniTree() {
  const magacini = db.prepare('SELECT * FROM magacini ORDER BY id').all();
  return magacini.map(m => {
    const prolazi = db.prepare('SELECT * FROM prolazi WHERE magacin_id = ? ORDER BY id').all(m.id);
    return {
      ...m,
      prolazi: prolazi.map(pr => {
        const regali = db.prepare('SELECT * FROM regali WHERE prolaz_id = ? ORDER BY id').all(pr.id);
        return {
          ...pr,
          regali: regali.map(r => {
            const police = db.prepare('SELECT * FROM police WHERE regal_id = ? ORDER BY id').all(r.id);
            return { ...r, police };
          })
        };
      })
    };
  });
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

app.get('/api/magacini', (req, res) => {
  res.json(getMagaciniTree());
});

app.post('/api/magacini', (req, res) => {
  const { naziv } = req.body;
  if (!naziv?.trim()) return res.status(400).json({ error: 'Naziv je obavezan' });
  const result = db.prepare('INSERT INTO magacini (naziv) VALUES (?)').run(naziv.trim());
  res.json({ id: result.lastInsertRowid, naziv: naziv.trim(), prolazi: [] });
});

app.delete('/api/magacini/:id', (req, res) => {
  db.prepare('DELETE FROM magacini WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ PROLAZ ROUTES ============

app.post('/api/prolazi', (req, res) => {
  const { magacin_id } = req.body;
  const existing = db.prepare('SELECT naziv FROM prolazi WHERE magacin_id = ? ORDER BY id').all(magacin_id);
  const lastLetter = existing.length ? existing[existing.length - 1].naziv.slice(-1) : null;
  const nextLetter = lastLetter ? String.fromCharCode(lastLetter.charCodeAt(0) + 1) : 'A';
  const naziv = `Prolaz ${nextLetter}`;
  const result = db.prepare('INSERT INTO prolazi (magacin_id, naziv) VALUES (?, ?)').run(magacin_id, naziv);
  res.json({ id: result.lastInsertRowid, magacin_id, naziv, regali: [] });
});

app.delete('/api/prolazi/:id', (req, res) => {
  db.prepare('DELETE FROM prolazi WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ REGAL ROUTES ============

app.post('/api/regali', (req, res) => {
  const { prolaz_id } = req.body;
  const existing = db.prepare('SELECT naziv FROM regali WHERE prolaz_id = ? ORDER BY id').all(prolaz_id);
  const nums = existing.map(r => parseInt(r.naziv.replace('R', '')) || 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const naziv = `R${next}`;
  const result = db.prepare('INSERT INTO regali (prolaz_id, naziv) VALUES (?, ?)').run(prolaz_id, naziv);
  res.json({ id: result.lastInsertRowid, prolaz_id, naziv, police: [] });
});

app.delete('/api/regali/:id', (req, res) => {
  db.prepare('DELETE FROM regali WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ POLICA ROUTES ============

app.get('/api/police', (req, res) => {
  const police = db.prepare(`
    SELECT p.*, r.naziv as regal_naziv, pr.naziv as prolaz_naziv, m.naziv as magacin_naziv
    FROM police p
    JOIN regali r ON p.regal_id = r.id
    JOIN prolazi pr ON r.prolaz_id = pr.id
    JOIN magacini m ON pr.magacin_id = m.id
    ORDER BY p.naziv
  `).all();
  res.json(police);
});

app.post('/api/police/auto', (req, res) => {
  const { regal_id } = req.body;
  const num = nextCounter('po');
  const naziv = `P${num}`;
  try {
    const result = db.prepare('INSERT INTO police (regal_id, naziv) VALUES (?, ?)').run(regal_id, naziv);
    res.json({ id: result.lastInsertRowid, regal_id, naziv });
  } catch (e) {
    res.status(400).json({ error: 'Polica već postoji' });
  }
});

app.post('/api/police/custom', (req, res) => {
  const { regal_id, naziv: rawNaziv } = req.body;
  const naziv = rawNaziv.toUpperCase().startsWith('P') ? rawNaziv.toUpperCase() : `P${rawNaziv.toUpperCase()}`;
  try {
    const result = db.prepare('INSERT INTO police (regal_id, naziv) VALUES (?, ?)').run(regal_id, naziv);
    res.json({ id: result.lastInsertRowid, regal_id, naziv });
  } catch (e) {
    res.status(400).json({ error: `Polica "${naziv}" već postoji` });
  }
});

app.delete('/api/police/:id', (req, res) => {
  db.prepare('DELETE FROM police WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ GUMA ROUTES ============

app.get('/api/gume', (req, res) => {
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
  const gume = db.prepare(sql).all(...params).map(formatGuma);
  res.json(gume);
});

app.post('/api/gume', (req, res) => {
  const { sezona, sirina, visina, promjer, napomena, policaKod, slike } = req.body;
  if (!sezona || !sirina || !visina || !promjer || !policaKod) {
    return res.status(400).json({ error: 'Sva polja su obavezna' });
  }
  const polica = db.prepare('SELECT * FROM police WHERE naziv = ?').get(policaKod);
  if (!polica) return res.status(400).json({ error: `Polica "${policaKod}" ne postoji` });
  const num = nextCounter('gu');
  const sifra = `GU${num}`;
  const result = db.prepare(`
    INSERT INTO gume (sifra, sezona, sirina, visina, promjer, napomena, polica_id, polica_kod, slike)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sifra, sezona, sirina, visina, promjer, napomena || '', polica.id, policaKod, JSON.stringify(slike || []));
  const guma = formatGuma(db.prepare('SELECT * FROM gume WHERE id = ?').get(result.lastInsertRowid));
  res.json(guma);
});

app.put('/api/gume/:id', (req, res) => {
  const { sezona, sirina, visina, promjer, napomena, policaKod, slike } = req.body;
  const polica = db.prepare('SELECT * FROM police WHERE naziv = ?').get(policaKod);
  if (!polica) return res.status(400).json({ error: `Polica "${policaKod}" ne postoji` });
  db.prepare(`
    UPDATE gume SET sezona=?, sirina=?, visina=?, promjer=?, napomena=?, polica_id=?, polica_kod=?, slike=?
    WHERE id=?
  `).run(sezona, sirina, visina, promjer, napomena || '', polica.id, policaKod, JSON.stringify(slike || []), req.params.id);
  const guma = formatGuma(db.prepare('SELECT * FROM gume WHERE id = ?').get(req.params.id));
  res.json(guma);
});

app.post('/api/gume/:id/prodaj', (req, res) => {
  const { cijena } = req.body;
  const datum = new Date().toLocaleDateString('bs-BA');
  const cijenaTxt = cijena ? `${parseFloat(cijena).toLocaleString('bs-BA')} KM` : null;
  db.prepare('UPDATE gume SET prodato=1, cijena_prodaje=?, datum_prodaje=? WHERE id=?')
    .run(cijenaTxt, datum, req.params.id);
  const guma = formatGuma(db.prepare('SELECT * FROM gume WHERE id = ?').get(req.params.id));
  res.json(guma);
});

app.delete('/api/gume/:id', (req, res) => {
  db.prepare('DELETE FROM gume WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Auto Delić Gume server pokrenut na portu ${PORT}`);
});
