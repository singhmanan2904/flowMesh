import "dotenv/config";
import logger from "../logger/logger.js";
import { startServer } from "./server.js";

let server: Awaited<ReturnType<typeof startServer>> | undefined;

async function shutdown(signal: string) {
    logger.info({ signal }, "Shutting down API");
    if (server) {
        await server.close();
    }
    process.exit(0);
}

["SIGINT", "SIGTERM"].forEach((signal) => {
    process.on(signal, () => {
        shutdown(signal).catch((err) => {
            logger.error({ err }, "Shutdown failed");
            process.exit(1);
        });
    });
});

async function main() {
    server = await startServer();
}

main().catch((err) => {
    logger.error({ err }, "API failed to start");
    process.exit(1);
});
