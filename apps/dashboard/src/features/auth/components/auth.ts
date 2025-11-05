// packages/schemas/src/auth.ts
import { z } from 'zod';



// === Admin Login (email only) ===
export const AdminAuthLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
