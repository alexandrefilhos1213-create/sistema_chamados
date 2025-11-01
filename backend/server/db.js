require('dotenv').config();
const sql = require('mssql');

const config = {
    server: process.env.SQL_SERVER,
    port: parseInt(process.env.SQL_PORT, 10),
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: false, // true se usar Azure
        trustServerCertificate: true
    },
    pool: {
        max: 10,          // máximo de conexões no pool
        min: 0,           // mínimo de conexões
        idleTimeoutMillis: 30000
    }
};

let pool = null;

// Função para conectar ao banco (com pooling)
async function connectDB() {
    try {
        if (pool) {
            // Se já houver pool conectado, retorna ele
            return pool;
        }
        pool = await sql.connect(config);
        console.log('✅ Conectado ao SQL Server com sucesso!');
        return pool;
    } catch (err) {
        console.error('❌ Erro na conexão:', err);
        throw err;
    }
}

module.exports = { connectDB, sql };
