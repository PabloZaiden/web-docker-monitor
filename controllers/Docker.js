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
const OS = require("os");
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
    ls(context) {
        let id = context.request.query.id;
        let path = context.request.query.path;
        if (id == undefined || path == undefined) {
            context.response.status(404).send("invalid id or path");
            return;
        }
        let container = this.dockerAPI.getContainer(id);
        container.exec({
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
            Cmd: ["ls", "-lap", path]
        }, (err, exec) => {
            if (err) {
                this.handleError(context, err);
                return;
            }
            exec.start((err, stream) => {
                if (err) {
                    this.handleError(context, err);
                    return;
                }
                this.readStream(stream, content => {
                    let model = {
                        path: path,
                        id: id,
                        entries: []
                    };
                    let lines = content.split(OS.EOL);
                    for (let line of lines) {
                        if (!line.startsWith("total")) {
                            let lastSpace = line.lastIndexOf(" ");
                            let info = line.substring(0, lastSpace);
                            let entryName = line.substring(lastSpace + 1);
                            let action = "";
                            let newPath = path + entryName;
                            if (entryName.endsWith("/")) {
                                action = "ls";
                            }
                            else {
                                action = "getArchive";
                            }
                            let link = `/docker/${action}?id=${id}&path=${path + entryName}`;
                            let entry = {
                                info: info,
                                name: entryName,
                                link: link
                            };
                            model.entries.push(entry);
                        }
                    }
                    context.response.render("fsList", model);
                });
            });
        });
    }
    getArchive(context) {
        let id = context.request.query.id;
        let path = context.request.query.path;
        if (id == undefined || path == undefined) {
            context.response.status(404).send("invalid id or path");
            return;
        }
        let container = this.dockerAPI.getContainer(id);
        container.getArchive({
            path: path
        }, (err, stream) => {
            if (err) {
                this.handleError(context, err);
                return;
            }
            let fileName = path.split("/").join("__");
            context.response.setHeader("Content-Type", "application/octet-stream");
            context.response.setHeader("Content-Disposition", `attachment; filename="${fileName}.tar"`);
            stream.pipe(context.response);
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
            this.readStream(stream, data => {
                let parts = Parser(data);
                let html = "";
                for (let p of parts) {
                    html += p.text;
                }
                context.response.send("<html><body><pre>" + html + "</pre></body></html>");
            });
        });
    }
    readStream(stream, callback) {
        var data = "";
        var finalStream = new Stream.PassThrough();
        finalStream.on("data", chunk => {
            data += chunk;
        });
        stream.on("end", () => {
            stream.destroy();
            callback(data);
        });
        this.dockerAPI.modem.demuxStream(stream, finalStream, finalStream);
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
    kwyjibo_1.DocAction(`Lists the content of a directory from a container`),
    K.ActionMiddleware(environmentAuth_1.default)
], Docker.prototype, "ls", null);
__decorate([
    kwyjibo_1.DocAction(`Gets the content of a file from a container`),
    K.ActionMiddleware(environmentAuth_1.default)
], Docker.prototype, "getArchive", null);
__decorate([
    kwyjibo_1.DocAction(`Shows the logs for the container with the id sent in the querystring`),
    K.ActionMiddleware(environmentAuth_1.default)
], Docker.prototype, "logs", null);
Docker = __decorate([
    kwyjibo_1.Controller("/docker"),
    kwyjibo_1.DocController("Docker operations controller.")
], Docker);
//# sourceMappingURL=Docker.js.map