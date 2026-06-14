
export const orderBodySchema = {
    $id: "orderBodySchema",
    type: "object",
    required: ["products"],
    properties: {
        products: { type: "array", 
            items: {
                type: "string"
            }
        },
    }

}

export const orderHeadersSchema = {
    $id: "orderHeadersSchema",
    type: "object",
    required: [],
}