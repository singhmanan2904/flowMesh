import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

export function authMiddleware(fastify: FastifyInstance) {
    fastify.decorateRequest("userId", "");
    fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { flowmesh_token } = request.cookies;
            const decode = jwt.verify(flowmesh_token || "", process.env.SECRET_JWT || "") as { id: string };
            if (!decode.id) {
                request.log.warn({ url: request.url, method: request.method }, "Auth rejected: missing user id in token");
                return reply.code(401).send({ message: "Invaild user!" });
            }
            request.userId = decode.id;
        } catch (err) {
            request.log.warn({ err, url: request.url, method: request.method }, "Auth rejected: invalid token");
            return reply.code(401).send({ message: "Invalid user!" });
        }
    });
}
