import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

const TOTAL_GOV_RECORDS = 10_000;
const ADMIN_EMAIL = 'mayu@gmail.com';
const ADMIN_PASSWORD = 'mayu123';
const ADMIN_NAME = 'Mayu Admin';

const firstNames = [
    'Aarav', 'Vihaan', 'Aditya', 'Sai', 'Arjun', 'Rohan', 'Ishaan', 'Kabir', 'Vivaan', 'Ansh',
    'Diya', 'Saanvi', 'Ananya', 'Aadhya', 'Pari', 'Kavya', 'Meera', 'Riya', 'Ishita', 'Neha',
];
const lastNames = [
    'Sharma', 'Verma', 'Gupta', 'Singh', 'Patel', 'Reddy', 'Nair', 'Kumar', 'Mehta', 'Iyer',
    'Joshi', 'Malhotra', 'Bhat', 'Desai', 'Chopra', 'Kapoor', 'Das', 'Roy', 'Sen', 'Pillai',
];
const cities = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Surat',
    'Pune', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal',
    'Visakhapatnam', 'Patna', 'Vadodara', 'Mysore',
];

function aadhaarFromIndex(index: number): string {
    // Guaranteed unique 12-digit number for each index.
    const value = (1_000_000_000_000 + index).toString().slice(-12);
    return `AADHAAR-${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`;
}

function generateRandomRecord(index: number) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];

    const year = 1970 + Math.floor(Math.random() * 30);
    const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
    const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');

    return {
        id: `gov-${index}`,
        fullName: `${firstName} ${lastName}`,
        dateOfBirth: `${year}-${month}-${day}`,
        documentNumber: aadhaarFromIndex(index),
        address: `${Math.floor(Math.random() * 300) + 1}, Some Colony, ${city}`,
        photoUrl: `/gov-photos/citizen-${(index % 10) + 1}.jpg`,
    };
}

async function main() {
    console.log('Resetting and seeding database...');

    await prisma.$transaction([
        prisma.vote.deleteMany(),
        prisma.candidate.deleteMany(),
        prisma.election.deleteMany(),
        prisma.session.deleteMany(),
        prisma.user.deleteMany(),
        prisma.governmentRecord.deleteMany(),
    ]);
    console.log('Deleted existing data.');

    const governmentRecords: Array<{
        id: string;
        fullName: string;
        dateOfBirth: string;
        documentNumber: string;
        address: string;
        photoUrl: string;
    }> = [];

    const adminGovRecord = {
        id: 'gov-admin',
        fullName: ADMIN_NAME,
        dateOfBirth: '1995-01-15',
        documentNumber: aadhaarFromIndex(0),
        address: '1 Admin Street, Pune',
        photoUrl: '/gov-photos/citizen-1.jpg',
    };
    governmentRecords.push(adminGovRecord);

    for (let i = 1; i < TOTAL_GOV_RECORDS; i++) {
        governmentRecords.push(generateRandomRecord(i));
    }

    await prisma.governmentRecord.createMany({
        data: governmentRecords,
        skipDuplicates: false,
    });
    console.log(`Created ${governmentRecords.length} government records.`);

    await prisma.user.create({
        data: {
            email: ADMIN_EMAIL,
            passwordHash: hashSync(ADMIN_PASSWORD, 12),
            fullName: ADMIN_NAME,
            documentNumber: adminGovRecord.documentNumber,
            verified: true,
            isAdmin: true,
        },
    });

    console.log(`Created admin user: ${ADMIN_EMAIL}`);
    console.log('Seed complete.');
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
