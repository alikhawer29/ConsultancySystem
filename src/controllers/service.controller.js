const mongoose = require('mongoose')
const dotenv = require('dotenv')
const Service = require('../models/service.model')
const Review = require('../models/user.model')
const User = require('../models/user.model')
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery, ROLES, normalize } = require('../utils')

dotenv.config()

const createService = (async (req, res) => {
    try {

        let { body, decoded, file } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let payload = {
            ...body,
            user: decoded.id,
            image: file ? normalize(file.path) : null
        }

        let service = new Service(payload)

        await service.save()

        return res.status(200).send({
            success: true,
            message: "Service Successfully Saved",
            data: service
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getService = (async (req, res) => {
    try {

        let { decoded, query } = req
        let { page, per_page, search, from, to, sortBy, categories } = query

        let options = paginationHandler(page, per_page)

        let filter = {}
        let sort = {
            createdAt: -1
        }
        let projection = {
            reviews: 0,
            user_favorite: 0
        }

        if (search) {
            filter = { ...filter, name: getSearchQuery(search) }
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (sortBy) {
            sort = { [sortBy]: 1 }
        }

        if (categories) {
            let categoryIds = [];
            if (Array.isArray(categories)) {
                categoryIds = categories;
            } else if (typeof categories === 'string') {
                categoryIds = categories.split(',');
            }
            if (categoryIds.length > 0) {
                filter.category = { $in: categoryIds.map(item => new mongoose.Types.ObjectId(item)) };
            }
        }

        let pipeline = [
            {
                $match: filter
            },
            // {
            //     $lookup: {
            //         from: "reviews",
            //         localField: "_id",
            //         foreignField: "service",
            //         as: "reviews"
            //     }
            // },
            // {
            //     $addFields: {
            //         rating: {
            //             $avg: "$reviews.rating"
            //         }
            //     }
            // },
            {
                $lookup: {
                    from: "categories",
                    localField: "category",
                    foreignField: "_id",
                    as: "category"
                }
            },
            {
                $unwind: {
                    path: "$category",
                    preserveNullAndEmptyArrays: true
                }
            }
        ]

        if (decoded?.id) {
            pipeline.push(
                {
                    $lookup: {
                        from: "users",
                        let: { service_id: "$_id" },
                        pipeline: [
                            {
                                $match: { _id: new mongoose.Types.ObjectId(decoded.id) }
                            },
                            {
                                $project: {
                                    _id: 0,
                                    is_favorite: { $in: ["$$service_id", "$favorite_services"] }
                                }
                            }
                        ],
                        as: "user_favorite"
                    }
                },
                {
                    $addFields: {
                        is_favorite: { $arrayElemAt: ["$user_favorite.is_favorite", 0] }
                    }
                }
            )
        } else {
            pipeline.push({
                $addFields: { is_favorite: false }
            })
        }

        pipeline.push({
            $project: projection
        }, {
            $sort: sort
        })

        if (options?.skip) {
            pipeline.push({ $skip: options.skip })
        }

        if (options?.limit) {
            pipeline.push({ $limit: options.limit })
        }

        pipeline.push({
            $addFields: {
                image_url: {
                    $cond: {
                        if: { $regexMatch: { input: "$image", regex: /^http/ } },
                        then: "$image",
                        else: { $concat: [process.env.BASE_URL, "$image"] }
                    }
                }
            }
        })

        const services = await Service.aggregate(pipeline);

        let total = await Service.countDocuments(filter)

        return res.status(200).send({
            success: true,
            total,
            data: services
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})



const getServiceById = async (req, res) => {
    try {
        const { id } = req.params;

        const service = await Service.findById(id)
            .populate([{ path: "category", select: "name price" }])
            .lean({ virtuals: true });

        if (!service) {
            return res.status(404).send({
                success: false,
                message: "Service not found"
            });
        }

        // Get reviews for this service
        const Review = require('../models/review.model');
        const reviews = await Review.find({ service: id })
            .populate({ path: 'user', select: 'first_name last_name email picture' })
            .select('rating review createdAt')
            .sort({ createdAt: -1 })
            .lean({ virtuals: true });

        service.reviews = reviews;

        // Calculate average rating and review count
        const review_count = reviews.length;
        let avg_rating = 0;

        if (review_count > 0) {
            avg_rating = reviews.reduce((sum, review) => sum + review.rating, 0) / review_count;
            avg_rating = parseFloat(avg_rating.toFixed(1));
        }

        service.review_count = review_count;
        service.avg_rating = avg_rating;

        return res.status(200).send({
            success: true,
            data: service
        });

    } catch (error) {
        console.error("Error Message :: ", error);
        return res.status(500).send({
            success: false,
            message: error.message || "Internal server error"
        });
    }
};


const updateService = (async (req, res) => {
    try {

        const { body, params } = req
        const { id } = params

        let service = await Service.findByIdAndUpdate(id, { $set: body }, { new: true })

        return res.status(200).send({
            success: true,
            message: "Service Updated Successfully",
            data: service
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const deleteService = (async (req, res) => {
    try {

        const { params } = req
        const { id } = params

        await Service.findByIdAndDelete(id)

        return res.status(200).send({
            success: true,
            message: "Service Deleted Successfully",
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const handleFavorite = (async (req, res) => {
    try {

        const { params, decoded } = req
        const { id } = params

        let user = await User.findById(decoded.id)

        if (!user) {
            throw new Error(ERRORS.USER_NOTEXIST)
        }

        let favorite_services = await user.favorite_services.map(service => service.toString())

        if (favorite_services.includes(id)) {
            favorite_services = favorite_services.filter(service => service !== id)
        } else {
            favorite_services.push(id)
        }

        user.favorite_services = favorite_services
        await user.save()

        return res.status(200).send({
            success: true,
            message: "Favorite Services Updated Successfully",
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

//Admin
const getServices = (async (req, res) => {
    try {

        let { decoded, query } = req
        let { page, per_page, search, from, to, sortBy, categories } = query

        let options = paginationHandler(page, per_page)

        let filter = {}
        let sort = {
            createdAt: -1
        }
        let projection = {
            reviews: 0,
            user_favorite: 0
        }

        if (search) {
            filter = { ...filter, name: getSearchQuery(search) }
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (sortBy) {
            sort = { [sortBy]: 1 }
        }

        if (categories) {
            let categoryIds = [];
            if (Array.isArray(categories)) {
                categoryIds = categories;
            } else if (typeof categories === 'string') {
                categoryIds = categories.split(',');
            }
            if (categoryIds.length > 0) {
                filter.category = { $in: categoryIds.map(item => new mongoose.Types.ObjectId(item)) };
            }
        }

        let pipeline = [
            {
                $match: filter
            },
            // {
            //     $lookup: {
            //         from: "reviews",
            //         localField: "_id",
            //         foreignField: "service",
            //         as: "reviews"
            //     }
            // },
            // {
            //     $addFields: {
            //         rating: {
            //             $avg: "$reviews.rating"
            //         }
            //     }
            // },
            {
                $lookup: {
                    from: "categories",
                    localField: "category",
                    foreignField: "_id",
                    as: "category"
                }
            },
            {
                $unwind: {
                    path: "$category",
                    preserveNullAndEmptyArrays: true
                }
            }
        ]

        if (decoded?.id) {
            pipeline.push(
                {
                    $lookup: {
                        from: "users",
                        let: { service_id: "$_id" },
                        pipeline: [
                            {
                                $match: { _id: new mongoose.Types.ObjectId(decoded.id) }
                            },
                            {
                                $project: {
                                    _id: 0,
                                    is_favorite: { $in: ["$$service_id", "$favorite_services"] }
                                }
                            }
                        ],
                        as: "user_favorite"
                    }
                },
                {
                    $addFields: {
                        is_favorite: { $arrayElemAt: ["$user_favorite.is_favorite", 0] }
                    }
                }
            )
        } else {
            pipeline.push({
                $addFields: { is_favorite: false }
            })
        }

        pipeline.push({
            $project: projection
        }, {
            $sort: sort
        })

        if (options?.skip) {
            pipeline.push({ $skip: options.skip })
        }

        if (options?.limit) {
            pipeline.push({ $limit: options.limit })
        }

        pipeline.push({
            $addFields: {
                image_url: {
                    $cond: {
                        if: { $regexMatch: { input: "$image", regex: /^http/ } },
                        then: "$image",
                        else: { $concat: [process.env.BASE_URL, "$image"] }
                    }
                }
            }
        })

        const services = await Service.aggregate(pipeline);

        let total = await Service.countDocuments(filter)

        return res.status(200).send({
            success: true,
            total,
            data: services
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
    createService,
    getService,
    getServiceById,
    updateService,
    deleteService,
    handleFavorite,
    getServices
}