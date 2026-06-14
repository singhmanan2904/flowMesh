export const shipmentHeadersSchema = {
    $id: "shipmentHeadersSchema",
    type: "object",
    required: [],
}

export const shipmentParamsSchema = {
    $id: "shipmentParamsSchema",
    type: "object",
    required: ["orderId"],
    properties: {
        orderId: { type: "string" },
    },
};