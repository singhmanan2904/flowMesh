export const productBodySchema = {
    $id: "productBodySchema",
    type: "object",
    required: ["id", "price", "imageUrl"],
    properties: {
        id: { type: "string" },
        price: { type: "number" },
        imageUrl: { type: "string" },
    },
}