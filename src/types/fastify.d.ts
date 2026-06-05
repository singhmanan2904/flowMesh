import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    rawBody?: Buffer | string;
  }
}