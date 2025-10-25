import 'dotenv/config';
import { db } from './server/db';
import { users } from './shared/schema';
import { eq } from 'drizzle-orm';

async function verifyEmail() {
  const email = 'leonardoseibt@gmail.com';
  
  try {
    const result = await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.email, email))
      .returning({ email: users.email, emailVerified: users.emailVerified });
    
    if (result.length > 0) {
      console.log('✅ Email verified successfully for:', result[0].email);
      console.log('   Email verified:', result[0].emailVerified);
    } else {
      console.log('❌ User not found:', email);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

verifyEmail();
