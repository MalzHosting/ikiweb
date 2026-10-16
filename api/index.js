// Satu fungsi serverless untuk semua /api/*
const crypto = require('crypto');
const USER = process.env.ADMIN_USER || 'malzx';
const PASS = process.env.ADMIN_PASS || 'malzz098';
const SECRET = process.env.SESSION_SECRET || 'mz:' + PASS;
const RURL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RTOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const mem = {};

const DEF = {
  intro: 'Halo, saya MalzXploit, seorang programmer dari Cimahi, Jawa Barat. Saya membuat berbagai tools, API, dan website yang bermanfaat. Silakan lihat project dan produk saya di bawah.',
  about1: 'Saya seorang programmer yang berdomisili di Cimahi, Jawa Barat. Saya mengerjakan pengembangan aplikasi web, bot, dan API, serta senang mewujudkan ide menjadi produk yang dapat digunakan.',
  about2: 'Saya mengutamakan hasil yang sederhana, berfungsi dengan baik, dan mudah digunakan.',
  location: 'Cimahi, Jawa Barat',
  contact: 'Apabila Anda tertarik bekerja sama atau ingin berdiskusi, silakan hubungi saya melalui media sosial berikut.',
  instagram: 'malz_nothuman',
  telegram: 'm4lzfck',
  whatsapp: '62881011132277',
  skills: 'JavaScript, Python, PHP, HTML, CSS, Node.js, Express, React, Tailwind CSS, REST API, MySQL, MongoDB, Git & GitHub, Linux, Bash, Bot Telegram, Bot WhatsApp, Web Scraping, Deploy VPS'
};

async function kv(cmd) {
  const r = await fetch(RURL, { method: 'POST', headers: { Authorization: 'Bearer ' + RTOK }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('KV');
  return (await r.json()).result;
}
async function get(k, fallback) {
  if (!RURL) return k in mem ? mem[k] : fallback;
  const v = await kv(['GET', k]);
  return v ? JSON.parse(v) : fallback;
}
async function set(k, v) {
  if (!RURL) { if (process.env.VERCEL) throw new Error('NOSTORE'); mem[k] = v; return; }
  await kv(['SET', k, JSON.stringify(v)]);
}

const sign = t => crypto.createHmac('sha256', SECRET).update(t).digest('hex');
const makeToken = () => { const exp = String(Date.now() + 86400000); return exp + '.' + sign(exp); };
const authed = req => {
  const m = /(?:^|;\s*)sid=([\d]+\.[a-f0-9]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  const good = sign(exp);
  return Number(exp) > Date.now() && sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
};
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const clean = (s, n) => String(s || '').trim().slice(0, n);
const fails = {};

module.exports = async (req, res) => {
  const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };
  try {
    const p = (new URL(req.url, 'http://x').searchParams.get('p') || '').replace(/^\/+|\/+$/g, '');
    const [route, id] = p.split('/');
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0];

    if (route === 'me') return send(200, { ok: authed(req) });

    if (route === 'login' && req.method === 'POST') {
      const f = fails[ip] || { n: 0, t: 0 };
      if (f.n >= 5 && Date.now() - f.t < 600000) return send(429, { error: 'Terlalu banyak percobaan gagal. Silakan coba lagi dalam 10 menit.' });
      if (eq(body.username || '', USER) && eq(body.password || '', PASS)) {
        delete fails[ip];
        res.setHeader('Set-Cookie', `sid=${makeToken()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`);
        return send(200, { ok: true });
      }
      fails[ip] = { n: f.n + 1, t: Date.now() };
      return send(401, { error: 'Username atau password salah.' });
    }
    if (route === 'logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', 'sid=; HttpOnly; Secure; Path=/; Max-Age=0');
      return send(200, { ok: true });
    }

    if (route === 'settings') {
      if (req.method === 'GET') return send(200, Object.assign({}, DEF, await get('settings', {})));
      if (req.method === 'POST') {
        if (!authed(req)) return send(401, { error: 'Silakan login terlebih dahulu.' });
        const cur = Object.assign({}, DEF, await get('settings', {}));
        Object.keys(DEF).forEach(k => { if (typeof body[k] === 'string') cur[k] = clean(body[k], 500); });
        cur.instagram = cur.instagram.replace(/^@/, '').replace(/[^\w.]/g, '');
        cur.telegram = cur.telegram.replace(/^@/, '').replace(/[^\w]/g, '');
        cur.whatsapp = cur.whatsapp.replace(/\D/g, '');
        await set('settings', cur);
        return send(200, cur);
      }
    }

    if (route === 'projects') {
      if (req.method === 'GET') return send(200, await get('projects', []));
      if (!authed(req)) return send(401, { error: 'Silakan login terlebih dahulu.' });
      if (req.method === 'POST') {
        const item = { id: Date.now().toString(36), type: body.type === 'product' ? 'product' : 'project', name: clean(body.name, 80), desc: clean(body.desc, 300), link: clean(body.link, 300), tag: clean(body.tag, 20) };
        if (!item.name) return send(400, { error: 'Nama wajib diisi.' });
        if (item.link && !/^https?:\/\//i.test(item.link)) return send(400, { error: 'Link harus diawali http:// atau https://' });
        const list = await get('projects', []); list.unshift(item); await set('projects', list);
        return send(200, item);
      }
      if (req.method === 'DELETE' && id) {
        const list = (await get('projects', [])).filter(x => x.id !== decodeURIComponent(id));
        await set('projects', list);
        return send(200, { ok: true });
      }
    }
    return send(404, { error: 'Tidak ditemukan.' });
  } catch (e) {
    if (e.message === 'NOSTORE') return send(500, { error: 'Penyimpanan belum dipasang. Pasang Upstash Redis di tab Storage Vercel.' });
    return send(500, { error: 'Terjadi kesalahan pada server.' });
  }
};
