import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);

    const result = await dataSource.query(`
    SELECT *
    FROM product
    WHERE product_id = 93
  `);

    console.log('Data for product 93:');
    console.log(JSON.stringify(result[0], null, 2));

    await app.close();
}

bootstrap().catch(err => {
    console.error(err);
    process.exit(1);
});
