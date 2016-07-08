"use strict";
// Verifies if the cookie "auth" has the same value that the env variable AUTH_PASSWORD
function EnvironmentAuth(request, response, next) {
    if (process.env.AUTH_PASSWORD == undefined) {
        next();
    }
    else if (process.env.AUTH_PASSWORD === request.cookies.auth) {
        next();
    }
    else {
        response.status(401).send("Unauthorized!");
    }
    return;
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = EnvironmentAuth;
//# sourceMappingURL=environmentAuth.js.map