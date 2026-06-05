export const shipmentHeadersSchema = {
    $id: "shipmentHeadersSchema",
    type: "object",
    required: ["authorization"],
    properties: {
        authorization: {type: "string"},
    }
}

export const shipmentParamsSchema = {
    $id: "shipmentParamsSchema",
    type: "object",
    required: ["orderId"],
    properties: {
        orderId: { type: "string" },
    },
};