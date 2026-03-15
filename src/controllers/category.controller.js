const Category = require('../models/category.model')
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery, ROLES } = require('../utils')

const createCategory = (async (req, res) => {
    try {

        let { body, decoded } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let category = new Category(body)

        await category.save()

        return res.status(200).send({
            success: true,
            message: "Category Successfully Saved",
            data: category
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getCategory = (async (req, res) => {
    try {

        let { role } = req.decoded
        let { page, per_page, search, from, to, sortBy, active } = req.query

        let options = paginationHandler(page, per_page)

        let filter = {}
        let sort = {}
        let projection = {}

        if (search) {
            filter = { ...filter, name: getSearchQuery(search) }
        }

        if (role === ROLES.USER) {
            filter.active = true
        }

        if (req?.query?.hasOwnProperty("active")) {
            filter.active = active
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (sortBy) {
            sort = { [sortBy]: 1 }
        }

        let categories = await Category.find(filter, projection, options).sort(sort)

        let total = await Category.countDocuments(filter)

        return res.status(200).send({
            success: true,
            total,
            data: categories
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getCategoryById = (async (req, res) => {
    try {

        let { id } = req.params

        let category = await Category.findById(id)

        return res.status(200).send({
            success: true,
            data: category
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const updateCategory = (async (req, res) => {
    try {

        const { body, params } = req
        const { id } = params

        let category = await Category.findByIdAndUpdate(id, { $set: body }, { new: true })

        return res.status(200).send({
            success: true,
            message: "Category Updated Successfully",
            data: category
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const deleteCategory = (async (req, res) => {
    try {

        const { params } = req
        const { id } = params

        let category = await Category.findById(id)
        await category.trash()

        return res.status(200).send({
            success: true,
            message: "Category Deleted Successfully",
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getAllActiveCategories = (async (req, res) => {
    try {
        let categories = await Category.find({ active: true }).sort({ name: 1 })

        return res.status(200).send({
            success: true,
            data: categories
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
    createCategory,
    getCategory,
    getCategoryById,
    updateCategory,
    deleteCategory,
    getAllActiveCategories
}