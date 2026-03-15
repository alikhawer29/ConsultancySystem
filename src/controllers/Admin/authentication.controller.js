// authentication.controller.js
const User = require('../../models/user.model')
const Otp = require('../../models/otp.model')
const { comparePassword } = require('../../helpers/encryption')
const { generateToken } = require('../../helpers/token')
const { generateOTP, ERRORS, ROLES } = require('../../utils')
const { sendMail } = require("../../helpers/email")
const response = require('../../utils/response')
const ResponseHandler = require('../../utils/response')


const login = async (req, res) => {
    try {
        let { email, password, device_id, device_type, timezone } = req.body;

        if (!email || !password) {
            throw new Error(ERRORS.REQUIRED_FIELD);
        }

        let projection = { __v: 0, createdAt: 0, updatedAt: 0 };
        let userExist = await User.findOne({ email: email.toLowerCase() }, projection);

        if (!userExist) {
            throw new Error(ERRORS.INVALID_CREDENTIALS);
        }

        let validPassword = await comparePassword(password, userExist.password);

        if (!validPassword) {
            throw new Error(ERRORS.INVALID_CREDENTIALS);
        }

        let requestedUser = ROLES.ADMIN;

        if ((requestedUser !== userExist.role)) {
            throw new Error(ERRORS.UNAUTHORIZED);
        }

        // Update timezone if provided (for current location)
        if (timezone) {
            const moment = require('moment-timezone');
            try {
                // Validate timezone
                if (moment.tz.zone(timezone)) {
                    userExist.timezone = timezone;
                } else {
                    console.warn(`Invalid timezone provided: ${timezone}`);
                }
            } catch (error) {
                console.warn(`Error validating timezone: ${error.message}`);
            }
        }

        let token = await generateToken({
            id: userExist._id,
            email: userExist.email,
            role: userExist.role
        });

        // Handle device_id and device_type
        if (device_id) {
            // Initialize device_ids array if it doesn't exist
            if (!userExist.device_ids) {
                userExist.device_ids = []
            }

            // Add device_id to array if it doesn't already exist
            if (!userExist.device_ids.includes(device_id)) {
                userExist.device_ids.push(device_id)
            }
        }

        // Update device_type if provided
        if (device_type && ['ios', 'android', 'web'].includes(device_type)) {
            userExist.device_type = device_type
        }

        await userExist.save();

        // Prepare user data with only required fields
        let userData = {
            id: userExist._id,
            first_name: userExist.first_name,
            last_name: userExist.last_name,
            email: userExist.email,
            phone: userExist.phone,
            country_code: userExist.country_code,
            dialing_code: userExist.dialing_code || '+971',
            role: userExist.role,
            picture: userExist.picture,
            image_url: userExist.image_url || `http://localhost:5000/uploads/user/dummy.jpg`
        };

        return ResponseHandler.success(res, "Admin successfully logged in", {
            token: token,
            user: userData
        }, 200);

    } catch (e) {
        console.log("Error Message :: ", e);
        return ResponseHandler.error(res, e.message, 400);
    }
};

const forgetPassword = (async (req, res) => {
    try {

        let { email } = req.body

        if (!email) {
            throw new Error("Email is not provided")
        }

        let userExist = await User.findOne({ email }, { _id: 1, email: 1 })

        if (!userExist) {
            throw new Error(ERRORS.USER_NOTEXIST)
        }

        let otpExist = await Otp.findOne({ userId: userExist._id })

        if (otpExist) {
            await Otp.findByIdAndDelete(otpExist._id)
        }

        let otp = await generateOTP()
        let expiry = new Date()
        expiry.setHours(expiry.getHours() + 1)

        let payload = {
            otp,
            expiry,
            userId: userExist._id,
        }

        sendMail("noreply@lynxconsultancy.com", email, "Password Recovery - Lynx Consultancy", otp)

        let otpData = new Otp(payload)
        await otpData.save()

        return ResponseHandler.success(res, "Code has been sent to email.");

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
})

const verifyOtp = (async (req, res) => {
    try {

        let { email, otp } = req.body

        if (!email || !otp) {
            throw new Error("Email or OTP is not provided")
        }

        let userExist = await User.findOne({ email })

        if (!userExist) {
            throw new Error(ERRORS.USER_NOTEXIST)
        }

        let otpExist = await Otp.findOne({ userId: userExist._id })

        let now = new Date()

        if (now < otpExist.expiry) {

            if (otp == otpExist.otp) {

                return ResponseHandler.success(res, "OTP Verified", { email })
            } else {
                throw new Error("Invalid OTP")
            }

        } else {
            throw new Error("OTP has been expired")
        }

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
})

const resetPassword = (async (req, res) => {
    try {

        let { email, password } = req.body

        if (!email || !password) {
            throw new Error("Email or Password is not provided")
        }

        let userExist = await User.findOne({ email })

        if (!userExist) {
            throw new Error(ERRORS.USER_NOTEXIST)
        }

        await User.findOneAndUpdate({ _id: userExist._id }, { password })

        return ResponseHandler.success(res, "Password reset successfully");


    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
})

module.exports = {
    login,
    forgetPassword,
    verifyOtp,
    resetPassword
}
