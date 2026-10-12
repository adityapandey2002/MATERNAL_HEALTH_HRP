import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { db } from '../db/client.js';
import { LoginSchema, RefreshTokenSchema } from '@hrp/shared';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/login', {
    schema: { body: LoginSchema },
  }, async (request, reply) => {
    const { employeeId, password } = request.body;

    const user = await db.selectFrom('users')
      .selectAll()
      .where('employee_id', '=', employeeId)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ message: 'Invalid credentials' });
    }

    const accessToken = app.jwt.sign({ sub: user.id, role: user.role, facilityId: user.facility_id });
    const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    const { password_hash, ...userWithoutPassword } = user;
    return { accessToken, refreshToken, user: userWithoutPassword };
  });

  app.post('/refresh', {
    schema: { body: RefreshTokenSchema },
  }, async (request, reply) => {
    const { refreshToken } = request.body;
    try {
      const decoded = app.jwt.verify<{ sub: string; type: string }>(refreshToken);
      if (decoded.type !== 'refresh') throw new Error('Invalid token type');

      const user = await db.selectFrom('users')
        .select(['id', 'employee_id', 'name', 'role', 'facility_id', 'language', 'is_active'])
        .where('id', '=', decoded.sub)
        .where('is_active', '=', true)
        .executeTakeFirst();

      if (!user) throw new Error('User not found');

      const newAccessToken = app.jwt.sign({ sub: user.id, role: user.role, facilityId: user.facility_id });
      const newRefreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });

      reply.setCookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch {
      return reply.code(401).send({ message: 'Invalid refresh token' });
    }
  });

  app.get('/me', { preHandler: [app.authenticate] }, async (request) => {
    const user = await db.selectFrom('users')
      .select(['id', 'employee_id', 'name', 'phone', 'role', 'facility_id', 'language', 'is_active', 'created_at', 'updated_at'])
      .where('id', '=', request.user.sub)
      .executeTakeFirstOrThrow();
    return user;
  });

  app.post('/logout', async (request, reply) => {
    reply.clearCookie('refreshToken', { path: '/' });
    return { message: 'Logged out' };
  });
};