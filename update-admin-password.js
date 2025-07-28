import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from './shared/schema.js';
import { eq } from 'drizzle-orm';

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function updateAdminPassword() {
  try {
    // Connect to database
    const client = postgres(databaseUrl);
    const db = drizzle(client);

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

    // Close database connection
    await client.end();
    
  } catch (error) {
    console.error('❌ Error updating password:', error);
    process.exit(1);
  }
}

// Run the script
updateAdminPassword(); 