const { connectDB, sql } = require('./db');

(async () => {
    try {
        const pool = await connectDB();
        const result = await pool.request().query('SELECT * FROM users');
        console.log('Usuários encontrados:', result.recordset);
        pool.close();
    } catch (err) {
        console.error('Erro ao testar conexão:', err);
    }
})();
