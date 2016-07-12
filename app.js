"use strict";
const Express = require("express");
const CookieParser = require("cookie-parser");
const BodyParser = require("body-parser");
const Http = require("http");
const Passport = require("passport");
const Session = require("express-session");
const slackSecurityProvider_1 = require("./middleware/slackSecurityProvider");
const kwyjibo_1 = require("kwyjibo");
class App {
    static get authorizeMiddleware() {
        return App.securityProvider.getAuthorizeMiddleware();
    }
    static get authenticateMiddleware() {
        return App.securityProvider.getAuthenticateMiddleware();
    }
    static init() {
        if (process.env.NODE_ENV === "development") {
            App.isDevelopment = true;
        }
        App.express = Express();
        App.express.use(BodyParser.json());
        App.express.use(BodyParser.urlencoded({ extended: false }));
        App.express.use(CookieParser());
        let sessionSecret = process.env.SESSION_SECRET;
        if (!sessionSecret) {
            throw new Error("Missing SESSION_SECRET");
        }
        App.express.use(Session({
            secret: sessionSecret,
            resave: false,
            saveUninitialized: true
        }));
        App.express.use(Passport.initialize());
        App.express.use(Passport.session());
        Passport.serializeUser(function (user, done) {
            done(null, user);
        });
        Passport.deserializeUser(function (user, done) {
            done(null, user);
        });
        App.express.set('view engine', 'ejs');
        App.loadSecurityProvider(new slackSecurityProvider_1.default());
    }
    static loadSecurityProvider(securityProvider) {
        App.securityProvider = securityProvider;
    }
    static start() {
        // Create HTTP server.
        App.server = Http.createServer(App.express);
        // Init all Kwyjibo controllers
        kwyjibo_1.addControllersToExpressApp(App.express);
        // Use custom errors
        App.express.use(App.OnRequestError);
        App.express.use(App.OnRequestNotFound);
        // Listen on provided port, on all network interfaces.
        App.express.set("port", App.port);
        App.server.listen(App.port);
        App.server.on("error", App.onError);
        App.server.on("listening", App.onListening);
    }
    static OnRequestError(err, req, res, next) {
        if (err.name === "UnauthorizedError") {
            res.sendStatus(401);
        }
        else {
            if (App.isDevelopment) {
                res.statusCode = 500;
                if (err instanceof Error) {
                    console.error({ name: err.name, message: err.message, stack: err.stack });
                    res.json({ name: err.name, message: err.message });
                }
                else {
                    console.error(err);
                    res.json(err);
                }
            }
            else {
                res.sendStatus(500);
            }
        }
    }
    static OnRequestNotFound(req, res, next) {
        res.sendStatus(404);
    }
    static normalizePort(val) {
        let port = parseInt(val, 10);
        if (isNaN(port)) {
            // named pipe
            return val;
        }
        if (port >= 0) {
            // port number
            return port;
        }
        return false;
    }
    static onError(error) {
        if (error.syscall !== "listen") {
            throw error;
        }
        let bind = typeof App.port === "string" ? ("Pipe " + App.port) : ("Port " + App.port);
        // handle specific listen errors with friendly messages
        switch (error.code) {
            case "EACCES":
                console.error(bind + " requires elevated privileges");
                process.exit(1);
                break;
            case "EADDRINUSE":
                console.error(bind + " is already in use");
                process.exit(1);
                break;
            default:
                throw error;
        }
    }
    static onListening() {
        let addr = App.server.address();
        let bind = typeof addr === "string" ?
            "pipe " + addr :
            "port " + addr.port;
        if (App.isDevelopment) {
            console.log("Listening on " + bind);
        }
    }
}
App.port = App.normalizePort(process.env.port || "3000");
App.isDevelopment = false;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
App.init();
// HACK: this must be done. Otherwise kwyjibo wont find the controllers
/* tslint:disable */
let controllers = require("require-all")({
    dirname: __dirname + "/controllers",
    excludeDirs: /^\.(git|svn)$/,
    recursive: true
});
/* tslint:enable */
App.start();
//# sourceMappingURL=app.js.map