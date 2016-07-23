import * as Express from "express";
import * as CookieParser from "cookie-parser";
import * as BodyParser from "body-parser";
import * as DebugModule from "debug";
import * as Http from "http";
import * as EJS from "ejs";
import * as Passport from "passport";
import Session = require("cookie-session");
import SlackSecurityProvider from "./middleware/slackSecurityProvider";
import {SecurityProvider} from "./middleware/securityProvider";
import * as K from "kwyjibo";

export default class App {

    private static port: number = App.normalizePort(process.env.port || "3000");
    private static server: Http.Server;
    private static express: Express.Express;
    private static isDevelopment = false;
    private static securityProvider: SecurityProvider;
   
    public static get authorize(): Express.Handler {
        if (process.env.DISABLE_AUTH) {
            return (req, res, next) => next();
        } else {
            return App.securityProvider.getAuthorizeMiddleware();
        }
    }

    public static get authenticate(): Express.Handler {
        return App.securityProvider.getAuthenticateMiddleware()
    }

    public static init(): void {
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
        
        let callbackUrl: string = process.env.SLACK_CALLBACK_URL;
        if (callbackUrl == undefined) {
            callbackUrl = "";
        }

        let isHttps = callbackUrl.toLowerCase().startsWith("https");

        App.express.use(Session({
            secureProxy: isHttps, 
            name: "session",
            secret: sessionSecret,
            httpOnly: true
        }));
        App.express.use(Passport.initialize());
        App.express.use(Passport.session());

        Passport.serializeUser(function (user, done) {
            done(null, user);
        });

        Passport.deserializeUser(function (user, done) {
            done(null, user);
        });

        App.express.set("view engine", "ejs");

        App.securityProvider = new SlackSecurityProvider("/oauth/callback");
    }


    private static loadSecurityProvider(securityProvider) {
        App.securityProvider = securityProvider;
    }

    public static start(): void {
        // Create HTTP server.
        App.server = Http.createServer(App.express);

        // Init all Kwyjibo controllers
        K.initialize(App.express);

        // Use custom errors
        App.express.use(App.OnRequestError);
        App.express.use(App.OnRequestNotFound);

        // Listen on provided port, on all network interfaces.
        App.express.set("port", App.port);
        App.server.listen(App.port);
        App.server.on("error", App.onError);
        App.server.on("listening", App.onListening);
    }

    private static OnRequestError(err: any, req: Express.Request, res: Express.Response, next: Function): void {
        if (err.name === "UnauthorizedError") {
            res.sendStatus(401);
        } else {
            if (App.isDevelopment) {
                res.statusCode = 500;
                if (err instanceof Error) {
                    console.error({ name: err.name, message: err.message, stack: err.stack });
                    res.json({ name: err.name, message: err.message });
                } else {
                    console.error(err);
                    res.json(err);
                }
            } else {
                res.sendStatus(500);
            }
        }
    }

    private static OnRequestNotFound(req: Express.Request, res: Express.Response, next: Function): void {
        res.sendStatus(404);
    }

    private static normalizePort(val): any {
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

    private static onError(error): void {

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

    private static onListening(): void {
        let addr = App.server.address();
        let bind = typeof addr === "string" ?
            "pipe " + addr :
            "port " + addr.port;

        if (App.isDevelopment) {
            console.log("Listening on " + bind);
        }
    }
}

App.init();
App.start();