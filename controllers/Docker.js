"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const kwyjibo_1 = require("kwyjibo");
const K = require("kwyjibo");
const Dockerode = require("dockerode");
const Parser = require("ansi-style-parser");
const Stream = require("stream");
const environmentAuth_1 = require("../middleware/environmentAuth");
let Docker = class Docker {
    constructor() {
        this.dockerAPI = undefined;
        this.dockerAPI = new Dockerode({ socketPath: "/var/run/docker.sock" });
    }
    handleError(context, error) {
        context.response.status(500).send(error);
    }
    authGet(context) {
        context.response.render('auth');
    }
    authPost(context) {
        let password = context.request.body.password;
        if (password != undefined) {
            context.response.cookie("auth", password);
        }
        context.response.redirect("/docker/containers");
    }
    containers(context) {
        this.dockerAPI.listContainers({ all: true }, (err, containers) => {
            if (err) {
                this.handleError(context, err);
                return;
            }
            context.response.render("containersList", { model: containers });
        });
    }
    start(context) {
        let id = context.request.query.id;
        if (id == undefined) {
            context.response.status(404).send("invalid id");
            return;
        }
        let container = this.dockerAPI.getContainer(id);
        container.start((err, stream) => {
            if (err) {
                this.handleError(context, err);
                return;
            }
            context.response.redirect("/docker/containers");
        });
    }
    logs(context) {
        let id = context.request.query.id;
        if (id == undefined) {
            context.response.status(404).send("invalid id");
            return;
        }
        let container = this.dockerAPI.getContainer(id);
        container.logs({
            timestamps: true,
            stdout: true,
            stderr: true,
            tty: false
        }, (err, stream) => {
            if (err) {
                this.handleError(context, err);
                return;
            }
            var data = "";
            var logStream = new Stream.PassThrough();
            logStream.on("data", chunk => {
                data += chunk;
            });
            stream.on("end", () => {
                stream.destroy();
                let parts = Parser(data);
                let html = "";
                for (let p of parts) {
                    html += p.text;
                }
                context.response.send("<html><body><pre>" + html + "</pre></body></html>");
            });
            this.dockerAPI.modem.demuxStream(stream, logStream, logStream);
        });
    }
};
__decorate([
    kwyjibo_1.Get("/auth"),
    kwyjibo_1.DocAction(`Add authentication cookie`)
], Docker.prototype, "authGet", null);
__decorate([
    kwyjibo_1.Post("/auth")
], Docker.prototype, "authPost", null);
__decorate([
    kwyjibo_1.DocAction(`Lists existing containers`),
    K.ActionMiddleware(environmentAuth_1.default)
], Docker.prototype, "containers", null);
__decorate([
    kwyjibo_1.DocAction(`Starts a container`),
    K.ActionMiddleware(environmentAuth_1.default)
], Docker.prototype, "start", null);
__decorate([
    kwyjibo_1.DocAction(`Shows the logs for the container with the id sent in the querystring`),
    K.ActionMiddleware(environmentAuth_1.default)
], Docker.prototype, "logs", null);
Docker = __decorate([
    kwyjibo_1.Controller("/docker"),
    kwyjibo_1.DocController("Docker operations controller.")
], Docker);
//# sourceMappingURL=Docker.js.map