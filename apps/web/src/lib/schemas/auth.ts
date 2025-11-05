import { z } from 'zod';

export const AuthRegisterSchema = z.object({
  name: z.string().trim().min(1, { message: 'Name is required' }),
  email: z.string().trim().min(6, { message: 'Email is required' }),
  password: z.string().trim().optional(),
  gender: z.enum(['male', 'female']),
  birthDate: z.date(),
});
