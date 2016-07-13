"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const kwyjibo_1 = require("kwyjibo");
let Root = class Root {
    oauth(context) {
        context.response.redirect("/docker");
    }
};
__decorate([
    kwyjibo_1.Get("/"),
    kwyjibo_1.DocAction(`Redirect to docker controller`)
], Root.prototype, "oauth", null);
Root = __decorate([
    kwyjibo_1.Controller("/"),
    kwyjibo_1.DocController("Root controller.")
], Root);
//# sourceMappingURL=root.js.map