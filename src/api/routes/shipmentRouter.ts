import type { FastifyInstance } from "fastify";
import { getShipmentController } from "../controllers/shipment.controller.js";
import { shipmentHeadersSchema, shipmentParamsSchema } from "../../schema/shipment.schema.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

function shipmentRouter (fastify: FastifyInstance) {
    fastify.addSchema(shipmentHeadersSchema);
    fastify.addSchema(shipmentParamsSchema);

    authMiddleware(fastify);

    fastify.get("/:orderId", {
        schema: {
            headers: {$ref: "shipmentHeadersSchema"},
            params: { $ref: "shipmentParamsSchema" },
        },
        handler: getShipmentController
    })
}

export default shipmentRouter;