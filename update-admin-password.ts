import bcrypt from 'bcryptjs';
import { users } from '@shared/schema';
import { db } from './server/db';
import { eq } from 'drizzle-orm';

async function updateAdminPassword() {
  try {
    console.log('🔍 Looking for admin user...');

    // Find admin user
    const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
    
    if (adminUsers.length === 0) {
      console.error('❌ No admin user found');
      process.exit(1);
    }

    if (adminUsers.length > 1) {
      console.log('⚠️  Multiple admin users found:');
      adminUsers.forEach(user => {
        console.log(`   - ID: ${user.id}, Username: ${user.username}, Email: ${user.email}`);
      });
      console.log('   Using the first admin user...');
    }

    const adminUser = adminUsers[0];
    console.log(`✅ Found admin user: ${adminUser.username} (ID: ${adminUser.id})`);

    // Hash the new password
    console.log('🔐 Hashing new password...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);

    // Update the password
    console.log('💾 Updating password in database...');
    const updatedUser = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, adminUser.id))
      .returning();

    if (updatedUser.length === 0) {
      console.error('❌ Failed to update password');
      process.exit(1);
    }

    console.log('✅ Password updated successfully!');
    console.log(`   Username: ${adminUser.username}`);
    console.log(`   New Password: admin123`);
    console.log('   You can now log in with these credentials.');
    
  } catch (error) {
    console.error('❌ Error updating password:', error);
    process.exit(1);
  }
}

// Run the script
updateAdminPassword().then(() => {
  console.log('🏁 Script completed.');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
}); 