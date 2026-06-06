import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createLogger } from "../logger/logger.js";

const log = createLogger("seed");

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const products = [
    { id: "prod-001", price: 29.99, imageUrl: "https://picsum.photos/id/1/400/400" },
    { id: "prod-002", price: 49.99, imageUrl: "https://picsum.photos/id/26/400/400" },
    { id: "prod-003", price: 19.99, imageUrl: "https://picsum.photos/id/60/400/400" },
    { id: "prod-004", price: 89.99, imageUrl: "https://picsum.photos/id/82/400/400" },
    { id: "prod-005", price: 14.99, imageUrl: "https://picsum.photos/id/96/400/400" },
    { id: "prod-006", price: 59.99, imageUrl: "https://picsum.photos/id/108/400/400" },
];

async function main() {
    log.info({ productCount: products.length }, "Seeding products");
    for (const product of products) {
        await prisma.product.upsert({
            where: { id: product.id },
            update: product,
            create: product,
        });
    }
    log.info({ productCount: products.length, productIds: products.map((p) => p.id) }, "Products seeded");
}

main()
    .catch((err) => {
        log.error({ err }, "Failed to seed products");
        process.exit(1);
    })
    .finally(async () => {
        log.info("Closing database connection");
        await prisma.$disconnect();
    });
