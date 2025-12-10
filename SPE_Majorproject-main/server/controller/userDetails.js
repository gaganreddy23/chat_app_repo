// const getUserDetailsFromToken = require("../helpers/getUserDetailsFromToken")

// async function userDetails(request,response){
//     try {
//         const token = request.cookies.token || ""

//         const user = await getUserDetailsFromToken(token)

//         return response.status(200).json({
//             message : "user details",
//             data : user
//         })
//     } catch (error) {
//         return response.status(500).json({
//             message : error.message || error,
//             error : true
//         })
//     }
// }

// module.exports = userDetails

const getUserDetailsFromToken = require("../helpers/getUserDetailsFromToken")

async function userDetails(request, response) {
    try {
        // Extract token from the Authorization header
        const authHeader = request.headers['authorization']
        const token = authHeader && authHeader.split(' ')[1]  // 'Bearer <token>'

        if (!token) {
            return response.status(403).json({
                message: "Token not provided",
                error: true
            })
        }

        console.log("tokencheck", token)

        // Use the token to fetch user details
        const user = await getUserDetailsFromToken(token)

        return response.status(200).json({
            message: "User details fetched successfully",
            data: user
        })
    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true
        })
    }
}

module.exports = userDetails