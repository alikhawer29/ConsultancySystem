var jwt = require("jsonwebtoken")

const generateToken = async (payload) => {
    try {
        let token = await jwt.sign(payload, process.env.JWT_SECRET_KEY)
        return token
    } catch (error) {
        throw new Error()
    }
};

const verifyToken = async (token) => {
    try {
        let result = await jwt.verify(token, process.env.JWT_SECRET_KEY)
        return result
    } catch (error) {
        throw new Error("Invalid Auth Token")
    }
};

module.exports = {
    generateToken,
    verifyToken,
};
