const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  multipleStatements: true
};

const DB_NAME = process.env.DB_NAME || 'onepot_db';

const DEFAULT_BOWLS = [
  { name: 'House Rent', category: 'housing', target: 200000, allocated: 150000, spent: 50000, color: '#3B82F6', icon: 'home', priority: 1 },
  { name: 'Food & Groceries', category: 'food', target: 150000, allocated: 120000, spent: 75000, color: '#10B981', icon: 'shopping-cart', priority: 2 },
  { name: 'School Fees', category: 'education', target: 100000, allocated: 80000, spent: 0, color: '#8B5CF6', icon: 'academic-cap', priority: 3 },
  { name: 'Utilities & Bills', category: 'utilities', target: 40000, allocated: 35000, spent: 25000, color: '#F59E0B', icon: 'bolt', priority: 4 },
  { name: 'Healthcare & Meds', category: 'health', target: 30000, allocated: 25000, spent: 5000, color: '#EF4444', icon: 'heart', priority: 5 },
  { name: 'Travel & Transport', category: 'transport', target: 30000, allocated: 20000, spent: 10000, color: '#06B6D4', icon: 'truck', priority: 6 },
  { name: 'Emergency Fund', category: 'emergency', target: 100000, allocated: 50000, spent: 0, color: '#EC4899', icon: 'shield-check', priority: 7, is_locked: true }
];

async function initializeDatabase() {
  let rootConn;
  try {
    console.log(`[DB Init] Connecting to MySQL server at ${dbConfig.host}:${dbConfig.port}...`);
    rootConn = await mysql.createConnection(dbConfig);
    
    // 1. Create Database if not exists
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log(`[DB Init] Database "${DB_NAME}" confirmed.`);
    await rootConn.end();

    // 2. Connect to target database
    const conn = await mysql.createConnection({
      ...dbConfig,
      database: DB_NAME
    });

    // 3. Create Tables
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(30) NULL,
        role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
        avatar_url VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS families (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        invite_code VARCHAR(32) NOT NULL UNIQUE,
        currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
        pot_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        emergency_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        auto_save_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.0500,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS family_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
        relationship VARCHAR(50) DEFAULT 'family_member',
        bank_name VARCHAR(100) NULL,
        account_number_masked VARCHAR(20) NULL,
        mono_account_id VARCHAR(100) NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_family_user (family_id, user_id),
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS bowls (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        category VARCHAR(50) DEFAULT 'general',
        target_budget DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        allocated_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        spent_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        is_locked BOOLEAN NOT NULL DEFAULT FALSE,
        is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
        icon VARCHAR(50) DEFAULT 'folder',
        color VARCHAR(20) DEFAULT '#3B82F6',
        priority INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS contributions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        user_id INT NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        pot_amount DECIMAL(15, 2) NOT NULL,
        auto_save_amount DECIMAL(15, 2) NOT NULL,
        payment_method ENUM('paystack', 'bank_transfer', 'manual', 'simulated') DEFAULT 'paystack',
        reference VARCHAR(100) NOT NULL UNIQUE,
        status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
        note VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        bowl_id INT NULL,
        user_id INT NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        title VARCHAR(150) NOT NULL,
        description TEXT NULL,
        receipt_url VARCHAR(255) NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        rejection_reason TEXT NULL,
        approved_by INT NULL,
        approved_at TIMESTAMP NULL,
        is_emergency_borrow BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
        FOREIGN KEY (bowl_id) REFERENCES bowls(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS approvals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        entity_type ENUM('expense', 'emergency_borrow', 'goal_unlock') NOT NULL,
        entity_id INT NOT NULL,
        requested_by INT NOT NULL,
        approver_id INT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        comments TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
        FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS goals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        created_by INT NOT NULL,
        title VARCHAR(150) NOT NULL,
        description TEXT NULL,
        target_amount DECIMAL(15, 2) NOT NULL,
        current_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        deadline DATE NULL,
        image_url VARCHAR(255) NULL,
        status ENUM('in_progress', 'achieved', 'cancelled', 'disbursed') DEFAULT 'in_progress',
        is_locked BOOLEAN NOT NULL DEFAULT TRUE,
        unlocked_by_admin1 INT NULL,
        unlocked_by_admin2 INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (unlocked_by_admin1) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (unlocked_by_admin2) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS paystack_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        user_id INT NOT NULL,
        reference VARCHAR(100) NOT NULL UNIQUE,
        amount DECIMAL(15, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'NGN',
        type ENUM('contribution', 'goal_topup', 'simulated') DEFAULT 'contribution',
        status ENUM('pending', 'success', 'failed', 'abandoned') DEFAULT 'pending',
        channel VARCHAR(50) DEFAULT 'card',
        paid_at TIMESTAMP NULL,
        gateway_response VARCHAR(255) NULL,
        metadata JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS mono_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        user_id INT NOT NULL,
        mono_account_id VARCHAR(100) NOT NULL UNIQUE,
        institution_name VARCHAR(100) NOT NULL,
        account_name VARCHAR(150) NOT NULL,
        account_number_masked VARCHAR(30) NOT NULL,
        account_type VARCHAR(50) DEFAULT 'SAVINGS',
        balance DECIMAL(15, 2) DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT 'NGN',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        user_id INT NOT NULL,
        type ENUM('expense_request', 'expense_decision', 'contribution', 'threshold_alert', 'goal_milestone', 'emergency_alert', 'system') NOT NULL,
        title VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        metadata JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('[DB Init] All tables created or verified.');

    // 4. Seed initial mock demonstration data if empty
    const [userCount] = await conn.query('SELECT COUNT(*) as cnt FROM users;');
    if (userCount[0].cnt === 0) {
      console.log('[DB Init] Seeding initial demonstration family and users...');
      const defaultPasswordHash = await bcrypt.hash('password123', 10);

      // Seed Dad
      const [dadResult] = await conn.query(
        'INSERT INTO users (name, email, password_hash, phone, role, avatar_url) VALUES (?, ?, ?, ?, ?, ?)',
        ['Adeola Adeleke (Dad)', 'dad@onepot.local', defaultPasswordHash, '+2348011223344', 'admin', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Adeola']
      );
      const dadId = dadResult.insertId;

      // Seed Mum
      const [mumResult] = await conn.query(
        'INSERT INTO users (name, email, password_hash, phone, role, avatar_url) VALUES (?, ?, ?, ?, ?, ?)',
        ['Chioma Adeleke (Mum)', 'mum@onepot.local', defaultPasswordHash, '+2348022334455', 'admin', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chioma']
      );
      const mumId = mumResult.insertId;

      // Seed Child 1
      const [tobiResult] = await conn.query(
        'INSERT INTO users (name, email, password_hash, phone, role, avatar_url) VALUES (?, ?, ?, ?, ?, ?)',
        ['Tobi Adeleke', 'tobi@onepot.local', defaultPasswordHash, '+2348033445566', 'member', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tobi']
      );
      const tobiId = tobiResult.insertId;

      // Seed Child 2
      const [zainabResult] = await conn.query(
        'INSERT INTO users (name, email, password_hash, phone, role, avatar_url) VALUES (?, ?, ?, ?, ?, ?)',
        ['Zainab Adeleke', 'zainab@onepot.local', defaultPasswordHash, '+2348044556677', 'member', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zainab']
      );
      const zainabId = zainabResult.insertId;

      // Create Adeleke Family Pot
      const [famResult] = await conn.query(
        'INSERT INTO families (name, invite_code, currency, pot_balance, emergency_balance, auto_save_rate, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['Adeleke Family Pot', 'ONEPOT-ADELEKE', 'NGN', 250000.00, 50000.00, 0.05, dadId]
      );
      const familyId = famResult.insertId;

      // Add Family Members
      await conn.query(
        `INSERT INTO family_members (family_id, user_id, role, relationship, bank_name, account_number_masked) VALUES
          (?, ?, 'admin', 'Father', 'Access Bank', '****1234'),
          (?, ?, 'admin', 'Mother', 'GTBank', '****5678'),
          (?, ?, 'member', 'Son', 'Kuda Bank', '****9012'),
          (?, ?, 'member', 'Daughter', 'Zenith Bank', '****3456')`,
        [familyId, dadId, familyId, mumId, familyId, tobiId, familyId, zainabId]
      );

      // Add Default Bowls
      for (const b of DEFAULT_BOWLS) {
        await conn.query(
          `INSERT INTO bowls (family_id, name, description, category, target_budget, allocated_amount, spent_amount, is_locked, is_system_default, icon, color, priority)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            familyId,
            b.name,
            `Budget bowl for ${b.name}`,
            b.category,
            b.target,
            b.allocated,
            b.spent,
            b.is_locked ? 1 : 0,
            1,
            b.icon,
            b.color,
            b.priority
          ]
        );
      }

      // Add Initial Contributions
      await conn.query(
        `INSERT INTO contributions (family_id, user_id, amount, pot_amount, auto_save_amount, payment_method, reference, status, note) VALUES
          (?, ?, 200000.00, 190000.00, 10000.00, 'paystack', 'REF-INIT-DAD-200K', 'success', 'Monthly family contribution from Dad'),
          (?, ?, 100000.00, 95000.00, 5000.00, 'paystack', 'REF-INIT-MUM-100K', 'success', 'Monthly grocery & pantry contribution from Mum'),
          (?, ?, 20000.00, 19000.00, 1000.00, 'simulated', 'REF-INIT-TOBI-20K', 'success', 'Allowance contribution from Tobi')`,
        [familyId, dadId, familyId, mumId, familyId, tobiId]
      );

      // Get Food Bowl id
      const [foodBowl] = await conn.query('SELECT id FROM bowls WHERE family_id = ? AND category = "food" LIMIT 1', [familyId]);
      const foodBowlId = foodBowl.length > 0 ? foodBowl[0].id : null;

      // Seed Expenses (Approved & Pending)
      if (foodBowlId) {
        await conn.query(
          `INSERT INTO expenses (family_id, bowl_id, user_id, amount, title, description, status, approved_by, approved_at) VALUES
            (?, ?, ?, 25000.00, 'Weekend Supermarket Shopping', 'Groceries, vegetables and provisions', 'approved', ?, NOW())`,
          [familyId, foodBowlId, mumId, dadId]
        );

        await conn.query(
          `INSERT INTO expenses (family_id, bowl_id, user_id, amount, title, description, status) VALUES
            (?, ?, ?, 8500.00, 'Calculus & Physics Textbooks', 'Prescribed textbooks for the new school semester', 'pending')`,
          [familyId, foodBowlId, tobiId]
        );
      }

      // Seed Family Goal
      await conn.query(
        `INSERT INTO goals (family_id, created_by, title, description, target_amount, current_amount, deadline, is_locked) VALUES
          (?, ?, 'December Family Holiday Trip', 'Trip to Obudu Cattle Ranch / Calabar Festival', 400000.00, 180000.00, '2026-12-20', 1)`,
        [familyId, mumId]
      );

      // Seed Welcome Notification
      await conn.query(
        `INSERT INTO notifications (family_id, user_id, type, title, message) VALUES
          (?, ?, 'system', 'Welcome to OnePot', 'Your Adeleke Family Pot is live! Everyone can pool, plan into bowls, and spend transparently.')`,
        [familyId, dadId]
      );

      console.log('[DB Init] Sample demonstration seed completed successfully!');
    } else {
      console.log(`[DB Init] Database already contains ${userCount[0].cnt} users. Skipping seed.`);
    }

    await conn.end();
    return true;
  } catch (error) {
    console.error('[DB Init Error]:', error.message);
    if (rootConn) await rootConn.end();
    throw error;
  }
}

if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('[DB Init] Database initialization complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[DB Init Failed]:', err);
      process.exit(1);
    });
}

module.exports = {
  initializeDatabase,
  DEFAULT_BOWLS
};

