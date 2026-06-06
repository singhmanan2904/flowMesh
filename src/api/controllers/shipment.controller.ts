import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../lib/prismaClient.js";

export const getShipmentController = async function (
    request: FastifyRequest<{
        Headers: {
            Authorization: string;
        };
        Params: {
            orderId: string;
        };
    }>,
    reply: FastifyReply
) {
    const { orderId } = request.params;
    const { userId } = request;

    try {
        request.log.info({ userId, orderId }, "Fetching shipments for order");
        const shipments = await prisma.shipment.findMany({
            where: { orderId },
        });
        request.log.info({ userId, orderId, shipmentCount: shipments.length }, "Shipments fetched");
        return reply.code(200).send({ shipments });
    } catch (err) {
        request.log.error({ err, userId, orderId }, "Failed to fetch shipments");
        return reply.code(401).send({ message: "could not get shipments for this user", error: (err as Error).message });
    }
};
