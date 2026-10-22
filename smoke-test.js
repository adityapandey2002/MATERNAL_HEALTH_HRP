const http = require('http');

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(opts, (rs) => {
      let b = '';
      rs.on('data', (c) => (b += c));
      rs.on('end', () => resolve({ status: rs.statusCode, body: b, headers: rs.headers }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

const base = { hostname: '127.0.0.1', port: 3000 };
const json = { 'Content-Type': 'application/json' };

(async () => {
  const login = await req(
    { ...base, path: '/api/auth/login', method: 'POST', headers: json },
    JSON.stringify({ employeeId: 'CHO001', password: 'password123' })
  );
  console.log('LOGIN          ', login.status, login.body.slice(0, 80));

  const token = JSON.parse(login.body).accessToken;
  const auth = { ...json, Authorization: 'Bearer ' + token };

  const me = await req({ ...base, path: '/api/auth/me', method: 'GET', headers: auth });
  console.log('ME             ', me.status, me.body.slice(0, 110));

  for (const p of [
    '/api/patients',
    '/api/patients?riskLevel=RED&limit=5',
    '/api/patients?search=Rekha',
    '/api/visits',
    '/api/referrals',
    '/api/supervision/alerts',
    '/api/facilities',
  ]) {
    const r = await req({ ...base, path: p, method: 'GET', headers: auth });
    console.log(p.padEnd(38), r.status, r.body.slice(0, 150));
  }

  // validation must reject a bad payload
  const bad = await req(
    { ...base, path: '/api/patients', method: 'POST', headers: auth },
    JSON.stringify({ name: 'X' })
  );
  console.log('POST bad patient', bad.status, bad.body.slice(0, 160));

  // unauthenticated request must be rejected
  const noauth = await req({ ...base, path: '/api/patients', method: 'GET', headers: json });
  console.log('GET no auth     ', noauth.status, noauth.body.slice(0, 100));
})().catch((e) => console.error('FATAL', e));
