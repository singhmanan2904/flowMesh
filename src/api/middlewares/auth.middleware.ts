import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

export function authMiddleware (fastify: FastifyInstance) {
    fastify.decorateRequest("userId", "");
    fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
        const { authorization } = request.headers;
        const decode = jwt.verify(authorization || "", process.env.SECRET_JWT || "") as {id: string};
        if(!decode.id) return reply.code(401).send({message: "Invaild user!"});
        request.userId = decode.id;
        } catch (err) {
            return reply.code(401).send({ message: "Invalid user!" });
        }
    });
}