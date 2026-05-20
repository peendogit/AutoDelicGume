const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

let publicPath = path.join(__dirname, 'public');
if (!fs.existsSync(publicPath)) publicPath = path.join(__dirname, 'Public');
if (!fs.existsSync(publicPath)) publicPath = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicPath)) publicPath = path.join(process.cwd(), 'Public');
app.use(express.static(publicPath));

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
  // Add auto_id link to troskovi_auta if missing
  try { await dbExec(`ALTER TABLE troskovi_auta ADD COLUMN auto_id INTEGER`); } catch(e) {}

  // KUPCI
  await dbExec(`
    CREATE TABLE IF NOT EXISTS kupci (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ime TEXT NOT NULL,
      telefon TEXT,
      napomena TEXT DEFAULT '',
      dodao_korisnik TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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

  // PONUDE / RAČUNI
  await dbExec(`
    CREATE TABLE IF NOT EXISTS ponude (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      broj TEXT NOT NULL UNIQUE,
      kupac_ime TEXT NOT NULL,
      kupac_adresa TEXT DEFAULT '',
      kupac_telefon TEXT,
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

  // Add columns if missing (for existing DBs)
  const alterCols = ['dodao_korisnik TEXT','prodao_korisnik TEXT','dubina TEXT','dot TEXT','cijena TEXT','tip TEXT'];
  for (const col of alterCols) {
    try { await dbExec(`ALTER TABLE gume ADD COLUMN ${col}`); } catch(e) {}
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
    const [korisnici,magacini,police,gume] = await Promise.all([
      dbAll('SELECT id,username,role,created_at FROM korisnici'),
      dbAll('SELECT * FROM magacini'),
      dbAll('SELECT * FROM police'),
      dbAll('SELECT * FROM gume'),
    ]);
    const prolazi = await dbAll('SELECT * FROM prolazi');
    const regali = await dbAll('SELECT * FROM regali');
    const counters = await dbAll('SELECT * FROM counters');
    const date = new Date().toISOString().slice(0,10);
    const backup = { exported_at: new Date().toISOString(), korisnici, magacini, prolazi, regali, police, gume, counters };
    res.setHeader('Content-Disposition', `attachment; filename="autodelic-backup-${date}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(backup, null, 2));
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
  const datum = new Date().toLocaleDateString('hr-HR');
  const cijenaTxt = cijena ? parseFloat(cijena).toLocaleString('hr-HR')+' KM' : null;
  await dbRun('UPDATE gume SET prodato=1,cijena_prodaje=?,datum_prodaje=?,prodao_korisnik=? WHERE id=?',
    [cijenaTxt,datum,req.user.username,req.params.id]);
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
      `SELECT substr(datum_prodaje,7,4)||'-'||substr(datum_prodaje,4,2) as mj,
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
    const [gumeStanje, gumeProdato, autaStanje, autaProdato,
           zadaciOtvoreni, troskoviAktivno,
           aktivnosti, zadnjeGume, zadnjaAuta] = await Promise.all([
      dbGet('SELECT COUNT(*) as c FROM gume WHERE prodato=0'),
      dbGet('SELECT COUNT(*) as c FROM gume WHERE prodato=1'),
      dbGet("SELECT COUNT(*) as c FROM auta WHERE status='na_stanju'"),
      dbGet("SELECT COUNT(*) as c FROM auta WHERE status='prodat'"),
      dbGet("SELECT COUNT(*) as c FROM zadaci WHERE status='otvoreno'"),
      dbGet('SELECT COUNT(*) as c FROM troskovi_auta'),
      dbAll('SELECT * FROM aktivnosti ORDER BY created_at DESC LIMIT 15'),
      dbAll('SELECT id,sifra,sezona,sirina,visina,promjer,polica_kod,created_at FROM gume ORDER BY created_at DESC LIMIT 5'),
      dbAll('SELECT id,sifra,marka,model,godiste,status,created_at FROM auta ORDER BY created_at DESC LIMIT 5'),
    ]);
    res.json({
      gume_stanje: gumeStanje?.c||0,
      gume_prodato: gumeProdato?.c||0,
      auta_stanje: autaStanje?.c||0,
      auta_prodato: autaProdato?.c||0,
      zadaci_otvoreno: zadaciOtvoreni?.c||0,
      troskovi_aktivno: troskoviAktivno?.c||0,
      aktivnosti,
      zadnje_gume: zadnjeGume,
      zadnja_auta: zadnjaAuta,
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
    const {marka,model,godiste,boja,km,motor,vin,napomena,slike,nabavna_cijena,prodajna_cijena,olx_link} = req.body;
    if(!marka||!model) return res.status(400).json({error:'Marka i model su obavezni'});
    const num = await nextCounter('au');
    const sifra = 'AU'+String(num).padStart(3,'0');
    await dbRun(`INSERT INTO auta (sifra,marka,model,godiste,boja,km,motor,vin,napomena,slike,nabavna_cijena,prodajna_cijena,olx_link,dodao_korisnik)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [sifra,marka,model,godiste||null,boja||null,km||null,motor||null,vin||null,napomena||'',
       JSON.stringify(slike||[]),nabavna_cijena||null,prodajna_cijena||null,olx_link||null,req.user.username]);
    const a = await dbGet('SELECT * FROM auta WHERE sifra=?',[sifra]);
    await logActivity(req.user.username,'DODANO_AUTO',`${a.sifra} — ${marka} ${model} ${godiste||''}`);
    res.json({...a, slike:JSON.parse(a.slike||'[]')});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/auta/:id', requireAuth, async (req,res) => {
  try {
    const {marka,model,godiste,boja,km,motor,vin,napomena,slike,nabavna_cijena,prodajna_cijena,olx_link,status} = req.body;
    // Log price change if prodajna_cijena changed
    const stari = await dbGet('SELECT prodajna_cijena FROM auta WHERE id=?',[req.params.id]);
    if (stari && stari.prodajna_cijena !== (prodajna_cijena||null)) {
      await dbRun('INSERT INTO cijena_historija (auto_id,stara_cijena,nova_cijena,korisnik) VALUES (?,?,?,?)',
        [req.params.id, stari.prodajna_cijena||null, prodajna_cijena||'0', req.user.username]);
    }
    await dbRun(`UPDATE auta SET marka=?,model=?,godiste=?,boja=?,km=?,motor=?,vin=?,napomena=?,slike=?,
      nabavna_cijena=?,prodajna_cijena=?,olx_link=?,status=? WHERE id=?`,
      [marka,model,godiste||null,boja||null,km||null,motor||null,vin||null,napomena||'',
       JSON.stringify(slike||[]),nabavna_cijena||null,prodajna_cijena||null,olx_link||null,status||'na_stanju',req.params.id]);
    const a = await dbGet('SELECT * FROM auta WHERE id=?',[req.params.id]);
    await logActivity(req.user.username,'EDITOVANO_AUTO',`${a.sifra} — ${a.marka} ${a.model}`);
    res.json({...a, slike:JSON.parse(a.slike||'[]')});
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
app.get('/api/katalog-auta', async (req,res) => {
  try {
    const auta = await dbAll("SELECT id,sifra,marka,model,godiste,boja,km,motor,napomena,slike,prodajna_cijena,olx_link FROM auta WHERE status='na_stanju' ORDER BY id DESC");
    res.json({auta: auta.map(a=>({...a, slike:JSON.parse(a.slike||'[]')}))});
  } catch(e) { res.status(500).json({error:e.message}); }
});

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
    const {ime,telefon,napomena} = req.body;
    if(!ime) return res.status(400).json({error:'Ime je obavezno'});
    const r = await dbRun('INSERT INTO kupci (ime,telefon,napomena,dodao_korisnik) VALUES (?,?,?,?)',
      [ime,telefon||'',napomena||'',req.user.username]);
    const k = await dbGet('SELECT * FROM kupci WHERE id=?',[r.lastID]);
    k.kupovine = [];
    res.json(k);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/kupci/:id', requireAdmin, async (req,res) => {
  try {
    const {ime,telefon,napomena} = req.body;
    await dbRun('UPDATE kupci SET ime=?,telefon=?,napomena=? WHERE id=?',[ime,telefon||'',napomena||'',req.params.id]);
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
    const {placeno} = req.body;
    await dbRun('UPDATE kupovine SET placeno=? WHERE id=?',[parseFloat(placeno)||0,req.params.kid]);
    res.json(await dbGet('SELECT * FROM kupovine WHERE id=?',[req.params.kid]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/kupci/:id/kupovina/:kid', requireAdmin, async (req,res) => {
  try { await dbRun('DELETE FROM kupovine WHERE id=?',[req.params.kid]); res.json({ok:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

// ===== CJENOVNIK =====
app.get('/api/cjenovnik', requireAdmin, async (req,res) => {
  try { res.json(await dbAll('SELECT * FROM cjenovnik ORDER BY dimenzija')); }
  catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/cjenovnik', requireAdmin, async (req,res) => {
  try {
    const {dimenzija,sezona,cijena_min,cijena_max,napomena} = req.body;
    if(!dimenzija) return res.status(400).json({error:'Dimenzija je obavezna'});
    const r = await dbRun('INSERT INTO cjenovnik (dimenzija,sezona,cijena_min,cijena_max,napomena) VALUES (?,?,?,?,?)',
      [dimenzija,sezona||'',parseFloat(cijena_min)||0,parseFloat(cijena_max)||0,napomena||'']);
    res.json(await dbGet('SELECT * FROM cjenovnik WHERE id=?',[r.lastID]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/cjenovnik/:id', requireAdmin, async (req,res) => {
  try {
    const {dimenzija,sezona,cijena_min,cijena_max,napomena} = req.body;
    await dbRun('UPDATE cjenovnik SET dimenzija=?,sezona=?,cijena_min=?,cijena_max=?,napomena=? WHERE id=?',
      [dimenzija,sezona||'',parseFloat(cijena_min)||0,parseFloat(cijena_max)||0,napomena||'',req.params.id]);
    res.json(await dbGet('SELECT * FROM cjenovnik WHERE id=?',[req.params.id]));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/cjenovnik/:id', requireAdmin, async (req,res) => {
  try { await dbRun('DELETE FROM cjenovnik WHERE id=?',[req.params.id]); res.json({ok:true}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

// ===== PONUDE / RAČUNI =====
app.get('/api/ponude', requireAdmin, async (req,res) => {
  try {
    const ponude = await dbAll('SELECT * FROM ponude ORDER BY created_at DESC');
    res.json(ponude.map(p=>({...p, stavke:JSON.parse(p.stavke||'[]')})));
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/ponude', requireAdmin, async (req,res) => {
  try {
    const {kupac_ime,kupac_adresa,kupac_telefon,stavke,napomena,pdv,rok_placanja,mjesto} = req.body;
    const year = new Date().getFullYear();
    const count = await dbGet('SELECT COUNT(*) as c FROM ponude WHERE broj LIKE ?',[year+'-%']);
    const broj = year+'-'+(String((count?.c||0)+1).padStart(3,'0'));
    const r = await dbRun(
      'INSERT INTO ponude (broj,kupac_ime,kupac_adresa,kupac_telefon,stavke,napomena,pdv,rok_placanja,mjesto,kreirao) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [broj,kupac_ime,kupac_adresa||'',kupac_telefon||'',JSON.stringify(stavke||[]),napomena||'',pdv?1:0,rok_placanja||'Avansno plaćanje',mjesto||'Bijeljina',req.user.username]);
    const p = await dbGet('SELECT * FROM ponude WHERE id=?',[r.lastID]);
    res.json({...p, stavke:JSON.parse(p.stavke||'[]')});
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
       FROM gume WHERE prodato=1 AND datum_prodaje >= ? ORDER BY datum_prodaje DESC`,
      [datumOd.slice(0,7) <= now.toISOString().slice(0,7) ? datumOd : '2000-01-01']);

    // Prihodi od auta
    const autaProdana = await dbAll(
      `SELECT sifra,marka,model,godiste,nabavna_cijena,prodajna_cijena,dodao_korisnik
       FROM auta WHERE status='prodat' ORDER BY id DESC`);

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
      troskoviOtpada,
      troskoviPopravke,
      gumeStanje: { count: gumeStanje?.c||0, vrijednost: gumeStanje?.ukupno||0 },
      autaStanje: { count: autaStanje?.c||0, vrijednost: autaStanje?.ukupno||0 },
      period: period||'sve',
    });
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

app.use((err,req,res,next) => { console.error(err); res.status(500).json({error:err.message}); });

// Start: init DB then listen
initDB().then(() => {
  app.listen(PORT, () => console.log('Auto Delic Gume na portu', PORT));
}).catch(err => {
  console.error('Greska pri inicijalizaciji baze:', err);
  console.error('Provjeri TURSO_URL i TURSO_TOKEN environment varijable!');
  process.exit(1);
});
