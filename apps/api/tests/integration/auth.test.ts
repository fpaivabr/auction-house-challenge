import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { app } from '../../src/app.js';
import { prisma } from '../../src/shared/database/prisma.js';

const testEmail = `auth-test-${crypto.randomUUID()}@example.com`;
const password = 'SenhaTeste123!';

afterAll(async () => {
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { email: testEmail },
        select: { id: true },
      });

      if (!user) {
        return;
      }

      await tx.wallet.deleteMany({
        where: { userId: user.id },
      });

      await tx.user.delete({
        where: { id: user.id },
      });
    });
  } finally {
    await prisma.$disconnect();
  }
});

describe('Authentication API', () => {
  it('should register a bidder', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Cliente Teste',
      email: testEmail,
      password,
    });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('BIDDER');
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.accessToken).toBeDefined();
  });

  it('should reject duplicate registrations', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Cliente Duplicado',
      email: testEmail,
      password,
    });

    expect(response.status).toBe(409);
  });

  it('should reject role escalation during registration', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Leiloeiro Indevido',
      email: 'invalid-role@example.com',
      password,
      role: 'AUCTIONEER',
    });

    expect(response.status).toBe(400);
  });

  it('should authenticate with valid credentials', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password,
    });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeDefined();
  });

  it('should reject an incorrect password', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'SenhaIncorreta123!',
    });

    expect(response.status).toBe(401);
  });

  it('should reject unauthenticated access', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
  });

  it('should reject an invalid JWT', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });
});
