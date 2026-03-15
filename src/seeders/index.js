// seeders/adminSeeder.js
const User = require("../models/user.model")
const { ROLES, AUTH_TYPES } = require("../utils")

const seedAdmin = async () => {

    const email = "admin.lynx@yopmail.com"

    const exists = await User.findOne({ email })

    if (!exists) {

        const admin = new User({
            first_name: "Admin",
            last_name: "Lynx",
            email,
            password: "Admin@123",
            country_code: "US",
            dialing_code: "+1",
            phone: "1231231231",
            role: ROLES.ADMIN,
            active: true,
            auth_provider: AUTH_TYPES.EMAIL,
        })

        await admin.save()
        console.log("Admin Seeder :: Admin created successfully!")

    }
}

module.exports = { seedAdmin }