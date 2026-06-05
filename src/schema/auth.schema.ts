export const authRegisterSchema = {
    $id: "authRegisterSchema",
    type: "object",
    required: ["username", "password"],
    properties: {
        username: {type: "string"},
        password: {type: "string"}
    }
}