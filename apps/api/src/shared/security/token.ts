import { SignJWT, jwtVerify } from 'jose';
import { env } from '../../config/env.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);

const issuer = 'auction-house-api';
const audience = 'auction-house-client';

export async function createAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret, {
    issuer,
    audience,
    algorithms: ['HS256'],
  });

  if (!payload.sub) {
    throw new Error('Token sem identificação de usuário.');
  }

  return payload.sub;
}
