const mongoose = require("mongoose")
const mongooseLeanVirtuals = require('mongoose-lean-virtuals')
const dotenv = require('dotenv')

dotenv.config()

const serviceSchema = mongoose.Schema({
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        index: true
    },
    image: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
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
    service_type: {
        type: String,
        enum: ['provider_visits_user', 'user_visits_provider', 'both'],
        default: 'both'
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

serviceSchema.plugin(mongooseLeanVirtuals)

serviceSchema.pre(/^find/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false })
    } else {
        delete this.getFilter().deleted
    }
    next()
})

serviceSchema.pre(/^count/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false })
    } else {
        delete this.getFilter().deleted
    }
    next()
})

serviceSchema.methods.trash = async function () {
    this.deleted = true
    this.deletedAt = new Date()
    await this.save()
}

serviceSchema.methods.restore = async function () {
    this.deleted = false
    this.deletedAt = null
    await this.save()
}


serviceSchema.virtual('image_url').get(function () {
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


module.exports = mongoose.model("Service", serviceSchema)
