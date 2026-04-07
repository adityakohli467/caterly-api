import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

async function describeTable() {
    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        synchronize: false,
    });

    try {
        await dataSource.initialize();
        const columns = await dataSource.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'orders'
        `);
        console.log(JSON.stringify(columns, null, 2));
    } finally {
        await dataSource.destroy();
    }
}

describeTable();
