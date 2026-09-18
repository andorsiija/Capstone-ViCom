-- ViCom database for XAMPP / MariaDB
-- Import this file in phpMyAdmin or run: mysql -u root < database.sql

CREATE DATABASE IF NOT EXISTS vicom_database
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE vicom_database;

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(150) NOT NULL,
  role ENUM('customer', 'artist') NOT NULL DEFAULT 'customer',
  specialty VARCHAR(150) NOT NULL DEFAULT '',
  profile_views INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB;

-- ─── ARTWORKS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artworks (
  id VARCHAR(64) NOT NULL,
  artist_id VARCHAR(64) NOT NULL,
  title VARCHAR(180) NOT NULL,
  detail VARCHAR(255) NOT NULL DEFAULT '',
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  category VARCHAR(80) NOT NULL,
  image LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_artworks_artist (artist_id),
  KEY idx_artworks_created (created_at),
  CONSTRAINT fk_artworks_artist
    FOREIGN KEY (artist_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── COMMISSIONS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commissions (
  id VARCHAR(64) NOT NULL,
  artist_id VARCHAR(64) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status ENUM('pending','active','done','declined') NOT NULL DEFAULT 'pending',
  current_stage TINYINT UNSIGNED NOT NULL DEFAULT 0,
  stage_status JSON NOT NULL DEFAULT (JSON_ARRAY(false,false,false,false,false)),
  client_approval JSON NOT NULL DEFAULT (JSON_ARRAY(false,false,false,false,false)),
  stage_data JSON NOT NULL DEFAULT (JSON_ARRAY()),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_comm_artist (artist_id),
  KEY idx_comm_client (client_id),
  KEY idx_comm_status (status),
  CONSTRAINT fk_comm_artist FOREIGN KEY (artist_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_comm_client FOREIGN KEY (client_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── COMMISSION MESSAGES (chat per commission) ──────────────────────────────
CREATE TABLE IF NOT EXISTS commission_messages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  commission_id VARCHAR(64) NOT NULL,
  sender_id VARCHAR(64) NOT NULL,
  sender_name VARCHAR(150) NOT NULL,
  sender_role ENUM('customer','artist') NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_msg_commission (commission_id),
  KEY idx_msg_sender (sender_id),
  KEY idx_msg_read (is_read),
  CONSTRAINT fk_msg_commission FOREIGN KEY (commission_id) REFERENCES commissions(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(64) NOT NULL,
  type ENUM('new_commission','commission_accepted','commission_declined','new_message','stage_submitted','stage_approved','revision_requested') NOT NULL,
  commission_id VARCHAR(64) DEFAULT NULL,
  text VARCHAR(255) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id),
  KEY idx_notif_read (is_read)
) ENGINE=InnoDB;

-- ─── DEMO DATA ────────────────────────────────────────────────────────────────
INSERT INTO users (id, email, password, name, role, specialty, created_at) VALUES
  ('user_1788850409831', 'harus@gmail.com', 'haruharu', 'harus', 'customer', '', '2026-09-08 06:53:29'),
  ('user_1788850810981', 'ron@gmail.com', 'ronron', 'ron', 'customer', '', '2026-09-08 07:00:10'),
  ('user_1788852100034', 'harurin@gmail.com', '123123', 'Haru Studio', 'artist', 'Character Portraits', '2026-09-08 07:21:40')
ON DUPLICATE KEY UPDATE email=VALUES(email), name=VALUES(name), role=VALUES(role), specialty=VALUES(specialty);

SELECT 'ViCom database ready' AS status;
SELECT id, email, name, role, specialty FROM users ORDER BY created_at;
