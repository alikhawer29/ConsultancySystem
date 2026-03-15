const jwt = require("jsonwebtoken")
const User = require('../models/user.model')
const Otp = require('../models/otp.model')
const Conversation = require('../models/conversation.model')
const { comparePassword } = require('../helpers/encryption')
const { generateToken } = require('../helpers/token')
const { generateOTP, ERRORS, ROLES, objectValidator, AUTH_TYPES, normalize } = require('../utils')
const { getCurrentSubscription } = require('../helpers/stripe')
const { sendMail } = require("../helpers/email")

const fs = require("fs");
const path = require("path");

const socialLogin = (async (req, res) => {
    try {

        let { access_token, type, source, device_id, device_type, timezone } = req.body

        if (!access_token || !type) {
            throw new Error(ERRORS.REQUIRED_FIELD)
        }

        let email = null, name = null, picture = null, sub = null

        if (type === AUTH_TYPES.GOOGLE) {

            const google_response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${access_token}`);
            const google_data = await google_response.json();

            if (google_data.error) {
                return res.status(401).json({ error: "Invalid Google Token" });
            }

            email = google_data?.email
            name = google_data?.name
            picture = google_data?.picture
            sub = google_data?.sub

        } else if (type === AUTH_TYPES.APPLE) {

            const decoded = jwt.decode(access_token, { complete: true });

            if (!decoded || !decoded.payload) {
                return res.status(401).json({ error: "Invalid Apple Token" });
            }

            email = decoded?.payload?.email
            sub = decoded?.payload?.sub
            name = decoded?.payload?.email.split("@")[0]

        }

        let projection = { __v: 0, password: 0, createdAt: 0, updatedAt: 0 }

        let userExist = await User.findOne({ provider_id: sub }, projection).populate([{ path: "manager" }])

        if (!userExist) {
            // Create new user with timezone if provided
            const userData = {
                name,
                email,
                picture,
                auth_provider: type,
                provider_id: sub
            };

            // Add timezone if provided
            if (timezone) {
                const moment = require('moment-timezone');
                try {
                    if (moment.tz.zone(timezone)) {
                        userData.timezone = timezone;
                    }
                } catch (error) {
                    console.warn(`Invalid timezone provided: ${timezone}`);
                }
            }

            userExist = await User.create(userData);
        } else {
            // Update timezone if provided (for existing user)
            if (timezone) {
                const moment = require('moment-timezone');
                try {
                    if (moment.tz.zone(timezone)) {
                        userExist.timezone = timezone;
                    }
                } catch (error) {
                    console.warn(`Invalid timezone provided: ${timezone}`);
                }
            }
        }

        let requested_user_role = source ? source : ROLES.MANAGER

        if ((requested_user_role !== userExist.role)) {
            throw new Error(ERRORS.UNAUTHORIZED)
        }

        if (!userExist.active) {
            throw new Error(ERRORS.BLOCKEDBY_ADMIN)
        }

        let token = await generateToken({ id: userExist._id, email: userExist.email, role: userExist.role })

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

        await userExist.save()

        let currentUser = { ...userExist._doc }

        let active_subscription = await getCurrentSubscription(currentUser._id)
        currentUser.active_subscription = active_subscription

        let conversation = await Conversation.findOne({ participants: { $in: [currentUser._id] } }).select("_id")
        currentUser.conversation = conversation._id

        return res.status(200).send({
            success: true,
            message: "User successfully logged in",
            token,
            data: currentUser
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const login = (async (req, res) => {
    try {

        let { email, password, source, device_id, device_type, timezone } = req.body

        if (!email || !password) {
            throw new Error(ERRORS.REQUIRED_FIELD)
        }

        let projection = { __v: 0, createdAt: 0, updatedAt: 0 }

        let userExist = await User.findOne({ email: email.toLowerCase() }, projection)

        if (!userExist) {
            throw new Error(ERRORS.INVALID_CREDENTIALS)
        }


        let validPassword = await comparePassword(password, userExist.password)

        if (!validPassword) {
            throw new Error(ERRORS.INVALID_CREDENTIALS)
        }

        let requestedUser = source ? source : ROLES.USER

        if ((requestedUser !== userExist.role)) {
            throw new Error(ERRORS.UNAUTHORIZED)
        }

        let activeUser = userExist.active


        if (userExist.role === ROLES.PROVIDER && !userExist.is_verified) {
            throw new Error("Your profile is pending admin approval");
        }

        if (!activeUser) {
            throw new Error(ERRORS.BLOCKEDBY_ADMIN)
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

        let token = await generateToken({ id: userExist._id, email: userExist.email, role: userExist.role })

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

        await userExist.save()

        let currentUser = { ...userExist._doc }

        delete currentUser.password

        // Add virtual fields for providers
        if (userExist.role === ROLES.PROVIDER) {
            currentUser.image_url = userExist.image_url
            currentUser.resume_url = userExist.resume_url
            currentUser.certifications_with_urls = userExist.certifications_with_urls
        } else {
            currentUser.image_url = userExist.image_url
        }

        let active_subscription = await getCurrentSubscription(currentUser._id)
        currentUser.active_subscription = active_subscription

        // if (currentUser.role !== ROLES.ADMIN) {
        //     let conversation = await Conversation.findOne({ participants: { $in: [currentUser._id] } }).select("_id")
        //     currentUser.conversation = conversation._id
        // }

        return res.status(200).send({
            success: true,
            message: "User successfully logged in",
            token,
            data: currentUser
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const signup = async (req, res) => {
    try {
        const { body, files } = req;
        const { email, role, device_id, device_type } = body;

        if (!objectValidator(body)) {
            throw new Error(ERRORS.NULL_FIELD);
        }

        const userExist = await User.findOne({ email }, { _id: 1 });
        if (userExist) {
            throw new Error(ERRORS.USER_EXIST);
        }

        const payload = { ...body };

        // Default role
        payload.role = role || ROLES.USER;

        // Validate and set timezone if provided
        if (body.timezone) {
            const moment = require('moment-timezone');
            try {
                // Validate timezone
                if (moment.tz.zone(body.timezone)) {
                    payload.timezone = body.timezone;
                } else {
                    console.warn(`Invalid timezone provided during signup: ${body.timezone}`);
                    // Will use default from model
                }
            } catch (error) {
                console.warn(`Error validating timezone during signup: ${error.message}`);
                // Will use default from model
            }
        }

        // ===============================
        // FILE MAP (IMPORTANT FIX)
        // ===============================
        const filesMap = {};
        if (Array.isArray(files)) {
            files.forEach(file => {
                filesMap[file.fieldname] = file;
            });
        }

        // ===============================
        // PROFILE IMAGE
        // ===============================
        if (filesMap.image) {
            payload.picture = filesMap.image.path.replace(/\\/g, '/');
        }

        // ===============================
        // PROVIDER LOGIC
        // ===============================
        if (payload.role === ROLES.PROVIDER) {

            // Resume
            if (filesMap.resume) {
                payload.resume = filesMap.resume.path.replace(/\\/g, '/');
            }

            // ===============================
            // CERTIFICATIONS
            // ===============================
            let certifications = [];

            // Parse certifications from JSON string
            let parsedCertifications = [];
            if (body.certifications) {
                try {
                    parsedCertifications = typeof body.certifications === 'string'
                        ? JSON.parse(body.certifications)
                        : body.certifications;
                } catch (e) {
                    console.error('Error parsing certifications JSON:', e);
                }
            }

            // Find all certification files
            const certFiles = files.filter(file =>
                file.fieldname.startsWith("certifications[") &&
                file.fieldname.includes("certificate_picture")
            );

            // Match files with parsed certification data
            parsedCertifications.forEach((cert, index) => {
                const certFile = certFiles.find(file =>
                    file.fieldname.includes(`[${index}]`)
                );

                if (certFile) {
                    // Rename file
                    const ext = path.extname(certFile.originalname);
                    const newFileName = `certifications_${index}_certificate_picture-${Date.now()}${ext}`;
                    const newPath = path.join("uploads/user", newFileName);

                    fs.renameSync(certFile.path, newPath);

                    certifications.push({
                        institution_name: cert.institution_name,
                        certificate_title: cert.certificate_title,
                        certificate_picture: newPath.replace(/\\/g, "/")
                    });
                }
            });

            if (!certifications.length) {
                throw new Error("Service providers must upload at least one certification");
            }

            payload.certifications = certifications;

            payload.is_verified = false;
            payload.active = false;
        }

        // ===============================
        // HANDLE DEVICE INFORMATION
        // ===============================
        if (device_id) {
            payload.device_ids = [device_id]; // Initialize with first device
        }

        if (device_type && ['ios', 'android', 'web'].includes(device_type)) {
            payload.device_type = device_type;
        }

        // ===============================
        // SAVE USER
        // ===============================
        const user = new User(payload);
        await user.save();

        return res.status(200).json({
            success: true,
            message:
                payload.role === ROLES.PROVIDER
                    ? "Service Provider registered successfully. Awaiting admin approval."
                    : "User registered successfully"
        });

    } catch (error) {
        console.error("Signup Error:", error);
        return res.status(400).json({
            success: false,
            message: error.message
        });
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

        return res.status(200).send({
            success: true,
            message: `Code has been sent to email.`,
            data: req.body
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
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

                return res.status(200).send({
                    success: true,
                    message: "OTP Verified",
                    data: { email }
                })

            } else {
                throw new Error("Invalid OTP")
            }

        } else {
            throw new Error("OTP has been expired")
        }

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
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

        return res.status(200).send({
            success: true,
            message: "Password reset successfully"
        })


    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

module.exports = {
    login,
    socialLogin,
    signup,
    forgetPassword,
    verifyOtp,
    resetPassword
}
