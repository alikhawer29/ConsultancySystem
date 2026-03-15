let bcryptjs = require("bcryptjs");

encryptData = async (text) => {
    try {
        let result = await bcryptjs.hash(text, 8);
        return result;
    } catch (error) {
        return error;
    }
};

comparePassword = async (text, hash) => {
    try {
        let result = await bcryptjs.compare(text, hash);
        return result;
    } catch (error) {
        return error;
    }
};

module.exports = {
    encryptData,
    comparePassword,
};