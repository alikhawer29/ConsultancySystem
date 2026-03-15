const mongoose = require('mongoose')
const mongooseLeanVirtuals = require('mongoose-lean-virtuals')
const dotenv = require('dotenv')

dotenv.config()

const categorySchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        normal: {
            type: Number,
            required: true
        },
        premium: {
            type: Number,
            required: true
        }
    },
    active: {
        type: Boolean,
        default: true
    },
    deleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },
    image: {
        type: String,
        required: true
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

categorySchema.plugin(mongooseLeanVirtuals)

categorySchema.pre(/^find/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false })
    } else {
        delete this.getFilter().deleted
    }
    next()
})

categorySchema.pre(/^count/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false })
    } else {
        delete this.getFilter().deleted
    }
    next()
})

categorySchema.methods.trash = async function () {
    this.deleted = true
    this.deletedAt = new Date()
    await this.save()
}

categorySchema.methods.restore = async function () {
    this.deleted = false
    this.deletedAt = null
    await this.save()
}

categorySchema.virtual('image_url').get(function () {

    console.log("Image :: ", this.image)
    if (!this.image) {
        return null
    }
    if (this.image.startsWith('http')) {
        return this.image
    }
    // Remove trailing slash from BASE_URL and add leading slash to path if needed
    const baseUrl = process.env.BASE_URL.replace(/\/$/, '')
    const path = this.image.startsWith('/') ? this.image : `/${this.image}`
    return `${baseUrl}${path}`
})

module.exports = mongoose.model('Category', categorySchema)