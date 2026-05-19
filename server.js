const express = require('express');
const { createClient } = require('@libsql/client');
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

// Turso client
if (!process.env.TURSO_URL || !process.env.TURSO_TOKEN) {
  console.error('❌ TURSO_URL i TURSO_TOKEN moraju biti postavljeni kao environment varijable!');
  console.error('   Idi na Render → Environment i dodaj:');
  console.error('   TURSO_URL = libsql://ime-baze.turso.io');
  console.error('   TURSO_TOKEN = tvoj-token');
  process.exit(1);
}

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

// Turso returns rows as objects — wrap to match old sqlite3 interface
async function dbRun(sql, p=[]) {
  const r = await db.execute({sql, args:p});
  return { lastID: Number(r.lastInsertRowid), changes: r.rowsAffected };
}
async function dbGet(sql, p=[]) {
  const r = await db.execute({sql, args:p});
  return r.rows[0] || null;
}
async function dbAll(sql, p=[]) {
  const r = await db.execute({sql, args:p});
  return r.rows;
}
async function dbExec(sql) {
  // Execute multiple statements split by semicolon
  const stmts = sql.split(';').map(s=>s.trim()).filter(s=>s.length>0);
  for (const s of stmts) await db.execute(s);
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

    // Add prodao count separately to avoid correlated subquery issues
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
