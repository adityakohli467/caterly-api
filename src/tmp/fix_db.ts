
import { DataSource } from 'typeorm';

async function fixDb() {
    const dataSource = new DataSource({
        type: 'postgres',
        url: 'postgresql://postgres:z6r-miWc%2671d2R2Gwiyv@dev-new-global-caterly.cbaiaa2m4c7z.ap-southeast-2.rds.amazonaws.com:5432/caterly-db',
    });

    await dataSource.initialize();

    console.log('Adding info_description column to product table...');
    try {
        await dataSource.query(`
      ALTER TABLE product 
      ADD COLUMN IF NOT EXISTS info_description TEXT
    `);
        console.log('Column added successfully');
    } catch (error) {
        console.error('Error adding column:', error);
    }

    await dataSource.destroy();
}

fixDb().catch(console.error);
