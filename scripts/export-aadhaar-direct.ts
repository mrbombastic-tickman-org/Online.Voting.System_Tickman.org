
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log('🔄 Connecting to database (Direct PG)...');

    // Use the connection string from env, ensure SSL is enabled
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        console.log('❌ DATABASE_URL is missing in .env');
        return;
    }

    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false } // Relaxed SSL for script
    });

    try {
        await client.connect();
        console.log('✅ Connected.');

        const res = await client.query('SELECT * FROM "GovernmentRecord"');
        const records = res.rows;

        console.log(`✅ Found ${records.length} Aadhaar records.`);

        if (records.length === 0) {
            console.log('⚠️ No records found to export.');
        } else {
            const outputPath = path.join(process.cwd(), 'aadhaar_records.json');
            fs.writeFileSync(outputPath, JSON.stringify(records, null, 2));
            console.log(`📂 Data exported successfully to: ${outputPath}`);
        }

    } catch (error) {
        console.error('❌ Error exporting records:', error);
    } finally {
        await client.end();
    }
}

main();
