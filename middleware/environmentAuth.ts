import * as Express from 'express';

// Verifies if the cookie "auth" has the same value that the env variable AUTH_PASSWORD
export default function EnvironmentAuth(request: Express.Request, response: Express.Response, next: Express.NextFunction): void {
    if (process.env.AUTH_PASSWORD == undefined) {
        next(); 
    } else if (process.env.AUTH_PASSWORD === request.cookies.auth) {
        next();
    } else {
        response.status(401).send("Unauthorized!");
    }

    return;
}