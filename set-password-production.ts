import 'dotenv/config';
import { db } from './server/db';
import { users } from './shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function setPassword() {
  const email = 'leonardoseibt@gmail.com';
  const password = 'Admin@123';
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db
      .update(users)
      .set({ passwordHash: hashedPassword })
      .where(eq(users.email, email))
      .returning({ email: users.email });
    
    if (result.length > 0) {
      console.log('✅ Password set successfully for:', result[0].email);
      console.log('   Email:', email);
      console.log('   Password:', password);
    } else {
      console.log('❌ User not found:', email);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

setPassword();
