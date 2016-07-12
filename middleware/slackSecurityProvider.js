"use strict";
const Passport = require("passport");
const Slack = require("passport-slack");
class SlackSecurityProvider {
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
        }, function (accessToken, refreshToken, profile, done) {
            if (profile._json.url === slackTeamUrl) {
                done(null, profile);
            }
            else {
                done(new Error("Invalid team"));
            }
        }));
        this.authenticateMiddleware = Passport.authenticate("slack");
        this.authorizeMiddleware = (req, res, next) => {
            if (!req.isAuthenticated()) {
                res.redirect("/oauth/callback");
            }
            else {
                next();
            }
        };
    }
    getAuthorizeMiddleware() {
        return this.authorizeMiddleware;
    }
    getAuthenticateMiddleware() {
        return this.authenticateMiddleware;
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SlackSecurityProvider;
//# sourceMappingURL=slackSecurityProvider.js.map