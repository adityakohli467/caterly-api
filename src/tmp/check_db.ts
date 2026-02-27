
import { DataSource } from 'typeorm';

async function checkDb() {
    const dataSource = new DataSource({
        type: 'postgres',
        url: 'postgresql://postgres:z6r-miWc%2671d2R2Gwiyv@dev-new-global-caterly.cbaiaa2m4c7z.ap-southeast-2.rds.amazonaws.com:5432/caterly-db',
    });

    await dataSource.initialize();

    const columns = await dataSource.query(`
    SELECT column_name
    FROM information_schema.columns 
    WHERE table_name = 'product'
    ORDER BY column_name
  `);

    console.log('COLUMNS_START');
    columns.forEach(c => console.log(c.column_name));
    console.log('COLUMNS_END');

    await dataSource.destroy();
}

checkDb().catch(console.error);
