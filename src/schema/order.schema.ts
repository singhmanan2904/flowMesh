
export const orderBodySchema = {
    $id: "orderBodySchema",
    type: "object",
    required: ["products", "totalAmount"],
    properties: {
        products: { type: "array", 
            items: {
                type: "string"
            }
        },
        totalAmount: {type: "number"},
    }

}

export const orderHeadersSchema = {
    $id: "orderHeadersSchema",
    type: "object",
    required: ["authorization"],
    properties: {
        authorization: {type: "string"},
    }

}