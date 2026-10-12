import fastify from 'fastify';
import cors from 'fastify-cors';
import jwt from 'fastify-jwt';
import { db } from './db/client.js';
import { authRoutes } from './routes/auth.js';
import { patientRoutes } from './routes/patients.js';
import { visitRoutes } from './routes/visits.js';
import { referralRoutes } from './routes/referrals.js';
import { facilityRoutes } from './routes/facilities.js';
import { syncRoutes } from './routes/sync.js';
import { supervisionRoutes } from './routes/supervision.js';
import { queueRoutes } from './routes/queue.js';

const app = fastify({ logger: true });

app.register(cors, {
  origin: true,
  credentials: true,
});

app.register(jwt, {
  secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  cookie: { cookieName: 'refreshToken', signed: false },
  sign: { expiresIn: '15m' },
});

app.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

app.register(authRoutes, { prefix: '/api/auth' });
app.register(patientRoutes, { prefix: '/api/patients' });
app.register(visitRoutes, { prefix: '/api/visits' });
app.register(referralRoutes, { prefix: '/api/referrals' });
app.register(facilityRoutes, { prefix: '/api/facilities' });
app.register(syncRoutes, { prefix: '/api/sync' });
app.register(supervisionRoutes, { prefix: '/api/supervision' });
app.register(queueRoutes, { prefix: '/api/queue' });

const start = async () => {
  try {
    await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
    console.log(`Server running on port ${process.env.PORT || 3000}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();