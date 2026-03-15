const { getIO } = require('../helpers/socket')
const Conversation = require('../models/conversation.model')
const Message = require('../models/message.model')
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery, ROLES } = require('../utils')

const createConversation = (async (req, res) => {
    try {

        let { decoded, body } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let conversation = null

        conversation = await Conversation.findOne({ participants: { $all: [decoded.id, body.user] } })

        if (!conversation) {
            conversation = new Conversation({ participants: [decoded.id, body.user] })
            await conversation.save()
        }

        return res.status(200).send({
            success: true,
            message: "Conversation Successfully Saved",
            data: conversation
        })


    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getConversation = (async (req, res) => {
    try {

        let { query, decoded } = req
        let { page, per_page, search, from, to, sortBy } = query

        let options = paginationHandler(page, per_page)

        let filter = {
            participants: { $in: [decoded.id] }
        }
        let sort = {}
        let projection = {}

        if (search) {
            filter = { ...filter, name: getSearchQuery(search) }
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (sortBy) {
            sort = { [sortBy]: 1 }
        }

        let conversations = await Conversation.find(filter, projection, options).populate("participants last_message").sort(sort)

        let total = await Conversation.countDocuments(filter)

        return res.status(200).send({
            success: true,
            total,
            data: conversations
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getConversationById = (async (req, res) => {
    try {

        let { id } = req.params

        console.log("CONVO ID", id)

        let conversation = await Conversation.findById(id).lean()
        let messages = await Message.find({ conversation: id }).populate("sender").sort({ createdAt: -1 }).lean()

        conversation.messages = messages || []

        return res.status(200).send({
            success: true,
            data: conversation
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const sendMessage = (async (req, res) => {
    try {

        let { decoded, body } = req

        let conversation = await Conversation.findOne({ _id: body?.conversation, participants: { $in: [decoded.id] } })

        if (!conversation) {
            throw new Error("Invalid Conversation")
        }

        if (decoded.role === ROLES.USER && body?.message !== "Acknowledged") {
            throw new Error("Invalid Message")
        }

        let payload = {
            ...body,
            sender: decoded.id
        }

        let message = new Message(payload)
        await message.save()

        getIO()?.to(body?.conversation).emit("message", message);

        conversation.last_message = message._id
        await conversation.save()

        return res.status(200).send({
            success: true,
            data: conversation
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
    createConversation,
    getConversation,
    getConversationById,
    sendMessage
}