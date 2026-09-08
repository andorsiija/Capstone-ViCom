-- ViCom database for XAMPP / MariaDB
-- Import this file in phpMyAdmin.
-- The current front end still uses localStorage; connect it to these tables through PHP next.

CREATE DATABASE IF NOT EXISTS vicom_database
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE vicom_database;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(150) NOT NULL,
  role ENUM('customer', 'artist') NOT NULL DEFAULT 'customer',
  specialty VARCHAR(150) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB;

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
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO users (id, email, password, name, role, specialty, created_at)
VALUES
  ('user_1788850409831', 'harus@gmail.com', 'haruharu', 'harus', 'customer', '', '2026-09-08 06:53:29'),
  ('user_1788850810981', 'ron@gmail.com', 'ronron', 'ron', 'customer', '', '2026-09-08 07:00:10'),
  ('user_1788852100034', 'harurin@gmail.com', '123123', 'Haru Studio', 'artist', 'Character Portraits', '2026-09-08 07:21:40')
  
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  password = VALUES(password),
  name = VALUES(name),
  role = VALUES(role),
  specialty = VALUES(specialty);

-- Add artwork rows after importing their image data from database.json.
-- The image column stores the current base64 data URL format used by the demo.

SELECT 'ViCom database ready' AS status;
SELECT id, email, name, role, specialty FROM users ORDER BY created_at;
SELECT COUNT(*) AS artwork_count FROM artworks;
