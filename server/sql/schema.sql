CREATE DATABASE IF NOT EXISTS pitch_futebol CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pitch_futebol;

-- =============================================
-- TABELAS
-- =============================================

-- Users (cliente + admin)
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(80) NOT NULL,
  email VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  cpf_hash CHAR(64) NULL,
  phone VARCHAR(30) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_email (email),
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- Categorias
CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  image_url VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_categories_slug (slug),
  INDEX idx_categories_name (name)
) ENGINE=InnoDB;

-- Produtos
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  brand VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NULL,

  price DECIMAL(10,2) NOT NULL,
  old_price DECIMAL(10,2) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'BRL',

  image_url VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,

  sizes_json JSON NOT NULL,
  stock_qty INT UNSIGNED NOT NULL DEFAULT 0,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE RESTRICT,

  INDEX idx_products_category_id (category_id),
  INDEX idx_products_is_featured (is_featured),
  INDEX idx_products_is_active (is_active),
  INDEX idx_products_brand (brand)
) ENGINE=InnoDB;

-- =============================================
-- REVIEW (necessário para avaliações)
-- (você pediu avaliações; incluo aqui para o sistema ficar completo)
-- =============================================
CREATE TABLE IF NOT EXISTS reviews (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  name_snapshot VARCHAR(120) NULL,

  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NULL,

  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uk_reviews_product_user (product_id, user_id),
  INDEX idx_reviews_product_id (product_id),
  INDEX idx_reviews_user_id (user_id)
) ENGINE=InnoDB;

-- =============================================
-- Constraints de estoque (opcional)
-- =============================================
-- (We keep it simple; stock validations happen in services/transactions)

