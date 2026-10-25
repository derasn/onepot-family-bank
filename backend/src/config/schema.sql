-- OnePot Family Bank - MySQL Database Schema
-- Pooled Family Wallet, Envelope Budgeting (Bowls), and Role-Based Approval Workflow

CREATE DATABASE IF NOT EXISTS onepot_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE onepot_db;

-- 1. Users Table
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

-- 2. Families Table
CREATE TABLE IF NOT EXISTS families (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  invite_code VARCHAR(32) NOT NULL UNIQUE,
  currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
  pot_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  emergency_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  auto_save_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.0500, -- 5%
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Family Members Table (RBAC: Admin/Parent vs Member/Child)
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

-- 4. Bowls (Budget Buckets) Table
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

-- 5. Contributions Table
CREATE TABLE IF NOT EXISTS contributions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  family_id INT NOT NULL,
  user_id INT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  pot_amount DECIMAL(15, 2) NOT NULL,       -- 95% goes to pot
  auto_save_amount DECIMAL(15, 2) NOT NULL, -- 5% goes to emergency
  payment_method ENUM('paystack', 'bank_transfer', 'manual', 'simulated') DEFAULT 'paystack',
  reference VARCHAR(100) NOT NULL UNIQUE,
  status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
  note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Expenses Table
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

-- 7. Approvals Audit Trail Table
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

-- 8. Goals Table
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

-- 9. Paystack Transactions Table
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

-- 10. Mono Accounts Table (Sandbox Open Banking)
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

-- 11. Notifications Table
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

