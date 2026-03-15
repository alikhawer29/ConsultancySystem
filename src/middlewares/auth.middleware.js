const { verifyToken } = require('../helpers/token')

module.exports = {
    AuthVerifier: async (req, res, next) => {
        try {
            let token = req.get('Authorization')
            if (!token) {
                return res.status(401).send({ message: 'No token provided' })
            }

            token = token.split(' ')[1]
            if (!token) {
                return res.status(401).send({ message: 'Invalid token format' })
            }

            const decoded = await verifyToken(token)
            if (!decoded) {
                return res.status(401).send({ message: 'Invalid or expired token' })
            }

            req.decoded = decoded
            next()
        } catch (e) {
            console.error('AuthVerifier error:', e)
            return res.status(500).send({ message: 'Failed to authenticate token.' })
        }
    },
    OptionalAuthVerifier: async (req, res, next) => {
        try {
            let token = req.get('Authorization')
            if (!token) {
                return next()
            }

            token = token.split(' ')[1]
            if (!token) {
                return next()
            }

            try {
                const decoded = await verifyToken(token)
                if (decoded) {
                    req.decoded = decoded
                }
            } catch (err) {
            }

            return next()
        } catch (e) {
            console.error('OptionalAuthVerifier error:', e)
            return next()
        }
    },
    RestrictAccess: (allowedRoles) => async (req, res, next) => {
        try {
            if (!req.decoded || !allowedRoles.includes(req.decoded.role)) {
                return res.status(403).json({ message: "Access denied: Insufficient permissions" })
            }
            next()
        } catch (e) {
            console.error('RestrictAccess error:', e)
            res.status(500).json({ message: "An error occurred while verifying role" })
        }
    }
}
