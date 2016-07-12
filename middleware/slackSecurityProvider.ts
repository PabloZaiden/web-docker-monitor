import {SecurityProvider} from "./securityProvider";
import * as Express from "express";
import * as Passport from "passport";
import * as Slack from "passport-slack";

export default class SlackSecurityProvider implements SecurityProvider {

    private authenticateMiddleware: Express.Handler;
    private authorizeMiddleware: Express.Handler;

    constructor() {
        let slackClientId = process.env.SLACK_CLIENT_ID;
        let slackClientSecret = process.env.SLACK_CLIENT_SECRET;
        let slackTeamUrl = process.env.SLACK_TEAM_URL;

        if (!slackClientId) {
            throw new Error("Missing SLACK_CLIENT_ID");
        }

        if (!slackClientSecret) {
            throw new Error("Missing SLACK_CLIENT_SECRET");
        }

        if (!slackTeamUrl) {
            throw new Error("Missing SLACK_TEAM_URL");
        }

        Passport.use(new Slack.Strategy({
            clientID: slackClientId,
            clientSecret: slackClientSecret,
            scope: "users:read",
        },
            function (accessToken, refreshToken, profile, done) {
                if (profile._json.url === slackTeamUrl) {
                    done(null, profile);
                } else {
                    done(new Error("Invalid team"));
                }
            }
        ));

        this.authenticateMiddleware = Passport.authenticate("slack");

        this.authorizeMiddleware = (req, res, next) => {
            if (!req.isAuthenticated()) {
                res.redirect("/oauth/callback");
            } else {
                next();
            }
        }


    }

    getAuthorizeMiddleware(): Express.Handler {
        return this.authorizeMiddleware;
    }

    getAuthenticateMiddleware(): Express.Handler {
        return this.authenticateMiddleware;
    }
}