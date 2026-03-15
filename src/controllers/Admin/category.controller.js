const { default: mongoose } = require('mongoose')
const Category = require('../../models/category.model')
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery, ROLES, paginateResponse, normalize } = require('../../utils')
const ResponseHandler = require('../../utils/response')

const createCategory = (async (req, res) => {
    try {

        let { body, decoded, file } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let payload = {
            ...body,
            image: file ? normalize(file.path) : null
        }

        let category = new Category(payload)

        await category.save()

        return ResponseHandler.success(res, "Category Successfully Saved", category);

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
})

const getCategory = async (req, res) => {
    try {
        const { role } = req.decoded;
        let { page = 1, per_page = 10, search, from, to, sortBy, active } = req.query;

        const { limit, skip } = paginationHandler(page, per_page);

        let filter = {};
        let sort = {};

        if (search) {
            filter.name = getSearchQuery(search);
        }

        if (role === ROLES.USER) {
            filter.active = true;
        }

        if (req.query.hasOwnProperty("active") && active != null) {
            filter.active = active;
        }

        if (from || to) {
            filter.createdAt = getDateRangeQuery(from, to);
        }

        sort = sortBy ? { [sortBy]: 1 } : { createdAt: -1 };

        const categories = await Category.find(filter, {}, { skip, limit })
            .sort(sort)
            .lean();

        const total = await Category.countDocuments(filter);

        const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

        const paginated = paginateResponse({
            page: Number(page),
            per_page: Number(per_page),
            total,
            baseUrl,
            data: categories
        });

        return ResponseHandler.success(res, "Category listing retrieved successfully", paginated);

    } catch (e) {
        console.log("Error Message :: ", e);
        return ResponseHandler.error(res, e.message, 400);
    }
};


const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return ResponseHandler.error(res, "Invalid category ID format", 400);
        }

        // Use lean with virtuals enabled
        let category = await Category.findById(id).lean({ virtuals: true });

        if (!category) {
            throw new Error(ERRORS.CATEGORY_NOTEXIST)
        }

        return ResponseHandler.success(res, "Category retrieved successfully", category);

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
};



const updateCategory = async (req, res) => {
    try {
        const { body, params, file } = req;
        const { id } = params;

        let payload = { ...body };

        // Only update image if a new file is uploaded
        if (file) {
            payload.image = normalize(file.path);
        }

        let category = await Category.findByIdAndUpdate(id, { $set: payload }, { new: true }).lean({ virtuals: true });

        return ResponseHandler.success(res, "Category Updated Successfully", category);

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
};


const deleteCategory = (async (req, res) => {
    try {

        const { params } = req
        const { id } = params

        let category = await Category.findById(id)
        await category.trash()

        return ResponseHandler.success(res, "Category Deleted Successfully");

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
})

module.exports = {
    createCategory,
    getCategory,
    getCategoryById,
    updateCategory,
    deleteCategory
}