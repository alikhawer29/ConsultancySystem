const Content = require('../models/content.model')
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery, ROLES, CONTENT_TYPES, normalize } = require('../utils')

const createContent = (async (req, res) => {
    try {

        let { body, files } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let payload = {
            ...body
        }

        const media = files?.media?.[0] || null
        const media_thumbnail = files?.media_thumbnail?.[0] || null

        if (media) {
            payload.media = normalize(media.path)
            payload.media_thumbnail = media_thumbnail ? normalize(media_thumbnail.path) : null
            payload.media_type = payload.type === CONTENT_TYPES.ARTICLE ? "image" : "video"
        }

        let content = new Content(payload)

        await content.save()

        return res.status(200).send({
            success: true,
            message: "Content Successfully Saved",
            data: content
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getContent = (async (req, res) => {
    try {

        let { role } = req.decoded
        let { page, per_page, search, from, to, sortBy, active, type } = req.query

        let options = paginationHandler(page, per_page)

        let filter = {}
        let sort = {}
        let projection = {}

        if (search) {
            filter = { ...filter, title: getSearchQuery(search) }
        }

        if (role === ROLES.USER) {
            filter.active = true
        }

        if (req?.query?.hasOwnProperty("active")) {
            filter.active = active
        }

        if (type) {
            filter.type = type
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (sortBy) {
            sort = { [sortBy]: 1 }
        }

        let contents = await Content.find(filter, projection, options).sort(sort)

        let total = await Content.countDocuments(filter)

        return res.status(200).send({
            success: true,
            total,
            data: contents
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getContentById = (async (req, res) => {
    try {

        let { id } = req.params

        let content = await Content.findById(id).lean({ virtuals: true })

        if (content?.type === CONTENT_TYPES.VIDEO) {

            const similar_content = await Content.find({
                _id: { $ne: content._id },
                type: content.type,
                active: true
            })
                .limit(5)
                .lean({ virtuals: true })

            content.similar_content = similar_content

        }

        return res.status(200).send({
            success: true,
            data: content
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const updateContent = (async (req, res) => {
    try {

        const { body, params } = req
        const { id } = params

        let content = await Content.findByIdAndUpdate(id, { $set: body }, { new: true })

        return res.status(200).send({
            success: true,
            message: "Content Updated Successfully",
            data: content
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const deleteContent = (async (req, res) => {
    try {

        const { params } = req
        const { id } = params

        let content = await Content.findById(id)
        await content.trash()

        return res.status(200).send({
            success: true,
            message: "Content Deleted Successfully",
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
    createContent,
    getContent,
    getContentById,
    updateContent,
    deleteContent
}