import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { orderBodySchema, orderHeadersSchema } from "../../schema/order.schema.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { createOrderController, getOrderController } from "../controllers/order.controller.js";

function orderRoute (fastify: FastifyInstance) {
    // Schemas
    fastify.addSchema(orderBodySchema);
    fastify.addSchema(orderHeadersSchema);

    authMiddleware(fastify);

    fastify.get("/", {
        schema: {
            headers: {$ref: "orderHeadersSchema"},
        },
        handler: getOrderController
    })

    fastify.post("/", {
        schema: {
            body: {$ref: "orderBodySchema"},
            headers: {$ref: "orderHeadersSchema"},
        },
        handler: createOrderController
    });
}

export default orderRoute;