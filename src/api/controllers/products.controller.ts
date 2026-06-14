import type { FastifyReply } from "fastify/types/reply.js";
import type { FastifyRequest } from "fastify/types/request.js";
import { prisma } from "../../../lib/prismaClient.js";

export async function getProductsController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const products = await prisma.product.findMany();
        request.log.info({ products }, "Products fetched successfully");
        return reply.code(200).send({ products });
    } catch (err) {
        request.log.error({ err }, "Failed to fetch products");
        return reply.code(500).send({ message: "Failed to fetch products" });
    }
}

export async function createProductController(request: FastifyRequest<{
    Body: {
        id: string;
        price: number;
        imageUrl: string;
    };
}>, reply: FastifyReply) {
    try {
        const { id, price, imageUrl } = request.body;
        const product = await prisma.product.create({
            data: { id, price, imageUrl },
        });
        request.log.info({ product }, "Product created successfully");
        return reply.code(201).send({ product });
    } catch (err) {
        request.log.error({ err }, "Failed to create product");
        return reply.code(500).send({ message: "Failed to create product" });
    }
}