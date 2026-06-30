const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Load .env if exists
try { require('dotenv').config(); } catch(e) {}

const app = express();
const PORT = process.env.PORT || 3000;

// ===== SECURITY =====
// Rate limiting - login brute force protection
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Previše pokušaja prijave. Pokušaj ponovo za 15 minuta.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: 'Previše zahtjeva. Usporite.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const backupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Backup je moguć max 5 puta na sat.' },
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/backup', backupLimiter);
app.use('/api', apiLimiter);

app.use(cors());
app.use((req, res, next) => {
  express.json({ limit: '100mb' })(req, res, (err) => {
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Neispravan JSON' });
    }
    next(err || undefined);
  });
});

const publicPath = path.join(process.cwd(), 'dist');
if (!fs.existsSync(publicPath)) {
  console.error('dist/ folder not found! Run: npm run build');
}
app.use(express.static(publicPath));

// Uploads directory for images
const uploadsPath = path.join(__dirname, 'public', 'uploads');
// Also serve public for uploads
app.use('/uploads', require('express').static(path.join(__dirname, 'public', 'uploads')));
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
app.use('/uploads', express.static(uploadsPath));

// ===== UPLOAD SLIKA NA DISK =====
app.post('/api/upload-slika', requireAuth, async (req,res) => {
  try {
    const { dataURL } = req.body;
    if (!dataURL || !dataURL.startsWith('data:image')) {
      return res.status(400).json({ error: 'Neispravan format slike' });
    }

    // Validate image type - only jpg, png, webp allowed
    const matches = dataURL.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Dozvoljeni formati: JPG, PNG, WEBP' });

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const data = Buffer.from(matches[2], 'base64');

    // Max 5MB per image
    if (data.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Slika je prevelika (max 5MB)' });
    }

    // Generate unique filename - no user input in filename
    const fname = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const fpath = path.join(uploadsPath, fname);

    fs.writeFileSync(fpath, data);
    res.json({ url: `/uploads/${fname}` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Local SQLite via better-sqlite3
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'gume.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Wrap better-sqlite3 (sync) in async interface to match existing code
async function dbRun(sql, p=[]) {
  const stmt = db.prepare(sql);
  const r = stmt.run(...p);
  return { lastID: r.lastInsertRowid, changes: r.changes };
}
async function dbGet(sql, p=[]) {
  const stmt = db.prepare(sql);
  return stmt.get(...p) || null;
}
async function dbAll(sql, p=[]) {
  const stmt = db.prepare(sql);
  return stmt.all(...p);
}
async function dbExec(sql) {
  db.exec(sql);
}

function hash(pw) { return crypto.createHash('sha256').update(pw+'autodelic_salt_2024').digest('hex'); }
function genToken() { return crypto.randomBytes(32).toString('hex'); }

async function initDB() {
  await dbExec(`
    CREATE TABLE IF NOT EXISTS korisnici (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'radnik',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS sesije (
      token TEXT PRIMARY KEY,
      korisnik_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (korisnik_id) REFERENCES korisnici(id) ON DELETE CASCADE
    )
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS magacini (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naziv TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS prolazi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      magacin_id INTEGER NOT NULL,
      naziv TEXT NOT NULL,
      FOREIGN KEY (magacin_id) REFERENCES magacini(id) ON DELETE CASCADE
    )
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS regali (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prolaz_id INTEGER NOT NULL,
      naziv TEXT NOT NULL,
      FOREIGN KEY (prolaz_id) REFERENCES prolazi(id) ON DELETE CASCADE
    )
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS police (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      regal_id INTEGER NOT NULL,
      naziv TEXT NOT NULL UNIQUE,
      FOREIGN KEY (regal_id) REFERENCES regali(id) ON DELETE CASCADE
    )
  `);
  await dbExec(`
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
      dodao_korisnik TEXT,
      prodao_korisnik TEXT,
      cijena TEXT,
      dubina TEXT,
      dot TEXT,
      tip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (polica_id) REFERENCES police(id) ON DELETE SET NULL
    )
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS historija_premjestanja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guma_id INTEGER NOT NULL,
      guma_sifra TEXT NOT NULL,
      polica_sa TEXT,
      polica_na TEXT NOT NULL,
      korisnik TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS aktivnosti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      korisnik TEXT NOT NULL,
      akcija TEXT NOT NULL,
      detalji TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS counters (
      key TEXT PRIMARY KEY,
      value INTEGER DEFAULT 0
    )
  `);
  await dbExec(`INSERT OR IGNORE INTO counters (key, value) VALUES ('gu', 9)`);
  await dbExec(`INSERT OR IGNORE INTO counters (key, value) VALUES ('po', 9)`);
  await dbExec(`INSERT OR IGNORE INTO counters (key, value) VALUES ('au', 0)`);

  // AUTA
  await dbExec(`
    CREATE TABLE IF NOT EXISTS auta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sifra TEXT NOT NULL UNIQUE,
      marka TEXT NOT NULL,
      model TEXT NOT NULL,
      godiste TEXT,
      boja TEXT,
      km TEXT,
      motor TEXT,
      vin TEXT,
      napomena TEXT DEFAULT '',
      slike TEXT DEFAULT '[]',
      nabavna_cijena TEXT,
      prodajna_cijena TEXT,
      olx_link TEXT,
      status TEXT DEFAULT 'na_stanju',
      dodao_korisnik TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Add na_popravci status support (already text field, no migration needed)
  // HISTORIJA STATUSA AUTA
  await dbExec(`
    CREATE TABLE IF NOT EXISTS status_historija (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auto_id INTEGER NOT NULL,
      stari_status TEXT,
      novi_status TEXT NOT NULL,
      napomena TEXT DEFAULT '',
      korisnik TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // KUPCI
  await dbExec(`
    CREATE TABLE IF NOT EXISTS kupci (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ime TEXT NOT NULL,
      telefon TEXT,
      adresa TEXT DEFAULT '',
      jib TEXT DEFAULT '',
      pdv_broj TEXT DEFAULT '',
      napomena TEXT DEFAULT '',
      dodao_korisnik TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try { await dbExec(`ALTER TABLE kupci ADD COLUMN adresa TEXT DEFAULT ''`); } catch(e) {}
  try { await dbExec(`ALTER TABLE kupci ADD COLUMN jib TEXT DEFAULT ''`); } catch(e) {}
  try { await dbExec(`ALTER TABLE kupci ADD COLUMN pdv_broj TEXT DEFAULT ''`); } catch(e) {}

  // KUPOVINE (historija kupovine po kupcu)
  await dbExec(`
    CREATE TABLE IF NOT EXISTS kupovine (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kupac_id INTEGER NOT NULL,
      opis TEXT NOT NULL,
      iznos REAL,
      placeno REAL DEFAULT 0,
      datum TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try { await dbExec(`ALTER TABLE kupovine ADD COLUMN placeno REAL DEFAULT 0`); } catch(e) {}
  try { await dbExec(`ALTER TABLE kupovine ADD COLUMN datum_uplate TEXT`); } catch(e) {}

  // PONUDE / RAČUNI
  await dbExec(`
    CREATE TABLE IF NOT EXISTS ponude (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      broj TEXT NOT NULL UNIQUE,
      kupac_ime TEXT NOT NULL,
      kupac_adresa TEXT DEFAULT '',
      kupac_telefon TEXT,
      vozilo TEXT DEFAULT '',
      stavke TEXT DEFAULT '[]',
      napomena TEXT DEFAULT '',
      pdv INTEGER DEFAULT 1,
      rok_placanja TEXT DEFAULT 'Avansno plaćanje',
      mjesto TEXT DEFAULT 'Bijeljina',
      status TEXT DEFAULT 'nacrt',
      kreirao TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try { await dbExec(`ALTER TABLE ponude ADD COLUMN kupac_adresa TEXT DEFAULT ''`); } catch(e) {}
  try { await dbExec(`ALTER TABLE ponude ADD COLUMN pdv INTEGER DEFAULT 1`); } catch(e) {}
  try { await dbExec(`ALTER TABLE ponude ADD COLUMN rok_placanja TEXT DEFAULT 'Avansno plaćanje'`); } catch(e) {}
  try { await dbExec(`ALTER TABLE ponude ADD COLUMN mjesto TEXT DEFAULT 'Bijeljina'`); } catch(e) {}
  try { await dbExec(`ALTER TABLE ponude ADD COLUMN vozilo TEXT DEFAULT ''`); } catch(e) {}
  try { await dbExec(`ALTER TABLE ponude ADD COLUMN unos_sa_pdv INTEGER DEFAULT 0`); } catch(e) {}

  // KOMPENZACIJE
  await dbExec(`
    CREATE TABLE IF NOT EXISTS kompenzacije (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kupac_id INTEGER NOT NULL,
      opis TEXT NOT NULL,
      iznos REAL NOT NULL,
      smjer TEXT NOT NULL DEFAULT 'dugujemo',
      datum TEXT,
      napomena TEXT DEFAULT '',
      izmireno INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // CJENOVNIK
  await dbExec(`
    CREATE TABLE IF NOT EXISTS cjenovnik (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dimenzija TEXT NOT NULL,
      sezona TEXT,
      cijena_min REAL,
      cijena_max REAL,
      napomena TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // REGISTRACIJA AUTA (podsjetnici)
  try { await dbExec(`ALTER TABLE auta ADD COLUMN datum_registracije TEXT`); } catch(e) {}
  try { await dbExec(`ALTER TABLE auta ADD COLUMN podsjetnik_reg INTEGER DEFAULT 1`); } catch(e) {}

  // REDOVNI (RECURRING) TROŠKOVI
  await dbExec(`
    CREATE TABLE IF NOT EXISTS redovni_troskovi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naziv TEXT NOT NULL,
      kategorija TEXT NOT NULL,
      iznos REAL NOT NULL,
      dan_u_mjesecu INTEGER DEFAULT 1,
      aktivan INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // TROŠKOVI OTPADA (gorivo, radnici, režije...)
  await dbExec(`
    CREATE TABLE IF NOT EXISTS troskovi_otpada (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kategorija TEXT NOT NULL,
      opis TEXT DEFAULT '',
      iznos REAL NOT NULL,
      datum TEXT NOT NULL,
      korisnik TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // HISTORIJA CIJENA AUTA
  await dbExec(`
    CREATE TABLE IF NOT EXISTS cijena_historija (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auto_id INTEGER NOT NULL,
      stara_cijena TEXT,
      nova_cijena TEXT NOT NULL,
      korisnik TEXT NOT NULL,
      napomena TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // SERVIS — mehaničari
  await dbExec(`
    CREATE TABLE IF NOT EXISTS mehanicari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ime TEXT NOT NULL,
      aktivan INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // SERVIS — poslovi
  await dbExec(`
    CREATE TABLE IF NOT EXISTS servis_poslovi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mehanicar_id INTEGER,
      mehanicar_ime TEXT NOT NULL,
      registracija TEXT DEFAULT '',
      opis_posla TEXT NOT NULL,
      naplaceno REAL NOT NULL DEFAULT 0,
      napomena TEXT DEFAULT '',
      dodao_korisnik TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ZADACI (to-do)
  await dbExec(`
    CREATE TABLE IF NOT EXISTS zadaci (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naslov TEXT NOT NULL,
      opis TEXT DEFAULT '',
      prioritet TEXT DEFAULT 'srednji',
      status TEXT DEFAULT 'otvoreno',
      dodao_korisnik TEXT,
      zatvorio_korisnik TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      zatvoreno_at DATETIME
    )
  `);

  // TROSKOVI — auto na popravci
  await dbExec(`
    CREATE TABLE IF NOT EXISTS troskovi_auta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auto_id INTEGER,
      naziv_auta TEXT NOT NULL,
      nabavna_cijena REAL DEFAULT 0,
      napomena TEXT DEFAULT '',
      dodao_korisnik TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS troskovi_dijelovi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trosak_id INTEGER NOT NULL,
      naziv TEXT NOT NULL,
      planirana_cijena REAL DEFAULT 0,
      stvarna_cijena REAL,
      nabavljeno INTEGER DEFAULT 0,
      napomena TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trosak_id) REFERENCES troskovi_auta(id) ON DELETE CASCADE
    )
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS nalozi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guma_id INTEGER NOT NULL,
      guma_sifra TEXT,
      guma_opis TEXT,
      guma_lokacija TEXT DEFAULT '',
      guma_slika TEXT DEFAULT '',
      napomena TEXT DEFAULT '',
      hitno INTEGER DEFAULT 0,
      za_slanje INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ceka',
      kreirao TEXT NOT NULL,
      preuzeo TEXT DEFAULT NULL,
      preuzeto_at DATETIME DEFAULT NULL,
      zavrseno_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add columns if missing (for existing DBs)
  const alterCols = ['dodao_korisnik TEXT','prodao_korisnik TEXT','dubina TEXT','dot TEXT','cijena TEXT','tip TEXT'];
  for (const col of alterCols) {
    try { await dbExec(`ALTER TABLE gume ADD COLUMN ${col}`); } catch(e) {}
  }
  const alterNalozi = ["guma_lokacija TEXT DEFAULT ''","zavrseno_at DATETIME DEFAULT NULL","guma_slika TEXT DEFAULT ''"];
  for (const col of alterNalozi) {
    try { await dbExec(`ALTER TABLE nalozi ADD COLUMN ${col}`); } catch(e) {}
  }

  // Create default admin
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const existing = await dbGet('SELECT id FROM korisnici WHERE username=?',['admin']);
  if (!existing) {
    await dbRun('INSERT INTO korisnici (username,password_hash,role) VALUES (?,?,?)',
      ['admin', hash(adminPass), 'admin']);
    console.log('Admin kreiran, lozinka:', adminPass);
  }
  console.log('✅ Baza inicijalizirana');
}

async function logNalogEvent(nalogId, gumaSifra, gumaOpis, akcija, korisnik, detalji) {
  try { await dbRun('INSERT INTO nalozi_log (nalog_id,guma_sifra,guma_opis,akcija,korisnik,detalji) VALUES (?,?,?,?,?,?)',
    [nalogId, gumaSifra, gumaOpis, akcija, korisnik, detalji||'']); } catch(e) { console.error('logNalogEvent error', e); }
}

async function logActivity(korisnik, akcija, detalji) {
  try {
    await dbRun('INSERT INTO aktivnosti (korisnik,akcija,detalji) VALUES (?,?,?)',
      [korisnik, akcija, detalji||null]);
  } catch(e) { console.error('Log error:', e.message); }
}

async function nextCounter(key) {
  const row = await dbGet('SELECT value FROM counters WHERE key=?',[key]);
  const next = (row?.value||0)+1;
  await dbRun('UPDATE counters SET value=? WHERE key=?',[next,key]);
  return next;
}

async function requireAuth(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ','');
  if (!token) return res.status(401).json({error:'Nisi prijavljen'});
  const sesija = await dbGet('SELECT s.*,k.role,k.username FROM sesije s JOIN korisnici k ON s.korisnik_id=k.id WHERE s.token=?',[token]);
  if (!sesija) return res.status(401).json({error:'Sesija istekla'});
  req.user = sesija;
  next();
}

async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    if (req.user.role !== 'admin') return res.status(403).json({error:'Samo admin ima pristup'});
    next();
  });
}

// AUTH
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username||!password) return res.status(400).json({error:'Unesite korisnicko ime i lozinku'});
    const k = await dbGet('SELECT * FROM korisnici WHERE username=? AND password_hash=?',[username.trim(), hash(password)]);
    if (!k) return res.status(401).json({error:'Pogresno korisnicko ime ili lozinka'});
    const token = genToken();
    await dbRun('INSERT INTO sesije (token,korisnik_id) VALUES (?,?)',[token,k.id]);
    await logActivity(k.username, 'PRIJAVA', null);
    res.json({token, role:k.role, username:k.username});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  await dbRun('DELETE FROM sesije WHERE token=?',[req.headers['authorization']?.replace('Bearer ','')]);
  res.json({ok:true});
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({username:req.user.username, role:req.user.role});
});

// KORISNICI
app.get('/api/korisnici', requireAdmin, async (req,res) => {
  res.json(await dbAll('SELECT id,username,role,created_at FROM korisnici ORDER BY id'));
});
app.post('/api/korisnici', requireAdmin, async (req,res) => {
  try {
    const {username,password,role} = req.body;
    if (!username||!password) return res.status(400).json({error:'Unesite korisnicko ime i lozinku'});
    const r = await dbRun('INSERT INTO korisnici (username,password_hash,role) VALUES (?,?,?)',[username.trim(),hash(password),role||'radnik']);
    res.json({id:r.lastID,username:username.trim(),role:role||'radnik'});
  } catch(e) { res.status(400).json({error:'Korisnicko ime vec postoji'}); }
});
app.delete('/api/korisnici/:id', requireAdmin, async (req,res) => {
  const k = await dbGet('SELECT role FROM korisnici WHERE id=?',[req.params.id]);
  if (k?.role==='admin') return res.status(400).json({error:'Ne mozete obrisati admin nalog'});
  await dbRun('DELETE FROM korisnici WHERE id=?',[req.params.id]);
  res.json({ok:true});
});

app.put('/api/korisnici/:id', requireAdmin, async (req,res) => {
  try {
    const {username, password, role} = req.body;
    if (!username?.trim()) return res.status(400).json({error:'Korisnicko ime je obavezno'});
    const existing = await dbGet('SELECT * FROM korisnici WHERE id=?',[req.params.id]);
    if (!existing) return res.status(404).json({error:'Korisnik nije pronaden'});
    let sql = 'UPDATE korisnici SET username=?, role=? WHERE id=?';
    let params = [username.trim(), role||existing.role, req.params.id];
    if (password?.trim()) {
      sql = 'UPDATE korisnici SET username=?, role=?, password_hash=? WHERE id=?';
      params = [username.trim(), role||existing.role, hash(password), req.params.id];
    }
    await dbRun(sql, params);
    const updated = await dbGet('SELECT id,username,role,created_at FROM korisnici WHERE id=?',[req.params.id]);
    res.json(updated);
  } catch(e) { res.status(400).json({error:'Korisnicko ime vec postoji'}); }
});

// BACKUP — JSON export (DB je u Turso cloudu, ne može se skinuti kao .db fajl)
app.get('/api/backup', requireAdmin, async (req,res) => {
  try {
    const { execSync } = require('child_process');
    const date = new Date().toISOString().slice(0,10);
    const zipName = `autodelic-backup-${date}.zip`;
    const zipPath = path.join('/tmp', zipName);

    // Build zip with db + uploads
    const dbPath2 = process.env.DB_PATH || path.join(__dirname, 'data', 'gume.db');
    const uploadsDir = path.join(__dirname, 'public', 'uploads');

    // Remove old zip if exists
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

    // Create zip
    let cmd = `zip -j "${zipPath}" "${dbPath2}"`;
    if (fs.existsSync(uploadsDir) && fs.readdirSync(uploadsDir).length > 0) {
      cmd = `zip -j "${zipPath}" "${dbPath2}" && zip -r "${zipPath}" "${uploadsDir}"`;
    }
    execSync(cmd);

    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    res.setHeader('Content-Type', 'application/zip');
    const stream = fs.createReadStream(zipPath);
    stream.pipe(res);
    stream.on('end', () => { try { fs.unlinkSync(zipPath); } catch(e){} });
  } catch(e) { res.status(500).json({error:e.message}); }
});

// MAGACINI
async function getMagaciniTree() {
  const magacini = await dbAll('SELECT * FROM magacini ORDER BY id');
  const result = [];
  for (const m of magacini) {
    const prolazi = await dbAll('SELECT * FROM prolazi WHERE magacin_id=? ORDER BY id',[m.id]);
    const pf = [];
    for (const pr of prolazi) {
      const regali = await dbAll('SELECT * FROM regali WHERE prolaz_id=? ORDER BY id',[pr.id]);
      const rf = [];
      for (const r of regali) {
        const police = await dbAll('SELECT * FROM police WHERE regal_id=? ORDER BY id',[r.id]);
        rf.push({...r, police});
      }
      pf.push({...pr, regali:rf});
    }
    result.push({...m, prolazi:pf});
  }
  return result;
}

app.get('/api/magacini', requireAuth, async (req,res) => { res.json(await getMagaciniTree()); });
app.post('/api/magacini', requireAdmin, async (req,res) => {
  const {naziv} = req.body;
  if (!naziv?.trim()) return res.status(400).json({error:'Naziv obavezan'});
  const r = await dbRun('INSERT INTO magacini (naziv) VALUES (?)',[naziv.trim()]);
  res.json({id:r.lastID,naziv:naziv.trim(),prolazi:[]});
});
app.delete('/api/magacini/:id', requireAdmin, async (req,res) => {
  await dbRun('DELETE FROM magacini WHERE id=?',[req.params.id]); res.json({ok:true});
});

app.post('/api/prolazi', requireAdmin, async (req,res) => {
  const {magacin_id} = req.body;
  const ex = await dbAll('SELECT naziv FROM prolazi WHERE magacin_id=? ORDER BY id',[magacin_id]);
  const last = ex.length ? ex[ex.length-1].naziv.slice(-1) : null;
  const next = last ? String.fromCharCode(last.charCodeAt(0)+1) : 'A';
  const naziv = 'Prolaz '+next;
  const r = await dbRun('INSERT INTO prolazi (magacin_id,naziv) VALUES (?,?)',[magacin_id,naziv]);
  res.json({id:r.lastID,magacin_id,naziv,regali:[]});
});
app.delete('/api/prolazi/:id', requireAdmin, async (req,res) => {
  await dbRun('DELETE FROM prolazi WHERE id=?',[req.params.id]); res.json({ok:true});
});

app.post('/api/regali', requireAdmin, async (req,res) => {
  const {prolaz_id} = req.body;
  const ex = await dbAll('SELECT naziv FROM regali WHERE prolaz_id=? ORDER BY id',[prolaz_id]);
  const nums = ex.map(r=>parseInt(r.naziv.replace('R',''))||0);
  const next = nums.length ? Math.max(...nums)+1 : 1;
  const naziv = 'R'+next;
  const r = await dbRun('INSERT INTO regali (prolaz_id,naziv) VALUES (?,?)',[prolaz_id,naziv]);
  res.json({id:r.lastID,prolaz_id,naziv,police:[]});
});
app.delete('/api/regali/:id', requireAdmin, async (req,res) => {
  await dbRun('DELETE FROM regali WHERE id=?',[req.params.id]); res.json({ok:true});
});

app.get('/api/police', requireAuth, async (req,res) => {
  const police = await dbAll(`SELECT p.*,r.naziv as regal_naziv,pr.naziv as prolaz_naziv,m.naziv as magacin_naziv
    FROM police p JOIN regali r ON p.regal_id=r.id JOIN prolazi pr ON r.prolaz_id=pr.id JOIN magacini m ON pr.magacin_id=m.id ORDER BY p.naziv`);
  res.json(police);
});
app.post('/api/police/auto', requireAdmin, async (req,res) => {
  try {
    const {regal_id} = req.body;
    const num = await nextCounter('po');
    const naziv = 'P'+num;
    const r = await dbRun('INSERT INTO police (regal_id,naziv) VALUES (?,?)',[regal_id,naziv]);
    res.json({id:r.lastID,regal_id,naziv});
  } catch(e) { res.status(400).json({error:'Polica vec postoji'}); }
});
app.post('/api/police/custom', requireAdmin, async (req,res) => {
  try {
    const {regal_id,naziv:raw} = req.body;
    const naziv = raw.toUpperCase().startsWith('P') ? raw.toUpperCase() : 'P'+raw.toUpperCase();
    const r = await dbRun('INSERT INTO police (regal_id,naziv) VALUES (?,?)',[regal_id,naziv]);
    res.json({id:r.lastID,regal_id,naziv});
  } catch(e) { res.status(400).json({error:'Polica vec postoji'}); }
});
app.delete('/api/police/:id', requireAdmin, async (req,res) => {
  await dbRun('DELETE FROM police WHERE id=?',[req.params.id]); res.json({ok:true});
});

// GUME
function formatGuma(g) {
  return {...g, slike:JSON.parse(g.slike||'[]'), prodato:g.prodato===1};
}

const GUME_SELECT = `
  SELECT g.*,
    p.naziv as loc_polica,
    r.naziv as loc_regal,
    pr.naziv as loc_prolaz,
    m.naziv as loc_magacin
  FROM gume g
  LEFT JOIN police p ON g.polica_id = p.id
  LEFT JOIN regali r ON p.regal_id = r.id
  LEFT JOIN prolazi pr ON r.prolaz_id = pr.id
  LEFT JOIN magacini m ON pr.magacin_id = m.id
`;

app.get('/api/gume', requireAuth, async (req,res) => {
  const {status,sezona,sirina,visina,promjer,sifra,tip} = req.query;
  let sql = GUME_SELECT + ' WHERE 1=1';
  const p = [];
  if (status==='stanje') { sql+=' AND g.prodato=0'; }
  if (status==='prodato') { sql+=' AND g.prodato=1'; }
  if (sezona) { sql+=' AND g.sezona=?'; p.push(sezona); }
  if (sirina) { sql+=' AND g.sirina LIKE ?'; p.push('%'+sirina+'%'); }
  if (visina) { sql+=' AND g.visina LIKE ?'; p.push('%'+visina+'%'); }
  if (promjer) { sql+=' AND g.promjer LIKE ?'; p.push('%'+promjer+'%'); }
  if (sifra) { sql+=' AND g.sifra LIKE ?'; p.push('%'+sifra+'%'); }
  if (tip) { sql+=' AND g.tip=?'; p.push(tip); }
  sql += ' ORDER BY g.id DESC';
  res.json((await dbAll(sql,p)).map(formatGuma));
});

app.post('/api/gume', requireAuth, async (req,res) => {
  try {
    const {sezona,sirina,visina,promjer,napomena,policaKod,slike,dubina,dot,tip} = req.body;
    const cijena = req.user.role==='admin' ? (req.body.cijena||null) : null;
    if (!sezona||!sirina||!visina||!promjer||!policaKod) return res.status(400).json({error:'Sva polja obavezna'});
    const polica = await dbGet('SELECT * FROM police WHERE naziv=?',[policaKod]);
    if (!polica) return res.status(400).json({error:'Polica "'+policaKod+'" ne postoji'});
    const num = await nextCounter('gu');
    const sifra = 'GU'+num;
    await dbRun('INSERT INTO gume (sifra,sezona,sirina,visina,promjer,napomena,polica_id,polica_kod,slike,dodao_korisnik,dubina,dot,tip,cijena) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [sifra,sezona,sirina,visina,promjer,napomena||'',polica.id,policaKod,JSON.stringify(slike||[]),req.user.username,dubina||null,dot||null,tip||null,cijena]);
    const g = formatGuma(await dbGet(GUME_SELECT+' WHERE g.sifra=?',[sifra]));
    await logActivity(req.user.username, 'DODANA_GUMA', `${sifra} — ${sirina}/${visina} ${promjer} ${sezona} → ${policaKod}`);
    res.json(g);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/gume/:id', requireAuth, async (req,res) => {
  try {
    const {sezona,sirina,visina,promjer,napomena,policaKod,slike,dubina,dot,tip} = req.body;
    const cijena = req.user.role==='admin' ? (req.body.cijena||null) : undefined;
    const polica = await dbGet('SELECT * FROM police WHERE naziv=?',[policaKod]);
    if (!polica) return res.status(400).json({error:'Polica "'+policaKod+'" ne postoji'});
    if (cijena !== undefined) {
      await dbRun('UPDATE gume SET sezona=?,sirina=?,visina=?,promjer=?,napomena=?,polica_id=?,polica_kod=?,slike=?,dubina=?,dot=?,tip=?,cijena=? WHERE id=?',
        [sezona,sirina,visina,promjer,napomena||'',polica.id,policaKod,JSON.stringify(slike||[]),dubina||null,dot||null,tip||null,cijena,req.params.id]);
    } else {
      await dbRun('UPDATE gume SET sezona=?,sirina=?,visina=?,promjer=?,napomena=?,polica_id=?,polica_kod=?,slike=?,dubina=?,dot=?,tip=? WHERE id=?',
        [sezona,sirina,visina,promjer,napomena||'',polica.id,policaKod,JSON.stringify(slike||[]),dubina||null,dot||null,tip||null,req.params.id]);
    }
    const g = formatGuma(await dbGet(GUME_SELECT+' WHERE g.id=?',[req.params.id]));
    await logActivity(req.user.username, 'EDITOVANA_GUMA', `${g.sifra} — ${sezona} ${sirina}/${visina} ${promjer}`);
    res.json(g);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Premjesti gumu na drugu policu
app.post('/api/gume/:id/premjesti', requireAuth, async (req,res) => {
  try {
    const {policaKod} = req.body;
    const polica = await dbGet('SELECT * FROM police WHERE naziv=?',[policaKod]);
    if (!polica) return res.status(400).json({error:'Polica "'+policaKod+'" ne postoji'});
    const stara = await dbGet('SELECT sifra,polica_kod FROM gume WHERE id=?',[req.params.id]);
    await dbRun('UPDATE gume SET polica_id=?,polica_kod=? WHERE id=?',[polica.id,policaKod,req.params.id]);
    await dbRun('INSERT INTO historija_premjestanja (guma_id,guma_sifra,polica_sa,polica_na,korisnik) VALUES (?,?,?,?,?)',
      [req.params.id, stara.sifra, stara.polica_kod||null, policaKod, req.user.username]);
    await logActivity(req.user.username, 'PREMJESTENA_GUMA', `${stara.sifra}: ${stara.polica_kod||'—'} → ${policaKod}`);
    res.json(formatGuma(await dbGet(GUME_SELECT+' WHERE g.id=?',[req.params.id])));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/gume/:id/prodaj', requireAuth, async (req,res) => {
  const {cijena} = req.body;
  const _d=new Date();const datum=String(_d.getDate()).padStart(2,'0')+'. '+String(_d.getMonth()+1).padStart(2,'0')+'. '+_d.getFullYear()+'.';
  const cijenaTxt = cijena ? parseFloat(cijena)+' KM' : null;
  await dbRun('UPDATE gume SET prodato=1,cijena_prodaje=?,datum_prodaje=?,prodao_korisnik=? WHERE id=?',
    [cijenaTxt,datum,req.user.username,req.params.id]);
  const aktivniNalog = await dbGet('SELECT * FROM nalozi WHERE guma_id=?',[req.params.id]);
  if(aktivniNalog){
    await logNalogEvent(aktivniNalog.id, aktivniNalog.guma_sifra, aktivniNalog.guma_opis, 'ARHIVIRAN', req.user.username, `Artikal prodat za ${cijenaTxt||'—'}`);
  }
  await dbRun('DELETE FROM nalozi WHERE guma_id=?',[req.params.id]);
  const g = formatGuma(await dbGet(GUME_SELECT+' WHERE g.id=?',[req.params.id]));
  await logActivity(req.user.username, 'PRODANA_GUMA', `${g.sifra} — ${g.sirina}/${g.visina} ${g.promjer}${cijenaTxt?' za '+cijenaTxt:''}`);
  res.json(g);
});

// HISTORIJA PREMJEŠTANJA — mora biti prije DELETE /:id
app.get('/api/gume/:id/historija', requireAuth, async (req,res) => {
  const historija = await dbAll(
    'SELECT * FROM historija_premjestanja WHERE guma_id=? ORDER BY created_at DESC',
    [req.params.id]);
  res.json(historija);
});

app.delete('/api/gume/:id', requireAdmin, async (req,res) => {
  const g = await dbGet('SELECT sifra,sirina,visina,promjer FROM gume WHERE id=?',[req.params.id]);
  await dbRun('DELETE FROM gume WHERE id=?',[req.params.id]);
  if (g) await logActivity(req.user.username, 'OBRISANA_GUMA', `${g.sifra} — ${g.sirina}/${g.visina} ${g.promjer}`);
  res.json({ok:true});
});

// LOG AKTIVNOSTI (admin only)
app.get('/api/aktivnosti', requireAdmin, async (req,res) => {
  const limit = parseInt(req.query.limit)||100;
  const aktivnosti = await dbAll(
    'SELECT * FROM aktivnosti ORDER BY created_at DESC LIMIT ?',
    [limit]);
  res.json(aktivnosti);
});

// ANALITIKA (admin only)
app.get('/api/analitika', requireAdmin, async (req,res) => {
  try {
    const ukupnoGuma   = await dbGet('SELECT COUNT(*) as c FROM gume') || {c:0};
    const naStan       = await dbGet('SELECT COUNT(*) as c FROM gume WHERE prodato=0') || {c:0};
    const prodatoCount = await dbGet('SELECT COUNT(*) as c FROM gume WHERE prodato=1') || {c:0};

    const prodajaPoSezonama = await dbAll(
      'SELECT sezona, COUNT(*) as ukupno, SUM(prodato) as prodato FROM gume GROUP BY sezona');

    const prodajaPoMjesecima = await dbAll(
      `SELECT substr(created_at,1,7) as mj,
        COUNT(*) as dodano,
        SUM(CASE WHEN prodato=1 THEN 1 ELSE 0 END) as prodano
       FROM gume GROUP BY mj ORDER BY mj DESC LIMIT 12`);

    const topRadnici = await dbAll(
      `SELECT dodao_korisnik as korisnik, COUNT(*) as dodao
       FROM gume WHERE dodao_korisnik IS NOT NULL
       GROUP BY dodao_korisnik ORDER BY dodao DESC`);

    for (const r of topRadnici) {
      const p = await dbGet('SELECT COUNT(*) as c FROM gume WHERE prodao_korisnik=?', [r.korisnik]);
      r.prodao = p?.c || 0;
    }

    const gumePoPolici = await dbAll(
      `SELECT polica_kod, COUNT(*) as guma_count FROM gume
       WHERE prodato=0 AND polica_kod IS NOT NULL
       GROUP BY polica_kod ORDER BY guma_count DESC LIMIT 10`);

    const topDimenzije = await dbAll(
      `SELECT sirina||'/'||visina||' '||promjer as dimenzija,
        COUNT(*) as ukupno,
        SUM(prodato) as prodato,
        SUM(CASE WHEN prodato=0 THEN 1 ELSE 0 END) as na_stanju
       FROM gume GROUP BY dimenzija ORDER BY ukupno DESC LIMIT 10`);

    // ===== ABC ANALIZA =====
    // Sve prodane gume po dimenziji — sortirane po broju prodaja
    const abcRaw = await dbAll(
      `SELECT sirina||'/'||visina||' '||promjer as dimenzija,
        COUNT(*) as prodato_kom,
        SUM(CASE WHEN prodato=0 THEN 1 ELSE 0 END) as na_stanju
       FROM gume GROUP BY dimenzija ORDER BY prodato_kom DESC`);

    // Izračunaj ABC kategorije (Pareto 80/15/5)
    const ukupnoProdano = abcRaw.reduce((s,r)=>s+Number(r.prodato_kom),0);
    let kumulativ = 0;
    const abcAnaliza = abcRaw.map(r=>{
      kumulativ += Number(r.prodato_kom);
      const posto = ukupnoProdano>0 ? (kumulativ/ukupnoProdano*100) : 0;
      const kategorija = posto<=80 ? 'A' : posto<=95 ? 'B' : 'C';
      return {...r, kumulativ_posto: Math.round(posto), kategorija};
    });

    // ===== PROGNOZA =====
    // Uzmi prodaju po mjesecima za prošlu godinu i napravi prognozu
    // Prognoza za sljedećih 6 mjeseci
    // datum_prodaje je u formatu DD.MM.YYYY - parsiramo ga ispravno
    const prodajaMjesecno = await dbAll(
      `SELECT substr(datum_prodaje,9,4)||'-'||substr(datum_prodaje,5,2) as mj,
        COUNT(*) as prodano
       FROM gume WHERE prodato=1 AND datum_prodaje IS NOT NULL
       AND length(datum_prodaje)>=10
       GROUP BY mj ORDER BY mj`);

    // Prosječna prodaja po mjesecu
    const prosjecno = prodajaMjesecno.length > 0
      ? Math.round(prodajaMjesecno.reduce((s,m)=>s+Number(m.prodano),0) / prodajaMjesecno.length)
      : 0;

    // Sezonski faktori — prodaja po broju mjeseca (1-12)
    const prodajaPoMjesecu = {};
    for (const m of prodajaMjesecno) {
      const mBroj = parseInt(m.mj.slice(5,7));
      if(!prodajaPoMjesecu[mBroj]) prodajaPoMjesecu[mBroj] = {ukupno:0,godina:0};
      prodajaPoMjesecu[mBroj].ukupno += Number(m.prodano);
      prodajaPoMjesecu[mBroj].godina += 1;
    }

    // Prognoza za specifične mjesece (proljeće i jesen — sezona guma)
    const prognoza = [];
    const sada = new Date();
    const TARGET_MONTHS = [3,4,5,9,10,11]; // Mart, April, Maj, Septembar, Oktobar, Novembar
    for(const mjes of TARGET_MONTHS){
      const d = new Date(sada);
      d.setDate(1);
      d.setMonth(mjes-1);
      // Ako je taj mjesec već prošao ove godine, uzmi sljedeću godinu
      if(d <= sada) d.setFullYear(d.getFullYear()+1);
      const mj = d.toISOString().slice(0,7);
      const jeZimskiMjesec = [10,11,12,1,2,3].includes(mjes);
      const histData = prodajaPoMjesecu[mjes];
      const prognozaKom = histData
        ? Math.round(histData.ukupno / histData.godina)
        : prosjecno;
      prognoza.push({
        mj,
        naziv: d.toLocaleDateString('sr-Latn-RS',{month:'long',year:'numeric'}),
        prognoza_kom: prognozaKom,
        sezona: jeZimskiMjesec ? 'Zimska' : 'Ljetna',
        ima_historiju: !!histData,
      });
    }

    const prodajaPoMjesecimaFixed = (prodajaPoMjesecima||[]).map(m=>({
      mj: m.mj, dodano: Number(m.dodano)||0, prodano: Number(m.prodano)||0
    }));

    res.json({
      ukupnoGuma: Number(ukupnoGuma.c)||0,
      naStan: Number(naStan.c)||0,
      prodatoCount: Number(prodatoCount.c)||0,
      prodajaPoSezonama: prodajaPoSezonama||[],
      prodajaPoMjesecima: prodajaPoMjesecimaFixed,
      topRadnici: topRadnici||[],
      gumePoPolici: gumePoPolici||[],
      topDimenzije: topDimenzije||[],
      abcAnaliza: abcAnaliza||[],
      prognoza: prognoza||[],
      prosjecnaMjesecnaProdaja: prosjecno,
    });
  } catch(e) {
    console.error('Analitika error:', e);
    res.status(500).json({error: e.message});
  }
});

// ===== DASHBOARD =====
app.get('/api/dashboard', requireAuth, async (req,res) => {
  try {
    const _today=new Date();
    const danasISO = _today.getFullYear()+'-'+String(_today.getMonth()+1).padStart(2,'0')+'-'+String(_today.getDate()).padStart(2,'0');
    const [gumeStanje, gumeProdato, autaStanje, autaProdato,
           zadaciOtvoreni, troskoviAktivno,
           zadnjeGume, zadnjiZadaci, prodaja24h] = await Promise.all([
      dbGet('SELECT COUNT(*) as c FROM gume WHERE prodato=0'),
      dbGet('SELECT COUNT(*) as c FROM gume WHERE prodato=1'),
      dbGet("SELECT COUNT(*) as c FROM auta WHERE status='na_stanju'"),
      dbGet("SELECT COUNT(*) as c FROM auta WHERE status='prodat'"),
      dbGet("SELECT COUNT(*) as c FROM zadaci WHERE status='otvoreno'"),
      dbGet('SELECT COUNT(*) as c FROM troskovi_auta'),
      dbAll("SELECT id,sifra,sezona,sirina,visina,promjer,polica_kod,created_at FROM gume WHERE date(created_at,'+2 hours')=date('now','+2 hours') ORDER BY created_at DESC"),
      dbAll("SELECT id,naslov,prioritet,status,dodao_korisnik,created_at FROM zadaci WHERE status='otvoreno' ORDER BY CASE prioritet WHEN 'visok' THEN 1 WHEN 'srednji' THEN 2 ELSE 3 END, created_at DESC LIMIT 25"),
      dbAll(`SELECT id,sifra,sirina,visina,promjer,sezona,cijena_prodaje,datum_prodaje,prodao_korisnik FROM gume WHERE prodato=1 AND length(datum_prodaje)>=10 AND (substr(datum_prodaje,9,4)||'-'||substr(datum_prodaje,5,2)||'-'||substr(datum_prodaje,1,2)) >= ? ORDER BY datum_prodaje DESC`, [danasISO]),
    ]);
    res.json({
      gume_stanje: gumeStanje?.c||0,
      gume_prodato: gumeProdato?.c||0,
      auta_stanje: autaStanje?.c||0,
      auta_prodato: autaProdato?.c||0,
      zadaci_otvoreno: zadaciOtvoreni?.c||0,
      troskovi_aktivno: troskoviAktivno?.c||0,
      zadnje_gume: zadnjeGume,
      zadnji_zadaci: zadnjiZadaci,
      prodaja_24h: prodaja24h,
    });
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ===== AUTA =====
app.get('/api/auta', requireAuth, async (req,res) => {
  try {
    const {status, q} = req.query;
    let sql = 'SELECT * FROM auta WHERE 1=1';
    const p = [];
    if(status) { sql+=' AND status=?'; p.push(status); }
    if(q) { sql+=' AND (marka LIKE ? OR model LIKE ? OR sifra LIKE ? OR vin LIKE ?)'; p.push('%'+q+'%','%'+q+'%','%'+q+'%','%'+q+'%'); }
    sql+=' ORDER BY id DESC';
    const auta = await dbAll(sql,p);
    res.json(auta.map(a=>({...a, slike:JSON.parse(a.slike||'[]')})));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/auta', requireAuth, async (req,res) => {
  try {
    const {marka,model,godiste,boja,km,motor,vin,napomena,slike,nabavna_cijena,prodajna_cijena,olx_link,status,datum_registracije} = req.body;
    if(!marka||!model) return res.status(400).json({error:'Marka i model su obavezni'});
    const num = await nextCounter('au');
    const sifra = 'AU'+String(num).padStart(3,'0');
    await dbRun(`INSERT INTO auta (sifra,marka,model,godiste,boja,km,motor,vin,napomena,slike,nabavna_cijena,prodajna_cijena,olx_link,status,datum_registracije,dodao_korisnik)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [sifra,marka,model,godiste||null,boja||null,km||null,motor||null,vin||null,napomena||'',
       JSON.stringify(slike||[]),nabavna_cijena||null,prodajna_cijena||null,olx_link||null,
       status||'na_stanju',datum_registracije||null,req.user.username]);
    const a = await dbGet('SELECT * FROM auta WHERE sifra=?',[sifra]);
    await logActivity(req.user.username,'DODANO_AUTO',`${a.sifra} — ${marka} ${model} ${godiste||''}`);
    res.json({...a, slike:JSON.parse(a.slike||'[]')});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/auta/:id', requireAuth, async (req,res) => {
  try {
    const {marka,model,godiste,boja,km,motor,vin,napomena,slike,nabavna_cijena,prodajna_cijena,olx_link,status,datum_registracije} = req.body;
    const stari = await dbGet('SELECT prodajna_cijena,status,marka,model FROM auta WHERE id=?',[req.params.id]);
    // Log price change
    if (stari && stari.prodajna_cijena !== (prodajna_cijena||null)) {
      await dbRun('INSERT INTO cijena_historija (auto_id,stara_cijena,nova_cijena,korisnik) VALUES (?,?,?,?)',
        [req.params.id, stari.prodajna_cijena||null, prodajna_cijena||'0', req.user.username]);
    }
    // Log status change
    if (stari && stari.status !== (status||'na_stanju')) {
      await dbRun('INSERT INTO status_historija (auto_id,stari_status,novi_status,korisnik) VALUES (?,?,?,?)',
        [req.params.id, stari.status, status||'na_stanju', req.user.username]);
    }
    await dbRun(`UPDATE auta SET marka=?,model=?,godiste=?,boja=?,km=?,motor=?,vin=?,napomena=?,slike=?,
      nabavna_cijena=?,prodajna_cijena=?,olx_link=?,status=?,datum_registracije=? WHERE id=?`,
      [marka,model,godiste||null,boja||null,km||null,motor||null,vin||null,napomena||'',
       JSON.stringify(slike||[]),nabavna_cijena||null,prodajna_cijena||null,olx_link||null,status||'na_stanju',datum_registracije||null,req.params.id]);
    const a = await dbGet('SELECT * FROM auta WHERE id=?',[req.params.id]);
    await logActivity(req.user.username,'EDITOVANO_AUTO',`${a.sifra} — ${a.marka} ${a.model}`);
    res.json({...a, slike:JSON.parse(a.slike||'[]')});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Historija statusa za auto
app.get('/api/auta/:id/status-historija', requireAdmin, async (req,res) => {
  try {
    res.json(await dbAll('SELECT * FROM status_historija WHERE auto_id=? ORDER BY created_at DESC',[req.params.id]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Historija cijena za auto
app.get('/api/auta/:id/cijena-historija', requireAdmin, async (req,res) => {
  try {
    const historija = await dbAll('SELECT * FROM cijena_historija WHERE auto_id=? ORDER BY created_at DESC',[req.params.id]);
    res.json(historija);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/auta/:id', requireAdmin, async (req,res) => {
  try {
    const a = await dbGet('SELECT sifra,marka,model FROM auta WHERE id=?',[req.params.id]);
    await dbRun('DELETE FROM auta WHERE id=?',[req.params.id]);
    if(a) await logActivity(req.user.username,'OBRISANO_AUTO',`${a.sifra} — ${a.marka} ${a.model}`);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Javni katalog auta

// ===== ZADACI =====
app.get('/api/zadaci', requireAdmin, async (req,res) => {
  try {
    const zadaci = await dbAll("SELECT * FROM zadaci ORDER BY CASE prioritet WHEN 'visok' THEN 1 WHEN 'srednji' THEN 2 ELSE 3 END, created_at DESC");
    res.json(zadaci);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/zadaci', requireAdmin, async (req,res) => {
  try {
    const {naslov,opis,prioritet} = req.body;
    if(!naslov?.trim()) return res.status(400).json({error:'Naslov je obavezan'});
    const r = await dbRun('INSERT INTO zadaci (naslov,opis,prioritet,dodao_korisnik) VALUES (?,?,?,?)',
      [naslov.trim(),opis||'',prioritet||'srednji',req.user.username]);
    res.json(await dbGet('SELECT * FROM zadaci WHERE id=?',[r.lastID]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/zadaci/:id', requireAdmin, async (req,res) => {
  try {
    const {naslov,opis,prioritet,status} = req.body;
    const zatvoreno = status==='zatvoreno' ? new Date().toISOString() : null;
    await dbRun('UPDATE zadaci SET naslov=?,opis=?,prioritet=?,status=?,zatvorio_korisnik=?,zatvoreno_at=? WHERE id=?',
      [naslov,opis||'',prioritet||'srednji',status||'otvoreno',
       status==='zatvoreno'?req.user.username:null, zatvoreno, req.params.id]);
    res.json(await dbGet('SELECT * FROM zadaci WHERE id=?',[req.params.id]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/zadaci/:id', requireAdmin, async (req,res) => {
  try {
    await dbRun('DELETE FROM zadaci WHERE id=?',[req.params.id]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ===== TROŠKOVI PO AUTU =====
app.get('/api/auta/:id/troskovi', requireAuth, async (req,res) => {
  try {
    const trosak = await dbGet('SELECT * FROM troskovi_auta WHERE auto_id=?',[req.params.id]);
    if(!trosak) return res.json({dijelovi:[]});
    trosak.dijelovi = await dbAll('SELECT * FROM troskovi_dijelovi WHERE trosak_id=? ORDER BY id',[trosak.id]);
    res.json(trosak);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/auta/:id/troskovi/dio', requireAuth, async (req,res) => {
  try {
    const {naziv, planirana_cijena, stvarna_cijena, nabavljeno} = req.body;
    if(!naziv) return res.status(400).json({error:'Naziv je obavezan'});
    let trosak = await dbGet('SELECT * FROM troskovi_auta WHERE auto_id=?',[req.params.id]);
    if(!trosak) {
      const auto = await dbGet('SELECT * FROM auta WHERE id=?',[req.params.id]);
      if(!auto) return res.status(404).json({error:'Auto nije pronađen'});
      const r = await dbRun('INSERT INTO troskovi_auta (auto_id,naziv_auta,nabavna_cijena,dodao_korisnik) VALUES (?,?,?,?)',
        [req.params.id, auto.marka+' '+auto.model, parseFloat(auto.nabavna_cijena)||0, req.user.username]);
      trosak = await dbGet('SELECT * FROM troskovi_auta WHERE id=?',[r.lastID]);
    }
    const r = await dbRun('INSERT INTO troskovi_dijelovi (trosak_id,naziv,planirana_cijena,stvarna_cijena,nabavljeno) VALUES (?,?,?,?,?)',
      [trosak.id, naziv, parseFloat(planirana_cijena)||0, nabavljeno?(parseFloat(stvarna_cijena)||0):null, nabavljeno?1:0]);
    const dio = await dbGet('SELECT * FROM troskovi_dijelovi WHERE id=?',[r.lastID]);
    await logActivity(req.user.username,'TROSAK_DODAN',`${trosak.naziv_auta}: ${naziv}`);
    res.json(dio);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/auta/:id/troskovi/dio/:dioId', requireAuth, async (req,res) => {
  try {
    const {naziv, planirana_cijena, stvarna_cijena, nabavljeno} = req.body;
    await dbRun('UPDATE troskovi_dijelovi SET naziv=?,planirana_cijena=?,stvarna_cijena=?,nabavljeno=? WHERE id=?',
      [naziv, parseFloat(planirana_cijena)||0, nabavljeno?(parseFloat(stvarna_cijena)||0):null, nabavljeno?1:0, req.params.dioId]);
    res.json(await dbGet('SELECT * FROM troskovi_dijelovi WHERE id=?',[req.params.dioId]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/auta/:id/troskovi/dio/:dioId', requireAuth, async (req,res) => {
  try { await dbRun('DELETE FROM troskovi_dijelovi WHERE id=?',[req.params.dioId]); res.json({ok:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

// ===== TROŠKOVI =====
app.get('/api/troskovi', requireAuth, async (req,res) => {
  try {
    const troskovi = await dbAll('SELECT * FROM troskovi_auta ORDER BY created_at DESC');
    for(const t of troskovi) {
      t.dijelovi = await dbAll('SELECT * FROM troskovi_dijelovi WHERE trosak_id=? ORDER BY created_at',[t.id]);
    }
    res.json(troskovi);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/troskovi', requireAuth, async (req,res) => {
  try {
    const {naziv_auta,nabavna_cijena,napomena,auto_id} = req.body;
    if(!naziv_auta?.trim()) return res.status(400).json({error:'Naziv auta je obavezan'});
    const r = await dbRun('INSERT INTO troskovi_auta (naziv_auta,nabavna_cijena,napomena,auto_id,dodao_korisnik) VALUES (?,?,?,?,?)',
      [naziv_auta.trim(),parseFloat(nabavna_cijena)||0,napomena||'',auto_id||null,req.user.username]);
    const t = await dbGet('SELECT * FROM troskovi_auta WHERE id=?',[r.lastID]);
    t.dijelovi = [];
    res.json(t);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/troskovi/:id', requireAdmin, async (req,res) => {
  try {
    await dbRun('DELETE FROM troskovi_auta WHERE id=?',[req.params.id]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/troskovi/:id/dijelovi', requireAuth, async (req,res) => {
  try {
    const {naziv,planirana_cijena,napomena} = req.body;
    if(!naziv?.trim()) return res.status(400).json({error:'Naziv dijela je obavezan'});
    const r = await dbRun('INSERT INTO troskovi_dijelovi (trosak_id,naziv,planirana_cijena,napomena) VALUES (?,?,?,?)',
      [req.params.id,naziv.trim(),parseFloat(planirana_cijena)||0,napomena||'']);
    res.json(await dbGet('SELECT * FROM troskovi_dijelovi WHERE id=?',[r.lastID]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/troskovi/:id/dijelovi/:did', requireAuth, async (req,res) => {
  try {
    const {naziv,planirana_cijena,stvarna_cijena,nabavljeno,napomena} = req.body;
    await dbRun('UPDATE troskovi_dijelovi SET naziv=?,planirana_cijena=?,stvarna_cijena=?,nabavljeno=?,napomena=? WHERE id=?',
      [naziv,parseFloat(planirana_cijena)||0,
       stvarna_cijena!==undefined&&stvarna_cijena!==''?parseFloat(stvarna_cijena):null,
       nabavljeno?1:0,napomena||'',req.params.did]);
    res.json(await dbGet('SELECT * FROM troskovi_dijelovi WHERE id=?',[req.params.did]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/troskovi/:id/dijelovi/:did', requireAuth, async (req,res) => {
  try {
    await dbRun('DELETE FROM troskovi_dijelovi WHERE id=?',[req.params.did]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ===== STATIC PAGES =====
app.get('/katalog', (req,res) => {
  const p = [path.join(__dirname,'public','katalog.html'),path.join(process.cwd(),'public','katalog.html')].find(x=>fs.existsSync(x));
  p ? res.sendFile(p) : res.status(404).send('Nije pronađeno');
});

// JAVNI KATALOG — bez autentifikacije, samo na stanju
app.get('/api/katalog', async (req,res) => {
  try {
    const gume = await dbAll(GUME_SELECT + ' WHERE g.prodato=0 ORDER BY g.id DESC');
    res.json({ gume: gume.map(formatGuma) });
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ===== BATCH PREMJEŠTANJE =====
app.post('/api/gume/batch-premjesti', requireAuth, async (req,res) => {
  try {
    const {sifre, policaKod} = req.body;
    if(!sifre||!sifre.length||!policaKod) return res.status(400).json({error:'Nema podataka'});
    const polica = await dbGet('SELECT * FROM police WHERE naziv=?',[policaKod]);
    if(!polica) return res.status(400).json({error:'Polica "'+policaKod+'" ne postoji'});
    const rezultati = [];
    for(const sifra of sifre) {
      const g = await dbGet('SELECT id,sifra,polica_kod FROM gume WHERE sifra=?',[sifra.trim().toUpperCase()]);
      if(!g) { rezultati.push({sifra, ok:false, greska:'Ne postoji'}); continue; }
      await dbRun('UPDATE gume SET polica_id=?,polica_kod=? WHERE id=?',[polica.id,policaKod,g.id]);
      await dbRun('INSERT INTO historija_premjestanja (guma_id,guma_sifra,polica_sa,polica_na,korisnik) VALUES (?,?,?,?,?)',
        [g.id, g.sifra, g.polica_kod||null, policaKod, req.user.username]);
      await logActivity(req.user.username,'PREMJESTENA_GUMA',`${g.sifra}: ${g.polica_kod||'—'} → ${policaKod}`);
      rezultati.push({sifra:g.sifra, ok:true, polica_nova:policaKod});
    }
    res.json({rezultati, uspjesno: rezultati.filter(r=>r.ok).length});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// PRETRAGA PO POLICI
app.get('/api/police/:naziv/gume', requireAuth, async (req,res) => {
  try {
    const naziv = decodeURIComponent(req.params.naziv).toUpperCase();
    const gume = await dbAll(GUME_SELECT + ' WHERE g.polica_kod=? AND g.prodato=0 ORDER BY g.id',[naziv]);
    res.json(gume.map(formatGuma));
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Magacini sa svim policama (za kartu magacina)
app.get('/api/magacini-full', requireAdmin, async (req,res) => {
  try {
    const magacini = await dbAll('SELECT * FROM magacini ORDER BY naziv');
    for(const m of magacini) {
      m.prolazi = await dbAll('SELECT * FROM prolazi WHERE magacin_id=? ORDER BY naziv',[m.id]);
      for(const pr of m.prolazi) {
        pr.regali = await dbAll('SELECT * FROM regali WHERE prolaz_id=? ORDER BY naziv',[pr.id]);
        for(const r of pr.regali) {
          r.police = await dbAll('SELECT * FROM police WHERE regal_id=? ORDER BY naziv',[r.id]);
        }
      }
    }
    res.json(magacini);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ===== KUPCI =====
app.get('/api/kupci', requireAdmin, async (req,res) => {
  try {
    const kupci = await dbAll('SELECT * FROM kupci ORDER BY ime');
    for(const k of kupci) k.kupovine = await dbAll('SELECT * FROM kupovine WHERE kupac_id=? ORDER BY datum DESC',[k.id]);
    res.json(kupci);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/kupci', requireAdmin, async (req,res) => {
  try {
    const {ime,telefon,adresa,jib,pdv_broj,napomena} = req.body;
    if(!ime) return res.status(400).json({error:'Ime je obavezno'});
    const r = await dbRun('INSERT INTO kupci (ime,telefon,adresa,jib,pdv_broj,napomena,dodao_korisnik) VALUES (?,?,?,?,?,?,?)',
      [ime,telefon||'',adresa||'',jib||'',pdv_broj||'',napomena||'',req.user.username]);
    const k = await dbGet('SELECT * FROM kupci WHERE id=?',[r.lastID]);
    k.kupovine = [];
    res.json(k);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/kupci/:id', requireAdmin, async (req,res) => {
  try {
    const {ime,telefon,adresa,jib,pdv_broj,napomena} = req.body;
    await dbRun('UPDATE kupci SET ime=?,telefon=?,adresa=?,jib=?,pdv_broj=?,napomena=? WHERE id=?',
      [ime,telefon||'',adresa||'',jib||'',pdv_broj||'',napomena||'',req.params.id]);
    res.json(await dbGet('SELECT * FROM kupci WHERE id=?',[req.params.id]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/kupci/:id', requireAdmin, async (req,res) => {
  try {
    await dbRun('DELETE FROM kupovine WHERE kupac_id=?',[req.params.id]);
    await dbRun('DELETE FROM kupci WHERE id=?',[req.params.id]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/kupci/:id/kupovina', requireAdmin, async (req,res) => {
  try {
    const {opis,iznos,placeno,datum} = req.body;
    const r = await dbRun('INSERT INTO kupovine (kupac_id,opis,iznos,placeno,datum) VALUES (?,?,?,?,?)',
      [req.params.id,opis,parseFloat(iznos)||0,parseFloat(placeno)||0,datum||new Date().toISOString().slice(0,10)]);
    res.json(await dbGet('SELECT * FROM kupovine WHERE id=?',[r.lastID]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/kupci/:id/kupovina/:kid', requireAdmin, async (req,res) => {
  try {
    const {placeno,datum_uplate,opis,iznos,datum} = req.body;
    if(opis!==undefined){
      await dbRun('UPDATE kupovine SET opis=?,iznos=?,placeno=?,datum=?,datum_uplate=? WHERE id=?',
        [opis,parseFloat(iznos)||0,parseFloat(placeno)||0,datum||null,datum_uplate||null,req.params.kid]);
    } else {
      await dbRun('UPDATE kupovine SET placeno=?,datum_uplate=? WHERE id=?',
        [parseFloat(placeno)||0,datum_uplate||null,req.params.kid]);
    }
    res.json(await dbGet('SELECT * FROM kupovine WHERE id=?',[req.params.kid]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/kupci/:id/kupovina/:kid', requireAdmin, async (req,res) => {
  try { await dbRun('DELETE FROM kupovine WHERE id=?',[req.params.kid]); res.json({ok:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});


// ===== KOMPENZACIJE =====
app.get('/api/kupci/:id/kompenzacije', requireAdmin, async (req,res) => {
  try { res.json(await dbAll('SELECT * FROM kompenzacije WHERE kupac_id=? ORDER BY datum DESC',[req.params.id])); }
  catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/kupci/:id/kompenzacije', requireAdmin, async (req,res) => {
  try {
    const {opis,iznos,smjer,datum,napomena} = req.body;
    const r = await dbRun('INSERT INTO kompenzacije (kupac_id,opis,iznos,smjer,datum,napomena) VALUES (?,?,?,?,?,?)',
      [req.params.id,opis,parseFloat(iznos)||0,smjer||'dugujemo',datum||new Date().toISOString().slice(0,10),napomena||'']);
    res.json(await dbGet('SELECT * FROM kompenzacije WHERE id=?',[r.lastID]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/kupci/:id/kompenzacije/:kid', requireAdmin, async (req,res) => {
  try {
    const {izmireno} = req.body;
    await dbRun('UPDATE kompenzacije SET izmireno=? WHERE id=?',[izmireno?1:0,req.params.kid]);
    res.json(await dbGet('SELECT * FROM kompenzacije WHERE id=?',[req.params.kid]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/kupci/:id/kompenzacije/:kid', requireAdmin, async (req,res) => {
  try { await dbRun('DELETE FROM kompenzacije WHERE id=?',[req.params.kid]); res.json({ok:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

// ===== PONUDE / RAČUNI =====
app.get('/api/ponude', requireAdmin, async (req,res) => {
  try {
    const ponude = await dbAll('SELECT * FROM ponude ORDER BY created_at DESC');
    res.json(ponude.map(p=>({...p, stavke:JSON.parse(p.stavke||'[]'), unosSaPdv:!!p.unos_sa_pdv})));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/ponude', requireAdmin, async (req,res) => {
  try {
    const {kupac_ime,kupac_adresa,kupac_telefon,vozilo,stavke,napomena,pdv,rok_placanja,mjesto,unosSaPdv} = req.body;
    const year = new Date().getFullYear();
    // Use MAX to avoid gaps causing duplicate keys when ponude are deleted
    const lastBroj = await dbGet(`SELECT broj FROM ponude WHERE broj LIKE ? ORDER BY id DESC LIMIT 1`,[year+'-%']);
    let nextNum = 1;
    if(lastBroj) {
      const parts = lastBroj.broj.split('-');
      nextNum = (parseInt(parts[parts.length-1])||0) + 1;
    }
    let broj = year+'-'+String(nextNum).padStart(3,'0');
    // Extra safety: keep incrementing if somehow still taken
    while(await dbGet('SELECT id FROM ponude WHERE broj=?',[broj])) {
      nextNum++;
      broj = year+'-'+String(nextNum).padStart(3,'0');
    }
    const r = await dbRun(
      'INSERT INTO ponude (broj,kupac_ime,kupac_adresa,kupac_telefon,vozilo,stavke,napomena,pdv,unos_sa_pdv,rok_placanja,mjesto,kreirao) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [broj,kupac_ime,kupac_adresa||'',kupac_telefon||'',vozilo||'',JSON.stringify(stavke||[]),napomena||'',pdv?1:0,unosSaPdv?1:0,rok_placanja||'Avansno plaćanje',mjesto||'Bijeljina',req.user.username]);
    const p = await dbGet('SELECT * FROM ponude WHERE id=?',[r.lastID]);
    res.json({...p, stavke:JSON.parse(p.stavke||'[]')});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/ponude/:id', requireAdmin, async (req,res) => {
  try {
    const {kupac_ime,kupac_adresa,kupac_telefon,vozilo,stavke,napomena,pdv,rok_placanja,mjesto,unosSaPdv} = req.body;
    await dbRun('UPDATE ponude SET kupac_ime=?,kupac_adresa=?,kupac_telefon=?,vozilo=?,stavke=?,napomena=?,pdv=?,unos_sa_pdv=?,rok_placanja=?,mjesto=? WHERE id=?',
      [kupac_ime,kupac_adresa||'',kupac_telefon||'',vozilo||'',JSON.stringify(stavke||[]),napomena||'',pdv?1:0,unosSaPdv?1:0,rok_placanja||'Avansno plaćanje',mjesto||'Bijeljina',req.params.id]);
    const p = await dbGet('SELECT * FROM ponude WHERE id=?',[req.params.id]);
    res.json({...p, stavke:JSON.parse(p.stavke||'[]'), unosSaPdv:!!p.unos_sa_pdv});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/ponude/:id', requireAdmin, async (req,res) => {
  try { await dbRun('DELETE FROM ponude WHERE id=?',[req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

// ===== PODSJETNICI — auta sa isteklom/skorom registracijom =====
app.get('/api/podsjetnici/registracija', requireAdmin, async (req,res) => {
  try {
    const auta = await dbAll(`SELECT id,sifra,marka,model,godiste,datum_registracije FROM auta
      WHERE status!='prodat' AND datum_registracije IS NOT NULL AND datum_registracije != ''`);
    const danas = new Date();
    const rezultat = auta.map(a => {
      const reg = new Date(a.datum_registracije);
      const daniDo = Math.round((reg - danas) / (1000*60*60*24));
      return {...a, dani_do_registracije: daniDo, istekla: daniDo < 0};
    }).sort((a,b) => a.dani_do_registracije - b.dani_do_registracije);
    res.json(rezultat);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ===== REDOVNI TROŠKOVI =====
app.get('/api/redovni-troskovi', requireAdmin, async (req,res) => {
  try { res.json(await dbAll('SELECT * FROM redovni_troskovi ORDER BY dan_u_mjesecu, naziv')); }
  catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/redovni-troskovi', requireAdmin, async (req,res) => {
  try {
    const {naziv, kategorija, iznos, dan_u_mjesecu} = req.body;
    if(!naziv||!iznos) return res.status(400).json({error:'Naziv i iznos su obavezni'});
    const r = await dbRun('INSERT INTO redovni_troskovi (naziv,kategorija,iznos,dan_u_mjesecu) VALUES (?,?,?,?)',
      [naziv, kategorija||'Ostalo', parseFloat(iznos), parseInt(dan_u_mjesecu)||1]);
    res.json(await dbGet('SELECT * FROM redovni_troskovi WHERE id=?',[r.lastID]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/redovni-troskovi/:id', requireAdmin, async (req,res) => {
  try {
    const {naziv, kategorija, iznos, dan_u_mjesecu, aktivan} = req.body;
    await dbRun('UPDATE redovni_troskovi SET naziv=?,kategorija=?,iznos=?,dan_u_mjesecu=?,aktivan=? WHERE id=?',
      [naziv, kategorija||'Ostalo', parseFloat(iznos), parseInt(dan_u_mjesecu)||1, aktivan?1:0, req.params.id]);
    res.json(await dbGet('SELECT * FROM redovni_troskovi WHERE id=?',[req.params.id]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/redovni-troskovi/:id', requireAdmin, async (req,res) => {
  try { await dbRun('DELETE FROM redovni_troskovi WHERE id=?',[req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

// ===== TROŠKOVI OTPADA =====
app.get('/api/troskovi-otpada', requireAdmin, async (req,res) => {
  try {
    const {od, do: do_} = req.query;
    let sql = 'SELECT * FROM troskovi_otpada WHERE 1=1';
    const p = [];
    if(od) { sql += ' AND datum >= ?'; p.push(od); }
    if(do_) { sql += ' AND datum <= ?'; p.push(do_); }
    sql += ' ORDER BY datum DESC';
    res.json(await dbAll(sql, p));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/troskovi-otpada', requireAdmin, async (req,res) => {
  try {
    const {kategorija, opis, iznos, datum} = req.body;
    if(!kategorija||!iznos) return res.status(400).json({error:'Kategorija i iznos su obavezni'});
    const r = await dbRun('INSERT INTO troskovi_otpada (kategorija,opis,iznos,datum,korisnik) VALUES (?,?,?,?,?)',
      [kategorija, opis||'', parseFloat(iznos), datum||new Date().toISOString().slice(0,10), req.user.username]);
    res.json(await dbGet('SELECT * FROM troskovi_otpada WHERE id=?',[r.lastID]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/troskovi-otpada/:id', requireAdmin, async (req,res) => {
  try {
    await dbRun('DELETE FROM troskovi_otpada WHERE id=?',[req.params.id]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ===== FINANSIJSKI IZVJEŠTAJ =====
// ===== SERVIS — MEHANIČARI =====
app.get('/api/mehanicari', requireAuth, async (req,res) => {
  try { res.json(await dbAll('SELECT * FROM mehanicari ORDER BY aktivan DESC, ime')); }
  catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/mehanicari', requireAdmin, async (req,res) => {
  try {
    const {ime} = req.body;
    if(!ime||!ime.trim()) return res.status(400).json({error:'Ime je obavezno'});
    const r = await dbRun('INSERT INTO mehanicari (ime) VALUES (?)', [ime.trim()]);
    res.json(await dbGet('SELECT * FROM mehanicari WHERE id=?', [r.lastID]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/mehanicari/:id', requireAdmin, async (req,res) => {
  try {
    const {ime, aktivan} = req.body;
    await dbRun('UPDATE mehanicari SET ime=?, aktivan=? WHERE id=?', [ime, aktivan?1:0, req.params.id]);
    res.json(await dbGet('SELECT * FROM mehanicari WHERE id=?', [req.params.id]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/mehanicari/:id', requireAdmin, async (req,res) => {
  try { await dbRun('DELETE FROM mehanicari WHERE id=?', [req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

// ===== SERVIS — POSLOVI =====
app.get('/api/servis-poslovi', requireAuth, async (req,res) => {
  try {
    const {od, do_, mehanicar_id} = req.query;
    let where = '1=1'; const params=[];
    if(od){ where+=' AND date(created_at) >= date(?)'; params.push(od); }
    if(do_){ where+=' AND date(created_at) <= date(?)'; params.push(do_); }
    if(mehanicar_id){ where+=' AND mehanicar_id=?'; params.push(mehanicar_id); }
    res.json(await dbAll(`SELECT * FROM servis_poslovi WHERE ${where} ORDER BY created_at DESC`, params));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/servis-poslovi', requireAuth, async (req,res) => {
  try {
    const {mehanicar_id, mehanicar_ime, registracija, opis_posla, naplaceno, napomena} = req.body;
    if(!mehanicar_ime||!opis_posla||!naplaceno) return res.status(400).json({error:'Mehaničar, opis posla i naplaćeno su obavezni'});
    const r = await dbRun(
      'INSERT INTO servis_poslovi (mehanicar_id,mehanicar_ime,registracija,opis_posla,naplaceno,napomena,dodao_korisnik) VALUES (?,?,?,?,?,?,?)',
      [mehanicar_id||null, mehanicar_ime, registracija||'', opis_posla, parseFloat(naplaceno)||0, napomena||'', req.user.username]);
    res.json(await dbGet('SELECT * FROM servis_poslovi WHERE id=?', [r.lastID]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/servis-poslovi/:id', requireAdmin, async (req,res) => {
  try {
    const {mehanicar_id, mehanicar_ime, registracija, opis_posla, naplaceno, napomena} = req.body;
    await dbRun(
      'UPDATE servis_poslovi SET mehanicar_id=?,mehanicar_ime=?,registracija=?,opis_posla=?,naplaceno=?,napomena=? WHERE id=?',
      [mehanicar_id||null, mehanicar_ime, registracija||'', opis_posla, parseFloat(naplaceno)||0, napomena||'', req.params.id]);
    res.json(await dbGet('SELECT * FROM servis_poslovi WHERE id=?', [req.params.id]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/servis-poslovi/:id', requireAdmin, async (req,res) => {
  try { await dbRun('DELETE FROM servis_poslovi WHERE id=?', [req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

// Pregled — zarada po mehaničaru
app.get('/api/servis-pregled', requireAdmin, async (req,res) => {
  try {
    const {period} = req.query;
    let datumOd = '2000-01-01';
    const now = new Date();
    if(period==='danas') datumOd = now.toISOString().slice(0,10);
    else if(period==='sedmica') { const d=new Date(now); d.setDate(d.getDate()-7); datumOd=d.toISOString().slice(0,10); }
    else if(period==='mjesec') datumOd = now.toISOString().slice(0,7)+'-01';
    else if(period==='godina') datumOd = now.getFullYear()+'-01-01';

    const poslovi = await dbAll(
      `SELECT * FROM servis_poslovi WHERE date(created_at) >= date(?) ORDER BY created_at DESC`, [datumOd]);

    const poMeh = {};
    for(const p of poslovi){
      const key = p.mehanicar_ime;
      if(!poMeh[key]) poMeh[key] = {mehanicar_ime:key, mehanicar_id:p.mehanicar_id, broj_poslova:0, ukupno:0};
      poMeh[key].broj_poslova++;
      poMeh[key].ukupno += p.naplaceno;
    }
    const poMehArr = Object.values(poMeh).sort((a,b)=>b.ukupno-a.ukupno);
    const ukupnaZarada = poslovi.reduce((s,p)=>s+p.naplaceno,0);

    res.json({ poslovi, poMehanicaru: poMehArr, ukupnaZarada, brojPoslova: poslovi.length, period: period||'sve' });
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/finansije', requireAdmin, async (req,res) => {
  try {
    const {period} = req.query; // 'danas' | 'sedmica' | 'mjesec' | 'godina' | 'sve'
    let datumOd = '2000-01-01';
    const now = new Date();
    if(period==='danas') datumOd = now.toISOString().slice(0,10);
    else if(period==='sedmica') { const d=new Date(now); d.setDate(d.getDate()-7); datumOd=d.toISOString().slice(0,10); }
    else if(period==='mjesec') datumOd = now.toISOString().slice(0,7)+'-01';
    else if(period==='godina') datumOd = now.getFullYear()+'-01-01';

    // Prihodi od guma
    const gumeProdate = await dbAll(
      `SELECT sifra,sirina,visina,promjer,sezona,cijena_prodaje,datum_prodaje,prodao_korisnik
       FROM gume WHERE prodato=1 AND (
         ? = '2000-01-01' OR
         (length(datum_prodaje)>=10 AND
          substr(datum_prodaje,9,4)||'-'||substr(datum_prodaje,5,2)||'-'||substr(datum_prodaje,1,2) >= ?)
       ) ORDER BY datum_prodaje DESC`,
      [datumOd, datumOd]);

    // Prihodi od auta
    const autaProdana = await dbAll(
      `SELECT sifra,marka,model,godiste,nabavna_cijena,prodajna_cijena,dodao_korisnik
       FROM auta WHERE status='prodat' ORDER BY id DESC`);

    // Prihodi od servisa
    const servisPoslovi = await dbAll(
      `SELECT * FROM servis_poslovi WHERE (
         ? = '2000-01-01' OR date(created_at) >= date(?)
       ) ORDER BY created_at DESC`,
      [datumOd, datumOd]);

    // Troškovi otpada
    const troskoviOtpada = await dbAll(
      `SELECT * FROM troskovi_otpada WHERE datum >= ? ORDER BY datum DESC`, [datumOd]);

    // Troškovi popravke (nabavne cijene auta + dijelovi)
    const troskoviPopravke = await dbAll('SELECT * FROM troskovi_auta ORDER BY created_at DESC');
    for(const t of troskoviPopravke) {
      t.dijelovi = await dbAll('SELECT * FROM troskovi_dijelovi WHERE trosak_id=?',[t.id]);
    }

    // Gume na stanju — potencijalna vrijednost
    const gumeStanje = await dbGet('SELECT COUNT(*) as c, SUM(CAST(cijena AS REAL)) as ukupno FROM gume WHERE prodato=0 AND cijena IS NOT NULL');
    const autaStanje = await dbGet("SELECT COUNT(*) as c, SUM(CAST(prodajna_cijena AS REAL)) as ukupno FROM auta WHERE status='na_stanju' AND prodajna_cijena IS NOT NULL");

    res.json({
      gumeProdate,
      autaProdana,
      servisPoslovi,
      troskoviOtpada,
      troskoviPopravke,
      gumeStanje: { count: gumeStanje?.c||0, vrijednost: gumeStanje?.ukupno||0 },
      autaStanje: { count: autaStanje?.c||0, vrijednost: autaStanje?.ukupno||0 },
      period: period||'sve',
    });
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ===== NALOZI LOG (DNEVNIK) =====
app.get('/api/nalozi-log', requireAdmin, async (req,res) => {
  try {
    const {od, do_} = req.query;
    let where='1=1'; const params=[];
    if(od){ where+=" AND date(created_at) >= date(?)"; params.push(od); }
    if(do_){ where+=" AND date(created_at) <= date(?)"; params.push(do_); }
    const log = await dbAll(`SELECT * FROM nalozi_log WHERE ${where} ORDER BY created_at DESC LIMIT 500`, params);
    res.json(log);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Licna istorija naloga - sve sto je korisnik preuzeo i zavrsio/arhivirao
app.get('/api/nalozi-moja-istorija', requireAuth, async (req,res) => {
  try {
    const log = await dbAll(
      `SELECT * FROM nalozi_log WHERE korisnik=? AND akcija IN ('PREUZET','SPREMLJENO','ZAVRSENO','ARHIVIRAN') ORDER BY created_at DESC LIMIT 200`,
      [req.user.username]);
    res.json(log);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ===== NALOZI (GET) =====
app.get('/api/nalozi', requireAuth, async (req,res) => {
  try {
    const nalozi = await dbAll("SELECT * FROM nalozi WHERE status!='zavrseno' OR preuzeo=? OR ?='admin' ORDER BY hitno DESC, created_at DESC", [req.user.username, req.user.role]);
    res.json(nalozi);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/nalozi/count', requireAuth, async (req,res) => {
  try {
    const r = await dbGet("SELECT COUNT(*) as c FROM nalozi WHERE status='ceka'");
    res.json({count: r?.c||0});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ===== ANALITIKA - STATISTIKA UNOSA DIJELOVA =====
app.get('/api/analitika/unosi', requireAdmin, async (req,res) => {
  try {
    const {od, do_} = req.query;
    let where = "dodao_korisnik IS NOT NULL";
    const params = [];
    if(od){ where += " AND date(created_at) >= date(?)"; params.push(od); }
    if(do_){ where += " AND date(created_at) <= date(?)"; params.push(do_); }

    const poKorisniku = await dbAll(
      `SELECT dodao_korisnik as korisnik, COUNT(*) as broj
       FROM gume WHERE ${where}
       GROUP BY dodao_korisnik ORDER BY broj DESC`, params);

    res.json({ poKorisniku });
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/analitika/unosi/:korisnik', requireAdmin, async (req,res) => {
  try {
    const {od, do_} = req.query;
    let where = "dodao_korisnik = ?";
    const params = [req.params.korisnik];
    if(od){ where += " AND date(created_at) >= date(?)"; params.push(od); }
    if(do_){ where += " AND date(created_at) <= date(?)"; params.push(do_); }

    const artikli = await dbAll(
      `SELECT id, sifra, sirina, visina, promjer, sezona, polica_kod, created_at
       FROM gume WHERE ${where} ORDER BY created_at DESC`, params);

    res.json(artikli);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('*', (req,res) => {
  const attempts = [
    path.join(__dirname,'public','index.html'),
    path.join(__dirname,'Public','index.html'),
    path.join(process.cwd(),'public','index.html'),
    path.join(process.cwd(),'Public','index.html'),
  ];
  const p = attempts.find(x=>fs.existsSync(x));
  if (!p) return res.status(500).json({error:'index.html not found',attempts});
  res.sendFile(p);
});


// ===== PRINT ENDPOINT =====
app.get('/api/print', requireAuth, async (req,res) => {
  try {
    const {id, tip, brFisk} = req.query;
    const p = await dbGet('SELECT * FROM ponude WHERE id=?',[id]);
    if(!p) return res.status(404).send('Ponuda nije pronadjena');
    p.stavke = JSON.parse(p.stavke||'[]');
    const hasPdv = p.pdv!==0;
    const datum = new Date(p.created_at).toLocaleDateString('sr-Latn-RS');
    const ukupnoBez = p.stavke.reduce((s,x)=>s+(parseFloat(x.cijena)||0)*(parseInt(x.kolicina)||1),0);
    const pdvIz = Math.round(ukupnoBez*0.17*100)/100;
    const ukupnoSa = hasPdv ? Math.round((ukupnoBez+pdvIz)*100)/100 : ukupnoBez;
    const LOGO = 'data:image/webp;base64,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';
    const title = tip==='racun'?'RACUN':'PREDRACUN / PONUDA';
    const stavkeHTML = p.stavke.map((s,i)=>{
      const v=(parseFloat(s.cijena)||0)*(parseInt(s.kolicina)||1);
      return '<tr><td>'+(i+1)+'.</td><td>'+s.opis+'</td><td>'+(s.jm||'KOM')+'</td><td class=num>'+s.kolicina+'</td><td class=num>'+parseFloat(s.cijena||0).toFixed(2)+' KM</td><td class=num>'+v.toFixed(2)+' KM</td></tr>';
    }).join('');
    const totalsHTML = hasPdv ?
      '<tr><td>Ukupno bez PDV-a:</td><td>'+ukupnoBez.toFixed(2)+' KM</td></tr><tr class=pdv-row><td>PDV (17%):</td><td>'+pdvIz.toFixed(2)+' KM</td></tr><tr class=main-row><td>UKUPNO sa PDV-om:</td><td>'+ukupnoSa.toFixed(2)+' KM</td></tr>' :
      '<tr class=main-row><td>UKUPNO:</td><td>'+ukupnoBez.toFixed(2)+' KM</td></tr>';
    const fiscRow = (tip==='racun'&&brFisk) ? '<tr><td><b>Br. fisc. racuna:</b></td><td><b>'+brFisk+'</b></td></tr>' : '';
    const adr = p.kupac_adresa ? '<div>'+p.kupac_adresa+'</div>' : '';
    const tel2 = p.kupac_telefon ? '<div>Tel: '+p.kupac_telefon+'</div>' : '';
    const nap = p.napomena ? '<div class=napomena><b>Napomena:</b> '+p.napomena+'</div>' : '';

    const html = '<!DOCTYPE html><html><head><meta charset=UTF-8><title>'+title+' '+p.broj+'</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10.5pt;color:#111}.page{width:210mm;min-height:297mm;margin:0 auto;padding:10mm 12mm 15mm}.header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #5a9e2f;padding-bottom:6mm;margin-bottom:4mm}.header img{height:55px;object-fit:contain}.firma{text-align:right;font-size:9pt;color:#333;line-height:1.6}.firma .tel{font-size:11pt;font-weight:bold;color:#111}.firma .web{color:#5a9e2f;font-weight:bold}.jib{color:#555;font-size:8.5pt;padding:3px 0;display:flex;justify-content:space-between;margin-bottom:4mm;border-bottom:1px solid #ddd}.doc-title{font-size:14pt;font-weight:bold;text-align:center;margin-bottom:4mm}.doc-row{display:flex;gap:10mm;margin-bottom:5mm}.kom{flex:1;border:1px solid #ccc;border-radius:3px;padding:5px 8px;min-height:28mm}.kom-lbl{font-size:8pt;text-transform:uppercase;color:#777;margin-bottom:3px;font-weight:bold}.kom-name{font-size:12pt;font-weight:bold;margin-bottom:2px}.kom-info{font-size:8.5pt;color:#444;line-height:1.5}.info-box{flex:0 0 70mm;border:1px solid #ccc;border-radius:3px;padding:5px 8px}.info-box table{width:100%;border-collapse:collapse;font-size:9pt}.info-box td{padding:2px 4px;vertical-align:top}.info-box td:first-child{color:#666;font-weight:bold;width:45%}table.st{width:100%;border-collapse:collapse;margin-bottom:4mm;font-size:9.5pt}table.st th{background:#f5f5f5;border-top:1.5px solid #333;border-bottom:1.5px solid #333;padding:5px 6px;text-align:left;font-size:8.5pt}table.st th.num{text-align:right}table.st td{padding:4px 6px;border-bottom:1px solid #e5e5e5}table.st td.num{text-align:right;font-weight:bold}table.st tr:nth-child(even) td{background:#fafafa}.tot-wrap{display:flex;justify-content:flex-end;margin-bottom:6mm}.tot{width:72mm;border-collapse:collapse;font-size:10pt}.tot td{padding:3px 6px}.tot td:last-child{text-align:right;font-weight:bold}.main-row td{padding:5px 6px;font-size:11pt;font-weight:bold;border-top:2px solid #333}.pdv-row{border-top:1px solid #e0e0e0}.napomena{border:1px dashed #ccc;border-radius:3px;padding:5px 8px;font-size:9pt;color:#555;margin-bottom:5mm}.potpis{display:flex;justify-content:space-between;margin-top:12mm}.pb{text-align:center;width:60mm}.pb-line{border-top:1px solid #aaa;margin-top:10mm;padding-top:3px;font-size:8pt;color:#666}.footer{margin-top:20px;font-size:7.5pt;color:#888;text-align:center;border-top:1px solid #ddd;padding-top:3mm}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:0}.page{padding:8mm 10mm 12mm}}</style></head><body><div class=page><div class=header><img src="'+LOGO+'" alt="Auto Delic"/><div class=firma><div class=tel>Tel: 066 027 888</div><div class=web>www.delicauto.com</div><div>Pavlovica put 13, 76300 Bijeljina</div><div>autootpaddelic@gmail.com</div></div></div><div class=jib><span>JIB: 4512510240001</span><span>ZR: 5540010000584312</span></div><div class=doc-title>'+title+' BR. '+p.broj+'</div><div class=doc-row><div class=kom><div class=kom-lbl>Komitent (kupac):</div><div class=kom-name>'+p.kupac_ime+'</div><div class=kom-info>'+adr+tel2+'</div></div><div class=info-box><table><tr><td>Datum:</td><td>'+datum+'</td></tr><tr><td>Rok placanja:</td><td>'+(p.rok_placanja||'Avansno placanje')+'</td></tr><tr><td>Mjesto:</td><td>'+(p.mjesto||'Bijeljina')+'</td></tr>'+fiscRow+'</table></div></div><table class=st><thead><tr><th>Br.</th><th>Opis</th><th>JM</th><th class=num>Kol.</th><th class=num>Cijena</th><th class=num>Vrijednost</th></tr></thead><tbody>'+stavkeHTML+'</tbody></table><div class=tot-wrap><table class=tot>'+totalsHTML+'</table></div>'+nap+'<div class=potpis><div class=pb><div class=pb-line>Potpis kupca</div></div><div class=pb><div class=pb-line>Potpis izdavaoca</div></div></div><div class=footer>Auto Delic - Pavlovica put 13, 76300 Bijeljina - Tel: 066 027 888</div></div><script>window.onload=function(){window.print();}<\/script></body></html>';

    res.send(html);
  } catch(e) { res.status(500).send('Greska: '+e.message); }
});

app.use((err,req,res,next) => { console.error(err); res.status(500).json({error:err.message}); });

// ===== NALOZI (POST) =====
app.post('/api/nalozi', requireAdmin, async (req,res) => {
  try {
    const {guma_id,guma_sifra,guma_opis,guma_lokacija,guma_slika,napomena,hitno,za_slanje} = req.body;
    const r = await dbRun('INSERT INTO nalozi (guma_id,guma_sifra,guma_opis,guma_lokacija,guma_slika,napomena,hitno,za_slanje,kreirao) VALUES (?,?,?,?,?,?,?,?,?)',
      [guma_id, guma_sifra, guma_opis||'', guma_lokacija||'', guma_slika||'', napomena||'', hitno?1:0, za_slanje?1:0, req.user.username]);
    const nalog = await dbGet('SELECT * FROM nalozi WHERE id=?', [r.lastID]);
    let detTags=[]; if(hitno)detTags.push('HITNO'); if(za_slanje)detTags.push('ZA SLANJE');
    await logNalogEvent(r.lastID, guma_sifra, guma_opis||'', 'KREIRAN', req.user.username, [napomena, ...detTags].filter(Boolean).join(' · '));
    res.json(nalog);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/nalozi/:id/preuzmi', requireAuth, async (req,res) => {
  try {
    const nalog = await dbGet('SELECT * FROM nalozi WHERE id=?', [req.params.id]);
    await dbRun("UPDATE nalozi SET status='preuzeto',preuzeo=?,preuzeto_at=datetime('now') WHERE id=?",
      [req.user.username, req.params.id]);
    if(nalog) await logNalogEvent(nalog.id, nalog.guma_sifra, nalog.guma_opis, 'PREUZET', req.user.username, '');
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/nalozi/:id/spremi', requireAuth, async (req,res) => {
  try {
    const nalog = await dbGet('SELECT * FROM nalozi WHERE id=?', [req.params.id]);
    if(!nalog) return res.status(404).json({error:'Nalog ne postoji'});
    let polica = await dbGet('SELECT * FROM police WHERE naziv=?',['P599']);
    if(!polica){
      const anyRegal = await dbGet('SELECT id FROM regali LIMIT 1');
      const regalId = anyRegal ? anyRegal.id : null;
      if(regalId){
        await dbRun('INSERT INTO police (regal_id,naziv) VALUES (?,?)',[regalId,'P599']);
        polica = await dbGet('SELECT * FROM police WHERE naziv=?',['P599']);
      }
    }
    const staraGuma = await dbGet('SELECT sifra,polica_kod FROM gume WHERE id=?',[nalog.guma_id]);
    if(polica){
      await dbRun("UPDATE gume SET polica_id=?,polica_kod='P599' WHERE id=?", [polica.id, nalog.guma_id]);
    } else {
      await dbRun("UPDATE gume SET polica_kod='P599' WHERE id=?", [nalog.guma_id]);
    }
    await dbRun('INSERT INTO historija_premjestanja (guma_id,guma_sifra,polica_sa,polica_na,korisnik) VALUES (?,?,?,?,?)',
      [nalog.guma_id, staraGuma?.sifra||nalog.guma_sifra, staraGuma?.polica_kod||null, 'P599', req.user.username]);
    await logActivity(req.user.username, 'PREMJESTENA_GUMA', `${staraGuma?.sifra||nalog.guma_sifra}: ${staraGuma?.polica_kod||'—'} → P599 (nalog #${req.params.id})`);
    await dbRun("UPDATE nalozi SET status='zavrseno',zavrseno_at=datetime('now'),guma_lokacija='P599' WHERE id=?", [req.params.id]);
    await logNalogEvent(nalog.id, nalog.guma_sifra, nalog.guma_opis, 'SPREMLJENO', req.user.username, `Premješteno na P599 (sa ${staraGuma?.polica_kod||'—'})`);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/nalozi/:id/zavrsi', requireAuth, async (req,res) => {
  try {
    const nalog = await dbGet('SELECT * FROM nalozi WHERE id=?', [req.params.id]);
    if(!nalog) return res.json({ok:true});
    if(nalog.status==='zavrseno'){
      // Already finished by worker - admin is now archiving permanently
      await logNalogEvent(nalog.id, nalog.guma_sifra, nalog.guma_opis, 'ARHIVIRAN', req.user.username, `Zatvoreno bez prodaje (radnik: ${nalog.preuzeo||'—'})`);
      await dbRun('DELETE FROM nalozi WHERE id=?', [req.params.id]);
    } else {
      await dbRun("UPDATE nalozi SET status='zavrseno',zavrseno_at=datetime('now') WHERE id=?", [req.params.id]);
      await logNalogEvent(nalog.id, nalog.guma_sifra, nalog.guma_opis, 'ZAVRSENO', req.user.username, 'Zatvoreno bez premještanja');
    }
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});


// Start: init DB then listen


initDB().then(() => {
  app.listen(PORT, () => console.log('Auto Delic Gume na portu', PORT));
}).catch(err => {
  console.error('Greska pri inicijalizaciji baze:', err);
  console.error('Provjeri TURSO_URL i TURSO_TOKEN environment varijable!');
  process.exit(1);
});
