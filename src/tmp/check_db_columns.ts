import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);

    const result = await dataSource.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'product'
    ORDER BY column_name
  `);

    console.log('Columns in product table:');
    result.forEach(col => console.log(`- ${col.column_name} (${col.data_type})`));

    await app.close();
}

bootstrap().catch(err => {
    console.error(err);
    process.exit(1);
});
