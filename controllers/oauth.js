"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const kwyjibo_1 = require("kwyjibo");
const app_1 = require("../app");
let OAuth = class OAuth {
    oauth(context) {
        context.response.redirect("/");
    }
};
__decorate([
    kwyjibo_1.Get("/callback"),
    kwyjibo_1.ActionMiddleware(app_1.default.authenticateMiddleware),
    kwyjibo_1.DocAction(`oAuth callback`)
], OAuth.prototype, "oauth", null);
OAuth = __decorate([
    kwyjibo_1.Controller("/oauth"),
    kwyjibo_1.DocController("OAuth controller.")
], OAuth);
//# sourceMappingURL=oauth.js.map