import type { FastifyInstance } from "fastify/types/instance.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { createProductController, getProductsController } from "../controllers/products.controller.js";
import { productBodySchema } from "../../schema/product.schema.js";

export function productsRouter(fastify: FastifyInstance) { 
    fastify.addSchema(productBodySchema);
    authMiddleware(fastify);

    fastify.get("/", {
        handler: getProductsController,
    });

    fastify.post("/", {
        handler: createProductController,
    });
}