import { Prisma, UserRole } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createAccessToken } from '../../shared/security/token.js';
import { hashPassword, verifyPassword } from './password.js';

type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

export async function register(input: RegisterInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new AppError(409, 'Este e-mail já está cadastrado.');
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: UserRole.BIDDER,
        wallet: {
          create: {
            balanceInCents: 0n,
          },
        },
      },
      select: publicUserSelect,
    });

    return {
      user,
      accessToken: await createAccessToken(user.id),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'Este e-mail já está cadastrado.');
    }

    throw error;
  }
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError(401, 'E-mail ou senha inválidos.');
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
    accessToken: await createAccessToken(user.id),
  };
}
