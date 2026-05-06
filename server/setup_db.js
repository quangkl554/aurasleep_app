require('dotenv').config();
const mysql = require('mysql2/promise');

async function createDatabase() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
        });
        
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'aurasleep_db'}\`;`);
        console.log(`Database '${process.env.DB_NAME || 'aurasleep_db'}' created or already exists.`);
        
        await connection.end();
    } catch (error) {
        console.error("Error creating database:", error.message);
        console.log("Please make sure XAMPP MySQL is running.");
    }
}

createDatabase();
