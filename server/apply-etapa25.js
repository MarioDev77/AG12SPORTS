'use strict';

// Adiciona integridade referencial às avaliações.
// Pré-valida órfãos e interrompe sem alterar o banco se encontrar dados
// inconsistentes. Desfazimento: remova as FKs e o índice idx_reviews_user_id.
const { getScriptConnection } = require('./scripts/db-connection');

async function run() {
  const conn = await getScriptConnection();
  try {
    const [[{ orphanProducts }]] = await conn.query(
      `SELECT COUNT(*) AS orphanProducts
       FROM reviews r LEFT JOIN products p ON p.id = r.product_id
       WHERE p.id IS NULL`
    );
    const [[{ orphanUsers }]] = await conn.query(
      `SELECT COUNT(*) AS orphanUsers
       FROM reviews r LEFT JOIN users u ON u.id = r.user_id
       WHERE r.user_id IS NOT NULL AND u.id IS NULL`
    );

    if (Number(orphanProducts) || Number(orphanUsers)) {
      throw new Error(
        `Migration cancelada: ${orphanProducts} avaliação(ões) sem produto e ${orphanUsers} sem usuário. Resolva os órfãos antes de tentar novamente.`
      );
    }

    const [indexes] = await conn.query(
      `SELECT 1 FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'reviews'
         AND index_name = 'idx_reviews_user_id' LIMIT 1`
    );
    if (!indexes.length) {
      await conn.query('ALTER TABLE reviews ADD INDEX idx_reviews_user_id (user_id)');
    }

    const [productFk] = await conn.query(
      `SELECT 1 FROM information_schema.referential_constraints
       WHERE constraint_schema = DATABASE() AND table_name = 'reviews'
         AND constraint_name = 'fk_reviews_product' LIMIT 1`
    );
    if (!productFk.length) {
      await conn.query(
        'ALTER TABLE reviews ADD CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT'
      );
    }

    const [userFk] = await conn.query(
      `SELECT 1 FROM information_schema.referential_constraints
       WHERE constraint_schema = DATABASE() AND table_name = 'reviews'
         AND constraint_name = 'fk_reviews_user' LIMIT 1`
    );
    if (!userFk.length) {
      await conn.query(
        'ALTER TABLE reviews ADD CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL'
      );
    }

    console.log('Etapa 25 aplicada: FKs de avaliações verificadas/adicionadas.');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error(`Etapa 25 não aplicada: ${err.message}`);
  process.exitCode = 1;
});
