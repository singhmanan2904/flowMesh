import bcrypt from "bcryptjs";
import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { prisma } from "../../../lib/prismaClient.js";
import { authRegisterSchema } from "../../schema/auth.schema.js";

function authRouter(fastify: FastifyInstance) {
    fastify.addSchema(authRegisterSchema);

    fastify.post("/register", {
        schema: {
            body: {$ref: "authRegisterSchema"}
        },
        handler: async (request: FastifyRequest<{
            Body: {
                username: string,
                password: string
            }
        }>, reply: FastifyReply) => {
            try {
                const { username, password } = request.body;
                const hashedPassword = bcrypt.hashSync(password, 10);
                const user = await prisma.users.create({
                    data: {
                        username,
                        password: hashedPassword
                    }
                });
                const token = await jwt.sign({id: user.id}, process.env.SECRET_JWT || "", {expiresIn: "24h"});
                return reply.code(201).send({token});
            } catch (err) {
                fastify.log.error("Error while registering the user");
                return reply.code(403).send({message: "Error while registering the user", err});
            }
        }
    });

    fastify.post("/login", {
        schema: {
            body: {$ref: "authRegisterSchema"}
        }, 
        handler: async (request: FastifyRequest<{
            Body: {
                username: string,
                password: string
            },
            Headers: {
                authorization: string
            }
        }>, reply: FastifyReply) => {
            try {
            const { username, password } = request.body;
            const user = await prisma.users.findUnique({
                where: {
                    username
                }
            });
            if(!user) {
                return reply.code(401).send({message: "User not found!"});
            }
            const isMatched = bcrypt.compareSync(password, user.password);
            if(!isMatched) return {message: "Incorrect username or password!"};
            const token = jwt.sign({id: user.id}, process.env.SECRET_JWT || "", { expiresIn: "24h" });
            return {token};
            } catch (err) {
                fastify.log.error("Error while logging in the user");
                return reply.code(403).send({message: "Error while logging in the user", err});
            }
        }
    })
};

export default authRouter;