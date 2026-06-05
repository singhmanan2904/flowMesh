import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../lib/prismaClient.js";

export const getShipmentController = async function (request: FastifyRequest<{
    Headers: {
        Authorization: string
    },
    Params: {
        orderId: string
    }
}>, reply: FastifyReply) {
    try {
        request.log.info(`GET request processing for shipments: ${request}`);
        const shipments = await prisma.shipment.findMany({
            where: { orderId: request.params.orderId }
        });
        request.log.info(`Shipments found: ${shipments}`);
        return reply.code(200).send({shipments});
    } catch (err) {
        request.log.info(`Error in getting shipments for: ${request}`);
        return reply.code(401).send({message: "could not get shipments for this user", error: (err as Error).message});
    }
}