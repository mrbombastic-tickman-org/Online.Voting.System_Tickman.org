import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

// Helper to generate random Indian names
const firstNames = ['Aarav', 'Vihaan', 'Aditya', 'Sai', 'Arjun', 'Rohan', 'Ishaan', 'Kabir', 'Vivaan', 'Ansh', 'Diya', 'Saanvi', 'Ananya', 'Aadhya', 'Pari', 'Kavya', 'Meera', 'Riya', 'Ishita', 'Neha'];
const lastNames = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Patel', 'Reddy', 'Nair', 'Kumar', 'Mehta', 'Iyer', 'Joshi', 'Malhotra', 'Bhat', 'Desai', 'Chopra', 'Kapoor', 'Das', 'Roy', 'Sen', 'Pillai'];
const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara'];

function generateRandomRecord(index: number) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    // Generate valid-looking Aadhaar: 12 digits, spaced 4-4-4
    const p1 = 1000 + Math.floor(Math.random() * 8999);
    const p2 = 1000 + Math.floor(Math.random() * 8999);
    const p3 = 1000 + Math.floor(Math.random() * 8999);

    return {
        id: `gov-${2000 + index}`, // Start from gov-2000 to avoid conflict with gov-001
        fullName: `${firstName} ${lastName}`,
        dateOfBirth: `${1970 + Math.floor(Math.random() * 30)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`,
        documentNumber: `AADHAAR-${p1}-${p2}-${p3}`,
        address: `${Math.floor(Math.random() * 100) + 1}, Some Colony, ${city}`,
        photoUrl: `/gov-photos/citizen-${(index % 10) + 1}.jpg`, // Cycling through 10 placeholder images
    };
}

async function main() {
    console.log('Seeding database...');

    // Clear existing data
    await prisma.vote.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.election.deleteMany();
    await prisma.user.deleteMany();
    await prisma.governmentRecord.deleteMany();

    console.log('Cleared existing data.');

    // Generate 1000 dummy records (configurable)
    const RECORD_COUNT = 1000;
    const governmentRecords = [];
    // Add known test record
    governmentRecords.push({
        id: 'gov-001',
        fullName: 'Arjun Sharma',
        dateOfBirth: '1990-05-15',
        documentNumber: 'AADHAAR-1001-2001-3001',
        address: '42 MG Road, Pune, Maharashtra',
        photoUrl: '/gov-photos/citizen-1.jpg',
    });

    for (let i = 0; i < RECORD_COUNT; i++) {
        governmentRecords.push(generateRandomRecord(i));
    }

    // Seed government records in batches using createMany for efficiency
    await prisma.governmentRecord.createMany({ data: governmentRecords, skipDuplicates: true });
    console.log('Created ' + governmentRecords.length + ' government records');

    // Seed election
    const election = await prisma.election.create({
        data: {
            id: 'election-2026',
            title: 'General Election 2026',
            description: 'National General Election for the year 2026. Cast your vote for your preferred candidate.',
            startDate: new Date('2026-02-01'),
            endDate: new Date('2026-03-01'),
            isActive: true,
        },
    });
    console.log('Created election: ' + election.title);

    // Seed candidates
    const candidates = [
        { name: 'Rajesh Kumar', party: 'National Progress Party', symbol: '🌸', photoUrl: null },
        { name: 'Sunita Devi', party: "People's Alliance", symbol: '🌾', photoUrl: null },
        { name: 'Mohammed Faiz', party: 'Democratic Front', symbol: '⭐', photoUrl: null },
        { name: 'Lakshmi Narayanan', party: 'Unity Coalition', symbol: '🕊️', photoUrl: null },
    ];

    for (const candidate of candidates) {
        await prisma.candidate.create({
            data: {
                ...candidate,
                electionId: election.id,
            },
        });
    }
    console.log('Created ' + candidates.length + ' candidates');

    // Create admin user with strong password
    const adminRecord = governmentRecords[0];
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'SecureAdmin2026!@#';
    await prisma.user.create({
        data: {
            id: 'admin-user',
            email: 'admin@votesecure.in',
            passwordHash: hashSync(adminPassword, 12), // Higher bcrypt cost
            fullName: 'Admin User',
            documentNumber: adminRecord.documentNumber,
            verified: true,
            isAdmin: true, // Set admin flag
        },
    });
    console.log('Created admin user (admin@votesecure.in)');
    console.log('IMPORTANT: Change default admin password immediately after first login!');

    console.log('Seeding complete!');
    // Print 5 sample IDs for the user to try
    console.log('\n--- SAMPLE IDs TO TEST ---');
    governmentRecords.slice(0, 5).forEach(r => {
        console.log(`${r.fullName}: ${r.documentNumber}`);
    });
    console.log('--------------------------\n');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
