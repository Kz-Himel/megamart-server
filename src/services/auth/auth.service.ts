import { prisma } from '../../lib/prisma';
import { hashPassword, comparePassword } from '../../utils/password';
import { generateToken } from '../../utils/jwt';
import { z } from 'zod';
import { registerSchema, loginSchema } from './auth.validation';

export class AuthService {
  static async register(data: z.infer<typeof registerSchema>) {
    const validated = registerSchema.parse(data);

    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      const error: any = new Error('Email is already registered');
      error.statusCode = 409;
      throw error;
    }

    const hashedPassword = await hashPassword(validated.password);

    const user = await prisma.user.create({
      data: {
        name: validated.name,
        email: validated.email,
        password: hashedPassword,
        role: 'USER',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  static async login(data: z.infer<typeof loginSchema>) {
    const validated = loginSchema.parse(data);

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (!user || user.isDeleted) {
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isMatch = await comparePassword(validated.password, user.password);

    if (!isMatch) {
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }
}