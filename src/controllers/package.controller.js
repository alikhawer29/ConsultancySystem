const { createProduct, getAllProductsWithPrices, createSubscription, getUserPaymentLogs, getAllPaymentLogs, getProductWithPrices, updateProduct } = require('../helpers/stripe')
const { ERRORS, objectValidator, ROLES } = require('../utils')

const createPackage = (async (req, res) => {
    try {

        let { body } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let { name, description, prices, no_of_employees } = body

        await createProduct(name, description, prices, { no_of_employees })

        return res.status(200).send({
            success: true,
            message: "Package Successfully Saved",
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getPackages = (async (req, res) => {

    try {

        let packages = await getAllProductsWithPrices()

        return res.status(200).send({
            success: true,
            data: packages
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getPackageById = (async (req, res) => {

    try {

        let { id } = req.params

        let package = await getProductWithPrices(id)

        return res.status(200).send({
            success: true,
            data: package
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const subscribe = (async (req, res) => {

    try {

        let { decoded, params } = req
        let { id } = params

        let url = await createSubscription(decoded.id, id)

        return res.status(200).send({
            success: true,
            message: "Successfully Generated Checkout Session",
            data: {
                url
            }
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getPaymentLogs = (async (req, res) => {

    try {

        let { id, role } = req.decoded

        let packages = []

        if (role === ROLES.ADMIN) {
            packages = await getAllPaymentLogs()
        } else {
            packages = await getUserPaymentLogs(id)
        }

        return res.status(200).send({
            success: true,
            data: packages
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const handleStatus = (async (req, res) => {
    try {

        let { body, params } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let update_payload = {}

        if (body?.status) {
            update_payload.status = body?.status
        }

        if (body?.hasOwnProperty("active")) {
            update_payload.active = body?.active
        }

        let product = await updateProduct(params?.id, update_payload)

        return res.status(200).send({
            success: true,
            message: "Package Successfully Updated",
            data: product
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
    createPackage,
    getPackages,
    getPackageById,
    subscribe,
    getPaymentLogs,
    handleStatus
}