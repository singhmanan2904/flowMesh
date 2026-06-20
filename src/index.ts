import "dotenv/config";
import logger from "../logger/logger.js";
import { paymentWorker } from "./workers/paymentWorker.js";
import { shipmentWorker } from "./workers/shipmentWorker.js";
import { startServer } from "./server.js";

// Render deploys a single web service with no separate worker process, so BullMQ
// workers run alongside the API in one Node process. Split into a dedicated worker
// service when using a vps or cloud provider.

let server: Awaited<ReturnType<typeof startServer>> | undefined;

async function shutdown(signal: string) {
    logger.info({ signal }, "Shutting down");
    await Promise.all([paymentWorker.close(), shipmentWorker.close()]);
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
    logger.info("BullMQ workers started (payment, shipment)");
}

main().catch((err) => {
    logger.error({ err }, "Application failed to start");
    process.exit(1);
});
