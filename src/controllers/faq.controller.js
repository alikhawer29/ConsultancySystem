// controllers/faq.controller.js
const FAQ = require('../models/faq.model')
const fs = require('fs')
const path = require('path')

// Admin: Get all FAQs (without pagination/filters)
const getAdminFAQs = async (req, res) => {
    try {
        const faqs = await FAQ.find()
            .sort({ order: 1, createdAt: -1 })
            .exec()

        return res.status(200).send({
            success: true,
            data: faqs
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
}

// User: Get active FAQs
const getUserFAQs = async (req, res) => {
    try {
        const faqs = await FAQ.find({ is_active: true })
            .sort({ order: 1, createdAt: -1 })
            .select('-created_by -updatedAt -__v')
            .exec()

        return res.status(200).send({
            success: true,
            data: faqs
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
}

// Admin: Add FAQ with Form Data
const addFAQ = async (req, res) => {
    try {
        const { question, answer_type, answer_text, category, order } = req.body
        const created_by = req.decoded.id

        // Get uploaded files from your upload middleware
        const answer_image = req.files?.answer_image ? req.files.answer_image[0] : null
        const answer_video = req.files?.answer_video ? req.files.answer_video[0] : null

        // Validate required fields based on answer_type
        if (answer_type === 'text' && !answer_text) {
            return res.status(400).send({
                success: false,
                message: "Answer text is required for text type"
            })
        }

        if (answer_type === 'image' && !answer_image) {
            return res.status(400).send({
                success: false,
                message: "Answer image is required for image type"
            })
        }

        if (answer_type === 'video' && !answer_video) {
            return res.status(400).send({
                success: false,
                message: "Answer video is required for video type"
            })
        }

        // Prepare FAQ data
        const faqData = {
            question,
            answer_type,
            category: category || 'general',
            order: order || 0,
            created_by
        }

        // Handle answer content based on type
        if (answer_type === 'text') {
            faqData.answer_text = answer_text
        } else if (answer_type === 'image' && answer_image) {
            // Save image path - use just the filename, not full path
            faqData.answer_image = `faq/${answer_image.filename}`
        } else if (answer_type === 'video' && answer_video) {
            // Save video path - use just the filename, not full path
            faqData.answer_video = `faq/${answer_video.filename}`
        }

        const faq = new FAQ(faqData)
        await faq.save()

        const populatedFAQ = await FAQ.findById(faq._id)
            // .populate('created_by', 'first_name last_name email')
            .exec()

        return res.status(201).send({
            success: true,
            message: "FAQ added successfully",
            data: populatedFAQ
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
}

// Admin: Edit FAQ by ID with Form Data
const editFAQ = async (req, res) => {
    try {
        const { id } = req.params
        const { question, answer_type, answer_text, category, order, is_active } = req.body
        const answer_image = req.files?.answer_image ? req.files.answer_image[0] : null
        const answer_video = req.files?.answer_video ? req.files.answer_video[0] : null

        const faq = await FAQ.findById(id)
        if (!faq) {
            return res.status(404).send({
                success: false,
                message: "FAQ not found"
            })
        }

        // Prepare update data
        const updateData = {}
        if (question !== undefined) updateData.question = question
        if (answer_type !== undefined) updateData.answer_type = answer_type
        if (category !== undefined) updateData.category = category
        if (order !== undefined) updateData.order = order
        if (is_active !== undefined) updateData.is_active = is_active

        // Handle answer content based on type
        if (answer_type === 'text') {
            updateData.answer_text = answer_text
            updateData.answer_image = null // Explicitly set to null
            updateData.answer_video = null // Explicitly set to null

            // Delete old files if they exist
            deleteOldFiles(faq)

        } else if (answer_type === 'image') {
            if (answer_image) {
                updateData.answer_image = `faq/${answer_image.filename}`
                updateData.answer_text = null // Explicitly set to null
                updateData.answer_video = null // Explicitly set to null

                // Delete old files if they exist
                deleteOldFiles(faq)
            } else {
                // If no new image provided but type is image, keep existing image
                updateData.answer_text = null
                updateData.answer_video = null
            }
        } else if (answer_type === 'video') {
            if (answer_video) {
                updateData.answer_video = `faq/${answer_video.filename}`
                updateData.answer_text = null // Explicitly set to null
                updateData.answer_image = null // Explicitly set to null

                // Delete old files if they exist
                deleteOldFiles(faq)
            } else {
                // If no new video provided but type is video, keep existing video
                updateData.answer_text = null
                updateData.answer_image = null
            }
        }

        const updatedFAQ = await FAQ.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        )
            .exec()

        return res.status(200).send({
            success: true,
            message: "FAQ updated successfully",
            data: updatedFAQ
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
}

// Helper function to delete old files
const deleteOldFiles = (faq) => {
    const fs = require('fs')
    const path = require('path')

    // Delete old image file if exists
    if (faq.answer_image) {
        const oldImagePath = path.join(__dirname, '../uploads', faq.answer_image)
        if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath)
        }
    }

    // Delete old video file if exists
    if (faq.answer_video) {
        const oldVideoPath = path.join(__dirname, '../uploads', faq.answer_video)
        if (fs.existsSync(oldVideoPath)) {
            fs.unlinkSync(oldVideoPath)
        }
    }
}

// Admin: Delete FAQ by ID
const deleteFAQ = async (req, res) => {
    try {
        const { id } = req.params

        const faq = await FAQ.findById(id)
        if (!faq) {
            return res.status(404).send({
                success: false,
                message: "FAQ not found"
            })
        }

        // Delete associated files if they exist
        deleteOldFiles(faq)

        await FAQ.findByIdAndDelete(id)

        return res.status(200).send({
            success: true,
            message: "FAQ deleted successfully"
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
}

// Admin: Get FAQ by ID
const getFAQById = async (req, res) => {
    try {
        const { id } = req.params

        const faq = await FAQ.findById(id)
            // .populate('created_by', 'first_name last_name email')
            .exec()

        if (!faq) {
            return res.status(404).send({
                success: false,
                message: "FAQ not found"
            })
        }

        return res.status(200).send({
            success: true,
            data: faq
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
}

module.exports = {
    getAdminFAQs,
    getUserFAQs,
    addFAQ,
    editFAQ,
    deleteFAQ,
    getFAQById
}