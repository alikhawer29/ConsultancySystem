/**
 * Response Handler Utility for Node.js/Express
 * Centralized API response management for consistent responses
 */

class ResponseHandler {
    // HTTP status codes
    static HTTP_OK = 200;
    static HTTP_CREATED = 201;
    static HTTP_NO_CONTENT = 204;
    static HTTP_BAD_REQUEST = 400;
    static HTTP_UNAUTHORIZED = 401;
    static HTTP_FORBIDDEN = 403;
    static HTTP_NOT_FOUND = 404;
    static HTTP_CONFLICT = 409;
    static HTTP_VALIDATION_ERROR = 422;
    static HTTP_TOO_MANY_REQUESTS = 429;
    static HTTP_SERVER_ERROR = 500;

    /**
     * Send success response with data
     * @param {Object} res - Express response object
     * @param {string} message - Success message
     * @param {any} data - Response data
     * @param {number} statusCode - HTTP status code
     * @param {Object} meta - Additional metadata
     */
    static success(res, message, data = null, statusCode = this.HTTP_OK, meta = {}) {
        const response = {
            status: true,
            message: message,
            ...(data !== null && { detail: data }),
            ...(Object.keys(meta).length > 0 && { meta })
        };

        return res.status(statusCode).json(response);
    }

    /**
     * Send success response without message (only data)
     * @param {Object} res - Express response object
     * @param {any} data - Response data
     * @param {number} statusCode - HTTP status code
     */
    static successData(res, data, statusCode = this.HTTP_OK) {
        const response = {
            status: true,
            detail: data
        };

        return res.status(statusCode).json(response);
    }

    /**
     * Send success response without data (only message)
     * @param {Object} res - Express response object
     * @param {string} message - Success message
     * @param {number} statusCode - HTTP status code
     */
    static successMessage(res, message, statusCode = this.HTTP_OK) {
        const response = {
            status: true,
            message: message
        };

        return res.status(statusCode).json(response);
    }

    /**
     * Send error response with data
     * @param {Object} res - Express response object
     * @param {any} data - Error data
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code
     */
    static errorWithData(res, data, message, statusCode = this.HTTP_BAD_REQUEST) {
        const response = {
            status: false,
            message: message,
            detail: data
        };

        return res.status(statusCode).json(response);
    }

    /**
     * Send error response without data
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code
     */
    static error(res, message, statusCode = this.HTTP_BAD_REQUEST) {
        const response = {
            status: false,
            message: message
        };

        return res.status(statusCode).json(response);
    }

    /**
     * Send validation error response
     * @param {Object} res - Express response object
     * @param {Array} errors - Validation errors
     * @param {string} message - Error message
     */
    static validationError(res, errors, message = "Validation failed") {
        const response = {
            status: false,
            message: message,
            errors: errors
        };

        return res.status(this.HTTP_VALIDATION_ERROR).json(response);
    }

    /**
     * Send created response (201)
     * @param {Object} res - Express response object
     * @param {string} message - Success message
     * @param {any} data - Created resource data
     */
    static created(res, message, data = null) {
        return this.success(res, message, data, this.HTTP_CREATED);
    }

    /**
     * Send paginated response
     * @param {Object} res - Express response object
     * @param {string} message - Success message
     * @param {Array} data - Array of items
     * @param {Object} pagination - Pagination information
     */
    static paginated(res, message, data = [], pagination = {}) {
        const meta = {
            pagination: {
                page: pagination.page || 1,
                limit: pagination.limit || data.length,
                total: pagination.total || data.length,
                pages: pagination.pages || 1
            }
        };

        return this.success(res, message, data, this.HTTP_OK, meta);
    }

    /**
     * Send unauthorized response (401)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    static unauthorized(res, message = "Unauthorized access") {
        return this.error(res, message, this.HTTP_UNAUTHORIZED);
    }

    /**
     * Send forbidden response (403)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    static forbidden(res, message = "Forbidden") {
        return this.error(res, message, this.HTTP_FORBIDDEN);
    }

    /**
     * Send not found response (404)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    static notFound(res, message = "Resource not found") {
        return this.error(res, message, this.HTTP_NOT_FOUND);
    }

    /**
     * Send conflict response (409)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    static conflict(res, message = "Conflict occurred") {
        return this.error(res, message, this.HTTP_CONFLICT);
    }

    /**
     * Send server error response (500)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {Error} error - Original error object for logging
     */
    static serverError(res, message = "Internal server error", error = null) {
        // Log the actual error for debugging
        if (error) {
            console.error('Server Error:', {
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        }

        return this.error(res, message, this.HTTP_SERVER_ERROR);
    }

    /**
     * Send too many requests response (429)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {number} retryAfter - Seconds to retry after
     */
    static tooManyRequests(res, message = "Too many requests", retryAfter = 60) {
        res.setHeader('Retry-After', retryAfter);
        return this.error(res, message, this.HTTP_TOO_MANY_REQUESTS);
    }
}

module.exports = ResponseHandler;